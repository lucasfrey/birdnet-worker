export interface DetectionRow {
    date: string;
    time: string;
    com_name: string;
    sci_name: string;
    confidence: number;
    audio_path?: string | null;
    spectrogram_path?: string | null;
}

export interface ChartRow {
    com_name: string;
    sci_name: string;
    time: string;
}

const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
export const mediaBase = (import.meta.env.VITE_R2_PUBLIC_BASE || "").replace(/\/$/, "");

async function get<T>(
    path: string,
    params: Record<string, string | number | undefined>,
): Promise<T> {
    const url = new URL(`${apiBase}${path}`, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url);
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) {
        throw new Error(body.error || `Request failed (${response.status})`);
    }
    return body;
}

export async function getDetections(
    startDate: string,
    endDate: string,
    offset = 0,
    search = "",
    limit = 40,
): Promise<{ data: DetectionRow[] }> {
    return get<{ data: DetectionRow[] }>("/detections", {
        start_date: startDate,
        end_date: endDate,
        offset,
        search: search || undefined,
        limit,
    });
}

export async function getSpecies(
    startDate: string,
    endDate: string,
): Promise<{ data: ChartRow[] }> {
    return get<{ data: ChartRow[] }>("/species", {
        start_date: startDate,
        end_date: endDate,
    });
}

export interface Stats {
    total: number;
    today: number;
    lastHour: number;
    speciesTotal: number;
    speciesToday: number;
}

export async function getStats(today: string): Promise<Stats> {
    return get<Stats>("/stats", { date: today });
}

export function mediaUrl(path: string | null | undefined): string | null {
    if (!path || !mediaBase) return null;
    return `${mediaBase}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
