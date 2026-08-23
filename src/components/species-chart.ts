import { supabase } from "../supabase";

const ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/** Escape untrusted text before injecting into innerHTML. */
function esc(value: unknown): string {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface ChartRow {
    com_name: string;
    sci_name: string;
    time: string;
}

interface SpeciesEntry {
    name: string;
    total: number;
    hours: number[];
}

/**
 * <species-chart> — table version of the BirdNET-Pi "Combo" chart.
 * Rows are species ordered by the selected range's total detections (most first). Columns
 * are the total count plus a per-hour grid (0–23), mirroring the bar chart +
 * hour-of-day heatmap. Hourly cells are lightly shaded by count.
 */
class SpeciesChart extends HTMLElement {
    static get observedAttributes(): string[] {
        return ["date", "start-date", "end-date"];
    }

    private _ready = false;
    private statusEl!: HTMLElement;
    private scrollEl!: HTMLElement;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    private get startDate(): string {
        return (
            this.getAttribute("start-date") ||
            this.getAttribute("date") ||
            new Date().toISOString().slice(0, 10)
        );
    }

    private get endDate(): string {
        return (
            this.getAttribute("end-date") ||
            this.getAttribute("date") ||
            this.startDate
        );
    }

    connectedCallback(): void {
        const root = this.shadowRoot!;
        root.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, sans-serif; }
        .status { padding: 8px; color: #666; }
        .scroll { overflow-x: auto; }
        table { border-collapse: collapse; font-size: 13px; }
        th, td { padding: 4px 6px; border: 1px solid #e0e0e0; text-align: center; }
        th { background: #f4f4f4; }
        .species { text-align: left; white-space: nowrap; position: sticky; left: 0; background: #fff; }
        .total { font-weight: bold; background: #fafafa; }
        .hour-now { color: #c60; font-weight: bold; }
        td.count { color: #063; }
        td.empty { color: transparent; }
      </style>
      <div class="status" hidden></div>
      <div class="scroll"></div>
    `;
        this.statusEl = root.querySelector(".status")!;
        this.scrollEl = root.querySelector(".scroll")!;
        this._ready = true;
        this.load();
    }

    attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
    ): void {
        if (
            ["date", "start-date", "end-date"].includes(name) &&
            oldValue !== newValue &&
            this._ready
        ) {
            this.load();
        }
    }

    setStatus(message: string): void {
        if (message) {
            this.statusEl.textContent = message;
            this.statusEl.hidden = false;
        } else {
            this.statusEl.hidden = true;
        }
    }

    async load(): Promise<void> {
        this.setStatus("Loading…");
        const { data, error } = await supabase
            .from("detections")
            .select("com_name, sci_name, time")
            .gte("date", this.startDate)
            .lte("date", this.endDate)
            .limit(5000);

        if (error) {
            this.setStatus(`Error loading chart: ${error.message}`);
            return;
        }
        const rows = (data ?? []) as ChartRow[];
        if (!rows.length) {
            this.setStatus("No detections for this date range.");
            this.scrollEl.innerHTML = "";
            return;
        }

        this.setStatus("");
        this.render(this.aggregate(rows));
    }

    /** Build per-species totals and hourly counts, ordered by total desc. */
    aggregate(rows: ChartRow[]): SpeciesEntry[] {
        const species = new Map<string, SpeciesEntry>();
        for (const r of rows) {
            let entry = species.get(r.sci_name);
            if (!entry) {
                entry = {
                    name: r.com_name,
                    total: 0,
                    hours: new Array(24).fill(0),
                };
                species.set(r.sci_name, entry);
            }
            const hour = parseInt(String(r.time).slice(0, 2), 10);
            if (!Number.isNaN(hour)) entry.hours[hour] += 1;
            entry.total += 1;
        }
        return [...species.values()].sort((a, b) => b.total - a.total);
    }

    render(list: SpeciesEntry[]): void {
        const isToday =
            this.startDate === this.endDate &&
            this.startDate === new Date().toISOString().slice(0, 10);
        const nowHour = isToday ? new Date().getHours() : -1;
        const maxHourCount = Math.max(1, ...list.flatMap((s) => s.hours));

        const headerCells = HOURS.map(
            (h) => `<th class="${h === nowHour ? "hour-now" : ""}">${h}</th>`,
        ).join("");

        const bodyRows = list
            .map((s) => {
                const hourCells = s.hours
                    .map((count) => {
                        if (!count) return `<td class="empty">0</td>`;
                        const intensity = 0.12 + 0.6 * (count / maxHourCount);
                        return `<td class="count" style="background: rgba(16,140,60,${intensity.toFixed(
                            2,
                        )})">${count}</td>`;
                    })
                    .join("");
                return `
          <tr>
            <td class="species">${esc(s.name)}</td>
            <td class="total">${s.total}</td>
            ${hourCells}
          </tr>`;
            })
            .join("");

        this.scrollEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th class="species">Species</th>
            <th>Total</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
    }
}

customElements.define("species-chart", SpeciesChart);
