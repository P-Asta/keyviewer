use rdev::{listen, Event, EventType};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::ShortcutState;

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

fn show_settings_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html?window=settings".into()))
        .title("Keyviewer Settings")
        .inner_size(380.0, 470.0)
        .min_inner_size(380.0, 470.0)
        .max_inner_size(380.0, 470.0)
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

    Ok(())
}

fn start_key_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let callback = move |event: Event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    let _ = app.emit("key-down", format!("{:?}", key));
                }
                EventType::KeyRelease(key) => {
                    let _ = app.emit("key-up", format!("{:?}", key));
                }
                _ => {}
            };
        };

        if let Err(err) = listen(callback) {
            eprintln!("Error: {:?}", err);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            start_key_listener(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            resize_main_window,
            set_main_always_on_top
        ])
        .on_window_event(|window, event| {
            if window.label() == "settings" && matches!(event, WindowEvent::Focused(false)) {
                let _ = window.close();
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
