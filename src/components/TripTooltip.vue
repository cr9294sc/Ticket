<script setup lang="ts">
import { computed } from "vue";
import type { TripEntity } from "../types/travel";
import { Plane, Train, Calendar, Navigation } from "lucide-vue-next";

const props = defineProps<{
  trip: TripEntity;
  x: number;
  y: number;
}>();

// Ensure tooltip stays on screen
const style = computed(() => {
  const offsetX = 16;
  const offsetY = 16;
  const isRight = props.x > window.innerWidth - 260;
  const isBottom = props.y > window.innerHeight - 200;

  const left = isRight ? `${props.x - 260}px` : `${props.x + offsetX}px`;
  const top = isBottom ? `${props.y - 180}px` : `${props.y + offsetY}px`;

  return {
    left,
    top,
  };
});
</script>

<template>
  <div
    :style="style"
    class="fixed pointer-events-none z-50 w-64 glass-panel bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all duration-75 text-xs text-slate-700 dark:text-slate-200"
  >
    <!-- Header: Type, Code & Badge -->
    <div
      class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2 mb-2.5"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center text-white"
          :style="{
            backgroundColor:
              trip.color || (trip.type === 'FLIGHT' ? '#D97706' : '#10B981'),
          }"
        >
          <Plane v-if="trip.type === 'FLIGHT'" class="w-3.5 h-3.5" />
          <Train v-else class="w-3.5 h-3.5" />
        </div>
        <span
          class="font-bold text-sm tracking-wide text-slate-900 dark:text-white"
        >
          {{ trip.code }}
        </span>
      </div>
      <span
        v-if="trip.airlineName"
        class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
      >
        {{ trip.airlineName }}
      </span>
    </div>

    <!-- Route Origin -> Destination -->
    <div
      class="flex items-center justify-between text-slate-900 dark:text-white font-medium my-2 px-1"
    >
      <div class="flex flex-col">
        <span class="text-xs text-slate-400 dark:text-slate-500 font-normal"
          >起点</span
        >
        <span class="text-sm font-semibold truncate max-w-[90px]">{{
          trip.originName
        }}</span>
      </div>
      <div class="flex flex-col items-center px-2">
        <span class="text-[10px] text-slate-400">→</span>
        <span class="text-[11px] font-bold text-amber-600 dark:text-amber-400"
          >{{ trip.distanceKm }} km</span
        >
      </div>
      <div class="flex flex-col items-end">
        <span class="text-xs text-slate-400 dark:text-slate-500 font-normal"
          >终点</span
        >
        <span class="text-sm font-semibold truncate max-w-[90px]">{{
          trip.destName
        }}</span>
      </div>
    </div>

    <!-- Date & Notes -->
    <div
      class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400"
    >
      <div class="flex items-center gap-1.5">
        <Calendar class="w-3 h-3 text-slate-400" />
        <span>{{ trip.date }}</span>
      </div>
      <div
        v-if="trip.notes"
        class="flex items-start gap-1.5 text-slate-600 dark:text-slate-300"
      >
        <Navigation class="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
        <span class="truncate">{{ trip.notes }}</span>
      </div>
    </div>
  </div>
</template>
