<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from "vue";
import { useTripStore } from "../stores/useTripStore";
import { Calendar, History, Play, Pause, FastForward } from "lucide-vue-next";

const tripStore = useTripStore();

// List of available year options including 'ALL'
const yearOptions = computed<(number | "ALL")[]>(() => {
  const years = tripStore.metadata.value.years || [];
  return ["ALL", ...years];
});

// Calculate current index in the options array
const currentIndex = computed(() => {
  const idx = yearOptions.value.indexOf(tripStore.selectedYear.value);
  return idx >= 0 ? idx : 0;
});

const isDragging = ref(false);
const trackRef = ref<HTMLDivElement | null>(null);

// Playback state
const isPlaying = ref(false);
const playbackSpeed = ref<1 | 2 | 5>(1);
let timerId: any = null;

const speeds: (1 | 2 | 5)[] = [1, 2, 5];
const toggleSpeed = () => {
  const nextIdx = (speeds.indexOf(playbackSpeed.value) + 1) % speeds.length;
  playbackSpeed.value = speeds[nextIdx];
  if (isPlaying.value) {
    stopPlayback();
    startPlayback();
  }
};

const selectIndex = (idx: number) => {
  if (idx >= 0 && idx < yearOptions.value.length) {
    tripStore.selectedYear.value = yearOptions.value[idx];
  }
};

const startPlayback = () => {
  isPlaying.value = true;
  const yearsOnly = yearOptions.value.filter((y): y is number => typeof y === "number");
  if (!yearsOnly.length) return;

  // If currently on ALL or last year, start from first year
  if (
    tripStore.selectedYear.value === "ALL" ||
    tripStore.selectedYear.value === yearsOnly[yearsOnly.length - 1]
  ) {
    tripStore.selectedYear.value = yearsOnly[0];
  }

  const intervalMs = Math.round(2200 / playbackSpeed.value);
  timerId = setInterval(() => {
    const curYear = tripStore.selectedYear.value;
    const curIdx = yearsOnly.indexOf(curYear as number);
    if (curIdx < yearsOnly.length - 1) {
      tripStore.selectedYear.value = yearsOnly[curIdx + 1];
    } else {
      // Loop or stop
      tripStore.selectedYear.value = "ALL";
      stopPlayback();
    }
  }, intervalMs);
};

const stopPlayback = () => {
  isPlaying.value = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback();
  } else {
    startPlayback();
  }
};

onUnmounted(() => {
  stopPlayback();
});

const handlePointerDown = (e: PointerEvent) => {
  if (isPlaying.value) stopPlayback();
  isDragging.value = true;
  updateFromPointer(e);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
};

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;
  updateFromPointer(e);
};

const handlePointerUp = () => {
  isDragging.value = false;
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", handlePointerUp);
};

const updateFromPointer = (e: PointerEvent) => {
  if (!trackRef.value) return;
  const rect = trackRef.value.getBoundingClientRect();
  const total = yearOptions.value.length;
  if (total <= 1) return;

  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const fraction = relX / rect.width;
  const closestIdx = Math.round(fraction * (total - 1));
  selectIndex(closestIdx);
};

const activePercentage = computed(() => {
  const total = yearOptions.value.length;
  if (total <= 1) return 0;
  return (currentIndex.value / (total - 1)) * 100;
});
</script>

<template>
  <div
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 select-none flex flex-col items-center"
  >
    <div
      class="glass-panel bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl px-5 py-3 flex flex-col gap-2 min-w-[340px] sm:min-w-[460px] backdrop-blur-xl transition-all"
    >
      <!-- Timeline Header -->
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200"
          >
            <Calendar class="w-3.5 h-3.5 text-amber-500" />
            <span>时空演播回放</span>
          </div>

          <!-- Play / Speed Controls -->
          <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              @click="togglePlayback"
              :title="isPlaying ? '暂停回放' : '开始逐年演播'"
              class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
            >
              <Pause v-if="isPlaying" class="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <Play v-else class="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              @click="toggleSpeed"
              title="切换演播倍速"
              class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400"
            >
              {{ playbackSpeed }}x
            </button>
          </div>
        </div>

        <div
          class="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono font-medium"
        >
          <History class="w-3 h-3" />
          <span class="text-[11px]">
            {{
              tripStore.selectedYear.value === "ALL"
                ? "全部历史时期"
                : `${tripStore.selectedYear.value} 年`
            }}
          </span>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-sans ml-1 text-slate-600 dark:text-slate-300"
          >
            {{ tripStore.filteredTrips.value.length }} 条
          </span>
        </div>
      </div>

      <!-- Draggable Timeline Track -->
      <div
        class="relative py-2 cursor-pointer"
        @pointerdown="handlePointerDown"
      >
        <div
          ref="trackRef"
          class="relative h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden"
        >
          <!-- Active Progress Bar -->
          <div
            class="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-150 ease-out"
            :style="{ width: `${activePercentage}%` }"
          />
        </div>

        <!-- Draggable Handle Thumb -->
        <div
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white dark:bg-slate-100 shadow-md border-2 border-amber-500 flex items-center justify-center transition-[left] duration-150 ease-out cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95"
          :style="{ left: `${activePercentage}%` }"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-amber-500" />
        </div>
      </div>

      <!-- Year Tick Labels -->
      <div
        class="flex justify-between items-center text-[11px] font-medium text-slate-500 dark:text-slate-400 px-0.5"
      >
        <button
          v-for="(item, idx) in yearOptions"
          :key="item"
          @click.stop="selectIndex(idx)"
          :class="[
            'transition-colors py-0.5 px-1.5 rounded-md hover:text-slate-900 dark:hover:text-white',
            currentIndex === idx
              ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10'
              : 'text-slate-500 dark:text-slate-400',
          ]"
        >
          {{ item === "ALL" ? "全部" : item }}
        </button>
      </div>
    </div>
  </div>
</template>
