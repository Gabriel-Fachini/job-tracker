export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
/** The app has always been dark; new devices start there until the user picks. */
export const DEFAULT_THEME: ThemePreference = "dark";
/** What the server renders and what the script falls back to if storage throws. */
export const FALLBACK_THEME: ResolvedTheme = "dark";

/** Browser chrome color per theme; matches `--background`. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#000000",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs in <head> before first paint: resolves the stored preference and sets
 * the `light`/`dark` class on <html>, so there is never a flash of the wrong
 * theme. Kept dependency-free and ES5 so it can be inlined as-is.
 */
export const themeInitScript = `(function(){var d=document.documentElement;try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var p=s==="light"||s==="dark"||s==="system"?s:${JSON.stringify(
  DEFAULT_THEME,
)};var r=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.classList.remove("light","dark");d.classList.add(r);d.style.colorScheme=r;}catch(e){d.classList.add(${JSON.stringify(FALLBACK_THEME)});}})();`;
