import { ref, computed } from "vue";
import type { ColorScheme } from "../types/travel";

export const LIGHT_THEME: ColorScheme = {
  bg: "#FFFFFF",
  landFill: "#F1F5F9",
  landStroke: "#CBD5E1",
  flightPrimary: "#D97706",
  flightGlow: "rgba(217, 119, 6, 0.35)",
  hsrPrimary: "#059669",
  nodeAirport: "#D97706",
  nodeTrain: "#059669",
  nodeHalo: "rgba(217, 119, 6, 0.2)",
  hoverHighlight: "#2563EB",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  cardBg: "rgba(255, 255, 255, 0.88)",
  cardBorder: "rgba(226, 232, 240, 0.8)",
};

export const DARK_THEME: ColorScheme = {
  bg: "#0F172A",
  landFill: "#1E293B",
  landStroke: "#334155",
  flightPrimary: "#FFE066",
  flightGlow: "rgba(255, 224, 102, 0.4)",
  hsrPrimary: "#10B981",
  nodeAirport: "#FFE066",
  nodeTrain: "#10B981",
  nodeHalo: "rgba(255, 224, 102, 0.25)",
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
} else if (
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
) {
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
