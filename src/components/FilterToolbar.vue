<script setup lang="ts">
import { useTripStore } from "../stores/useTripStore";
import { Plane, Train, Layers, Database } from "lucide-vue-next";

defineEmits<{
  (e: "open-import"): void;
}>();

const tripStore = useTripStore();
</script>

<template>
  <div
    class="glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-xl p-1.5 flex items-center gap-2"
  >
    <!-- Type Filter Tabs -->
    <div
      class="flex items-center bg-slate-100/80 dark:bg-slate-900/80 rounded-xl p-1 text-xs font-medium text-slate-600 dark:text-slate-300"
    >
      <button
        @click="tripStore.selectedType.value = 'ALL'"
        :class="[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
          tripStore.selectedType.value === 'ALL'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
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
        <span>仅看飞行</span>
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
        <span>仅看高铁</span>
      </button>
    </div>

    <!-- Divider -->
    <div class="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

    <!-- Data Import / Management Button -->
    <button
      @click="$emit('open-import')"
      title="数据导入与发布"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-900/80 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-300 transition-all shadow-sm active:scale-95"
    >
      <Database class="w-3.5 h-3.5" />
      <span>数据导入</span>
    </button>
  </div>
</template>
