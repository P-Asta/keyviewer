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
  { id: "e", alt: "E", className: "kv-key--e", setting: "showE" },
  { id: "g", alt: "G", className: "kv-key--g", setting: "showG" },
  { id: "c", alt: "C", className: "kv-key--c", setting: "showC", wide: true },
  { id: "shift", alt: "Shift", className: "kv-key--shift", setting: "showShift", wide: true },
];

function buildKeyList(settings) {
  return [
    ...BASE_KEYS.map((key) => ({
      ...key,
      binding: settings.keyBindings?.[key.id] ?? DEFAULT_SETTINGS.keyBindings[key.id],
      match: bindingTokenToPayloadMatches(settings.keyBindings?.[key.id] ?? DEFAULT_SETTINGS.keyBindings[key.id]),
    })),
    ...EXTRA_KEYS.map((key) => ({
      ...key,
      binding: settings.keyBindings?.[key.id] ?? DEFAULT_SETTINGS.keyBindings[key.id],
      match: bindingTokenToPayloadMatches(settings.keyBindings?.[key.id] ?? DEFAULT_SETTINGS.keyBindings[key.id]),
    })),
  ];
}

function matchesPayload(payload, match) {
  const matches = Array.isArray(match) ? match : [match];
  return matches.some((value) => payload === value || payload?.includes(value));
}

function matchesKeyboardCode(code, binding) {
  return !!binding && !binding.startsWith("Mouse") && code === binding;
}

function imagePath(id, pressed) {
  return pressed ? `/${id}_pressed.png` : `/${id}.png`;
}

function removePressedKey(current, keyId) {
  if (!current[keyId]) return current;

  const next = { ...current };
  delete next[keyId];
  return next;
}

function resolveLayout(settings, scale) {
  const sideKeys = EXTRA_KEYS.filter((key) => settings[key.setting]);
  const sideTopKeys = sideKeys.filter((key) => !key.wide);
  const wideSideKeys = sideKeys.filter((key) => key.wide);
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
    sideKeys,
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
  const { padding, positions, shellHeight, shellWidth, sideKeys } = resolveLayout(settings, scale);
  const visibleKeys = [...BASE_KEYS, ...sideKeys];
  const shiftBoostActive = settings.boostOnShift && !!pressedKeys.shift;

  useEffect(() => {
    const onInputDown = (payload) => {
      const key = allKeys.find((item) => matchesPayload(payload, item.match));
      if (!key) return;

      setPressedKeys((current) => ({ ...current, [key.id]: true }));
    };

    const onInputUp = (payload) => {
      const key = allKeys.find((item) => matchesPayload(payload, item.match));
      if (!key) return;

      setPressedKeys((current) => removePressedKey(current, key.id));
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
      const key = allKeys.find((item) => matchesKeyboardCode(event.code, item.binding));
      if (!key) return;

      setPressedKeys((current) => ({ ...current, [key.id]: true }));
    };

    const handleKeyUp = (event) => {
      const key = allKeys.find((item) => matchesKeyboardCode(event.code, item.binding));
      if (!key) return;

      setPressedKeys((current) => removePressedKey(current, key.id));
    };

    const handleMouseDown = (event) => {
      const token = getMouseBindingToken(event.button);
      if (!token) return;

      const key = allKeys.find((item) => item.binding === token);
      if (!key) return;

      event.preventDefault();
      setPressedKeys((current) => ({ ...current, [key.id]: true }));
    };

    const handleMouseUp = (event) => {
      const token = getMouseBindingToken(event.button);
      if (!token) return;

      const key = allKeys.find((item) => item.binding === token);
      if (!key) return;

      event.preventDefault();
      setPressedKeys((current) => removePressedKey(current, key.id));
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
              <img className="kv-key-image" src={imagePath(key.id, pressed)} alt={key.alt} />
            </div>
          );
        })}
      </section>
    </main>
  );
}
