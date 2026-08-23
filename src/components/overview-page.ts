import "./species-chart";
import "./detections-table";
import "./stats-banner";

/**
 * <overview-page> — the default landing page: today's species-by-hour chart
 * and today's detections list.
 */
class OverviewPage extends HTMLElement {
    connectedCallback(): void {
        this.innerHTML = `
      <stats-banner></stats-banner>
      <h2>Species by Hour</h2>
      <species-chart></species-chart>

      <h2>Today's Detections</h2>
      <detections-table></detections-table>
    `;
    }
}

customElements.define("overview-page", OverviewPage);
