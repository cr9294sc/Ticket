<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X, Plane, Train } from "lucide-vue-next";
import PlaceInput from "./PlaceInput.vue";
import { useTripStore } from "../stores/useTripStore";
import { useUiStore } from "../stores/useUiStore";
import {
  AIRCRAFT_PRESETS, CABINS, TRAIN_MODELS, SEAT_CLASSES,
  airportById, stationByName, flightKm, railKm, classifyTrain,
  TRAIN_CODE_RE, FLIGHT_CODE_RE, REG_RE, aircraftBody, railFamily,
  type TripInput,
} from "../core/catalog";

const store = useTripStore();
const ui = useUiStore();

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): TripInput => ({
  type: "FLIGHT", date: today(), code: "", from: "", to: "", notes: "",
  aircraft: "", registration: "", cabin: "经济", seat: "", trainModel: "", seatClass: "二等座",
  departTime: "", durationMin: undefined,
});
const form = ref<TripInput>(blank());
const customAircraft = ref(false);
const errorMsg = ref("");
const saving = ref(false);

watch(
  () => ui.entryOpen.value,
  (open) => {
    if (!open) return;
    errorMsg.value = "";
    form.value = blank();
    customAircraft.value = false;
    const id = ui.editingId.value;
    if (id) {
      const t = store.allTrips.value.find((x) => x.id === id);
      if (t) {
        form.value = {
          id: t.id, type: t.type, date: t.date, code: t.code, from: t.originId, to: t.destId,
          notes: t.notes || "", aircraft: t.aircraft || "", registration: t.registration || "",
          cabin: t.cabin || "经济", seat: t.seat || "", trainModel: t.trainModel || "",
          seatClass: t.seatClass || "二等座", departTime: t.departTime || "",
          durationMin: t.durationEstimated ? undefined : t.durationMin,
        };
        const all = [...AIRCRAFT_PRESETS.宽体, ...AIRCRAFT_PRESETS.窄体] as string[];
        customAircraft.value = !!t.aircraft && !all.includes(t.aircraft);
      }
    } else {
      const p = ui.entryPrefill.value;
      if (p.type) form.value.type = p.type;
      if (p.from) form.value.from = p.from;
      if (p.to) form.value.to = p.to;
    }
  },
);

const isFlight = computed(() => form.value.type === "FLIGHT");

watch(() => form.value.type, () => {
  // 切换交通方式时,已选站点不再适用
  if (!ui.editingId.value) { form.value.from = ""; form.value.to = ""; }
});

const normCode = () => { form.value.code = form.value.code.toUpperCase().replace(/\s+/g, ""); };

const codeValid = computed(() => !form.value.code || (isFlight.value ? FLIGHT_CODE_RE : TRAIN_CODE_RE).test(form.value.code));
const trainKind = computed(() => form.value.code && TRAIN_CODE_RE.test(form.value.code)
  ? (classifyTrain(form.value.code) === "HSR" ? (form.value.code.startsWith("D") ? "动车" : "高铁") : "普速") : "");

const sameEnds = computed(() => !!form.value.from && form.value.from === form.value.to);

// 实时测距
const preview = computed(() => {
  const { from, to } = form.value;
  if (!from || !to || from === to) return null;
  if (isFlight.value) {
    const a = airportById(from), b = airportById(to);
    return a && b ? { km: flightKm(a, b), label: "大圆距离" } : null;
  }
  const a = stationByName(from), b = stationByName(to);
  return a && b ? { km: railKm(a, b), label: "轨道折算里程" } : null;
});

const bodyHint = computed(() => form.value.aircraft ? (aircraftBody(form.value.aircraft) === "WIDE" ? "宽体" : "窄体") : "");
const familyHint = computed(() => form.value.trainModel ? railFamily(form.value.trainModel) : "");
const seatHint = computed(() => {
  const m = /^(\d{1,3})([A-L])$/i.exec(form.value.seat || "");
  if (!m) return "";
  const c = m[2].toUpperCase();
  const wide = form.value.aircraft && aircraftBody(form.value.aircraft) === "WIDE";
  const windows = wide ? "AK" : "AF";
  const aisles = wide ? "CDGH" : "CD";
  return windows.includes(c) ? "靠窗" : aisles.includes(c) ? "靠过道" : "中间";
});

const close = () => ui.closeEntry();

const submit = async () => {
  errorMsg.value = "";
  normCode();
  saving.value = true;
  try {
    const res = await store.saveTrip({ ...form.value });
    if (!res.ok) { errorMsg.value = res.error || "保存失败"; return; }
    ui.closeEntry();
  } finally { saving.value = false; }
};

const onAircraftSelect = (e: Event) => {
  const v = (e.target as HTMLSelectElement).value;
  if (v === "__custom") { customAircraft.value = true; form.value.aircraft = ""; }
  else { customAircraft.value = false; form.value.aircraft = v; }
};
</script>

