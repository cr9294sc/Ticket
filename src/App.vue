<script setup lang="ts">
import { ref } from "vue";
import MapCanvas from "./components/MapCanvas.vue";
import DashboardOverlay from "./components/DashboardOverlay.vue";
import FilterToolbar from "./components/FilterToolbar.vue";
import TimelineSlider from "./components/TimelineSlider.vue";
import DataImportModal from "./components/DataImportModal.vue";
import TripEntryModal from "./components/TripEntryModal.vue";
import TripListDrawer from "./components/TripListDrawer.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import { useTripStore } from "./stores/useTripStore";

const tripStore = useTripStore();
const isImportModalOpen = ref(false);
</script>

<template>
  <main class="relative w-screen h-screen overflow-hidden font-sans">
    <!-- Interactive Canvas Layer -->
    <MapCanvas />

    <!-- Top Left Dashboard -->
    <DashboardOverlay />

    <!-- Top Right Controls: Filter Toolbar & Theme Toggle -->
    <div class="fixed top-6 right-6 z-20 flex items-center gap-3">
      <FilterToolbar @open-import="isImportModalOpen = true" />
      <ThemeToggle />
    </div>

    <!-- Bottom Center Draggable Timeline Slider -->
    <TimelineSlider />

    <!-- Trip Entry & Edit Modal -->
    <TripEntryModal />

    <!-- Trip List & Management Drawer -->
    <TripListDrawer />

    <!-- Data Import & Management Modal -->
    <DataImportModal
      :isOpen="isImportModalOpen"
      @close="isImportModalOpen = false"
    />

    <!-- Loading Mask -->
    <div
      v-if="tripStore.isLoading.value"
      class="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"
    >
      <div
        class="flex flex-col items-center gap-3 text-slate-700 dark:text-slate-200"
      >
        <div
          class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"
        ></div>
        <span class="text-sm font-semibold tracking-wide"
          >加载个人旅行足迹中...</span
        >
      </div>
    </div>
  </main>
</template>
