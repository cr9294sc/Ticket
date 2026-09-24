<script setup lang="ts">
import { ref, computed } from "vue";
import { useTripStore } from "../stores/useTripStore";
import {
  Plane,
  Train,
  Globe,
  ChevronDown,
  ChevronUp,
  MapPin,
  Award,
  Compass,
} from "lucide-vue-next";

const tripStore = useTripStore();
const isExpanded = ref<boolean>(true);
const activeTab = ref<"STATIONS" | "AIRLINES" | "TRAINS">("STATIONS");

const stats = computed(() => tripStore.activeStats.value);
</script>

<template>
  <div class="fixed top-6 left-6 z-20 w-84 md:w-96 select-none font-sans">
    <div
      class="glass-panel bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden text-slate-800 dark:text-slate-100"
    >
      <!-- Top Header & Collapse Switch -->
      <div
        class="p-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-md shadow-amber-500/20"
          >
            <Compass class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1
              class="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
            >
              个人旅行痕迹
            </h1>
            <p
              class="text-[11px] text-slate-400 dark:text-slate-500 font-medium"
            >
              Global Flight & High-Speed Rail Traces
            </p>
          </div>
        </div>

        <button
          @click="isExpanded = !isExpanded"
          class="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center transition-colors"
        >
          <ChevronUp v-if="isExpanded" class="w-4 h-4" />
          <ChevronDown v-else class="w-4 h-4" />
        </button>
      </div>

      <!-- Collapsible Body -->
      <div v-show="isExpanded" class="p-5 pt-4 flex flex-col gap-4">
        <!-- Primary Metric: Total Distance -->
        <div
          class="bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/50 dark:to-slate-800/20 border border-slate-200/50 dark:border-slate-700/40 rounded-2xl p-4 flex items-baseline justify-between"
        >
          <div>
            <span
              class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5"
              >总出行里程</span
            >
            <div class="flex items-baseline gap-1">
              <span
                class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
              >
                {{ stats.totalKm.toLocaleString() }}
              </span>
              <span class="text-xs font-semibold text-slate-400">km</span>
            </div>
          </div>

          <div class="text-right">
            <div
              class="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 justify-end"
            >
              <Globe class="w-3.5 h-3.5" />
              <span>绕地球 {{ stats.earthLaps }} 圈</span>
            </div>
            <span class="text-[11px] text-slate-400 block mt-0.5"
              >累计 {{ stats.totalCount }} 次出行</span
            >
          </div>
        </div>

        <!-- Mode Sub-Metrics: Flight vs HSR -->
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Flight Box -->
          <div
            class="rounded-2xl p-3 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex flex-col"
          >
            <div
              class="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1"
            >
              <span class="text-xs font-semibold flex items-center gap-1">
                <Plane class="w-3.5 h-3.5" /> 飞行记录
              </span>
              <span
                class="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 rounded-md"
              >
                {{ stats.kmFlightPct }}%
              </span>
            </div>
            <span class="text-lg font-bold text-slate-900 dark:text-white">
              {{ stats.flightKm.toLocaleString() }}
              <span class="text-[10px] font-normal text-slate-400">km</span>
            </span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5"
              >{{ stats.flightCount }} 架次</span
            >
          </div>

          <!-- HSR Box -->
          <div
            class="rounded-2xl p-3 bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 flex flex-col"
          >
            <div
              class="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1"
            >
              <span class="text-xs font-semibold flex items-center gap-1">
                <Train class="w-3.5 h-3.5" /> 高铁记录
              </span>
              <span
                class="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 rounded-md"
              >
                {{ stats.kmHsrPct }}%
              </span>
            </div>
            <span class="text-lg font-bold text-slate-900 dark:text-white">
              {{ stats.hsrKm.toLocaleString() }}
              <span class="text-[10px] font-normal text-slate-400">km</span>
            </span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5"
              >{{ stats.hsrCount }} 车次</span
            >
          </div>
        </div>

        <!-- Proportional Ratio Bar -->
        <div class="flex flex-col gap-1">
          <div
            class="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex"
          >
            <div
              class="h-full bg-amber-500 transition-all duration-500"
              :style="{ width: `${stats.kmFlightPct}%` }"
              title="飞行里程占比"
            />
            <div
              class="h-full bg-emerald-500 transition-all duration-500"
              :style="{ width: `${stats.kmHsrPct}%` }"
              title="高铁里程占比"
            />
          </div>
          <div
            class="flex justify-between text-[10px] font-medium text-slate-400 px-0.5"
          >
            <span>飞行 {{ stats.kmFlightPct }}%</span>
            <span>高铁 {{ stats.kmHsrPct }}%</span>
          </div>
        </div>

        <!-- Leaderboards Section -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <!-- Tab Navigation -->
          <div
            class="flex items-center gap-1 mb-2.5 text-xs font-medium text-slate-400"
          >
            <button
              @click="activeTab = 'STATIONS'"
              :class="[
                'px-2 py-1 rounded-lg transition-colors',
                activeTab === 'STATIONS'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              打卡最多枢纽
            </button>
            <button
              @click="activeTab = 'AIRLINES'"
              :class="[
                'px-2 py-1 rounded-lg transition-colors',
                activeTab === 'AIRLINES'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              常坐航司
            </button>
            <button
              @click="activeTab = 'TRAINS'"
              :class="[
                'px-2 py-1 rounded-lg transition-colors',
                activeTab === 'TRAINS'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              常坐车次
            </button>
          </div>

          <!-- Top Stations List -->
          <div
            v-if="activeTab === 'STATIONS'"
            class="flex flex-col gap-1.5 text-xs"
          >
            <div
              v-for="(st, i) in stats.topStations"
              :key="st.name"
              class="flex items-center justify-between py-1 px-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-4 text-center font-bold text-[10px] text-slate-400"
                  >{{ i + 1 }}</span
                >
                <span
                  class="font-medium text-slate-900 dark:text-white truncate max-w-[150px]"
                  >{{ st.name }}</span
                >
              </div>
              <span
                class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold"
                >{{ st.count }} 次</span
              >
            </div>
            <div
              v-if="stats.topStations.length === 0"
              class="text-center py-2 text-slate-400 text-xs"
            >
              暂无匹配打卡站点
            </div>
          </div>

          <!-- Top Airlines List -->
          <div
            v-else-if="activeTab === 'AIRLINES'"
            class="flex flex-col gap-1.5 text-xs"
          >
            <div
              v-for="(air, i) in stats.topAirlines"
              :key="air.name"
              class="flex items-center justify-between py-1 px-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full"
                  :style="{ backgroundColor: air.color }"
                ></span>
                <span class="font-medium text-slate-900 dark:text-white">{{
                  air.name
                }}</span>
              </div>
              <span
                class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold"
                >{{ air.count }} 次</span
              >
            </div>
            <div
              v-if="stats.topAirlines.length === 0"
              class="text-center py-2 text-slate-400 text-xs"
            >
              当前过滤条件无航司数据
            </div>
          </div>

          <!-- Top Trains List -->
          <div v-else class="flex flex-col gap-1.5 text-xs">
            <div
              v-for="(tr, i) in stats.topTrains"
              :key="tr.code"
              class="flex items-center justify-between py-1 px-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-4 text-center font-bold text-[10px] text-slate-400"
                  >{{ i + 1 }}</span
                >
                <span
                  class="font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  >{{ tr.code }}</span
                >
              </div>
              <span
                class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold"
                >{{ tr.count }} 次</span
              >
            </div>
            <div
              v-if="stats.topTrains.length === 0"
              class="text-center py-2 text-slate-400 text-xs"
            >
              当前过滤条件无高铁车次
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
