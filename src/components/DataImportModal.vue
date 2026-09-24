<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useTripStore } from "../stores/useTripStore";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  PlusCircle,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  GitBranch,
} from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const tripStore = useTripStore();

const isDev = ref(false);
const activeTab = ref<"QUICK_ADD" | "CSV_EDIT" | "GIT_PUSH">("QUICK_ADD");

const csvContent = ref("");
const isLoadingCsv = ref(false);
const isSaving = ref(false);
const statusMessage = ref<{ type: "success" | "error"; text: string } | null>(
  null,
);

// Quick add form state
const newTrip = ref({
  date: new Date().toISOString().split("T")[0],
  type: "flight",
  code: "",
  from: "",
  to: "",
  notes: "",
});

// Git push state
const commitMessage = ref("Update travel records");
const isPushing = ref(false);
const pushLogs = ref("");

onMounted(async () => {
  await checkDevStatus();
  if (isDev.value) {
    await loadCsvData();
  }
});

const checkDevStatus = async () => {
  try {
    const res = await fetch("./api/dev-status");
    if (res.ok) {
      const data = await res.json();
      isDev.value = !!data.isDev;
    } else {
      isDev.value = false;
    }
  } catch {
    isDev.value = false;
  }
};

const loadCsvData = async () => {
  isLoadingCsv.value = true;
  try {
    const res = await fetch("./api/load-csv");
    if (res.ok) {
      const data = await res.json();
      csvContent.value = data.content || "";
    }
  } catch (err: any) {
    statusMessage.value = {
      type: "error",
      text: "加载 CSV 失败: " + err.message,
    };
  } finally {
    isLoadingCsv.value = false;
  }
};

const saveCsvData = async (customContent?: string) => {
  const contentToSave = customContent ?? csvContent.value;
  isSaving.value = true;
  statusMessage.value = null;

  try {
    const res = await fetch("./api/save-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: contentToSave }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "保存失败");
    }

    csvContent.value = contentToSave;
    statusMessage.value = {
      type: "success",
      text: data.message || "数据已更新并成功重新生成！",
    };

    // Reload trip store
    await tripStore.fetchData();
  } catch (err: any) {
    statusMessage.value = {
      type: "error",
      text: "处理失败: " + err.message,
    };
  } finally {
    isSaving.value = false;
  }
};

const handleQuickAdd = async () => {
  if (
    !newTrip.value.date ||
    !newTrip.value.code ||
    !newTrip.value.from ||
    !newTrip.value.to
  ) {
    statusMessage.value = {
      type: "error",
      text: "请填写完整出行信息（日期、类型、班次、起点、终点）",
    };
    return;
  }

  // Ensure CSV header exists
  let current = csvContent.value.trim();
  if (!current.startsWith("date,type,code,from,to,notes")) {
    current = "date,type,code,from,to,notes\n" + current;
  }

  const newLine = `${newTrip.value.date},${newTrip.value.type},${newTrip.value.code},${newTrip.value.from},${newTrip.value.to},${newTrip.value.notes}`;
  const updatedCsv = current + "\n" + newLine;

  await saveCsvData(updatedCsv);

  // Clear form on success
  if (statusMessage.value?.type === "success") {
    newTrip.value.code = "";
    newTrip.value.from = "";
    newTrip.value.to = "";
    newTrip.value.notes = "";
  }
};

const handleFileUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    if (text) {
      csvContent.value = text;
      statusMessage.value = {
        type: "success",
        text: `已载入本地文件: ${file.name}`,
      };
    }
  };
  reader.readAsText(file, "utf-8");
};

