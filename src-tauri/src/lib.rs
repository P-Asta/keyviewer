use rdev::{listen, Button, Event, EventType, Key};
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::ShortcutState;

const MAIN_POSITION_FILE: &str = "keyviewer-position.json";

#[derive(Clone, Copy, Deserialize, Serialize)]
struct SavedMainPosition {
    x: i32,
    y: i32,
}

#[tauri::command]
fn resize_main_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window.set_resizable(true).map_err(|e| e.to_string())?;
    window.set_maximizable(false).map_err(|e| e.to_string())?;
    window.set_min_size(Option::<LogicalSize<f64>>::None)
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Option::<LogicalSize<f64>>::None)
        .map_err(|e| e.to_string())?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_main_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_main_lock_position(app: AppHandle, lock_position: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .set_ignore_cursor_events(lock_position)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_settings_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "settings window not found".to_string())?;

    window
        .set_min_size(Option::<LogicalSize<f64>>::None)
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Option::<LogicalSize<f64>>::None)
        .map_err(|e| e.to_string())?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn focus_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    save_main_window_position(&app);
    app.exit(0);
}

fn main_position_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(MAIN_POSITION_FILE))
}

fn save_main_window_position(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Some(path) = main_position_path(app) else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let position = SavedMainPosition {
        x: position.x,
        y: position.y,
    };

    if let Ok(payload) = serde_json::to_vec_pretty(&position) {
        let _ = fs::write(path, payload);
    }
}

fn restore_main_window_position(app: &AppHandle, window: &WebviewWindow) {
    let Some(path) = main_position_path(app) else {
        return;
    };
    let Ok(payload) = fs::read(path) else {
        return;
    };
    let Ok(position) = serde_json::from_slice::<SavedMainPosition>(&payload) else {
        return;
    };

    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
}

fn show_or_focus_window(
    app: &AppHandle,
    label: &str,
    title: &str,
    route: &str,
    width: f64,
    height: f64,
) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(label) {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .title(title)
        .inner_size(width, height)
        .min_inner_size(width, height)
        .max_inner_size(width, height)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .center()
        .focused(true)
        .build()?;

    let _ = window.show();
    let _ = window.set_focus();

    let label = label.to_string();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(90));
        let main_thread_handle = app_handle.clone();
        let _ = app_handle.run_on_main_thread(move || {
            if let Some(window) = main_thread_handle.get_webview_window(&label) {
                let _ = window.set_focus();
            }
        });
    });

    Ok(())
}

fn show_settings_window(app: &AppHandle) -> tauri::Result<()> {
    show_or_focus_window(
        app,
        "settings",
        "Keyviewer Settings",
        "index.html?window=settings",
        500.0,
        760.0,
    )
}

fn normalize_mouse_button(button: Button) -> String {
    match button {
        Button::Left => "MouseLeft".to_string(),
        Button::Right => "MouseRight".to_string(),
        Button::Middle => "MouseMiddle".to_string(),
        Button::Unknown(1) => "MouseBackward".to_string(),
        Button::Unknown(2) => "MouseForward".to_string(),
        Button::Unknown(index) => format!("MouseUnknown{}", index),
    }
}

fn normalize_key_name(key: Key) -> String {
    match key {
        Key::ShiftLeft | Key::ShiftRight => "Shift".to_string(),
        Key::ControlLeft | Key::ControlRight => "Control".to_string(),
        Key::Unknown(16) | Key::Unknown(160) | Key::Unknown(161) => "Shift".to_string(),
        Key::Unknown(17) | Key::Unknown(25) | Key::Unknown(162) | Key::Unknown(163) => {
            "Control".to_string()
        }
        Key::Alt => "AltLeft".to_string(),
        Key::AltGr => "AltRight".to_string(),
        _ => format!("{:?}", key),
    }
}

fn start_key_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let callback = move |event: Event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    let _ = app.emit("key-down", normalize_key_name(key));
                }
                EventType::KeyRelease(key) => {
                    let _ = app.emit("key-up", normalize_key_name(key));
                }
                EventType::ButtonPress(button) => {
                    let _ = app.emit("mouse-down", normalize_mouse_button(button));
                }
                EventType::ButtonRelease(button) => {
                    let _ = app.emit("mouse-up", normalize_mouse_button(button));
                }
                _ => {}
            };
        };

        if let Err(err) = listen(callback) {
            eprintln!("Error: {:?}", err);
        }
    });
}

#[cfg(windows)]
fn start_modifier_polling(app: AppHandle) {
    use winapi::um::winuser::{
        GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_LSHIFT, VK_RCONTROL, VK_RSHIFT, VK_SHIFT,
    };
    const VK_HANJA: i32 = 0x19;

    std::thread::spawn(move || {
        let mut ctrl_pressed = false;
        let mut shift_pressed = false;

        loop {
            let next_ctrl_pressed = unsafe {
                GetAsyncKeyState(VK_CONTROL) < 0
                    || GetAsyncKeyState(VK_LCONTROL) < 0
                    || GetAsyncKeyState(VK_RCONTROL) < 0
                    || GetAsyncKeyState(VK_HANJA) < 0
            };
            let next_shift_pressed = unsafe {
                GetAsyncKeyState(VK_SHIFT) < 0
                    || GetAsyncKeyState(VK_LSHIFT) < 0
                    || GetAsyncKeyState(VK_RSHIFT) < 0
            };

            if next_ctrl_pressed != ctrl_pressed {
                ctrl_pressed = next_ctrl_pressed;
                let event = if next_ctrl_pressed { "key-down" } else { "key-up" };
                let _ = app.emit(event, "Control");
            }

            if next_shift_pressed != shift_pressed {
                shift_pressed = next_shift_pressed;
                let event = if next_shift_pressed { "key-down" } else { "key-up" };
                let _ = app.emit(event, "Shift");
            }

            std::thread::sleep(Duration::from_millis(12));
        }
    });
}

#[cfg(not(windows))]
fn start_modifier_polling(_app: AppHandle) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_skip_taskbar(true);
                restore_main_window_position(app.handle(), &window);
            }
            start_key_listener(app.handle().clone());
            start_modifier_polling(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            resize_main_window,
            set_main_always_on_top,
            set_main_lock_position,
            resize_settings_window,
            focus_main_window,
            exit_app
        ])
        .on_window_event(|window, event| {
            if window.label() == "settings" && matches!(event, WindowEvent::Focused(false)) {
                let _ = window.hide();
            }

            if window.label() == "main" && matches!(event, WindowEvent::CloseRequested { .. }) {
                save_main_window_position(window.app_handle());
            }

            if window.label() == "main" && matches!(event, WindowEvent::Moved(_)) {
                save_main_window_position(window.app_handle());
            }
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["ctrl+alt+shift+k"])
                .expect("failed to register global shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = show_settings_window(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
