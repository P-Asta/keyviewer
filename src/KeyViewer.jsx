import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_EVENT,
  SETTINGS_STORAGE_KEY,
  bindingTokenToPayloadMatches,
  getMouseBindingToken,
  loadSettings,
} from "./settings";

const BASE_KEYS = [
  { id: "w", alt: "W", className: "kv-key--w" },
  { id: "a", alt: "A", className: "kv-key--a" },
  { id: "s", alt: "S", className: "kv-key--s" },
  { id: "d", alt: "D", className: "kv-key--d" },
  { id: "space", alt: "Space", className: "kv-key--space" },
];

const EXTRA_KEYS = [
  { id: "tab", alt: "Tab", className: "kv-key--tab", setting: "showTab", span: 2 },
  { id: "q", alt: "Q", className: "kv-key--q", setting: "showQ" },
  { id: "e", alt: "E", className: "kv-key--e", setting: "showE" },
  { id: "t", alt: "T", className: "kv-key--t", setting: "showT" },
  { id: "shift", alt: "Shift", className: "kv-key--shift", setting: "showShift", span: 2 },
  { id: "g", alt: "G", className: "kv-key--g", setting: "showG" },
  { id: "ctrl", alt: "Ctrl", className: "kv-key--ctrl", setting: "showCtrl", span: 2 },
  { id: "long_space", alt: "Space", className: "kv-key--long-space", bindingId: "space", span: 4 },
];

const KEY_DEFINITIONS = [...BASE_KEYS, ...EXTRA_KEYS];
const LEGACY_EXTRA_KEY_IDS = new Set(["e", "g", "shift", "ctrl"]);
const LEGACY_EXTRA_KEYS = EXTRA_KEYS.filter((key) => LEGACY_EXTRA_KEY_IDS.has(key.id));
const EXPANDED_LAYOUT_ROWS = [
  [
    { id: "tab", span: 2 },
    { id: "q" },
    { id: "w" },
    { id: "e" },
    { id: "t" },
  ],
  [
    { id: "shift", span: 2 },
    { id: "a" },
    { id: "s" },
    { id: "d" },
    { id: "g" },
  ],
  [
    { id: "ctrl", span: 2 },
    { id: "long_space", span: 4 },
  ],
];
const LONG_SPACE_MIN_SPAN = 3;
const EXPANDED_LAYOUT_COLUMNS = [
  { column: 0, span: 2, items: [{ id: "tab" }, { id: "shift" }, { id: "ctrl" }], anchor: "bottom" },
  { column: 2, items: [{ id: "q", row: 0 }, { id: "a", row: 1 }] },
  { column: 3, items: [{ id: "w", row: 0 }, { id: "s", row: 1 }] },
  { column: 4, items: [{ id: "e", row: 0 }, { id: "d", row: 1 }] },
  { column: 5, items: [{ id: "t" }, { id: "g" }], anchor: "bottom", height: 2 },
];

function buildKeyList(settings) {
  return KEY_DEFINITIONS.map((key) => ({
    ...key,
    binding: settings.keyBindings?.[key.bindingId ?? key.id] ?? DEFAULT_SETTINGS.keyBindings[key.bindingId ?? key.id],
    match: bindingTokenToPayloadMatches(
      settings.keyBindings?.[key.bindingId ?? key.id] ?? DEFAULT_SETTINGS.keyBindings[key.bindingId ?? key.id],
    ),
  }));
}

function matchesPayload(payload, match) {
  const normalizedPayload = String(payload ?? "");
  const matches = Array.isArray(match) ? match : [match];
  return matches.some((value) => normalizedPayload === value || normalizedPayload.includes(value));
}

function matchesKeyboardCode(code, binding) {
  if (!binding || binding.startsWith("Mouse")) return false;
  if (binding === "Shift" && code.startsWith("Shift")) return true;
  if (binding.startsWith("Shift") && code.startsWith("Shift")) return true;
  if (binding === "Control" && code.startsWith("Control")) return true;
  if ((binding.startsWith("Control") || binding.startsWith("Ctrl")) && code.startsWith("Control")) return true;
  return code === binding;
}

function imagePath(id, pressed) {
  return pressed ? `/${id}_pressed.png` : `/${id}.png`;
}

function setPressedForKeys(current, keys, pressed) {
  const next = { ...current };
  let changed = false;

  keys.forEach((key) => {
    if (pressed) {
      if (!next[key.id]) {
        next[key.id] = true;
        changed = true;
      }
      return;
    }

    if (next[key.id]) {
      delete next[key.id];
      changed = true;
    }
  });

  return changed ? next : current;
}

