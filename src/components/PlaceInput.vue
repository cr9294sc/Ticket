<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { searchAirports, searchStations, airportById, stationByName } from "../core/catalog";

const props = defineProps<{
  kind: "airport" | "station";
  modelValue: string; // 机场 IATA / 车站名
  placeholder?: string;
  invalid?: boolean;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

const text = ref("");
const open = ref(false);
const active = ref(0);

const display = (id: string) => {
  if (!id) return "";
  if (props.kind === "airport") {
    const a = airportById(id);
    return a ? `${a.id} · ${a.name}` : id;
  }
  const s = stationByName(id);
  return s ? `${s.n}站` : id;
};

watch(
  () => props.modelValue,
  (v) => {
    text.value = display(v);
  },
  { immediate: true },
);

const options = computed(() => {
  const q = text.value.includes(" · ") ? "" : text.value;
  if (props.kind === "airport") {
    return searchAirports(q).map((a) => ({ id: a.id, label: `${a.id} · ${a.name}`, sub: a.country }));
  }
  return searchStations(q).map((s) => ({ id: s.n, label: `${s.n}站`, sub: "" }));
});

const onInput = (e: Event) => {
  text.value = (e.target as HTMLInputElement).value;
  open.value = true;
  active.value = 0;
  // 输入变化即视为未选中
  if (props.modelValue) emit("update:modelValue", "");
};
const onBlur = () => {
  setTimeout(() => (open.value = false), 120);
};
const pick = (id: string) => {
  emit("update:modelValue", id);
  text.value = display(id);
  open.value = false;
};
const onKey = (e: KeyboardEvent) => {
  if (!open.value || !options.value.length) return;
  if (e.key === "ArrowDown") { active.value = (active.value + 1) % options.value.length; e.preventDefault(); }
  else if (e.key === "ArrowUp") { active.value = (active.value - 1 + options.value.length) % options.value.length; e.preventDefault(); }
  else if (e.key === "Enter") { pick(options.value[active.value].id); e.preventDefault(); }
  else if (e.key === "Escape") { open.value = false; e.stopPropagation(); }
};
</script>

<template>
  <div class="relative">
    <input
      :value="text"
      @input="onInput"
      @focus="open = true"
      @blur="onBlur"
      @keydown="onKey"
      :placeholder="placeholder"
      :class="['field', invalid ? 'border-rose-500' : '']"
      autocomplete="off"
    />
    <ul
      v-if="open && options.length"
      class="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xl text-sm"
    >
      <li
        v-for="(o, i) in options"
        :key="o.id"
        @mousedown.prevent="pick(o.id)"
        :class="['px-3 py-1.5 cursor-pointer flex justify-between', i === active ? 'bg-sky-600/40' : 'hover:bg-slate-700/60']"
      >
        <span>{{ o.label }}</span>
        <span class="text-slate-400 text-xs">{{ o.sub }}</span>
      </li>
    </ul>
  </div>
</template>
