export const SETTINGS_STORAGE_KEY = "keyviewer.settings.v3";
export const SETTINGS_EVENT = "settings-updated";

export const VIEWER_BINDINGS = [
  { id: "w", label: "위쪽 슬롯", defaultCode: "KeyW" },
  { id: "a", label: "왼쪽 슬롯", defaultCode: "KeyA" },
  { id: "s", label: "아래쪽 슬롯", defaultCode: "KeyS" },
  { id: "d", label: "오른쪽 슬롯", defaultCode: "KeyD" },
  { id: "space", label: "스페이스", defaultCode: "Space" },
  { id: "e", label: "E 추가키", defaultCode: "KeyE" },
  { id: "g", label: "G 추가키", defaultCode: "KeyG" },
  { id: "c", label: "C 추가키", defaultCode: "KeyC" },
  { id: "shift", label: "Shift 추가키", defaultCode: "ShiftLeft" },
];

export const DEFAULT_BINDINGS = Object.fromEntries(
  VIEWER_BINDINGS.map((binding) => [binding.id, binding.defaultCode]),
);

export const DEFAULT_SETTINGS = {
  alwaysOnTop: false,
  lockPosition: false,
  keyScale: 1,
  showE: false,
  showG: false,
  showC: false,
  showShift: false,
  boostOnShift: false,
  flipExtraKeys: false,
  keyBindings: DEFAULT_BINDINGS,
};

export function clampKeyScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.keyScale;
  return Math.min(1.6, Math.max(0.6, numeric));
}

function normalizeKeyCode(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeKeyBindings(input = {}) {
  return Object.fromEntries(
    VIEWER_BINDINGS.map((binding) => [
      binding.id,
      normalizeKeyCode(input?.[binding.id], binding.defaultCode),
    ]),
  );
}

export function normalizeSettings(input = {}) {
  return {
    alwaysOnTop: Boolean(input.alwaysOnTop),
    lockPosition: Boolean(input.lockPosition),
    keyScale: clampKeyScale(input.keyScale ?? DEFAULT_SETTINGS.keyScale),
    showE: Boolean(input.showE),
    showG: Boolean(input.showG),
    showC: Boolean(input.showC),
    showShift: Boolean(input.showShift),
    boostOnShift: Boolean(input.boostOnShift),
    flipExtraKeys: Boolean(input.flipExtraKeys),
    keyBindings: normalizeKeyBindings(input.keyBindings),
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

export function formatBindingToken(code) {
  if (!code) return "미설정";
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);

  const labels = {
    Space: "Space",
    ArrowUp: "Arrow Up",
    ArrowDown: "Arrow Down",
    ArrowLeft: "Arrow Left",
    ArrowRight: "Arrow Right",
    ShiftLeft: "Left Shift",
    ShiftRight: "Right Shift",
    ControlLeft: "Left Ctrl",
    ControlRight: "Right Ctrl",
    AltLeft: "Left Alt",
    AltRight: "Right Alt",
    Enter: "Enter",
    Escape: "Esc",
    Tab: "Tab",
    Backspace: "Backspace",
    MouseForward: "Mouse Forward",
    MouseBackward: "Mouse Backward",
    MouseLeft: "Mouse Left",
    MouseRight: "Mouse Right",
    MouseMiddle: "Mouse Middle",
  };

  return labels[code] ?? code;
}

export function bindingTokenToPayloadMatches(code) {
  if (!code) return [];

  if (code.startsWith("Mouse")) {
    return [code];
  }

  const aliases = new Set([code]);
  const lookup = {
    ArrowUp: ["UpArrow"],
    ArrowDown: ["DownArrow"],
    ArrowLeft: ["LeftArrow"],
    ArrowRight: ["RightArrow"],
    Enter: ["Return"],
    Escape: ["Escape"],
    Space: ["Space"],
    ShiftLeft: ["ShiftLeft"],
    ShiftRight: ["ShiftRight"],
    ControlLeft: ["ControlLeft"],
    ControlRight: ["ControlRight"],
    AltLeft: ["Alt", "AltGr"],
    AltRight: ["Alt", "AltGr"],
    Backspace: ["Backspace"],
    Tab: ["Tab"],
  };

  for (const alias of lookup[code] ?? []) {
    aliases.add(alias);
  }

  return [...aliases];
}

export function getMouseBindingToken(button) {
  const lookup = {
    0: "MouseLeft",
    1: "MouseMiddle",
    2: "MouseRight",
    3: "MouseBackward",
    4: "MouseForward",
  };

  return lookup[button] ?? null;
}