const handleGitPush = async () => {
  isPushing.value = true;
  pushLogs.value = "正在推送数据到 GitHub 远程仓库...";
  statusMessage.value = null;

  try {
    const res = await fetch("./api/git-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: commitMessage.value }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Git Push 失败");
    }

    pushLogs.value = data.stdout || "推送成功完成！";
    statusMessage.value = {
      type: "success",
      text: "成功提交并推送到 GitHub！GitHub Pages 将在数分钟内自动更新部署。",
    };
  } catch (err: any) {
    pushLogs.value = "推送出错: " + err.message;
    statusMessage.value = {
      type: "error",
      text: "Git 推送失败: " + err.message,
    };
  } finally {
    isPushing.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div
        class="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20"
          >
            <UploadCloud class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              旅行轨迹数据管理
            </h2>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">
              {{
                isDev
                  ? "本地开发环境：支持直接录入、批量导入与自动同步"
                  : "线上静态展示模式（请在本地 npm run dev 录入新数据并推送）"
              }}
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tabs Navigation -->
      <div
        class="px-5 pt-3 flex gap-2 border-b border-slate-100 dark:border-slate-800/80 text-xs font-medium"
      >
        <button
          @click="activeTab = 'QUICK_ADD'"
          :class="[
            'pb-2.5 px-2.5 flex items-center gap-1.5 transition-all border-b-2',
            activeTab === 'QUICK_ADD'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <PlusCircle class="w-3.5 h-3.5" />
          <span>单条快速录入</span>
        </button>

        <button
          @click="activeTab = 'CSV_EDIT'"
          :class="[
            'pb-2.5 px-2.5 flex items-center gap-1.5 transition-all border-b-2',
            activeTab === 'CSV_EDIT'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <FileSpreadsheet class="w-3.5 h-3.5" />
          <span>CSV 批量导入/编辑</span>
        </button>

        <button
          @click="activeTab = 'GIT_PUSH'"
          :class="[
            'pb-2.5 px-2.5 flex items-center gap-1.5 transition-all border-b-2',
            activeTab === 'GIT_PUSH'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ]"
        >
          <GitBranch class="w-3.5 h-3.5" />
          <span>推送到 GitHub</span>
        </button>
      </div>

      <!-- Modal Content Body -->
      <div class="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
        <!-- Status Banner -->
        <div
          v-if="statusMessage"
          :class="[
            'p-3 rounded-xl flex items-start gap-2 text-xs font-medium',
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
          ]"
        >
          <CheckCircle2
            v-if="statusMessage.type === 'success'"
            class="w-4 h-4 shrink-0 mt-0.5"
          />
          <AlertCircle v-else class="w-4 h-4 shrink-0 mt-0.5" />
          <div class="flex-1 break-all">{{ statusMessage.text }}</div>
        </div>

        <!-- Tab 1: Quick Add -->
        <div v-if="activeTab === 'QUICK_ADD'" class="flex flex-col gap-3.5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >出行日期</label
              >
              <input
                type="date"
                v-model="newTrip.date"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >出行类型</label
              >
              <select
                v-model="newTrip.type"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="flight">飞机 (Flight)</option>
                <option value="hsr">高铁 (High-Speed Rail)</option>
              </select>
            </div>

            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >班次号 (如 CA1501 / G1)</label
              >
              <input
                type="text"
                v-model="newTrip.code"
                placeholder="例如: CA1501 或 G1"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >备注说明 (可选)</label
              >
              <input
                type="text"
                v-model="newTrip.notes"
                placeholder="例如: 商务出差 / 度假旅游"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >出发地 (三字码/站名/经纬度)</label
              >
              <input
                type="text"
                v-model="newTrip.from"
                placeholder="如: PEK 或 北京南 或 东京"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label
                class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >目的地 (三字码/站名/经纬度)</label
              >
              <input
                type="text"
                v-model="newTrip.to"
                placeholder="如: SHA 或 上海虹桥 或 伦敦"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <button
            @click="handleQuickAdd"
            :disabled="isSaving"
            class="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all disabled:opacity-50"
          >
            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
            <PlusCircle v-else class="w-4 h-4" />
            <span>追加此条记录并保存同步</span>
          </button>
        </div>

        <!-- Tab 2: CSV Batch Editor -->
        <div v-else-if="activeTab === 'CSV_EDIT'" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-slate-500 dark:text-slate-400">
              编辑或粘贴你的 <code>my_trips.csv</code> 数据：
            </span>
            <label
              class="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <UploadCloud class="w-3.5 h-3.5" />
              <span>上传 .csv 文件</span>
              <input
                type="file"
                accept=".csv"
                class="hidden"
                @change="handleFileUpload"
              />
            </label>
          </div>

          <textarea
            v-model="csvContent"
            rows="10"
            placeholder="date,type,code,from,to,notes"
            class="w-full font-mono text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />

          <div class="flex items-center justify-between">
            <button
              @click="loadCsvData"
              :disabled="isLoadingCsv"
              class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw
                :class="['w-3.5 h-3.5', isLoadingCsv ? 'animate-spin' : '']"
              />
              <span>重新拉取当前文件</span>
            </button>

            <button
              @click="() => saveCsvData()"
              :disabled="isSaving"
              class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
              <CheckCircle2 v-else class="w-4 h-4" />
              <span>保存并重新生成数据</span>
            </button>
          </div>
        </div>

        <!-- Tab 3: Git Push to GitHub -->
        <div v-else class="flex flex-col gap-3.5">
          <div
            class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2"
          >
            <div
              class="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200"
            >
              <GitBranch class="w-4 h-4 text-amber-500" />
              <span>一键推送到 GitHub 远程仓库与 GitHub Pages</span>
            </div>
            <p class="text-slate-500 dark:text-slate-400 leading-relaxed">
              在本地保存数据后，点击下方推送按钮将自动打包并推送最新的行程数据与静态文件至
              GitHub，GitHub Pages 线上站点会自动同步展示。
            </p>
          </div>

          <div>
            <label
              class="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >本次提交说明 (Commit Message)</label
            >
            <input
              type="text"
              v-model="commitMessage"
              placeholder="例如: Update travel traces data"
              class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <button
            @click="handleGitPush"
            :disabled="isPushing"
            class="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-98 transition-all disabled:opacity-50"
          >
            <Loader2 v-if="isPushing" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            <span>立即一键 Git Push 推送到远程仓库</span>
          </button>

          <!-- Push Terminal Logs -->
          <div v-if="pushLogs" class="mt-2">
            <span
              class="font-semibold text-slate-500 dark:text-slate-400 block mb-1"
              >执行输出日志:</span
            >
            <pre
              class="p-3 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-36 whitespace-pre-wrap"
              >{{ pushLogs }}</pre
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
</style>
