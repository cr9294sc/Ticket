<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { RenderEngine } from "../core/canvas/RenderEngine";
import { useTripStore } from "../stores/useTripStore";
import { useThemeStore } from "../stores/useThemeStore";
import { initGeoCore, buildProvinceIndex, type ProvinceIndex } from "../core/wasm";
import { useUiStore } from "../stores/useUiStore";
import { getAirports, getStations } from "../core/catalog";
import TripTooltip from "./TripTooltip.vue";
import { Globe, MapPin, ZoomIn, ZoomOut } from "lucide-vue-next";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const tripStore = useTripStore();
const themeStore = useThemeStore();
const ui = useUiStore();

// 区域钻取数据与弹窗
const showRegionPicker = ref(false);
const regionData = ref<{
  clusters: { name: string; bounds: [[number, number], [number, number]] }[];
  provinces: { name: string; bounds: [[number, number], [number, number]] }[];
}>({ clusters: [], provinces: [] });

// 右键菜单
const ctxMenu = ref<{ x: number; y: number; kind: "airport" | "station"; id: string; label: string } | null>(null);
let pulseNext = false;

let engine: RenderEngine | null = null;
let provinceIndex: ProvinceIndex | null = null;

// Hover tooltip positioning
const mousePos = ref<{ x: number; y: number }>({ x: 0, y: 0 });

// Dragging state
let isDragging = false;
let startX = 0;
let startY = 0;

onMounted(async () => {
  if (!canvasRef.value) return;

  engine = new RenderEngine(canvasRef.value, themeStore.currentTheme.value);

  // Load Rust/WASM core + layered basemap (countries / overseas admin-1 / China provinces / rail network)
  try {
    const [, countries, admin1, chinaProvinces, regions, railNetwork] = await Promise.all([
      initGeoCore(),
      fetch("./data/countries.json").then((r) => r.json()),
      fetch("./data/admin1.json").then((r) => r.json()),
      fetch("./data/china_provinces.json").then((r) => r.json()),
      fetch("./data/regions.json").then((r) => r.json()).catch(() => ({ clusters: [], provinces: [] })),
      fetch("./data/rail_network.json").then((r) => r.json()).catch(() => null),
    ]);
    engine.enableWasm();
    engine.setBaseMapData({ countries, admin1, chinaProvinces, railNetwork });
    provinceIndex = buildProvinceIndex(chinaProvinces);
    regionData.value = regions;
  } catch (err) {
    console.error("Failed to load map data", err);
  }

  // Load initial travel data
  await tripStore.fetchData();
  engine.setCatalogPlaces(getAirports(), getStations());
  updateEngineData();

  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  engine?.destroy();
});

/** 依据全量记录(不受筛选影响)判定到访省份:机场起降点 + 铁路真实折线穿行 */
const updateFootprint = (animateNew = false, delayMs = 0) => {
  if (!engine || !provinceIndex) return;
  const visited = new Set<string>();
  for (const t of tripStore.allTrips.value) {
    const [x0, y0] = t.originCoords;
    const [x1, y1] = t.destCoords;
    if (t.type === "FLIGHT") {
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        const n = provinceIndex.locate(x, y);
        if (n) visited.add(n);
      }
    } else {
      if (t.trackCoords && t.trackCoords.length >= 2) {
        for (let i = 0; i < t.trackCoords.length - 1; i++) {
          const seg = new Float64Array([
            t.trackCoords[i][0], t.trackCoords[i][1],
            t.trackCoords[i + 1][0], t.trackCoords[i + 1][1]
          ]);
          for (const n of provinceIndex.crossed(seg)) visited.add(n);
        }
      } else {
        for (const n of provinceIndex.crossed(new Float64Array([x0, y0, x1, y1]))) visited.add(n);
      }
    }
  }
  engine.setVisitedProvinces(visited, animateNew, delayMs);
};

const updateEngineData = () => {
  if (!engine) return;
  updateFootprint(pulseNext, 1900);
  pulseNext = false;
  engine.setTripsAndLocations(
    tripStore.filteredTrips.value,
    tripStore.locations.value,
  );
};

// React to filter changes
watch(
  () => [tripStore.filteredTrips.value, tripStore.locations.value],
  () => {
    updateEngineData();
  },
  { deep: true },
);

// 新增/修改行程后:复位筛选 -> 飞行 -> 绘制 -> 新省份呼吸光
watch(
  () => tripStore.lastAddedId.value,
  (id) => {
    if (!id || !engine) return;
    tripStore.selectedType.value = "ALL";
    tripStore.selectedYear.value = "ALL";
    pulseNext = true;
    engine.focusTrip(id, true);
    tripStore.lastAddedId.value = null;
  },
);

// 列表点击聚焦
watch(
  () => ui.focusTripId.value,
  (id) => {
    if (!id || !engine) return;
    engine.focusTrip(id, false);
    ui.focusTripId.value = null;
  },
);

// 区域钻取
watch(
  () => ui.drillDownBounds.value,
  (bounds) => {
    if (!bounds || !engine) return;
    engine.flyToGeoBounds(bounds);
    ui.drillDownBounds.value = null;
  },
);

// React to theme changes
watch(
  () => themeStore.currentTheme.value,
  (newTheme) => {
    engine?.setTheme(newTheme);
  },
);

// React to hovered trip changes
watch(
  () => tripStore.hoveredTrip.value,
  (val) => {
    engine?.setHoveredTrip(val);
  },
);

const handleResize = () => {
  engine?.fitToScreen();
};

const handlePointerDown = (e: PointerEvent) => {
  ctxMenu.value = null;
  engine?.cancelTween();
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  canvasRef.value?.setPointerCapture(e.pointerId);
};

