"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_THEME,
  FALLBACK_THEME,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readResolved(): ResolvedTheme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** Swaps the theme class without every `transition-colors` animating at once. */
function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(freeze);

  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));

  // Flush styles with transitions off, then restore them. A timeout rather than
  // requestAnimationFrame: rAF never fires in a hidden tab (e.g. a change that
  // arrives from another tab through the storage event).
  void window.getComputedStyle(root).opacity;
  window.setTimeout(() => freeze.remove(), 1);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY) return;
  apply(resolve(readPreference()));
  notify();
}

function handleSystemChange() {
  if (readPreference() !== "system") return;
  apply(resolve("system"));
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    window.addEventListener("storage", handleStorage);
    window.matchMedia(DARK_QUERY).addEventListener("change", handleSystemChange);
    // The <head> script ran before any metadata existed; sync the chrome color now.
    apply(readResolved());
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
      window.matchMedia(DARK_QUERY).removeEventListener("change", handleSystemChange);
    }
  };
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: the choice still applies to this page.
  }
  apply(resolve(preference));
  notify();
}

/** What the user picked: light, dark or system. Server render assumes the default. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => DEFAULT_THEME);
}

/** The theme actually on screen right now. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, readResolved, () => FALLBACK_THEME);
}
