export const SETTINGS_STORAGE_KEY = "keyviewer.settings.v1";
export const SETTINGS_EVENT = "settings-updated";

export const DEFAULT_SETTINGS = {
  alwaysOnTop: false,
  keyScale: 1,
  showE: false,
  showG: false,
  showShift: false,
  flipExtraKeys: false,
};

export function clampKeyScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.keyScale;
  return Math.min(1.6, Math.max(0.6, numeric));
}

export function normalizeSettings(input = {}) {
  return {
    alwaysOnTop: Boolean(input.alwaysOnTop),
    keyScale: clampKeyScale(input.keyScale ?? DEFAULT_SETTINGS.keyScale),
    showE: Boolean(input.showE),
    showG: Boolean(input.showG),
    showShift: Boolean(input.showShift),
    flipExtraKeys: Boolean(input.flipExtraKeys),
  };
}

export function loadSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  const next = normalizeSettings(settings);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
