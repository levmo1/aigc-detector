mod startup;

use std::fs;
use std::io::Write;
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{CloseRequestApi, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogResult};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// 持有 sidecar（node.exe）句柄，退出时终止后台进程
struct SidecarState(Mutex<Option<CommandChild>>);

fn find_free_port() -> std::io::Result<u16> {
    // 优先固定 3210（与前端默认回退地址一致）；被占则随机空闲端口
    if std::net::TcpListener::bind(("127.0.0.1", 3210)).is_ok() {
        return Ok(3210);
    }
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn ensure_data_dirs(base_dir: &std::path::Path) -> std::io::Result<()> {
    for name in ["config", "data", "rules", "logs", "tesseract-data"] {
        fs::create_dir_all(base_dir.join(name))?;
    }
    Ok(())
}

// 兼容多种部署方式查找后端目录：NSIS 安装（resources/）、7-Zip 解压（_up_/）、手动复制（exe 旁）
fn find_server_dir(exe_dir: &std::path::Path, resource_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    let candidates = [
        resource_dir.join("dist-server"),
        exe_dir.join("resources/dist-server"),
        exe_dir.join("_up_/dist-server"),
        exe_dir.join("dist-server"),
    ];
    candidates
        .into_iter()
        .find(|dir| dir.join("server.js").is_file())
}

fn write_startup_log(base_dir: &std::path::Path, message: &str) {
    let path = base_dir.join("logs/startup.log");
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{}", message);
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn create_main_window(app: &tauri::AppHandle, api_base: &str) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("AIGC检测器")
        .inner_size(1280.0, 860.0)
        .min_inner_size(960.0, 640.0)
        .initialization_script(&format!("window.__API_BASE__ = '{}';", api_base))
        .build()?;
    window.set_focus()?;
    Ok(())
}

fn show_startup_error(app: &tauri::AppHandle, detail: &str) {
    let _ = app
        .dialog()
        .message(format!(
            "AIGC检测器启动失败：{}\n\n请查看安装目录下 logs/startup.log 获取详细信息。",
            detail
        ))
        .title("启动失败")
        .blocking_show();
}

// 系统托盘：双击/菜单打开主界面，菜单可退出
fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "打开主界面", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;
    let icon = app.default_window_icon().cloned().expect("no default window icon");

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("AIGC检测器")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

// 关闭窗口时弹窗：是=退出（含后端），否=最小化到托盘
fn handle_close_requested(window: &Window, api: &CloseRequestApi) {
    let app = window.app_handle().clone();
    let label = window.label().to_string();
    api.prevent_close();
    let _ = app
        .dialog()
        .message("关闭窗口后程序将最小化到系统托盘继续运行。\n\n选择“是”退出程序，选择“否”最小化到托盘。")
        .title("AIGC检测器")
        .buttons(MessageDialogButtons::YesNo)
        .show_with_result(move |result| match result {
            MessageDialogResult::Yes => {
                app.exit(0);
            }
            _ => {
                if let Some(window) = app.get_webview_window(&label) {
                    let _ = window.hide();
                }
            }
        });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 重复启动时显示并聚焦已有窗口（可能处于托盘隐藏状态）
            show_main_window(app);
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            setup_tray(app.handle())?;

            // 用标准 API 解析 exe 目录（Tauri 的 path API 在部分环境返回 UnknownPath）
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                .unwrap_or_else(|| app.path().resource_dir().unwrap_or_default());
            if let Err(error) = ensure_data_dirs(&exe_dir) {
                write_startup_log(&exe_dir, &format!("failed to create data dirs: {error}"));
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| exe_dir.join("resources"));

            // 自适应查找 server_dir：兼容 NSIS 安装（resources/）、7-Zip 解压（_up_/）、手动复制等部署方式
            let server_dir = find_server_dir(&exe_dir, &resource_dir);
            let server_path = server_dir.as_ref().map(|d| d.join("server.js"));
            let font_path = server_dir.as_ref().map(|d| d.join("assets/fonts/NotoSansSC-subset.ttf"));
            // OCR traineddata 直接从打包资源读取（随 dist-server 分发）
            let traineddata_dir = server_dir.as_ref().map(|d| d.join("node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int"));

            let (Some(server_dir), Some(server_path), Some(font_path), Some(traineddata_dir)) =
                (server_dir, server_path, font_path, traineddata_dir)
            else {
                let message = format!(
                    "未找到后端资源目录（dist-server）。\n安装目录: {}\n资源目录: {}\n请确认程序文件完整（含 resources 文件夹）。",
                    exe_dir.display(),
                    resource_dir.display(),
                );
                write_startup_log(&exe_dir, &message);
                show_startup_error(app.handle(), &message);
                return Ok(());
            };

            let port = match find_free_port() {
                Ok(port) => port,
                Err(error) => {
                    let message = format!("无法分配本地端口：{error}");
                    write_startup_log(&exe_dir, &message);
                    show_startup_error(app.handle(), &message);
                    return Ok(());
                }
            };

            let sidecar_result = app
                .shell()
                .sidecar("node")
                .expect("failed to create node sidecar")
                .args([server_path.to_string_lossy().to_string(), port.to_string()])
                // cwd 指向 dist-server：默认规则库 rules/ai-writing-rules.json 由此解析
                .current_dir(&server_dir)
                .env("CONFIG_DIR", exe_dir.join("config").to_string_lossy().to_string())
                .env("DATA_DIR", exe_dir.join("data").to_string_lossy().to_string())
                .env("RULES_DIR", exe_dir.join("rules").to_string_lossy().to_string())
                .env("TESSERACT_LANG_PATH", traineddata_dir.to_string_lossy().to_string())
                .env("PDF_FONT_PATH", font_path.to_string_lossy().to_string())
                .spawn();

            let (mut rx, child) = match sidecar_result {
                Ok(pair) => pair,
                Err(error) => {
                    let message = format!("无法启动后端服务：{error}");
                    write_startup_log(&exe_dir, &message);
                    show_startup_error(app.handle(), &message);
                    return Ok(());
                }
            };

            // 保存 sidecar 句柄，退出时终止后台 node 进程
            {
                let state = app.state::<SidecarState>();
                let mut guard = state.0.lock().unwrap();
                *guard = Some(child);
            }

            let api_base = format!("http://127.0.0.1:{port}");
            let app_handle = app.handle().clone();
            let log_dir = exe_dir.clone();

            // 等待后端就绪（AIGC-SERVER-READY）再显示主窗口；失败弹出错误对话框
            tauri::async_runtime::spawn(async move {
                let ready = startup::wait_for_startup(async {
                    let mut ready = false;
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                if let Ok(text) = String::from_utf8(line) {
                                    if text.contains("AIGC-SERVER-READY") {
                                        ready = true;
                                        break;
                                    }
                                }
                            }
                            CommandEvent::Stderr(line) => {
                                if let Ok(text) = String::from_utf8(line) {
                                    write_startup_log(&log_dir, &text);
                                }
                            }
                            CommandEvent::Terminated(payload) => {
                                write_startup_log(
                                    &log_dir,
                                    &format!("node sidecar terminated: {payload:?}"),
                                );
                                break;
                            }
                            _ => {}
                        }
                    }
                    ready
                }, std::time::Duration::from_secs(30)).await;
                if ready {
                    let _ = create_main_window(&app_handle, &api_base);
                } else {
                    {
                        let state = app_handle.state::<SidecarState>();
                        if let Some(child) = state.0.lock().unwrap().take() {
                            let _ = child.kill();
                        };
                    }
                    write_startup_log(&log_dir, "backend startup failed or exceeded 30 seconds");
                    show_startup_error(&app_handle, "后端服务未能在 30 秒内启动，请退出后重试。");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                handle_close_requested(window, api);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                // 退出时终止 node.js 后台进程
                let state = app.state::<SidecarState>();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        });
}