function getVisibleKeys(settings) {
  const availableExtraKeys = settings.legacyKeyUi ? LEGACY_EXTRA_KEYS : EXTRA_KEYS;
  const extraKeys = availableExtraKeys.filter((key) => key.setting && settings[key.setting]);
  const useExpandedLayout = extraKeys.length > 0;

  if (!useExpandedLayout) {
    return {
      sideKeys: [],
      useExpandedLayout,
      visibleKeys: BASE_KEYS,
    };
  }

  const visibleIds = new Set(["w", "a", "s", "d"]);
  extraKeys.forEach((key) => visibleIds.add(key.id));

  if (settings.showT || settings.showG) {
    visibleIds.add("long_space");
  }

  if (!visibleIds.has("long_space")) {
    visibleIds.add("space");
  }

  return {
    sideKeys: extraKeys,
    useExpandedLayout,
    visibleKeys: KEY_DEFINITIONS.filter((key) => visibleIds.has(key.id)),
  };
}

function resolveLegacyLayout(settings, scale) {
  const sideKeys = LEGACY_EXTRA_KEYS.filter((key) => key.setting && settings[key.setting]);
  const sideTopKeys = sideKeys.filter((key) => !key.span);
  const wideSideKeys = sideKeys.filter((key) => key.span);
  const keySize = Math.round(64 * scale);
  const gap = Math.max(8, Math.round(8 * scale));
  const padding = Math.max(6, Math.round(10 * scale));
  const middleWidth = keySize * 3 + gap * 2;
  const spaceWidth = middleWidth;
  const extraGap = sideKeys.length > 0 ? gap * 2 : 0;
  const row2Y = keySize + gap;
  const row3Y = keySize * 2 + gap * 2;
  const wideWidth = keySize * 2 + gap;
  const sideTopWidth =
    sideTopKeys.length > 0 ? keySize * sideTopKeys.length + gap * Math.max(0, sideTopKeys.length - 1) : 0;
  const sideBlockWidth = sideKeys.length > 0 ? Math.max(wideWidth, sideTopWidth) : 0;
  const mainBlockX = settings.flipExtraKeys && sideKeys.length > 0 ? sideBlockWidth + extraGap : 0;
  const sideX = settings.flipExtraKeys ? 0 : middleWidth + extraGap;
  const shellContentWidth = sideKeys.length > 0 ? middleWidth + extraGap + sideBlockWidth : middleWidth;
  const shellWidth = Math.ceil(shellContentWidth + padding * 2);
  const shellHeight = Math.ceil(keySize * 3 + gap * 2 + padding * 2);
  const positions = {
    w: { x: mainBlockX + keySize + gap, y: 0, width: keySize },
    a: { x: mainBlockX, y: row2Y, width: keySize },
    s: { x: mainBlockX + keySize + gap, y: row2Y, width: keySize },
    d: { x: mainBlockX + (keySize + gap) * 2, y: row2Y, width: keySize },
    space: { x: mainBlockX, y: row3Y, width: spaceWidth },
  };

  const sideRowCount = (sideTopKeys.length > 0 ? 1 : 0) + wideSideKeys.length;
  const sideYOffset = Math.max(0, 3 - sideRowCount) * (keySize + gap);
  const wideStartY = sideYOffset + (sideTopKeys.length > 0 ? keySize + gap : 0);

  sideTopKeys.forEach((key, index) => {
    positions[key.id] = {
      x: sideX + index * (keySize + gap),
      y: sideYOffset,
      width: keySize,
    };
  });

  wideSideKeys.forEach((key, index) => {
    positions[key.id] = {
      x: sideX,
      y: wideStartY + index * (keySize + gap),
      width: wideWidth,
    };
  });

  return {
    padding,
    positions,
    shellHeight,
    shellWidth,
    visibleKeys: [...BASE_KEYS, ...sideKeys],
  };
}

function getKeyWidth(keySize, gap, span = 1) {
  return keySize * span + gap * Math.max(0, span - 1);
}

function getExpandedLayoutMetrics(visibleIds, placeSpecialKeysLeft) {
  let normalStartSpan = Number.POSITIVE_INFINITY;
  let normalContentSpan = 0;
  const hasSpecialKeys = ["tab", "shift", "ctrl"].some((id) => visibleIds.has(id));
  const specialSpan = hasSpecialKeys ? 2 : 0;

  EXPANDED_LAYOUT_COLUMNS.forEach((column) => {
    if (column.column === 0 || !column.items.some((item) => visibleIds.has(item.id))) return;

    normalStartSpan = Math.min(normalStartSpan, column.column);
    normalContentSpan = Math.max(normalContentSpan, column.column + (column.span ?? 1));
  });

  if (!Number.isFinite(normalStartSpan)) {
    normalStartSpan = 0;
  }

  const normalSpan = Math.max(0, normalContentSpan - normalStartSpan);
  const bottomPrefixSpan = placeSpecialKeysLeft ? specialSpan : 0;
  const bottomReservedSpan = placeSpecialKeysLeft ? 0 : specialSpan;
  let contentSpan = placeSpecialKeysLeft ? Math.max(normalContentSpan, specialSpan) : normalSpan + specialSpan;
  const availableSpaceSpan = placeSpecialKeysLeft ? contentSpan - bottomPrefixSpan : normalSpan;
  
  if (visibleIds.has("long_space")) {
    contentSpan = Math.max(contentSpan, bottomPrefixSpan + Math.max(LONG_SPACE_MIN_SPAN, availableSpaceSpan) + bottomReservedSpan);
  }

  if (visibleIds.has("space")) {
    contentSpan = Math.max(contentSpan, bottomPrefixSpan + 3 + bottomReservedSpan);
  }

  return {
    bottomPrefixSpan,
    contentSpan: Math.max(contentSpan, 1),
    normalStartSpan,
    normalSpan,
    specialSpan,
  };
}

