import { ref, computed } from "vue";
import type { ColorScheme } from "../types/travel";

export const LIGHT_THEME: ColorScheme = {
  bg: "#E6EBF0",
  landFill: "#F4F6F8",
  landStroke: "#9AA5B1",
  provinceStroke: "rgba(120, 134, 150, 0.45)",
  visitedFill: "rgba(37, 99, 235, 0.16)",
  visitedGlow: "rgba(37, 99, 235, 0.5)",
  visitedStroke: "rgba(37, 99, 235, 0.75)",
  flightPrimary: "#0F766E",
  flightGlow: "rgba(15, 118, 110, 0.3)",
  hsrPrimary: "#C2570C",
  railNetworkStroke: "rgba(100, 116, 139, 0.28)",
  nodeAirport: "#0F766E",
  nodeTrain: "#C2570C",
  nodeHalo: "rgba(15, 118, 110, 0.2)",
  hoverHighlight: "#2563EB",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  cardBg: "rgba(255, 255, 255, 0.88)",
  cardBorder: "rgba(226, 232, 240, 0.8)",
};

export const DARK_THEME: ColorScheme = {
  bg: "#050B14",
  landFill: "#14202E",
  landStroke: "rgba(110, 140, 170, 0.35)",
  provinceStroke: "rgba(110, 140, 170, 0.22)",
  visitedFill: "rgba(56, 140, 248, 0.20)",
  visitedGlow: "rgba(56, 160, 255, 0.75)",
  visitedStroke: "rgba(90, 175, 255, 0.85)",
  flightPrimary: "#4DFFB4",
  flightGlow: "rgba(77, 255, 180, 0.45)",
  hsrPrimary: "#FF9F43",
  railNetworkStroke: "rgba(64, 187, 223, 0.16)",
  nodeAirport: "#4DFFB4",
  nodeTrain: "#FF9F43",
  nodeHalo: "rgba(77, 255, 180, 0.25)",
  hoverHighlight: "#60A5FA",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  cardBg: "rgba(15, 23, 42, 0.88)",
  cardBorder: "rgba(51, 65, 85, 0.8)",
};

const isDark = ref<boolean>(false);

// Initialize system theme or stored theme
const stored = localStorage.getItem("theme-mode");
if (stored) {
  isDark.value = stored === "dark";
} else {
  // 默认夜航深空模式
  isDark.value = true;
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
