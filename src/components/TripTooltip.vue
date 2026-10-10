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
    class="fixed pointer-events-none z-50 w-72 glass-panel bg-slate-900/90 dark:bg-slate-950/95 border border-sky-500/30 dark:border-cyan-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-xs text-slate-200 transition-all duration-75 select-none"
  >
    <!-- Header HUD: Type, Code & Badge -->
    <div class="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2.5">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-950 font-bold shadow-sm"
          :style="{
            backgroundColor: trip.type === 'FLIGHT' ? '#4DFFB4' : '#FF9F43',
          }"
        >
          <Plane v-if="trip.type === 'FLIGHT'" class="w-4 h-4" />
          <Train v-else class="w-4 h-4" />
        </div>
        <div>
          <div class="font-mono font-extrabold text-sm tracking-wider text-white">
            {{ trip.code }}
          </div>
          <div class="text-[10px] text-slate-400">
            {{ trip.type === 'FLIGHT' ? (trip.airlineName || '航空出行') : (trip.railClass === 'CLASSIC' ? '普速列车' : '高速动车') }}
          </div>
        </div>
      </div>
      <div class="text-right">
        <span
          class="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
          :class="trip.type === 'FLIGHT' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-amber-500/40 text-amber-300 bg-amber-500/10'"
        >
          {{ trip.type === 'FLIGHT' ? 'BOARDING PASS' : 'TRAIN TICKET' }}
        </span>
      </div>
    </div>

    <!-- Origin -> Destination Airport/Station Codes & Names -->
    <div class="flex items-center justify-between text-white my-2 px-1">
      <div class="flex flex-col">
        <span class="font-mono text-lg font-black text-sky-400 tracking-wider">
          {{ trip.type === 'FLIGHT' ? trip.originId : trip.originCity }}
        </span>
        <span class="text-[11px] text-slate-300 truncate max-w-[90px]">
          {{ trip.originName }}
        </span>
      </div>
      <div class="flex flex-col items-center px-2">
        <span class="text-[10px] text-sky-400/80 font-mono">✈ ━━━</span>
        <span class="text-[11px] font-bold text-amber-400 font-mono">
          {{ trip.distanceKm.toLocaleString() }} km
        </span>
        <span v-if="trip.durationMin" class="text-[10px] text-slate-400">
          约 {{ Math.floor(trip.durationMin / 60) }}h{{ trip.durationMin % 60 }}m
        </span>
      </div>
      <div class="flex flex-col items-end">
        <span class="font-mono text-lg font-black text-sky-400 tracking-wider">
          {{ trip.type === 'FLIGHT' ? trip.destId : trip.destCity }}
        </span>
        <span class="text-[11px] text-slate-300 truncate max-w-[90px]">
          {{ trip.destName }}
        </span>
      </div>
    </div>

    <!-- Metadata Grid: Aircraft / Train model, Cabin / Seat -->
    <div class="mt-2.5 pt-2 border-t border-dashed border-slate-700/80 grid grid-cols-2 gap-2 text-[11px]">
      <div>
        <span class="text-slate-400 text-[10px] block">机型 / 车型</span>
        <span class="font-medium text-slate-200 truncate block">
          {{ trip.aircraft || trip.trainModel || '标准配置' }}
          <span v-if="trip.aircraftBody" class="text-[10px] text-sky-400">({{ trip.aircraftBody === 'WIDE' ? '宽体' : '窄体' }})</span>
        </span>
      </div>
      <div>
        <span class="text-slate-400 text-[10px] block">席别 / 座位</span>
        <span class="font-medium text-slate-200 truncate block">
          {{ [trip.cabin || trip.seatClass, trip.seat].filter(Boolean).join(' · ') || '自由席' }}
        </span>
      </div>
    </div>

    <!-- Date, Time & Notes Footer -->
    <div class="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-1 text-[11px] text-slate-400">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Calendar class="w-3 h-3 text-sky-400" />
          <span>{{ trip.date }}</span>
          <span v-if="trip.departTime" class="text-slate-300 font-mono font-medium">{{ trip.departTime }}</span>
        </div>
        <span v-if="trip.registration" class="font-mono text-[10px] text-slate-400 bg-slate-800 px-1 rounded">
          {{ trip.registration }}
        </span>
      </div>
      <div v-if="trip.notes" class="flex items-start gap-1.5 text-slate-300 mt-0.5">
        <Navigation class="w-3 h-3 mt-0.5 text-sky-400 flex-shrink-0" />
        <span class="truncate">{{ trip.notes }}</span>
      </div>
    </div>
  </div>
</template>