function resolveExpandedX(column, width, contentWidth, keySize, gap, placeSpecialKeysLeft, normalStartSpan) {
  if (placeSpecialKeysLeft) {
    return column * (keySize + gap);
  }

  if (column === 0) {
    return contentWidth - width;
  }

  return (column - normalStartSpan) * (keySize + gap);
}

function resolveLayout(settings, scale) {
  if (settings.legacyKeyUi) {
    return resolveLegacyLayout(settings, scale);
  }

  const { useExpandedLayout, visibleKeys } = getVisibleKeys(settings);
  const keySize = Math.round(64 * scale);
  const gap = Math.max(8, Math.round(8 * scale));
  const padding = Math.max(6, Math.round(10 * scale));
  const row2Y = keySize + gap;
  const row3Y = keySize * 2 + gap * 2;

  if (useExpandedLayout) {
    const visibleIds = new Set(visibleKeys.map((key) => key.id));
    const positions = {};
    const { bottomPrefixSpan, contentSpan, normalStartSpan, normalSpan } = getExpandedLayoutMetrics(
      visibleIds,
      settings.flipExtraKeys,
    );
    const contentWidth = getKeyWidth(keySize, gap, contentSpan);

    EXPANDED_LAYOUT_COLUMNS.forEach((column) => {
      const visibleColumnItems = column.items.filter((item) => visibleIds.has(item.id));
      const startRow = column.anchor === "bottom"
        ? (column.height ?? 3) - visibleColumnItems.length
        : 0;

      visibleColumnItems.forEach((item, index) => {
        const span = column.span ?? 1;
        const width = getKeyWidth(keySize, gap, span);
        const x = resolveExpandedX(
          column.column,
          width,
          contentWidth,
          keySize,
          gap,
          settings.flipExtraKeys,
          normalStartSpan,
        );
        const row = item.row ?? startRow + index;

        positions[item.id] = {
          x,
          y: row * (keySize + gap),
          width,
        };
      });
    });

    if (visibleIds.has("long_space")) {
      const span = Math.max(LONG_SPACE_MIN_SPAN, settings.flipExtraKeys ? contentSpan - bottomPrefixSpan : normalSpan);
      const width = getKeyWidth(keySize, gap, span);
      const x = bottomPrefixSpan * (keySize + gap);

      positions.long_space = {
        x,
        y: row3Y,
        width,
      };
    }

    if (visibleIds.has("space")) {
      const span = 3;
      const width = getKeyWidth(keySize, gap, span);
      const x = bottomPrefixSpan * (keySize + gap);

      positions.space = {
        x,
        y: row3Y,
        width,
      };
    }

    return {
      padding,
      positions,
      shellHeight: Math.ceil(keySize * 3 + gap * 2 + padding * 2),
      shellWidth: Math.ceil(contentWidth + padding * 2),
      visibleKeys,
    };
  }

  const middleWidth = keySize * 3 + gap * 2;
  const spaceWidth = middleWidth;
  const shellContentWidth = middleWidth;
  const shellWidth = Math.ceil(shellContentWidth + padding * 2);
  const shellHeight = Math.ceil(keySize * 3 + gap * 2 + padding * 2);
  const positions = {
    w: { x: keySize + gap, y: 0, width: keySize },
    a: { x: 0, y: row2Y, width: keySize },
    s: { x: keySize + gap, y: row2Y, width: keySize },
    d: { x: (keySize + gap) * 2, y: row2Y, width: keySize },
    space: { x: 0, y: row3Y, width: spaceWidth },
  };

  return {
    padding,
    positions,
    shellHeight,
    shellWidth,
    visibleKeys,
  };
}

