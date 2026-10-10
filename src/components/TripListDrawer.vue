<script setup lang="ts">
import { ref, computed } from "vue";
import { X, Search, Pencil, Trash2, Plane, Train, Download, Upload, RotateCcw } from "lucide-vue-next";
import { useTripStore } from "../stores/useTripStore";
import { useUiStore } from "../stores/useUiStore";
import { tripsToCsv, tripsToJson, download, parseImport, materialize } from "../core/io";
import type { TripEntity } from "../types/travel";

const store = useTripStore();
const ui = useUiStore();
const query = ref("");
const message = ref("");
const fileRef = ref<HTMLInputElement | null>(null);

const haystack = (t: TripEntity) =>
  [t.date, t.code, t.originId, t.originName, t.originCity, t.destId, t.destName, t.destCity, t.airlineName,
   t.aircraft, t.registration, t.cabin, t.seat, t.trainModel, t.seatClass, t.notes, t.type === "FLIGHT" ? "航班 飞机" : "高铁 铁路 火车"]
    .filter(Boolean).join(" ").toLowerCase();

const list = computed(() => {
  const kw = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = [...store.allTrips.value].reverse();
  return kw.length ? all.filter((t) => kw.every((k) => haystack(t).includes(k))) : all;
});

const remove = async (t: TripEntity) => {
  if (confirm(`删除 ${t.date} ${t.code}(${t.originCity} → ${t.destCity})?`)) await store.deleteTrip(t.id);
};

const exportCsv = () => download(`travel-trips-${new Date().toISOString().slice(0, 10)}.csv`, tripsToCsv(store.allTrips.value), "text/csv;charset=utf-8");
const exportJson = () => download(`travel-trips-${new Date().toISOString().slice(0, 10)}.json`, tripsToJson(store.allTrips.value), "application/json");

const onFile = async (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const text = await f.text();
  const { trips, errors, skipped } = materialize(parseImport(text, f.name), store.allTrips.value);
  if (trips.length) await store.importTrips(trips);
  message.value = `导入 ${trips.length} 条,跳过重复 ${skipped} 条` + (errors.length ? `,失败 ${errors.length} 条:${errors.slice(0, 3).join(";")}` : "");
  (e.target as HTMLInputElement).value = "";
};

const reset = async () => {
  if (confirm("清除所有浏览器本地改动(新增/修改/删除),恢复到 CSV 基线?")) {
    await store.resetLocal();
    message.value = "已恢复到 CSV 基线";
  }
};
</script>

<template>
  <transition name="fade">
    <aside v-if="ui.listOpen.value" class="fixed top-0 right-0 bottom-0 z-30 w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col text-slate-800 dark:text-slate-100">
      <div class="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <h2 class="font-bold">出行记录 <span class="text-xs font-normal text-slate-500">{{ list.length }} / {{ store.allTrips.value.length }}</span></h2>
        <button @click="ui.listOpen.value = false" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X class="w-5 h-5" /></button>
      </div>
      <div class="p-3 relative">
        <Search class="w-4 h-4 absolute left-6 top-6 text-slate-400" />
        <input v-model="query" class="field pl-9" placeholder="全文搜索:航班号、城市、机型、座位、备注…" />
      </div>
      <div class="flex-1 overflow-auto px-3 pb-3 space-y-2">
        <div v-for="t in list" :key="t.id" @click="ui.focusTripId.value = t.id"
             class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-sky-500 transition-colors">
          <div class="flex items-center justify-between text-xs text-slate-500">
            <span class="flex items-center gap-1"><component :is="t.type === 'FLIGHT' ? Plane : Train" class="w-3.5 h-3.5" />{{ t.date }}</span>
            <span>{{ t.distanceKm.toLocaleString() }} km</span>
          </div>
          <div class="mt-1 font-semibold">{{ t.code }} · {{ t.originCity }} → {{ t.destCity }}</div>
          <div class="text-xs text-slate-500 truncate">
            {{ [t.airlineName, t.aircraft, t.registration, t.cabin, t.seat, t.trainModel, t.seatClass, t.notes].filter(Boolean).join(" · ") }}
          </div>
          <div class="mt-2 flex gap-2 justify-end">
            <button class="btn btn-ghost !py-0.5 flex items-center gap-1" @click.stop="ui.openEntry({}, t.id)"><Pencil class="w-3 h-3" />编辑</button>
            <button class="btn btn-ghost !py-0.5 flex items-center gap-1 hover:!bg-rose-600 hover:!text-white" @click.stop="remove(t)"><Trash2 class="w-3 h-3" />删除</button>
          </div>
        </div>
        <p v-if="!list.length" class="text-center text-sm text-slate-500 py-10">没有匹配的记录</p>
      </div>
      <div class="p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <p v-if="message" class="text-xs text-sky-500">{{ message }}</p>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-ghost flex items-center gap-1" @click="exportCsv"><Download class="w-4 h-4" />CSV</button>
          <button class="btn btn-ghost flex items-center gap-1" @click="exportJson"><Download class="w-4 h-4" />JSON</button>
          <button class="btn btn-ghost flex items-center gap-1" @click="fileRef?.click()"><Upload class="w-4 h-4" />导入</button>
          <button class="btn btn-ghost flex items-center gap-1 ml-auto" @click="reset" title="清除本地改动"><RotateCcw class="w-4 h-4" />重置</button>
        </div>
        <input ref="fileRef" type="file" accept=".csv,.json" class="hidden" @change="onFile" />
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: transform 0.2s, opacity 0.2s; }
.fade-enter-from, .fade-leave-to { transform: translateX(24px); opacity: 0; }
</style>
