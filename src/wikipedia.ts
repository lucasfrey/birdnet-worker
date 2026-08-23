// Fetches bird thumbnails from the Wikipedia REST API by scientific name.
// Results are cached in memory (per species) for the page session, so each
// species is only requested once regardless of how many detections it has.

const cache = new Map<string, Promise<string | null>>();

interface WikipediaSummary {
    thumbnail?: { source?: string };
}

/**
 * Return a thumbnail image URL for a scientific name, or null if none found.
 */
export function getBirdThumbnail(sciName: string): Promise<string | null> {
    if (!sciName) return Promise.resolve(null);
    const cached = cache.get(sciName);
    if (cached) return cached;

    const title = encodeURIComponent(sciName.replace(/ /g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;

    const promise = fetch(url, { headers: { Accept: "application/json" } })
        .then((res) =>
            res.ok ? (res.json() as Promise<WikipediaSummary>) : null,
        )
        .then((data) => data?.thumbnail?.source ?? null)
        .catch(() => null);

    cache.set(sciName, promise);
    return promise;
}
