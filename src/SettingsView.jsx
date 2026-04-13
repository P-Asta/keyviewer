import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BINDINGS,
  SETTINGS_EVENT,
  SETTINGS_STORAGE_KEY,
  VIEWER_BINDINGS,
  clampKeyScale,
  formatBindingToken,
  getMouseBindingToken,
  loadSettings,
  saveSettings,
} from "./settings";

const MAIN_SETTINGS_HEIGHT = 690;
const BINDINGS_SETTINGS_HEIGHT = 645;

export default function SettingsView() {
  const appWindow = getCurrentWindow();
  const [settings, setSettings] = useState(() => loadSettings());
  const [page, setPage] = useState("main");
  const [bindingTarget, setBindingTarget] = useState(null);
  const settingsRef = useRef(settings);
  const pageRef = useRef(page);
  const bindingTargetRef = useRef(bindingTarget);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    bindingTargetRef.current = bindingTarget;
  }, [bindingTarget]);

  useEffect(() => {
    appWindow.setFocus().catch(() => {});

    const focusTimeoutId = window.setTimeout(() => {
      appWindow.setFocus().catch(() => {});
    }, 80);

    return () => {
      window.clearTimeout(focusTimeoutId);
    };
  }, [appWindow]);

  useEffect(() => {
    let unlistenFocusChanged;

    appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) return;

      setBindingTarget(null);
      setPage("main");
    }).then((dispose) => {
      unlistenFocusChanged = dispose;
    });

    return () => {
      unlistenFocusChanged?.();
    };
  }, [appWindow]);

  useEffect(() => {
    const targetHeight = page === "bindings" ? BINDINGS_SETTINGS_HEIGHT : MAIN_SETTINGS_HEIGHT;
    invoke("resize_settings_window", { height: targetHeight }).catch(() => {});
  }, [page]);

  const updateSettings = async (patch) => {
    const next = saveSettings({ ...settingsRef.current, ...patch });
    setSettings(next);

    if (patch.alwaysOnTop !== undefined) {
      await invoke("set_main_always_on_top", { alwaysOnTop: next.alwaysOnTop }).catch(() => {});
    }

    if (patch.lockPosition !== undefined) {
      await invoke("set_main_lock_position", { lockPosition: next.lockPosition }).catch(() => {});
    }

    await emitTo("main", SETTINGS_EVENT, next);
  };

  const assignBinding = async (token) => {
    const target = bindingTargetRef.current;
    if (!target || !token) return;

    const next = saveSettings({
      ...settingsRef.current,
      keyBindings: {
        ...settingsRef.current.keyBindings,
        [target]: token,
      },
    });

    setSettings(next);
    setBindingTarget(null);
    await emitTo("main", SETTINGS_EVENT, next);
  };

  const resetBindings = async () => {
    const next = saveSettings({
      ...settingsRef.current,
      keyBindings: DEFAULT_BINDINGS,
    });
    setSettings(next);
    setBindingTarget(null);
    await emitTo("main", SETTINGS_EVENT, next);
  };

  useEffect(() => {
    let unlistenSettingsEvent;

    listen(SETTINGS_EVENT, (event) => {
      setSettings((current) => ({ ...current, ...event.payload }));
    }).then((dispose) => {
      unlistenSettingsEvent = dispose;
    });

    const handleStorage = (event) => {
      if (event.key !== null && event.key !== SETTINGS_STORAGE_KEY) return;
      setSettings(loadSettings());
    };

    const handleKeyDown = (event) => {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();

        if (pageRef.current === "bindings" && bindingTargetRef.current) {
          setBindingTarget(null);
          return;
        }

        invoke("focus_main_window").catch(() => {
          appWindow.hide().catch(() => {});
        });
        return;
      }

      if (pageRef.current !== "bindings" || !bindingTargetRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      assignBinding(event.code);
    };

    const handleMouseDown = (event) => {
      if (pageRef.current !== "bindings" || !bindingTargetRef.current) return;

      const token = getMouseBindingToken(event.button);
      if (!token) return;

      event.preventDefault();
      event.stopPropagation();
      assignBinding(token);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      unlistenSettingsEvent?.();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [appWindow]);

  const waitingLabel = useMemo(
    () => VIEWER_BINDINGS.find((binding) => binding.id === bindingTarget)?.label ?? null,
    [bindingTarget],
  );

  return (
    <main className="settings-shell">
      <section className="settings-card">
        <header className="settings-dragbar" data-tauri-drag-region>
          <div className="settings-dragbar-inner">
            {page === "bindings" ? (
              <button
                className="settings-back settings-no-drag"
                type="button"
                onClick={() => {
                  setBindingTarget(null);
                  setPage("main");
                }}
                aria-label="뒤로가기"
              >
                <ArrowLeft size={16} strokeWidth={2.4} />
              </button>
            ) : (
              <span className="settings-back-placeholder settings-no-drag" />
            )}
            <span className="settings-title">settings</span>
            <span className="settings-back-placeholder settings-no-drag" />
          </div>
        </header>

        <div className="settings-body">
          <div className={`settings-page-slider page-${page}`}>
            <section className="settings-page-panel" aria-hidden={page !== "main"}>
              <section className="settings-page settings-page-inner settings-page-main">
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
                  <span className="settings-label">위치 고정</span>
                  <button
                    className={`settings-toggle settings-no-drag ${settings.lockPosition ? "is-on" : ""}`}
                    type="button"
                    onClick={() => updateSettings({ lockPosition: !settings.lockPosition })}
                    aria-pressed={settings.lockPosition}
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

                <label className="settings-row">
                  <span className="settings-label">C 키 표시</span>
                  <button
                    className={`settings-toggle settings-no-drag ${settings.showC ? "is-on" : ""}`}
                    type="button"
                    onClick={() => updateSettings({ showC: !settings.showC })}
                    aria-pressed={settings.showC}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </label>

                <label className="settings-row">
                  <span className="settings-label">Shift 키 표시</span>
                  <button
                    className={`settings-toggle settings-no-drag ${settings.showShift ? "is-on" : ""}`}
                    type="button"
                    onClick={() => updateSettings({ showShift: !settings.showShift })}
                    aria-pressed={settings.showShift}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </label>

                <label className="settings-row">
                  <span className="settings-label">Shift 색 강조</span>
                  <button
                    className={`settings-toggle settings-no-drag ${settings.boostOnShift ? "is-on" : ""}`}
                    type="button"
                    onClick={() => updateSettings({ boostOnShift: !settings.boostOnShift })}
                    aria-pressed={settings.boostOnShift}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </label>

                <label className="settings-row">
                  <span className="settings-label">추가 키 좌우반전</span>
                  <button
                    className={`settings-toggle settings-no-drag ${settings.flipExtraKeys ? "is-on" : ""}`}
                    type="button"
                    onClick={() => updateSettings({ flipExtraKeys: !settings.flipExtraKeys })}
                    aria-pressed={settings.flipExtraKeys}
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
                  className="settings-action settings-no-drag"
                  type="button"
                  onClick={() => {
                    setBindingTarget(null);
                    setPage("bindings");
                  }}
                >
                  키 변경
                </button>

                <button
                  className="settings-action settings-action-danger settings-no-drag"
                  type="button"
                  onClick={() => invoke("exit_app").catch(() => {})}
                >
                  키뷰어 종료
                </button>
              </section>
            </section>

            <section className="settings-page-panel" aria-hidden={page !== "bindings"}>
              <section className="settings-page settings-page-inner settings-page-bindings settings-stack settings-bindings">
                <div className="settings-bindings-header">
                  <span className="settings-label">입력 바인딩</span>
                  <button className="settings-reset settings-no-drag" type="button" onClick={resetBindings}>
                    기본값
                  </button>
                </div>

                <div className="settings-binding-list">
                  {VIEWER_BINDINGS.map((binding) => {
                    const isWaiting = bindingTarget === binding.id;

                    return (
                      <div key={binding.id} className="settings-binding-row">
                        <span className="settings-binding-label">{binding.label}</span>
                        <button
                          className={`settings-binding-button settings-no-drag ${isWaiting ? "is-listening" : ""}`}
                          type="button"
                          onClick={() => setBindingTarget(isWaiting ? null : binding.id)}
                        >
                          {isWaiting ? "입력 대기 중" : formatBindingToken(settings.keyBindings?.[binding.id])}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <p className="settings-hint">
                  {bindingTarget
                    ? `${waitingLabel}에 넣을 키나 마우스 버튼을 눌러주세요. Mouse Forward/Backward도 바로 인식됩니다.`
                    : "버튼을 눌러 변경 대기 상태로 만든 뒤 원하는 키나 마우스 버튼을 입력하세요."}
                </p>
              </section>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
