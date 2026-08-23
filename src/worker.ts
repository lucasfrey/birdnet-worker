interface D1Result {
    results: Record<string, unknown>[];
}

interface D1Statement {
    bind(...values: unknown[]): D1Statement;
    all(): Promise<D1Result>;
    first<T>(): Promise<T | null>;
}

interface D1Database {
    prepare(query: string): D1Statement;
    batch(statements: D1Statement[]): Promise<unknown>;
}

interface R2Bucket {
    put(key: string, value: ReadableStream, options?: { httpMetadata?: { contentType: string } }): Promise<unknown>;
}

interface Fetcher {
    fetch(request: Request): Promise<Response>;
}

interface Env {
    DETECTIONS_DB: D1Database;
    MEDIA_BUCKET: R2Bucket;
    ASSETS: Fetcher;
    PI_UPLOAD_SECRET: string;
    CLIENT_ORIGIN?: string;
}

interface DetectionInput {
    date: string;
    time: string;
    sci_name: string;
    com_name: string;
    confidence: number;
    lat?: number | null;
    lon?: number | null;
    cutoff?: number | null;
    week?: number | null;
    sens?: number | null;
    overlap?: number | null;
    file_name?: string | null;
    audio_path?: string | null;
    spectrogram_path?: string | null;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const ALLOWED_MEDIA_TYPES = new Set([
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/flac",
    "audio/x-flac",
    "image/png",
]);

function corsHeaders(request: Request, env: Env): Headers {
    const headers = new Headers(JSON_HEADERS);
    headers.set(
        "access-control-allow-origin",
        env.CLIENT_ORIGIN || request.headers.get("origin") || "*",
    );
    headers.set("access-control-allow-headers", "Authorization, Content-Type");
    headers.set("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
    return headers;
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: corsHeaders(request, env),
    });
}

function authorized(request: Request, env: Env): boolean {
    return request.headers.get("authorization") === `Bearer ${env.PI_UPLOAD_SECRET}`;
}

function requiredText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function validDetection(value: unknown): value is DetectionInput {
    if (!value || typeof value !== "object") return false;
    const row = value as Partial<DetectionInput>;
    return (
        requiredText(row.date) &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
        requiredText(row.time) &&
        requiredText(row.sci_name) &&
        requiredText(row.com_name) &&
        typeof row.confidence === "number" &&
        Number.isFinite(row.confidence)
    );
}

function detectionParams(row: DetectionInput): unknown[] {
    return [
        row.date,
        row.time,
        row.sci_name,
        row.com_name,
        row.confidence,
        row.lat ?? null,
        row.lon ?? null,
        row.cutoff ?? null,
        row.week ?? null,
        row.sens ?? null,
        row.overlap ?? null,
        row.file_name ?? null,
        row.audio_path ?? null,
        row.spectrogram_path ?? null,
    ];
}

