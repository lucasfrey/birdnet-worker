import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.ts";

const row = {
    date: "2026-08-23",
    time: "12:34:56",
    sci_name: "Turdus merula",
    com_name: "Blackbird",
    confidence: 0.91,
    audio_path: "2026/08/23/black bird.wav",
    spectrogram_path: "2026/08/23/black bird.png",
};

function environment(results: Record<string, unknown>[] = []) {
    const batches: unknown[][] = [];
    const puts: { key: string; type: string }[] = [];
    const db = {
        prepare: (query: string) => ({
            bind: (...values: unknown[]) => ({
                query,
                values,
                all: async () => ({ results }),
                first: async () => ({ count: 1, species: 1 }),
            }),
        }),
        batch: async (statements: unknown[]) => {
            batches.push(statements);
        },
    };
    const env = {
        DETECTIONS_DB: db,
        MEDIA_BUCKET: {
            put: async (
                key: string,
                _body: ReadableStream,
                options: { httpMetadata: { contentType: string } },
            ) => {
                puts.push({ key, type: options.httpMetadata.contentType });
            },
        },
        ASSETS: { fetch: async () => new Response("asset") },
        PI_UPLOAD_SECRET: "test-secret",
        CLIENT_ORIGIN: "https://client.example.com",
    };
    return { env, batches, puts };
}

test("rejects unauthorized detection POST", async () => {
    const { env } = environment();
    const response = await worker.fetch(
        new Request("https://worker.test/detections", {
            method: "POST",
            body: JSON.stringify(row),
        }),
        env,
    );
    assert.equal(response.status, 401);
});

test("inserts a valid detection and persists media paths", async () => {
    const { env, batches } = environment();
    const response = await worker.fetch(
        new Request("https://worker.test/detections", {
            method: "POST",
            headers: {
                Authorization: "Bearer test-secret",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(row),
        }),
        env,
    );
    assert.equal(response.status, 201);
    assert.equal(batches.length, 1);
    const statement = (batches[0] as { values: unknown[] }[])[0];
    assert.equal(statement.values.at(-2), row.audio_path);
    assert.equal(statement.values.at(-1), row.spectrogram_path);
});

test("requires authorization for media uploads", async () => {
    const { env } = environment();
    const response = await worker.fetch(
        new Request("https://worker.test/media/a.wav", {
            method: "PUT",
            headers: { "Content-Type": "audio/wav" },
            body: "audio",
        }),
        env,
    );
    assert.equal(response.status, 401);
});

test("uploads authorized media and rejects traversal", async () => {
    const { env, puts } = environment();
    const response = await worker.fetch(
        new Request("https://worker.test/media/2026/bird%20song.wav", {
            method: "PUT",
            headers: {
                Authorization: "Bearer test-secret",
                "Content-Type": "audio/wav",
            },
            body: "audio",
        }),
        env,
    );
    assert.equal(response.status, 201);
    assert.deepEqual(puts[0], {
        key: "2026/bird song.wav",
        type: "audio/wav",
    });

    const invalid = await worker.fetch(
        new Request("https://worker.test/media//secret.wav", {
            method: "PUT",
            headers: {
                Authorization: "Bearer test-secret",
                "Content-Type": "audio/wav",
            },
            body: "audio",
        }),
        env,
    );
    assert.equal(invalid.status, 400);
});

test("GET detections returns media paths", async () => {
    const { env } = environment([row]);
    const response = await worker.fetch(
        new Request("https://worker.test/detections?date=2026-08-23"),
        env,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: typeof row[] };
    assert.equal(body.data[0].audio_path, row.audio_path);
    assert.equal(body.data[0].spectrogram_path, row.spectrogram_path);
});
