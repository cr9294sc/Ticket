import { ref, computed } from "vue";
import type { ColorScheme } from "../types/travel";

export const LIGHT_THEME: ColorScheme = {
  bg: "#F1F5F9",
  landFill: "#FFFFFF",
  landStroke: "#CBD5E1",
  provinceStroke: "rgba(148, 163, 184, 0.45)",
  visitedFill: "rgba(59, 130, 246, 0.14)",
  visitedGlow: "rgba(59, 130, 246, 0.35)",
  visitedStroke: "rgba(37, 99, 235, 0.75)",
  flightPrimary: "#0284C7",
  flightGlow: "rgba(2, 132, 199, 0.3)",
  hsrPrimary: "#EA580C",
  railNetworkStroke: "rgba(203, 213, 225, 0.65)",
  nodeAirport: "#0284C7",
  nodeTrain: "#EA580C",
  nodeHalo: "rgba(2, 132, 199, 0.2)",
  hoverHighlight: "#2563EB",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  cardBg: "rgba(255, 255, 255, 0.92)",
  cardBorder: "rgba(226, 232, 240, 0.85)",
};

export const DARK_THEME: ColorScheme = {
  bg: "#0B0F17",
  landFill: "#161F2E",
  landStroke: "rgba(100, 116, 139, 0.35)",
  provinceStroke: "rgba(71, 85, 105, 0.4)",
  visitedFill: "rgba(56, 189, 248, 0.18)",
  visitedGlow: "rgba(56, 189, 248, 0.6)",
  visitedStroke: "rgba(56, 189, 248, 0.85)",
  flightPrimary: "#38BDF8",
  flightGlow: "rgba(56, 189, 248, 0.45)",
  hsrPrimary: "#FB923C",
  railNetworkStroke: "rgba(71, 85, 105, 0.3)",
  nodeAirport: "#38BDF8",
  nodeTrain: "#FB923C",
  nodeHalo: "rgba(56, 189, 248, 0.25)",
  hoverHighlight: "#60A5FA",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  cardBg: "rgba(15, 23, 42, 0.9)",
  cardBorder: "rgba(51, 65, 85, 0.8)",
};

const isDark = ref<boolean>(false);

// Initialize system theme or stored theme (defaults to Light Theme)
const stored = typeof localStorage !== "undefined" ? localStorage.getItem("theme-mode") : null;
if (stored) {
  isDark.value = stored === "dark";
} else {
  // 默认清新明亮模式
  isDark.value = false;
}

const syncDocumentClass = () => {
  if (isDark.value) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};
syncDocumentClass();

export function useThemeStore() {
  const toggleTheme = () => {
    isDark.value = !isDark.value;
    localStorage.setItem("theme-mode", isDark.value ? "dark" : "light");
    syncDocumentClass();
  };

  const currentTheme = computed<ColorScheme>(() =>
    isDark.value ? DARK_THEME : LIGHT_THEME,
  );

  return {
    isDark,
    toggleTheme,
    currentTheme,
    LIGHT_THEME,
    DARK_THEME,
  };
}