async function postDetections(request: Request, env: Env): Promise<Response> {
    if (!authorized(request, env)) {
        return json(request, env, { error: "Unauthorized" }, 401);
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return json(request, env, { error: "Request body must be valid JSON" }, 400);
    }

    const rows = Array.isArray(payload) ? payload : [payload];
    if (!rows.length || rows.some((row) => !validDetection(row))) {
        return json(
            request,
            env,
            {
                error: "Each detection requires date, time, sci_name, com_name, and numeric confidence",
            },
            400,
        );
    }

    try {
        const statements = rows.map((row) =>
            env.DETECTIONS_DB.prepare(
                `INSERT INTO detections
                 (date, time, sci_name, com_name, confidence, lat, lon, cutoff, week, sens, overlap, file_name, audio_path, spectrogram_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(...detectionParams(row as DetectionInput)),
        );
        await env.DETECTIONS_DB.batch(statements);
        return json(request, env, { inserted: rows.length }, 201);
    } catch (error) {
        return json(
            request,
            env,
            { error: error instanceof Error ? error.message : "Database error" },
            500,
        );
    }
}

function safeObjectKey(value: string): string | null {
    let key: string;
    try {
        key = decodeURIComponent(value);
    } catch {
        return null;
    }
    if (
        !key ||
        key.startsWith("/") ||
        key.includes("\\") ||
        key.split("/").some(
            (part) =>
                !part ||
                part === "." ||
                part === ".." ||
                /[\u0000-\u001f]/.test(part),
        )
    ) {
        return null;
    }
    return key;
}

async function putMedia(
    request: Request,
    env: Env,
    keyPart: string,
): Promise<Response> {
    if (!authorized(request, env)) {
        return json(request, env, { error: "Unauthorized" }, 401);
    }
    const key = safeObjectKey(keyPart);
    const contentType =
        request.headers.get("content-type")?.split(";", 1)[0].toLowerCase() || "";
    if (!key) return json(request, env, { error: "Invalid object path" }, 400);
    if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
        return json(request, env, { error: "Unsupported media type" }, 415);
    }
    if (!request.body) {
        return json(request, env, { error: "Request body is empty" }, 400);
    }
    await env.MEDIA_BUCKET.put(key, request.body, {
        httpMetadata: { contentType },
    });
    return json(request, env, { path: key }, 201);
}

function dateFilters(url: URL): { sql: string; values: string[] } {
    const date = url.searchParams.get("date");
    const start = url.searchParams.get("start_date") || date;
    const end = url.searchParams.get("end_date") || date || start;
    if (!start) return { sql: "", values: [] };
    return {
        sql: " WHERE date >= ? AND date <= ?",
        values: [start, end || start],
    };
}

async function getDetections(
    request: Request,
    env: Env,
    url: URL,
): Promise<Response> {
    const filters = dateFilters(url);
    if (!filters.values.length) {
        return json(request, env, { error: "date is required" }, 400);
    }
    const search = url.searchParams.get("search")?.trim();
    const clauses = [filters.sql.replace(" WHERE", "")];
    const values: unknown[] = [...filters.values];
    if (search) {
        clauses.push("(com_name LIKE ? OR sci_name LIKE ?)");
        values.push(`%${search}%`, `%${search}%`);
    }
    const offset = Math.max(
        0,
        Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
    );
    const limit = Math.min(
        100,
        Math.max(
            1,
            Number.parseInt(url.searchParams.get("limit") || "40", 10) || 40,
        ),
    );
    const statement = env.DETECTIONS_DB.prepare(
        `SELECT date, time, com_name, sci_name, confidence, lat, lon, cutoff, week, sens, overlap, file_name, audio_path, spectrogram_path
         FROM detections WHERE ${clauses.join(" AND ")} ORDER BY date DESC, time DESC LIMIT ? OFFSET ?`,
    ).bind(...values, limit, offset);
    const result = await statement.all();
    return json(request, env, { data: result.results, offset, limit });
}

async function getSpecies(
    request: Request,
    env: Env,
    url: URL,
): Promise<Response> {
    const filters = dateFilters(url);
    if (!filters.values.length) {
        return json(request, env, { error: "date is required" }, 400);
    }
    const result = await env.DETECTIONS_DB.prepare(
        `SELECT com_name, sci_name, time FROM detections${filters.sql} ORDER BY date DESC, time DESC LIMIT 10000`,
    )
        .bind(...filters.values)
        .all();
    return json(request, env, { data: result.results });
}

async function getStats(request: Request, env: Env, url: URL): Promise<Response> {
    const today = url.searchParams.get("date");
    if (!today) return json(request, env, { error: "date is required" }, 400);
    const total = await env.DETECTIONS_DB.prepare(
        "SELECT COUNT(*) AS count, COUNT(DISTINCT sci_name) AS species FROM detections",
    ).first<{ count: number; species: number }>();
    const todayStats = await env.DETECTIONS_DB.prepare(
        "SELECT COUNT(*) AS count, COUNT(DISTINCT sci_name) AS species FROM detections WHERE date = ?",
    ).bind(today).first<{ count: number; species: number }>();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourDate = hourAgo.toISOString().slice(0, 10);
    const hourTime = hourAgo.toISOString().slice(11, 19);
    const lastHour = await env.DETECTIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM detections WHERE date = ? AND time >= ?",
    ).bind(hourDate, hourTime).first<{ count: number }>();
    return json(request, env, {
        total: Number(total?.count || 0),
        today: Number(todayStats?.count || 0),
        lastHour: Number(lastHour?.count || 0),
        speciesTotal: Number(total?.species || 0),
        speciesToday: Number(todayStats?.species || 0),
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request, env),
            });
        }
        try {
            if (request.method === "POST" && url.pathname === "/detections") {
                return postDetections(request, env);
            }
            if (request.method === "GET" && url.pathname === "/detections") {
                return getDetections(request, env, url);
            }
            if (request.method === "GET" && url.pathname === "/species") {
                return getSpecies(request, env, url);
            }
            if (request.method === "GET" && url.pathname === "/stats") {
                return getStats(request, env, url);
            }
            if (
                request.method === "PUT" &&
                url.pathname.startsWith("/media/")
            ) {
                return putMedia(
                    request,
                    env,
                    url.pathname.slice("/media/".length),
                );
            }
            return env.ASSETS.fetch(request);
        } catch (error) {
            return json(
                request,
                env,
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Internal server error",
                },
                500,
            );
        }
    },
};
