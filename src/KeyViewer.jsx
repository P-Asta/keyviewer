import { listen } from "@tauri-apps/api/event";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, SETTINGS_EVENT, SETTINGS_STORAGE_KEY, loadSettings } from "./settings";

const BASE_KEYS = [
  { id: "w", match: "KeyW", alt: "W", className: "kv-key--w" },
  { id: "a", match: "KeyA", alt: "A", className: "kv-key--a" },
  { id: "s", match: "KeyS", alt: "S", className: "kv-key--s" },
  { id: "d", match: "KeyD", alt: "D", className: "kv-key--d" },
  { id: "space", match: "Space", alt: "Space", className: "kv-key--space" },
];

const EXTRA_KEYS = [
  { id: "e", match: "KeyE", alt: "E", className: "kv-key--e", setting: "showE" },
  { id: "g", match: "KeyG", alt: "G", className: "kv-key--g", setting: "showG" },
  {
    id: "shift",
    match: ["ShiftLeft", "ShiftRight"],
    alt: "Shift",
    className: "kv-key--shift",
    setting: "showShift",
  },
];

function matchesPayload(payload, match) {
  if (Array.isArray(match)) {
    return match.some((value) => payload === value || payload?.includes(value));
  }

  return payload === match || payload?.includes(match);
}

function matchesCode(code, match) {
  if (Array.isArray(match)) {
    return match.includes(code);
  }

  return match === code;
}

function imagePath(id, pressed) {
  return pressed ? `/${id}_pressed.png` : `/${id}.png`;
}

export default function KeyViewer() {
  const shellRef = useRef(null);
  const appWindow = getCurrentWindow();
  const webviewWindow = getCurrentWebviewWindow();
  const [pressedKeys, setPressedKeys] = useState({});
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    const allKeys = [...BASE_KEYS, ...EXTRA_KEYS];

    const onKeyDown = (event) => {
      const key = allKeys.find((item) => matchesPayload(event.payload, item.match));
      if (!key) return;

      setPressedKeys((current) => ({ ...current, [key.id]: true }));
    };

    const onKeyUp = (event) => {
      const key = allKeys.find((item) => matchesPayload(event.payload, item.match));
      if (!key) return;

      setPressedKeys((current) => {
        if (!current[key.id]) return current;

        const next = { ...current };
        delete next[key.id];
        return next;
      });
    };

    const unlistenDown = listen("key-down", onKeyDown);
    const unlistenUp = listen("key-up", onKeyUp);

    return () => {
      unlistenDown.then((dispose) => dispose());
      unlistenUp.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    const allKeys = [...BASE_KEYS, ...EXTRA_KEYS];

    const handleKeyDown = (event) => {
      const key = allKeys.find((item) => matchesCode(event.code, item.match));
      if (!key) return;

      setPressedKeys((current) => ({ ...current, [key.id]: true }));
    };

    const handleKeyUp = (event) => {
      const key = allKeys.find((item) => matchesCode(event.code, item.match));
      if (!key) return;

      setPressedKeys((current) => {
        if (!current[key.id]) return current;

        const next = { ...current };
        delete next[key.id];
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    webviewWindow.setBackgroundColor([0, 0, 0, 0]).catch(() => {});
  }, [webviewWindow]);

  useEffect(() => {
    invoke("set_main_always_on_top", { alwaysOnTop: settings.alwaysOnTop }).catch(() => {});
  }, [settings.alwaysOnTop]);

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

  const scale = settings.keyScale ?? DEFAULT_SETTINGS.keyScale;
  const sideKeys = EXTRA_KEYS.filter((key) => settings[key.setting]);
  const sideTopKeys = sideKeys.filter((key) => key.id !== "shift");
  const hasShift = sideKeys.some((key) => key.id === "shift");
  const keySize = Math.round(64 * scale);
  const gap = Math.max(8, Math.round(8 * scale));
  const padding = Math.max(6, Math.round(10 * scale));
  const middleWidth = keySize * 3 + gap * 2;
  const spaceWidth = middleWidth;
  const extraGap = sideKeys.length > 0 ? gap * 2 : 0;
  const row2Y = keySize + gap;
  const row3Y = keySize * 2 + gap * 2;
  const shiftWidth = keySize * 2 + gap;
  const sideTopWidth =
    sideTopKeys.length > 0 ? keySize * sideTopKeys.length + gap * Math.max(0, sideTopKeys.length - 1) : 0;
  const sideBlockWidth = hasShift ? Math.max(shiftWidth, sideTopWidth) : sideTopWidth;
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

  sideTopKeys.forEach((key, index) => {
    positions[key.id] = {
      x: sideX + index * (keySize + gap),
      y: hasShift ? row2Y : row3Y,
      width: keySize,
    };
  });

  if (hasShift) {
    positions.shift = {
      x: sideX,
      y: row3Y,
      width: shiftWidth,
    };
  }

  const visibleKeys = [...BASE_KEYS, ...sideKeys];

  useEffect(() => {
    invoke("resize_main_window", { width: shellWidth, height: shellHeight }).catch(() => {});
  }, [appWindow, shellHeight, shellWidth]);

  return (
    <main
      ref={shellRef}
      className="kv-shell"
      data-tauri-drag-region
      style={{
        "--kv-padding": `${padding}px`,
        width: `${shellWidth}px`,
        height: `${shellHeight}px`,
      }}
    >
      <section className="kv-layout" aria-label="Key viewer">
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
