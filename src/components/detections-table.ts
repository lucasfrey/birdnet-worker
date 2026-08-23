import { getDetections, mediaUrl, type DetectionRow } from "../api";
import { getBirdThumbnail } from "../wikipedia";

const PAGE = 40;

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

/**
 * <detections-table> — read-only mirror of the BirdNET-Pi "detections_table".
 * Lists a day's detections from Supabase, newest first, with search and
 * "Load 40 More" pagination. Defaults to today; set `start-date` and
 * `end-date` attributes (YYYY-MM-DD) to show a date range.
 */
class DetectionsTable extends HTMLElement {
    static get observedAttributes(): string[] {
        return ["date", "start-date", "end-date"];
    }

    private _ready = false;
    private offset = 0;
    private search = "";
    private _searchTimer: ReturnType<typeof setTimeout> | null = null;
    private tbody!: HTMLTableSectionElement;
    private moreBtn!: HTMLButtonElement;
    private statusEl!: HTMLElement;

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
        .toolbar { margin-bottom: 8px; }
        input {
          padding: 6px 8px; width: 220px; box-sizing: border-box;
          border: 1px solid #bbb; border-radius: 4px;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: middle; }
        th { border-bottom: 2px solid #999; }
        .conf { font-weight: bold; white-space: nowrap; }
        .photo { width: 64px; }
        .photo img {
          width: 56px; height: 56px; object-fit: cover;
          border-radius: 4px; background: #eee; display: block;
        }
        .info { text-align: center; }
        .info a { display: inline-flex; color: #888; }
        .info a:hover { color: #1a6; text-decoration: none; }
        a { color: #1a6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .status { padding: 8px; color: #666; }
        button {
          margin-top: 12px; padding: 8px 16px; cursor: pointer;
          border: 1px solid #999; border-radius: 4px; background: #f4f4f4;
        }
        button:hover { background: #e8e8e8; }
      </style>
      <div class="toolbar">
        <input type="search" placeholder="Search..." aria-label="Search detections" />
      </div>
      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Time</th>
            <th>Common Name</th>
            <th>Scientific Name</th>
            <th>Confidence</th>
            <th>Media</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="status" hidden></div>
      <button class="more" hidden>Load 40 More…</button>
    `;

        this.tbody = root.querySelector("tbody")!;
        this.moreBtn = root.querySelector(".more")!;
        this.statusEl = root.querySelector(".status")!;

        root.querySelector("input")!.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value.trim();
            if (this._searchTimer) clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => {
                this.search = value;
                this.reset();
            }, 250);
        });

        this.moreBtn.addEventListener("click", () => this.load());

        this._ready = true;
        this.reset();
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
            this.reset();
        }
    }

    reset(): void {
        this.offset = 0;
        this.tbody.innerHTML = "";
        this.moreBtn.hidden = true;
        this.setStatus("Loading…");
        this.load();
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
        try {
            const { data } = await getDetections(
                this.startDate,
                this.endDate,
                this.offset,
                this.search,
                PAGE,
            );
            const rows = data ?? [];
            this.render(rows);
            this.offset += rows.length;
            this.moreBtn.hidden = rows.length < PAGE;

            this.setStatus(
                this.offset === 0 ? "No detections for this date range." : "",
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.setStatus(`Error loading detections: ${message}`);
            return;
        }
    }

    render(rows: DetectionRow[]): void {
        for (const d of rows) {
            const wikiUrl = `https://wikipedia.org/wiki/${encodeURIComponent(
                String(d.sci_name).replace(/ /g, "_"),
            )}`;
            const infoSlug = String(d.com_name)
                .replace(/'/g, "")
                .replace(/ /g, "_");
            const infoUrl = `https://allaboutbirds.org/guide/${encodeURIComponent(
                infoSlug,
            )}`;
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td class="photo"></td>
        <td>${esc(d.time)}</td>
        <td><a href="${wikiUrl}" target="_blank" rel="noopener">${esc(d.com_name)}</a></td>
        <td><i>${esc(d.sci_name)}</i></td>
        <td class="conf">${Math.round(Number(d.confidence) * 100)}%</td>
        <td class="media"></td>
        <td class="info">
          <a href="${infoUrl}" target="_blank" rel="noopener" title="All About Birds" aria-label="All About Birds">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </a>
        </td>
      `;
            this.tbody.appendChild(tr);
            this.loadThumbnail(tr.querySelector(".photo")!, d);
            this.renderMedia(tr.querySelector(".media")!, d);
        }
    }

    renderMedia(cell: Element, d: DetectionRow): void {
        const audio = mediaUrl(d.audio_path);
        const spectrogram = mediaUrl(d.spectrogram_path);
        if (audio) {
            const player = document.createElement("audio");
            player.controls = true;
            player.preload = "none";
            player.src = audio;
            player.title = `Play ${d.com_name}`;
            cell.appendChild(player);
        }
        if (spectrogram) {
            const image = document.createElement("img");
            image.src = spectrogram;
            image.alt = `${d.com_name} spectrogram`;
            image.loading = "lazy";
            image.width = 120;
            cell.appendChild(image);
        }
    }

    async loadThumbnail(cell: Element, d: DetectionRow): Promise<void> {
        const src = await getBirdThumbnail(d.sci_name);
        if (!src) return;
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = d.com_name;
        img.src = src;
        cell.appendChild(img);
    }
}

customElements.define("detections-table", DetectionsTable);
