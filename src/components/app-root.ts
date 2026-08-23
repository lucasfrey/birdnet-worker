import "./site-nav";
import "./overview-page";
import "./daily-page";
import { currentRoute } from "../router";

/**
 * <app-root> — renders the nav and swaps the active page based on the hash
 * route (`#/overview` or `#/daily`). A minimal hash router keeps the app
 * dependency-free.
 */
class AppRoot extends HTMLElement {
    private main!: HTMLElement;
    private _onHashChange = (): void => this.render();

    connectedCallback(): void {
        this.innerHTML = `
      <site-nav></site-nav>
      <main></main>
    `;
        this.main = this.querySelector("main")!;
        window.addEventListener("hashchange", this._onHashChange);
        this.render();
    }

    disconnectedCallback(): void {
        window.removeEventListener("hashchange", this._onHashChange);
    }

    private render(): void {
        const tag = currentRoute() === "daily" ? "daily-page" : "overview-page";
        // Skip re-rendering when the active page is already mounted.
        if (this.main.firstElementChild?.tagName.toLowerCase() === tag) return;
        this.main.replaceChildren(document.createElement(tag));
    }
}

customElements.define("app-root", AppRoot);
