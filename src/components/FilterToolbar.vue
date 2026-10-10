<script setup lang="ts">
import { ref } from "vue";
import { useTripStore } from "../stores/useTripStore";
import { useUiStore } from "../stores/useUiStore";
import {
  Plane,
  Train,
  Layers,
  ListFilter,
  Plus,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-vue-next";

defineEmits<{
  (e: "open-import"): void;
}>();

const tripStore = useTripStore();
const ui = useUiStore();
const showAdvanced = ref(false);

const resetFilters = () => {
  tripStore.selectedType.value = "ALL";
  tripStore.selectedYear.value = "ALL";
  tripStore.startDate.value = "";
  tripStore.endDate.value = "";
  tripStore.vehicleFilter.value = "ALL";
  tripStore.scopeFilter.value = "ALL";
};

const hasActiveAdvanced = () => {
  return (
    tripStore.startDate.value !== "" ||
    tripStore.endDate.value !== "" ||
    tripStore.vehicleFilter.value !== "ALL" ||
    tripStore.scopeFilter.value !== "ALL"
  );
};
</script>

<template>
  <div class="flex flex-col items-end gap-2 select-none">
    <div
      class="glass-panel bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl p-1.5 flex items-center gap-2"
    >
      <!-- + 记录新旅程 快捷入口 -->
      <button
        @click="ui.openEntry()"
        title="记录新旅程"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm active:scale-95 transition-all"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>记旅程</span>
      </button>

      <!-- Type Filter Tabs -->
      <div
        class="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        <button
          @click="tripStore.selectedType.value = 'ALL'"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
            tripStore.selectedType.value === 'ALL'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
              : 'hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>全部</span>
        </button>

        <button
          @click="tripStore.selectedType.value = 'FLIGHT'"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
            tripStore.selectedType.value === 'FLIGHT'
              ? 'bg-amber-500 text-white shadow-sm font-semibold'
              : 'hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <Plane class="w-3.5 h-3.5" />
          <span>仅看航班</span>
        </button>

        <button
          @click="tripStore.selectedType.value = 'HSR'"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
            tripStore.selectedType.value === 'HSR'
              ? 'bg-emerald-600 text-white shadow-sm font-semibold'
              : 'hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <Train class="w-3.5 h-3.5" />
          <span>仅看铁路</span>
        </button>
      </div>

      <!-- Advanced Filter Toggle -->
      <button
        @click="showAdvanced = !showAdvanced"
        :class="[
          'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all',
          showAdvanced || hasActiveAdvanced()
            ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
        ]"
        title="高级多维筛选"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        <span>筛选</span>
      </button>

      <!-- 行程抽屉列表 -->
      <button
        @click="ui.listOpen.value = !ui.listOpen.value"
        title="出行记录列表与管理"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
      >
        <ListFilter class="w-3.5 h-3.5" />
        <span>列表</span>
      </button>
    </div>

    <!-- Advanced Filter Popover Panel -->
    <div
      v-if="showAdvanced"
      class="glass-panel bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 text-xs text-slate-700 dark:text-slate-200 w-80 backdrop-blur-xl"
    >
      <div class="flex items-center justify-between font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5">
        <span>高级条件过滤</span>
        <button
          v-if="hasActiveAdvanced()"
          @click="resetFilters"
          class="flex items-center gap-1 text-[11px] font-normal text-sky-500 hover:underline"
        >
          <RotateCcw class="w-3 h-3" /> 重置
        </button>
      </div>

      <!-- Scope Filter -->
      <div class="flex flex-col gap-1">
        <span class="text-slate-400 text-[10px]">航线范围</span>
        <div class="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          <button
            v-for="opt in [
              { id: 'ALL', label: '不限' },
              { id: 'DOMESTIC', label: '国内' },
              { id: 'INTL', label: '跨国' },
            ]"
            :key="opt.id"
            @click="tripStore.scopeFilter.value = opt.id as any"
            :class="[
              'py-1 rounded-md text-center transition-all',
              tripStore.scopeFilter.value === opt.id
                ? 'bg-white dark:bg-slate-700 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            ]"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Vehicle Filter -->
      <div class="flex flex-col gap-1">
        <span class="text-slate-400 text-[10px]">载具属性</span>
        <div class="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          <button
            v-for="opt in [
              { id: 'ALL', label: '不限' },
              { id: 'WIDE', label: '宽体机' },
              { id: 'HSR_CR', label: '高铁动车' },
            ]"
            :key="opt.id"
            @click="tripStore.vehicleFilter.value = opt.id as any"
            :class="[
              'py-1 rounded-md text-center transition-all',
              tripStore.vehicleFilter.value === opt.id
                ? 'bg-white dark:bg-slate-700 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            ]"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Date Range Filter -->
      <div class="flex flex-col gap-1">
        <span class="text-slate-400 text-[10px]">自定义日期区间</span>
        <div class="grid grid-cols-2 gap-1.5">
          <input
            type="date"
            v-model="tripStore.startDate.value"
            class="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px]"
          />
          <input
            type="date"
            v-model="tripStore.endDate.value"
            class="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
