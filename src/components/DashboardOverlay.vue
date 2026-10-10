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
  Clock,
  Compass,
  PieChart,
  Moon,
  Sun,
  Briefcase,
  Layers,
} from "lucide-vue-next";

const tripStore = useTripStore();
const isExpanded = ref<boolean>(true);
const activeTab = ref<"PREF" | "STATIONS" | "AIRLINES" | "TRAINS">("PREF");
const kmUnit = ref<"KM" | "MILE">("KM");

const stats = computed(() => tripStore.activeStats.value);

const displayDist = (km: number) => {
  if (kmUnit.value === "MILE") {
    return Math.round(km * 0.621371).toLocaleString();
  }
  return km.toLocaleString();
};

const unitLabel = computed(() => (kmUnit.value === "KM" ? "km" : "mi"));
</script>

<template>
  <div class="fixed top-6 left-6 z-20 w-84 md:w-[410px] select-none font-sans max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
    <div
      class="glass-panel bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-full"
    >
      <!-- Top Header & Collapse Switch -->
      <div
        class="p-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20"
          >
            <Compass class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1
              class="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
            >
              个人态势仪表板
            </h1>
            <p
              class="text-[11px] text-slate-400 dark:text-slate-500 font-medium"
            >
              Travel Telemetry & Exploration Analytics
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- KM / MILE Switch -->
          <button
            @click="kmUnit = kmUnit === 'KM' ? 'MILE' : 'KM'"
            class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="切换里程单位"
          >
            {{ kmUnit }}
          </button>
          <button
            @click="isExpanded = !isExpanded"
            class="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center transition-colors"
          >
            <ChevronUp v-if="isExpanded" class="w-4 h-4" />
            <ChevronDown v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Collapsible Body -->
      <div v-show="isExpanded" class="p-4 pt-3 flex flex-col gap-3.5 overflow-y-auto">
        <!-- 宏观总览指标看板: 里程与趣味折算 -->
        <div
          class="bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/50 dark:to-slate-800/20 border border-slate-200/50 dark:border-slate-700/40 rounded-2xl p-3.5 flex items-baseline justify-between"
        >
          <div>
            <span
              class="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5"
              >累计总出行里程</span
            >
            <div class="flex items-baseline gap-1">
              <span
                class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono"
              >
                {{ displayDist(stats.totalKm) }}
              </span>
              <span class="text-xs font-semibold text-slate-400">{{ unitLabel }}</span>
            </div>
          </div>

          <div class="text-right">
            <div
              class="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 justify-end"
            >
              <Globe class="w-3.5 h-3.5" />
              <span>赤道 {{ stats.earthLaps }} 圈</span>
            </div>
            <span class="text-[10px] text-slate-400 block mt-0.5"
              >地月距离 {{ stats.moonPercent }}% · {{ stats.totalCount }} 次在途</span
            >
          </div>
        </div>

        <!-- 宏观总览指标看板: 旅行时间资产 & 地理版图点亮 -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- 在途时间资产 -->
          <div class="rounded-2xl p-3 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span class="flex items-center gap-1 font-medium text-[11px]">
                <Clock class="w-3.5 h-3.5 text-amber-500" /> 在途时间资产
              </span>
            </div>
            <div>
              <span class="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {{ stats.durationDays }}
              </span>
              <span class="text-[10px] text-slate-400 ml-1">天</span>
              <span class="text-[10px] text-slate-400 block">共 {{ stats.totalDurationHours }} 小时</span>
            </div>
          </div>

          <!-- 地理版图点亮率 -->
          <div class="rounded-2xl p-3 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span class="flex items-center gap-1 font-medium text-[11px]">
                <MapPin class="w-3.5 h-3.5 text-emerald-500" /> 地理点亮版图
              </span>
            </div>
            <div>
              <div class="flex items-baseline gap-1">
                <span class="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {{ stats.visitedCitiesCount }}
                </span>
                <span class="text-[10px] text-slate-400">城</span>
                <span class="text-sm font-bold font-mono text-sky-500 ml-1.5">
                  {{ stats.visitedCountriesCount }}
                </span>
                <span class="text-[10px] text-slate-400">国</span>
              </div>
              <span class="text-[10px] text-slate-400 block">已到访联通城市群</span>
            </div>
          </div>
        </div>

        <!-- Mode Sub-Metrics: Flight vs HSR -->
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Flight Box -->
          <div
            class="rounded-2xl p-3 bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 flex flex-col"
          >
            <div
              class="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1"
            >
              <span class="text-xs font-semibold flex items-center gap-1">
                <Plane class="w-3.5 h-3.5" /> 航班记录
              </span>
              <span
                class="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 rounded-md font-mono"
              >
                {{ stats.kmFlightPct }}%
              </span>
            </div>
            <span class="text-base font-bold text-slate-900 dark:text-white font-mono">
              {{ displayDist(stats.flightKm) }}
              <span class="text-[10px] font-normal text-slate-400">{{ unitLabel }}</span>
            </span>
            <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5"
              >{{ stats.flightCount }} 架次</span
            >
          </div>

          <!-- HSR Box -->
          <div
            class="rounded-2xl p-3 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex flex-col"
          >
            <div
              class="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1"
            >
              <span class="text-xs font-semibold flex items-center gap-1">
                <Train class="w-3.5 h-3.5" /> 铁路记录
              </span>
              <span
                class="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 rounded-md font-mono"
              >
                {{ stats.kmHsrPct }}%
              </span>
            </div>
            <span class="text-base font-bold text-slate-900 dark:text-white font-mono">
              {{ displayDist(stats.hsrKm) }}
              <span class="text-[10px] font-normal text-slate-400">{{ unitLabel }}</span>
            </span>
            <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5"
              >{{ stats.hsrCount }} 车次</span
            >
          </div>
        </div>

        <!-- Proportional Ratio Bar -->
        <div class="flex flex-col gap-1">
          <div
            class="w-full h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex"
          >
            <div
              class="h-full bg-emerald-400 transition-all duration-500"
              :style="{ width: `${stats.kmFlightPct}%` }"
              title="飞行里程占比"
            />
            <div
              class="h-full bg-amber-500 transition-all duration-500"
              :style="{ width: `${stats.kmHsrPct}%` }"
              title="铁路里程占比"
            />
          </div>
          <div
            class="flex justify-between text-[10px] font-medium text-slate-400 px-0.5"
          >
            <span>民航 {{ stats.kmFlightPct }}%</span>
            <span>铁路 {{ stats.kmHsrPct }}%</span>
          </div>
        </div>

        <!-- 载具与出行偏好画像分析板块 -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <!-- Tab Navigation -->
          <div
            class="grid grid-cols-4 gap-1 mb-2.5 text-[11px] font-medium text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 p-0.5 rounded-xl"
          >
            <button
              @click="activeTab = 'PREF'"
              :class="[
                'py-1 rounded-lg transition-colors text-center',
                activeTab === 'PREF'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              偏好画像
            </button>
            <button
              @click="activeTab = 'STATIONS'"
              :class="[
                'py-1 rounded-lg transition-colors text-center',
                activeTab === 'STATIONS'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              高频枢纽
            </button>
            <button
              @click="activeTab = 'AIRLINES'"
              :class="[
                'py-1 rounded-lg transition-colors text-center',
                activeTab === 'AIRLINES'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              常坐航司
            </button>
            <button
              @click="activeTab = 'TRAINS'"
              :class="[
                'py-1 rounded-lg transition-colors text-center',
                activeTab === 'TRAINS'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-300',
              ]"
            >
              常坐车次
            </button>
          </div>

          <!-- 1. 偏好画像 Tab: 机型分布 + 铁路谱系 + 时段分布 -->
          <div v-if="activeTab === 'PREF'" class="flex flex-col gap-2.5 text-xs">
            <!-- 宽体 vs 窄体 -->
            <div class="rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/40">
              <div class="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                <span>民航机型结构 (宽体 vs 窄体)</span>
                <span class="font-mono text-sky-500">{{ stats.widePct }}% : {{ stats.narrowPct }}%</span>
              </div>
              <div class="w-full h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex mb-1">
                <div class="h-full bg-sky-500" :style="{ width: `${stats.widePct}%` }" title="宽体机占比" />
                <div class="h-full bg-slate-400" :style="{ width: `${stats.narrowPct}%` }" title="窄体机占比" />
              </div>
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>宽体客机 {{ stats.wideCount }} 次</span>
                <span>窄体客机 {{ stats.narrowCount }} 次</span>
              </div>
            </div>

            <!-- 铁路谱系构成 -->
            <div class="rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/40">
              <div class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                铁路动车组谱系打卡
              </div>
              <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div class="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                  <div class="font-bold">复兴号</div>
                  <div class="font-mono">{{ stats.fuxingCount }} 次</div>
                </div>
                <div class="rounded-lg bg-sky-500/10 p-1.5 text-sky-600 dark:text-sky-400">
                  <div class="font-bold">和谐号</div>
                  <div class="font-mono">{{ stats.hexieCount }} 次</div>
                </div>
                <div class="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                  <div class="font-bold">常态普速</div>
                  <div class="font-mono">{{ stats.classicCount }} 次</div>
                </div>
              </div>
            </div>

            <!-- 时段与工作日分布 -->
            <div class="grid grid-cols-2 gap-2 text-[10px]">
              <div class="rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                    <Sun class="w-3 h-3 text-amber-500" /> 日间 / 红眼
                  </div>
                  <div class="text-slate-400 mt-0.5">夜航: {{ stats.redEyeCount }} 次</div>
                </div>
                <div class="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                  {{ stats.daytimeCount }}:{{ stats.redEyeCount }}
                </div>
              </div>

              <div class="rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                    <Briefcase class="w-3 h-3 text-sky-500" /> 工作日 / 周末
                  </div>
                  <div class="text-slate-400 mt-0.5">通勤: {{ stats.weekdayCount }} 次</div>
                </div>
                <div class="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                  {{ stats.weekdayCount }}:{{ stats.weekendCount }}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Top Stations List -->
          <div
            v-else-if="activeTab === 'STATIONS'"
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

          <!-- 3. Top Airlines List -->
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

          <!-- 4. Top Trains List -->
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
                  class="font-mono font-bold text-amber-600 dark:text-amber-400"
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
              当前过滤条件无列车车次
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
