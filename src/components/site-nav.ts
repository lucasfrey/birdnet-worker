import { currentRoute, type Route } from "../router";

interface NavLink {
    route: Route;
    href: string;
    label: string;
}

const LINKS: NavLink[] = [
    { route: "overview", href: "#/overview", label: "Overview" },
    { route: "daily", href: "#/daily", label: "Charts" },
];

/**
 * <site-nav> — top navigation bar. Highlights the link matching the current
 * hash route and updates itself on every `hashchange`.
 */
class SiteNav extends HTMLElement {
    private _onHashChange = (): void => this.updateActive();

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback(): void {
        this.shadowRoot!.innerHTML = `
      <style>
        :host { display: block; margin: 0 0 1rem; }
        nav {
          display: flex; gap: 4px;
          border-bottom: 2px solid #1a6;
        }
        a {
          padding: 8px 16px; text-decoration: none; color: #333;
          border: 1px solid transparent; border-bottom: none;
          border-radius: 6px 6px 0 0; font-weight: 500;
        }
        a:hover { background: #f0f7f2; color: #1a6; }
        a[aria-current="page"] {
          background: #1a6; color: #fff;
        }
      </style>
      <nav>
        ${LINKS.map(
            (l) => `<a href="${l.href}" data-route="${l.route}">${l.label}</a>`,
        ).join("")}
      </nav>
    `;
        window.addEventListener("hashchange", this._onHashChange);
        this.updateActive();
    }

    disconnectedCallback(): void {
        window.removeEventListener("hashchange", this._onHashChange);
    }

    private updateActive(): void {
        const active = currentRoute();
        for (const a of this.shadowRoot!.querySelectorAll("a")) {
            if (a.dataset.route === active) {
                a.setAttribute("aria-current", "page");
            } else {
                a.removeAttribute("aria-current");
            }
        }
    }
}

customElements.define("site-nav", SiteNav);
