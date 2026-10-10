<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { RenderEngine } from "../core/canvas/RenderEngine";
import { useTripStore } from "../stores/useTripStore";
import { useThemeStore } from "../stores/useThemeStore";
import { initGeoCore, buildProvinceIndex, type ProvinceIndex } from "../core/wasm";
import TripTooltip from "./TripTooltip.vue";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-vue-next";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const tripStore = useTripStore();
const themeStore = useThemeStore();

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

  // Load Rust/WASM core + layered basemap (countries / overseas admin-1 / China provinces)
  try {
    const [, countries, admin1, chinaProvinces] = await Promise.all([
      initGeoCore(),
      fetch("./data/countries.json").then((r) => r.json()),
      fetch("./data/admin1.json").then((r) => r.json()),
      fetch("./data/china_provinces.json").then((r) => r.json()),
    ]);
    engine.enableWasm();
    engine.setBaseMapData({ countries, admin1, chinaProvinces });
    provinceIndex = buildProvinceIndex(chinaProvinces);
  } catch (err) {
    console.error("Failed to load map data", err);
  }

  // Load initial travel data
  await tripStore.fetchData();
  updateEngineData();

  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  engine?.destroy();
});

/** 依据全量记录(不受筛选影响)判定到访省份:机场起降点 + 铁路折线穿行 */
const updateFootprint = (animateNew = false) => {
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
      for (const n of provinceIndex.crossed(new Float64Array([x0, y0, x1, y1]))) visited.add(n);
    }
  }
  engine.setVisitedProvinces(visited, animateNew);
};

const updateEngineData = () => {
  if (!engine) return;
  updateFootprint();
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

  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  engine.transform.zoomAt(e.clientX, e.clientY, zoomFactor);

  // Update hover hit immediately
  const hit = engine.hitTest(e.clientX, e.clientY);
  tripStore.hoveredTrip.value = hit;
};

const handleReset = () => {
  engine?.fitToScreen();
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
    />

    <!-- Hover details tooltip -->
    <TripTooltip
      v-if="tripStore.hoveredTrip.value"
      :trip="tripStore.hoveredTrip.value"
      :x="mousePos.x"
      :y="mousePos.y"
    />

    <!-- Floating Map Viewport Controls (Bottom Right) -->
    <div class="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
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
        title="重置全图视图"
        class="w-10 h-10 rounded-xl glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