export default function KeyViewer() {
  const appWindow = getCurrentWindow();
  const webviewWindow = getCurrentWebviewWindow();
  const [pressedKeys, setPressedKeys] = useState({});
  const [settings, setSettings] = useState(() => loadSettings());
  const allKeys = buildKeyList(settings);
  const allKeySignature = JSON.stringify(allKeys.map((key) => [key.id, key.binding]));
  const scale = settings.keyScale ?? DEFAULT_SETTINGS.keyScale;
  const { padding, positions, shellHeight, shellWidth, visibleKeys } = resolveLayout(settings, scale);
  const shiftBoostActive = settings.boostOnShift && !!pressedKeys.shift;

  useEffect(() => {
    const onInputDown = (payload) => {
      const keys = allKeys.filter((item) => matchesPayload(payload, item.match));
      if (keys.length === 0) return;

      setPressedKeys((current) => setPressedForKeys(current, keys, true));
    };

    const onInputUp = (payload) => {
      const keys = allKeys.filter((item) => matchesPayload(payload, item.match));
      if (keys.length === 0) return;

      setPressedKeys((current) => setPressedForKeys(current, keys, false));
    };

    const unlistenKeyDown = listen("key-down", (event) => onInputDown(event.payload));
    const unlistenKeyUp = listen("key-up", (event) => onInputUp(event.payload));
    const unlistenMouseDown = listen("mouse-down", (event) => onInputDown(event.payload));
    const unlistenMouseUp = listen("mouse-up", (event) => onInputUp(event.payload));

    return () => {
      unlistenKeyDown.then((dispose) => dispose());
      unlistenKeyUp.then((dispose) => dispose());
      unlistenMouseDown.then((dispose) => dispose());
      unlistenMouseUp.then((dispose) => dispose());
    };
  }, [allKeySignature]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const keys = allKeys.filter((item) => matchesKeyboardCode(event.code, item.binding));
      if (keys.length === 0) return;

      setPressedKeys((current) => setPressedForKeys(current, keys, true));
    };

    const handleKeyUp = (event) => {
      const keys = allKeys.filter((item) => matchesKeyboardCode(event.code, item.binding));
      if (keys.length === 0) return;

      setPressedKeys((current) => setPressedForKeys(current, keys, false));
    };

    const handleMouseDown = (event) => {
      const token = getMouseBindingToken(event.button);
      if (!token) return;

      const keys = allKeys.filter((item) => item.binding === token);
      if (keys.length === 0) return;

      event.preventDefault();
      setPressedKeys((current) => setPressedForKeys(current, keys, true));
    };

    const handleMouseUp = (event) => {
      const token = getMouseBindingToken(event.button);
      if (!token) return;

      const keys = allKeys.filter((item) => item.binding === token);
      if (keys.length === 0) return;

      event.preventDefault();
      setPressedKeys((current) => setPressedForKeys(current, keys, false));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [allKeySignature]);

  useEffect(() => {
    setPressedKeys((current) => {
      const allowed = new Set(allKeys.map((key) => key.id));
      let changed = false;
      const next = {};

      Object.entries(current).forEach(([keyId, value]) => {
        if (allowed.has(keyId)) {
          next[keyId] = value;
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [allKeySignature]);

  useEffect(() => {
    webviewWindow.setBackgroundColor([0, 0, 0, 0]).catch(() => {});
  }, [webviewWindow]);

  useEffect(() => {
    invoke("set_main_always_on_top", { alwaysOnTop: settings.alwaysOnTop }).catch(() => {});
  }, [settings.alwaysOnTop]);

  useEffect(() => {
    invoke("set_main_lock_position", { lockPosition: settings.lockPosition }).catch(() => {});
  }, [settings.lockPosition]);

  useEffect(() => {
    let unlisten;

    listen(SETTINGS_EVENT, (event) => {
      setSettings((current) => ({ ...current, ...event.payload }));
    }).then((dispose) => {
      unlisten = dispose;
    });

    const handleStorage = (event) => {
      if (event.key !== null && event.key !== SETTINGS_STORAGE_KEY) return;
      setSettings(loadSettings());
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      unlisten?.();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    invoke("resize_main_window", { width: shellWidth, height: shellHeight }).catch(() => {});
  }, [appWindow, shellHeight, shellWidth]);

  return (
    <main
      className="kv-shell"
      data-tauri-drag-region={settings.lockPosition ? undefined : true}
      style={{
        "--kv-padding": `${padding}px`,
        width: `${shellWidth}px`,
        height: `${shellHeight}px`,
      }}
    >
      <section className="kv-layout" aria-label="Key viewer" data-shift-boost={shiftBoostActive}>
        {visibleKeys.map((key) => {
          const pressed = !!pressedKeys[key.id];
          const position = positions[key.id];

          return (
            <div
              key={key.id}
              className={`kv-key ${key.className}`}
              data-pressed={pressed}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${position.width}px`,
              }}
            >
              <img
                className="kv-key-image"
                src={imagePath(key.id, pressed)}
                alt={key.alt}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
              />
            </div>
          );
        })}
      </section>
    </main>
  );
}
