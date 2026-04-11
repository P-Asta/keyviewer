import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_EVENT,
  clampKeyScale,
  loadSettings,
  saveSettings,
} from "./settings";

export default function SettingsView() {
  const appWindow = getCurrentWindow();
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    const closeWindow = () => {
      appWindow.close().catch(() => {});
    };

    appWindow.setFocus().catch(() => {});

    let unlisten;

    appWindow
      .onFocusChanged(({ payload }) => {
        if (!payload) {
          closeWindow();
        }
      })
      .then((dispose) => {
        unlisten = dispose;
      });

    window.addEventListener("blur", closeWindow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        closeWindow();
      }
    });

    return () => {
      unlisten?.();
      window.removeEventListener("blur", closeWindow);
    };
  }, [appWindow]);

  const updateSettings = async (patch) => {
    const next = saveSettings({ ...settings, ...patch });
    setSettings(next);
    if (patch.alwaysOnTop !== undefined) {
      await invoke("set_main_always_on_top", { alwaysOnTop: next.alwaysOnTop }).catch(() => {});
    }
    await emitTo("main", SETTINGS_EVENT, next);
  };

  return (
    <main className="settings-shell">
      <section className="settings-card">
        <header
          className="settings-dragbar"
          data-tauri-drag-region
        >
          <span className="settings-title">Keyviewer</span>
          <button
            className="settings-close settings-no-drag"
            type="button"
            onClick={() => appWindow.close().catch(() => {})}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <div className="settings-body">
          <label className="settings-row">
            <span className="settings-label">앱 상단 고정</span>
            <button
              className={`settings-toggle settings-no-drag ${settings.alwaysOnTop ? "is-on" : ""}`}
              type="button"
              onClick={() => updateSettings({ alwaysOnTop: !settings.alwaysOnTop })}
              aria-pressed={settings.alwaysOnTop}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </label>

          <label className="settings-row">
            <span className="settings-label">E 키 표시</span>
            <button
              className={`settings-toggle settings-no-drag ${settings.showE ? "is-on" : ""}`}
              type="button"
              onClick={() => updateSettings({ showE: !settings.showE })}
              aria-pressed={settings.showE}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </label>

          <label className="settings-row">
            <span className="settings-label">G 키 표시</span>
            <button
              className={`settings-toggle settings-no-drag ${settings.showG ? "is-on" : ""}`}
              type="button"
              onClick={() => updateSettings({ showG: !settings.showG })}
              aria-pressed={settings.showG}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </label>

          <label className="settings-stack">
            <span className="settings-label">키 크기</span>
            <div className="settings-scale-row">
              <input
                className="settings-range settings-no-drag"
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={settings.keyScale}
                onChange={(event) => updateSettings({ keyScale: clampKeyScale(event.target.value) })}
              />
              <input
                className="settings-number settings-no-drag"
                type="number"
                min="60"
                max="160"
                step="5"
                value={Math.round(settings.keyScale * 100)}
                onChange={(event) =>
                  updateSettings({ keyScale: clampKeyScale(Number(event.target.value) / 100) })
                }
              />
              <span className="settings-unit">%</span>
            </div>
          </label>

          <button
            className="settings-reset settings-no-drag"
            type="button"
            onClick={() => updateSettings(DEFAULT_SETTINGS)}
          >
            기본값으로 복원
          </button>
        </div>
      </section>
    </main>
  );
}