const handlePointerMove = (e: PointerEvent) => {
  mousePos.value = { x: e.clientX, y: e.clientY };

  if (isDragging && engine) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    engine.transform.pan(dx, dy);
    startX = e.clientX;
    startY = e.clientY;
    return;
  }

  // Hit testing for hover
  if (engine) {
    const hit = engine.hitTest(e.clientX, e.clientY);
    tripStore.hoveredTrip.value = hit;
  }
};

const handlePointerUp = (e: PointerEvent) => {
  isDragging = false;
  try {
    canvasRef.value?.releasePointerCapture(e.pointerId);
  } catch {}
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  if (!engine) return;
  engine.cancelTween();

  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  engine.transform.zoomAt(e.clientX, e.clientY, zoomFactor);

  // Update hover hit immediately
  const hit = engine.hitTest(e.clientX, e.clientY);
  tripStore.hoveredTrip.value = hit;
};

const handleReset = () => {
  showRegionPicker.value = false;
  engine?.resetView();
};

const handleDrillDown = (bounds: [[number, number], [number, number]]) => {
  showRegionPicker.value = false;
  engine?.flyToGeoBounds(bounds);
};

const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault();
  const p = engine?.pickPlace(e.clientX, e.clientY);
  ctxMenu.value = p ? { x: e.clientX, y: e.clientY, kind: p.kind, id: p.id, label: p.label } : null;
};

const addFromMenu = (role: "from" | "to") => {
  const m = ctxMenu.value;
  if (!m) return;
  ui.openEntry({ type: m.kind === "airport" ? "FLIGHT" : "HSR", [role]: m.id });
  ctxMenu.value = null;
};

const handleZoomIn = () => {
  if (!canvasRef.value || !engine) return;
  const rect = canvasRef.value.getBoundingClientRect();
  engine.transform.zoomAt(rect.width / 2, rect.height / 2, 1.25);
};

const handleZoomOut = () => {
  if (!canvasRef.value || !engine) return;
  const rect = canvasRef.value.getBoundingClientRect();
  engine.transform.zoomAt(rect.width / 2, rect.height / 2, 0.8);
};
</script>

<template>
  <div
    class="relative w-screen h-screen overflow-hidden select-none bg-white dark:bg-slate-900 transition-colors duration-300"
  >
    <canvas
      ref="canvasRef"
      class="w-full h-full cursor-grab active:cursor-grabbing block"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @wheel="handleWheel"
      @contextmenu="handleContextMenu"
    />

    <!-- 站点右键菜单 -->
    <div
      v-if="ctxMenu"
      class="fixed z-30 min-w-[190px] rounded-xl border border-slate-300 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 shadow-2xl text-sm py-1 text-slate-800 dark:text-slate-100"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
    >
      <div class="px-3 py-1 text-xs text-slate-500">{{ ctxMenu.label }}</div>
      <button class="block w-full text-left px-3 py-1.5 hover:bg-sky-500/20" @click="addFromMenu('from')">以此为起点添加行程</button>
      <button class="block w-full text-left px-3 py-1.5 hover:bg-sky-500/20" @click="addFromMenu('to')">以此为终点添加行程</button>
    </div>

    <!-- Hover details tooltip -->
    <TripTooltip
      v-if="tripStore.hoveredTrip.value"
      :trip="tripStore.hoveredTrip.value"
      :x="mousePos.x"
      :y="mousePos.y"
    />

    <!-- Floating Map Viewport Controls (Bottom Right) -->
    <div class="absolute bottom-6 right-6 flex flex-col gap-2 z-20 items-end">
      <!-- 区域钻取选择器 -->
      <div v-if="showRegionPicker" class="glass-panel bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 shadow-2xl mb-1 w-64 max-h-72 overflow-y-auto text-xs text-slate-700 dark:text-slate-200 backdrop-blur-xl">
        <div class="font-bold text-slate-900 dark:text-white mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
          区域钻取 (Drill-Down)
        </div>
        <div class="mb-2">
          <div class="text-[10px] text-slate-400 mb-1 font-semibold">主要城市群</div>
          <div class="grid grid-cols-2 gap-1">
            <button
              v-for="c in regionData.clusters"
              :key="c.name"
              @click="handleDrillDown(c.bounds)"
              class="px-2 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-500 text-left truncate transition-colors"
            >
              {{ c.name }}
            </button>
          </div>
        </div>
        <div>
          <div class="text-[10px] text-slate-400 mb-1 font-semibold">省级行政区</div>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="p in regionData.provinces"
              :key="p.name"
              @click="handleDrillDown(p.bounds)"
              class="px-1.5 py-1 rounded bg-slate-100/60 dark:bg-slate-800/60 hover:bg-sky-500/20 hover:text-sky-500 text-center truncate text-[11px] transition-colors"
            >
              {{ p.name.replace(/(省|市|特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区)$/, '') }}
            </button>
          </div>
        </div>
      </div>

      <button
        @click="showRegionPicker = !showRegionPicker"
        title="区域钻取"
        :class="[
          'w-10 h-10 rounded-xl glass-panel border shadow-lg flex items-center justify-center transition-all active:scale-95',
          showRegionPicker
            ? 'bg-sky-500 text-white border-sky-600'
            : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700',
        ]"
      >
        <MapPin class="w-4 h-4" />
      </button>

      <button
        @click="handleZoomIn"
        title="放大"
        class="w-10 h-10 rounded-xl glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
      >
        <ZoomIn class="w-5 h-5" />
      </button>
      <button
        @click="handleZoomOut"
        title="缩小"
        class="w-10 h-10 rounded-xl glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
      >
        <ZoomOut class="w-5 h-5" />
      </button>
      <button
        @click="handleReset"
        title="全球全景 (Global View)"
        class="w-10 h-10 rounded-xl glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
      >
        <Globe class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