<template>
  <div v-if="ui.entryOpen.value" class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="close" @keydown.esc="close">
    <div class="w-[560px] max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 text-slate-800 dark:text-slate-100">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">{{ ui.editingId.value ? "编辑行程" : "记录新旅程" }}</h2>
        <button @click="close" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X class="w-5 h-5" /></button>
      </div>

      <div class="flex gap-2 mb-4">
        <button :class="['btn flex items-center gap-1.5', isFlight ? 'btn-primary' : 'btn-ghost']" @click="form.type = 'FLIGHT'"><Plane class="w-4 h-4" />航班</button>
        <button :class="['btn flex items-center gap-1.5', !isFlight ? 'btn-primary' : 'btn-ghost']" @click="form.type = 'HSR'"><Train class="w-4 h-4" />列车</button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">出行日期</label>
          <input type="date" v-model="form.date" class="field" />
        </div>
        <div>
          <label class="field-label">{{ isFlight ? "航班号" : "车次" }}
            <span v-if="!isFlight && trainKind" class="ml-1 text-sky-500">· {{ trainKind }}</span>
          </label>
          <input v-model="form.code" @input="normCode" :placeholder="isFlight ? 'CA1501' : 'G1'" :class="['field', codeValid ? '' : 'border-rose-500']" />
        </div>

        <div>
          <label class="field-label">{{ isFlight ? "出发机场(三字码/中文/拼音)" : "出发车站" }}</label>
          <PlaceInput :kind="isFlight ? 'airport' : 'station'" v-model="form.from" :invalid="sameEnds" :placeholder="isFlight ? 'PEK / 首都 / bj' : '北京南 / bjn'" />
        </div>
        <div>
          <label class="field-label">{{ isFlight ? "到达机场" : "到达车站" }}</label>
          <PlaceInput :kind="isFlight ? 'airport' : 'station'" v-model="form.to" :invalid="sameEnds" :placeholder="isFlight ? 'SHA / 虹桥 / hq' : '上海虹桥'" />
        </div>
      </div>
      <p v-if="sameEnds" class="text-xs text-rose-500 mt-1">出发与到达不能相同</p>

      <div v-if="preview" class="mt-3 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sm">
        预估{{ preview.label }}:<b class="text-sky-500">{{ preview.km.toLocaleString() }} km</b>
      </div>

      <template v-if="isFlight">
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label class="field-label">执飞机型 <span v-if="bodyHint" class="text-sky-500">· {{ bodyHint }}</span></label>
            <select class="field" :value="customAircraft ? '__custom' : form.aircraft" @change="onAircraftSelect">
              <option value="">未选择</option>
              <optgroup label="宽体"><option v-for="m in AIRCRAFT_PRESETS.宽体" :key="m" :value="m">{{ m }}</option></optgroup>
              <optgroup label="窄体"><option v-for="m in AIRCRAFT_PRESETS.窄体" :key="m" :value="m">{{ m }}</option></optgroup>
              <option value="__custom">手动输入…</option>
            </select>
            <input v-if="customAircraft" v-model="form.aircraft" class="field mt-1" placeholder="如 A330-200" />
          </div>
          <div>
            <label class="field-label">机身注册号</label>
            <input v-model="form.registration" class="field" placeholder="B-1234" :class="form.registration && !REG_RE.test(form.registration.toUpperCase()) ? 'border-rose-500' : ''" />
          </div>
          <div>
            <label class="field-label">客舱等级</label>
            <select class="field" v-model="form.cabin"><option v-for="c in CABINS" :key="c">{{ c }}</option></select>
          </div>
          <div>
            <label class="field-label">座位号 <span v-if="seatHint" class="text-sky-500">· {{ seatHint }}</span></label>
            <input v-model="form.seat" class="field" placeholder="41K" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label class="field-label">车型 <span v-if="familyHint" class="text-sky-500">· {{ familyHint }}</span></label>
            <select class="field" v-model="form.trainModel">
              <option value="">未选择</option>
              <optgroup v-for="g in TRAIN_MODELS" :key="g.group" :label="g.group"><option v-for="m in g.items" :key="m">{{ m }}</option></optgroup>
            </select>
          </div>
          <div>
            <label class="field-label">席别</label>
            <select class="field" v-model="form.seatClass"><option v-for="c in SEAT_CLASSES" :key="c">{{ c }}</option></select>
          </div>
        </div>
      </template>

      <div class="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label class="field-label">出发时刻(可选)</label>
          <input type="time" v-model="form.departTime" class="field" />
        </div>
        <div>
          <label class="field-label">耗时(分钟,可选,默认按里程估算)</label>
          <input type="number" min="1" v-model.number="form.durationMin" class="field" />
        </div>
      </div>
      <div class="mt-3">
        <label class="field-label">备注</label>
        <input v-model="form.notes" class="field" />
      </div>

      <p v-if="errorMsg" class="mt-3 text-sm text-rose-500">{{ errorMsg }}</p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn btn-ghost" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">保存并上图</button>
      </div>
    </div>
  </div>
</template>
