export type ThemePreference = "system" | "light" | "dark";

const KEY = "nubestock.theme";

export const readTheme = (): ThemePreference => {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

export const applyTheme = (preference: ThemePreference) => {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  try {
    if (preference === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, preference);
  } catch {
    // Preferencia opcional.
  }
};
