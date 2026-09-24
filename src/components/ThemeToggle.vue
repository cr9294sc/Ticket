<script setup lang="ts">
import { useThemeStore } from "../stores/useThemeStore";
import { Sun, Moon } from "lucide-vue-next";

const themeStore = useThemeStore();
</script>

<template>
  <button
    @click="themeStore.toggleTheme"
    :title="themeStore.isDark.value ? '切换至亮色模式' : '切换至暗色模式'"
    class="w-10 h-10 rounded-xl glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
  >
    <Sun
      v-if="themeStore.isDark.value"
      class="w-5 h-5 text-amber-400 animate-spin-slow"
    />
    <Moon v-else class="w-5 h-5 text-slate-600" />
  </button>
</template>
