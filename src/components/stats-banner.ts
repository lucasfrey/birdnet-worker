import { getStats } from "../api";

interface Stat {
    label: string;
    value: string;
}

class StatsBanner extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback(): void {
        this.renderStatus("Loading statistics...");
        this.load();
    }

    private localDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private async load(): Promise<void> {
        const now = new Date();
        const today = this.localDate(now);
        try {
            const stats = await getStats(today);

            this.render([
                { label: "Total", value: stats.total.toLocaleString() },
                { label: "Today", value: stats.today.toLocaleString() },
                { label: "Last Hour", value: stats.lastHour.toLocaleString() },
                {
                    label: "Species Total",
                    value: stats.speciesTotal.toLocaleString(),
                },
                {
                    label: "Species Today",
                    value: stats.speciesToday.toLocaleString(),
                },
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.renderStatus(`Unable to load statistics: ${message}`);
        }
    }

    private renderStatus(message: string): void {
        this.shadowRoot!.innerHTML = `
      <style>${this.styles()}</style>
      <p class="status">${message}</p>
    `;
    }

    private render(stats: Stat[]): void {
        this.shadowRoot!.innerHTML = `
      <style>${this.styles()}</style>
      <section aria-label="Detection summary">
        ${stats
            .map(
                (stat) => `
          <div class="stat">
            <span class="label">${stat.label}</span>
            <strong>${stat.value}</strong>
          </div>
        `,
            )
            .join("")}
      </section>
    `;
    }

    private styles(): string {
        return `
      :host { display: block; margin: 0 0 2rem; }
      section {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        border: 1px solid #d6e1da;
        border-radius: 8px;
        overflow: hidden;
        background: #f7faf8;
      }
      .stat {
        min-width: 0;
        padding: 16px 18px;
        border-right: 1px solid #d6e1da;
      }
      .stat:last-child { border-right: 0; }
      .label {
        display: block;
        margin-bottom: 8px;
        color: #587064;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      strong { color: #173d2b; font-size: 1.65rem; line-height: 1; }
      .status { margin: 0; padding: 16px; color: #66756d; }
      @media (max-width: 680px) {
        section { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .stat:nth-child(2n) { border-right: 0; }
        .stat:nth-child(-n + 3) { border-bottom: 1px solid #d6e1da; }
        .stat:last-child { grid-column: 1 / -1; }
      }
    `;
    }
}

customElements.define("stats-banner", StatsBanner);
