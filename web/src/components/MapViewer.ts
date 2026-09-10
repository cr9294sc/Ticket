// MapViewer: MapLibre GL JS integration with route arcs, dashed rail, and clustered stations

declare const maplibregl: any;

export class MapViewer {
  private map: any = null;
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  public init(routesData: any, stationsData: any) {
    // Standard Dark Matter map style (Carto CDN, tokenless, fast)
    const styleUrl =
      "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: styleUrl,
      center: [108.0, 34.0], // Centered on East Asia
      zoom: 3.5,
      pitch: 20,
      maxPitch: 60,
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    this.map.addControl(new maplibregl.FullscreenControl(), "top-right");

    this.map.on("error", (e: any) => {
      console.warn("MapLibre warning/error:", e);
    });

    this.map.on("load", async () => {
      // 1. Add Routes Source & Layers
      this.map.addSource("routes", {
        type: "geojson",
        data: routesData,
      });

      // Flight route glow background
      this.map.addLayer({
        id: "routes-flight-glow",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "type"], "flight"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 4.5,
          "line-opacity": 0.35,
          "line-blur": 3,
        },
      });

      // Flight route primary line
      this.map.addLayer({
        id: "routes-flight-line",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "type"], "flight"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 2,
          "line-opacity": 0.85,
        },
      });

      // Train route dashed line
      this.map.addLayer({
        id: "routes-train-line",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "type"], "train"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#fb923c",
          "line-width": 2.5,
          "line-opacity": 0.9,
          "line-dasharray": [3, 2],
        },
      });

      // 2. Add Stations Source with GeoJSON Clustering
      this.map.addSource("stations", {
        type: "geojson",
        data: stationsData,
        cluster: true,
        clusterMaxZoom: 7,
        clusterRadius: 40,
      });

      // Cluster circles
      this.map.addLayer({
        id: "stations-clusters",
        type: "circle",
        source: "stations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#6366f1",
            5,
            "#8b5cf6",
            10,
            "#ec4899",
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 10, 24],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });

      // Cluster count text
      this.map.addLayer({
        id: "stations-cluster-count",
        type: "symbol",
        source: "stations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold"],
          "text-size": 11,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual Station points (unclustered)
      this.map.addLayer({
        id: "stations-unclustered",
        type: "circle",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "airport",
            "#38bdf8",
            "railway_station",
            "#fb923c",
            "#ffffff",
          ],
          "circle-radius": 5,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f172a",
        },
      });

      // Station label
      this.map.addLayer({
        id: "stations-unclustered-label",
        type: "symbol",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#e2e8f0",
          "text-halo-color": "#0f172a",
          "text-halo-width": 1.5,
        },
      });

      // 3. Popup Interactions
      this.setupPopups();
    });
  }

  private setupPopups() {
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
    });

    // Click cluster to zoom in
    this.map.on("click", "stations-clusters", (e: any) => {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: ["stations-clusters"],
      });
      const clusterId = features[0].properties.cluster_id;
      this.map
        .getSource("stations")
        .getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          this.map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
          });
        });
    });

    // Click station to show info
    this.map.on("click", "stations-unclustered", (e: any) => {
      const feature = e.features[0];
      const coords = feature.geometry.coordinates.slice();
      const p = feature.properties;
      const typeLabel = p.type === "airport" ? "✈️ 机场" : "🚆 火车站";

      const html = `
        <div style="font-size: 13px; line-height: 1.6;">
          <strong style="color: #38bdf8; font-size: 14px;">${p.name}</strong> 
          <span style="color: #9ca3af;">(${p.code})</span>
          <div style="margin-top: 4px; color: #d1d5db;">
            ${typeLabel} · ${p.city}, ${p.country}
          </div>
          <div style="margin-top: 4px; border-top: 1px solid #374151; padding-top: 4px; color: #9ca3af;">
            出行打卡：<strong>${p.visitCount}</strong> 次
            (出发 ${p.departureCount} 次 · 到达 ${p.arrivalCount} 次)
          </div>
        </div>
      `;

      popup.setLngLat(coords).setHTML(html).addTo(this.map);
    });

    // Click route line to show info
    const onRouteClick = (e: any) => {
      const feature = e.features[0];
      const p = feature.properties;
      const typeIcon = p.type === "flight" ? "✈️ 航线" : "🚆 铁路";
      const coords = e.lngLat;

      const html = `
        <div style="font-size: 13px; line-height: 1.6;">
          <strong style="font-size: 14px; color: #f97316;">${typeIcon}: ${p.departure} ↔ ${p.arrival}</strong>
          <div style="margin-top: 4px; color: #d1d5db;">
            大圆距离: <strong>${p.distanceKm.toLocaleString()} km</strong>
          </div>
          <div style="margin-top: 4px; color: #9ca3af;">
            累计往返: <strong>${p.frequency}</strong> 次 · 最近出行: ${p.lastDate}
          </div>
        </div>
      `;

      popup.setLngLat(coords).setHTML(html).addTo(this.map);
    };

    this.map.on("click", "routes-flight-line", onRouteClick);
    this.map.on("click", "routes-train-line", onRouteClick);

    // Cursor pointers
    const setCursorPointer = () => {
      this.map.getCanvas().style.cursor = "pointer";
    };
    const resetCursor = () => {
      this.map.getCanvas().style.cursor = "";
    };

    this.map.on("mouseenter", "stations-clusters", setCursorPointer);
    this.map.on("mouseleave", "stations-clusters", resetCursor);
    this.map.on("mouseenter", "stations-unclustered", setCursorPointer);
    this.map.on("mouseleave", "stations-unclustered", resetCursor);
    this.map.on("mouseenter", "routes-flight-line", setCursorPointer);
    this.map.on("mouseleave", "routes-flight-line", resetCursor);
  }

  public filterType(type: "all" | "flight" | "train") {
    if (!this.map || !this.map.isStyleLoaded()) return;

    if (type === "all") {
      this.map.setLayoutProperty("routes-flight-line", "visibility", "visible");
      this.map.setLayoutProperty("routes-flight-glow", "visibility", "visible");
      this.map.setLayoutProperty("routes-train-line", "visibility", "visible");
    } else if (type === "flight") {
      this.map.setLayoutProperty("routes-flight-line", "visibility", "visible");
      this.map.setLayoutProperty("routes-flight-glow", "visibility", "visible");
      this.map.setLayoutProperty("routes-train-line", "visibility", "none");
    } else if (type === "train") {
      this.map.setLayoutProperty("routes-flight-line", "visibility", "none");
      this.map.setLayoutProperty("routes-flight-glow", "visibility", "none");
      this.map.setLayoutProperty("routes-train-line", "visibility", "visible");
    }
  }
}
