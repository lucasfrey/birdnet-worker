import "./species-chart";
import "./detections-table";

/**
 * <daily-page> — pick a date range and view its species-by-hour chart and
 * detections. Drives the shared components through their date attributes.
 */
class DailyPage extends HTMLElement {
    connectedCallback(): void {
        const today = this.localDate(new Date());
        this.innerHTML = `
      <div class="date-bar" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label style="font-weight: 500;">
          From:
          <input id="start-date" type="date" max="${today}" value="${today}"
                 style="padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px;" />
        </label>
        <label style="font-weight: 500;">
          To:
          <input id="end-date" type="date" max="${today}" value="${today}"
                 style="padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px;" />
        </label>
        <span class="date-status" role="alert" hidden></span>
      </div>

      <h2>Species by Hour</h2>
      <species-chart start-date="${today}" end-date="${today}"></species-chart>

      <h2>Detections</h2>
      <detections-table start-date="${today}" end-date="${today}"></detections-table>
    `;

        const startInput = this.querySelector<HTMLInputElement>("#start-date")!;
        const endInput = this.querySelector<HTMLInputElement>("#end-date")!;
        const status = this.querySelector<HTMLElement>(".date-status")!;
        const chart = this.querySelector("species-chart")!;
        const table = this.querySelector("detections-table")!;

        const updateRange = (): void => {
            if (!startInput.value || !endInput.value) return;
            if (startInput.value > endInput.value) {
                status.textContent =
                    "The start date must be before the end date.";
                status.hidden = false;
                return;
            }
            status.hidden = true;
            chart.setAttribute("start-date", startInput.value);
            chart.setAttribute("end-date", endInput.value);
            table.setAttribute("start-date", startInput.value);
            table.setAttribute("end-date", endInput.value);
        };

        startInput.addEventListener("change", updateRange);
        endInput.addEventListener("change", updateRange);
    }

    private localDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
}

customElements.define("daily-page", DailyPage);
