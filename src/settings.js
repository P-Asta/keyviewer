export const SETTINGS_STORAGE_KEY = "keyviewer.settings.v3";
export const SETTINGS_EVENT = "settings-updated";

export const VIEWER_BINDINGS = [
  { id: "tab", label: "Tab 추가키", defaultCode: "Tab" },
  { id: "q", label: "Q 추가키", defaultCode: "KeyQ" },
  { id: "w", label: "위쪽 슬롯", defaultCode: "KeyW" },
  { id: "e", label: "E 추가키", defaultCode: "KeyE" },
  { id: "t", label: "T 추가키", defaultCode: "KeyT" },
  { id: "shift", label: "Shift 추가키", defaultCode: "Shift" },
  { id: "a", label: "왼쪽 슬롯", defaultCode: "KeyA" },
  { id: "s", label: "아래쪽 슬롯", defaultCode: "KeyS" },
  { id: "d", label: "오른쪽 슬롯", defaultCode: "KeyD" },
  { id: "g", label: "G 추가키", defaultCode: "KeyG" },
  { id: "ctrl", label: "Ctrl 추가키", defaultCode: "Control" },
  { id: "space", label: "스페이스", defaultCode: "Space" },
];

export const DEFAULT_BINDINGS = Object.fromEntries(
  VIEWER_BINDINGS.map((binding) => [binding.id, binding.defaultCode]),
);

export const DEFAULT_SETTINGS = {
  alwaysOnTop: false,
  lockPosition: false,
  keyScale: 1,
  showTab: false,
  showQ: false,
  showE: false,
  showT: false,
  showG: false,
  showCtrl: false,
  showShift: false,
  boostOnShift: false,
  flipExtraKeys: false,
  legacyKeyUi: false,
  keyBindings: DEFAULT_BINDINGS,
};

export function clampKeyScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.keyScale;
  return Math.min(1.6, Math.max(0.6, numeric));
}

export function normalizeBindingToken(id, value, fallback) {
  const token = typeof value === "string" && value.trim() ? value.trim() : fallback;

  if (id === "shift" && token.startsWith("Shift")) {
    return "Shift";
  }

  if (id === "shift" && (token === "LShift" || token === "RShift")) {
    return "Shift";
  }

  if (
    id === "ctrl" &&
    (token.startsWith("Control") || token.startsWith("Ctrl") || token === "LCtrl" || token === "RCtrl")
  ) {
    return "Control";
  }

  return token;
}

function normalizeKeyBindings(input = {}) {
  return Object.fromEntries(
    VIEWER_BINDINGS.map((binding) => [
      binding.id,
      normalizeBindingToken(binding.id, input?.[binding.id], binding.defaultCode),
    ]),
  );
}

export function normalizeSettings(input = {}) {
  return {
    alwaysOnTop: Boolean(input.alwaysOnTop),
    lockPosition: Boolean(input.lockPosition),
    keyScale: clampKeyScale(input.keyScale ?? DEFAULT_SETTINGS.keyScale),
    showTab: Boolean(input.showTab),
    showQ: Boolean(input.showQ),
    showE: Boolean(input.showE),
    showT: Boolean(input.showT),
    showG: Boolean(input.showG),
    showCtrl: Boolean(input.showCtrl ?? input.showC),
    showShift: Boolean(input.showShift),
    boostOnShift: Boolean(input.boostOnShift),
    flipExtraKeys: Boolean(input.flipExtraKeys),
    legacyKeyUi: Boolean(input.legacyKeyUi),
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
    Shift: "Shift",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    Control: "Ctrl",
    Ctrl: "Ctrl",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
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
  if (code.startsWith("Shift")) {
    ["Shift", "ShiftLeft", "ShiftRight", "LShift", "RShift", "Unknown(16)", "Unknown(160)", "Unknown(161)"].forEach(
      (alias) => aliases.add(alias),
    );
  }

  if (code.startsWith("Control") || code.startsWith("Ctrl")) {
    [
      "Control",
      "Ctrl",
      "ControlLeft",
      "ControlRight",
      "CtrlLeft",
      "CtrlRight",
      "LCtrl",
      "RCtrl",
      "Unknown(17)",
      "Unknown(25)",
      "Unknown(162)",
      "Unknown(163)",
    ].forEach((alias) => aliases.add(alias));
  }

  if (code === "Shift") {
    ["ShiftLeft", "ShiftRight", "LShift", "RShift", "Unknown(16)", "Unknown(160)", "Unknown(161)"].forEach((alias) =>
      aliases.add(alias),
    );
  }

  if (code === "Control" || code === "Ctrl") {
    [
      "ControlLeft",
      "ControlRight",
      "CtrlLeft",
      "CtrlRight",
      "LCtrl",
      "RCtrl",
      "Unknown(17)",
      "Unknown(25)",
      "Unknown(162)",
      "Unknown(163)",
    ].forEach((alias) => aliases.add(alias));
  }

  const lookup = {
    ArrowUp: ["UpArrow"],
    ArrowDown: ["DownArrow"],
    ArrowLeft: ["LeftArrow"],
    ArrowRight: ["RightArrow"],
    Enter: ["Return"],
    Escape: ["Escape"],
    Space: ["Space"],
    Shift: ["ShiftLeft", "ShiftRight", "LShift", "RShift", "Unknown(16)", "Unknown(160)", "Unknown(161)"],
    ShiftLeft: ["Shift", "ShiftLeft", "ShiftRight", "LShift", "RShift", "Unknown(16)", "Unknown(160)", "Unknown(161)"],
    ShiftRight: ["Shift", "ShiftLeft", "ShiftRight", "LShift", "RShift", "Unknown(16)", "Unknown(160)", "Unknown(161)"],
    Control: ["Ctrl", "ControlLeft", "ControlRight", "CtrlLeft", "CtrlRight", "LCtrl", "RCtrl", "Unknown(17)", "Unknown(25)", "Unknown(162)", "Unknown(163)"],
    ControlLeft: ["Control", "Ctrl", "ControlLeft", "ControlRight", "CtrlLeft", "CtrlRight", "LCtrl", "RCtrl", "Unknown(17)", "Unknown(25)", "Unknown(162)", "Unknown(163)"],
    ControlRight: ["Control", "Ctrl", "ControlLeft", "ControlRight", "CtrlLeft", "CtrlRight", "LCtrl", "RCtrl", "Unknown(17)", "Unknown(25)", "Unknown(162)", "Unknown(163)"],
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
