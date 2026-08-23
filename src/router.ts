// Hash routes shared across the app. Keeping them here avoids magic strings
// scattered through the nav and router.
export type Route = "overview" | "daily";

export const DEFAULT_ROUTE: Route = "overview";

/** Parse the current location hash into a known route. */
export function currentRoute(): Route {
    const name = location.hash.replace(/^#\/?/, "");
    return name === "daily" ? "daily" : DEFAULT_ROUTE;
}
