import { ref } from "vue";

export interface EntryPrefill {
  type?: "FLIGHT" | "HSR";
  from?: string;
  to?: string;
}

const entryOpen = ref(false);
const editingId = ref<string | null>(null);
const entryPrefill = ref<EntryPrefill>({});
const listOpen = ref(false);
const importOpen = ref(false);
/** 请求地图聚焦的行程(列表点击) */
const focusTripId = ref<string | null>(null);
/** 区域钻取边界 [[minLng, minLat], [maxLng, maxLat]] */
const drillDownBounds = ref<[[number, number], [number, number]] | null>(null);

export function useUiStore() {
  const openEntry = (prefill: EntryPrefill = {}, editId: string | null = null) => {
    entryPrefill.value = prefill;
    editingId.value = editId;
    entryOpen.value = true;
  };
  const closeEntry = () => {
    entryOpen.value = false;
    editingId.value = null;
  };
  const drillDown = (bounds: [[number, number], [number, number]]) => {
    drillDownBounds.value = bounds;
  };
  return {
    entryOpen,
    editingId,
    entryPrefill,
    listOpen,
    importOpen,
    focusTripId,
    drillDownBounds,
    openEntry,
    closeEntry,
    drillDown,
  };
}
