import { MapViewer } from "./components/MapViewer";
import { StatsDashboard } from "./components/StatsDashboard";
import { TripList } from "./components/TripList";
import { StatsPayload } from "./types/schema";

async function bootstrap() {
  const routesUrl = "./data/routes.geojson";
  const stationsUrl = "./data/stations.geojson";
  const statsUrl = "./data/stats.json";

  try {
    // 1. Fetch Stats & GeoJSON Data
    const [statsRes, routesRes, stationsRes] = await Promise.all([
      fetch(statsUrl),
      fetch(routesUrl),
      fetch(stationsUrl),
    ]);
    if (!statsRes.ok)
      throw new Error(`HTTP ${statsRes.status} when loading stats.json`);
    if (!routesRes.ok)
      throw new Error(`HTTP ${routesRes.status} when loading routes.geojson`);
    if (!stationsRes.ok)
      throw new Error(
        `HTTP ${stationsRes.status} when loading stations.geojson`,
      );

    const stats: StatsPayload = await statsRes.json();
    const routesData = await routesRes.json();
    const stationsData = await stationsRes.json();

    // 2. Initialize Map Viewer
    const mapViewer = new MapViewer("map-container");
    mapViewer.init(routesData, stationsData);

    // 3. Initialize Dashboard Charts & KPIs
    const dashboard = new StatsDashboard();
    dashboard.init(stats);

    // 4. Initialize Trip Cards List
    const tripList = new TripList("trips-grid");
    tripList.init(stats.trips);

    // 5. Populate Year Filter Options
    const yearSelect = document.getElementById(
      "filter-year",
    ) as HTMLSelectElement;
    const typeSelect = document.getElementById(
      "filter-type",
    ) as HTMLSelectElement;

    if (yearSelect) {
      const years = Object.keys(stats.yearly).sort().reverse();
      years.forEach((yr) => {
        const opt = document.createElement("option");
        opt.value = yr;
        opt.innerText = `${yr} 年`;
        yearSelect.appendChild(opt);
      });
    }

    const applyFilter = () => {
      const selectedYear = yearSelect ? yearSelect.value : "all";
      const selectedType = typeSelect ? typeSelect.value : "all";

      tripList.filter(selectedYear, selectedType);
      mapViewer.filterType(selectedType as "all" | "flight" | "train");
    };

    yearSelect?.addEventListener("change", applyFilter);
    typeSelect?.addEventListener("change", applyFilter);
  } catch (error) {
    console.error("Failed to initialize TripTracker:", error);
    const container = document.getElementById("trips-grid");
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">
          数据加载失败，请确保已运行 C++ 数据生成引擎并生成静态数据文件。<br/>
          错误信息: ${error}
        </div>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
