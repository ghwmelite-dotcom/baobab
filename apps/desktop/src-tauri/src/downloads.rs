use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{
    webview::{DownloadEvent, WebviewBuilder},
    AppHandle, Emitter, Url,
};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const DEFAULT_FILENAME: &str = "download";

#[derive(Debug, Clone, Serialize)]
struct RequestedPayload {
    id: String,
    url: String,
    filename: String,
    destination: String,
}

#[derive(Debug, Clone, Serialize)]
struct FinishedPayload {
    url: String,
    path: Option<String>,
    success: bool,
}

fn sanitize_segment(raw: &str) -> String {
    let trimmed = raw.trim();
    let cleaned: String = trimmed
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    if cleaned.is_empty() {
        DEFAULT_FILENAME.to_string()
    } else {
        cleaned
    }
}

fn filename_from_url(url: &Url) -> String {
    let from_path = url
        .path_segments()
        .and_then(|segs| segs.filter(|s| !s.is_empty()).last())
        .map(|s| s.to_string())
        .unwrap_or_default();
    if from_path.is_empty() {
        DEFAULT_FILENAME.to_string()
    } else {
        sanitize_segment(&from_path)
    }
}

fn unique_path(dir: &Path, filename: &str) -> PathBuf {
    let mut candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(DEFAULT_FILENAME)
        .to_string();
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());
    for i in 1..1024 {
        let name = match &ext {
            Some(e) => format!("{stem} ({i}).{e}"),
            None => format!("{stem} ({i})"),
        };
        candidate = dir.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    candidate
}

/// Attach a download handler to a `WebviewBuilder`. Routes downloads into the
/// user's Downloads folder and emits `download://requested` and
/// `download://finished` events on the AppHandle for the frontend store.
pub fn attach<R: tauri::Runtime>(
    builder: WebviewBuilder<R>,
    app: AppHandle<R>,
) -> WebviewBuilder<R> {
    builder.on_download(move |_webview, event| match event {
        DownloadEvent::Requested { url, destination } => {
            let id = format!("d{}", uuid::Uuid::new_v4().simple());
            let filename = filename_from_url(&url);
            let download_dir = dirs::download_dir()
                .or_else(dirs::home_dir)
                .unwrap_or_else(|| PathBuf::from("."));
            let _ = std::fs::create_dir_all(&download_dir);
            let target = unique_path(&download_dir, &filename);
            *destination = target.clone();
            let payload = RequestedPayload {
                id,
                url: url.to_string(),
                filename: target
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&filename)
                    .to_string(),
                destination: target.to_string_lossy().to_string(),
            };
            let _ = app.emit("download://requested", payload);
            true
        }
        DownloadEvent::Finished { url, path, success } => {
            let payload = FinishedPayload {
                url: url.to_string(),
                path: path.map(|p| p.to_string_lossy().to_string()),
                success,
            };
            let _ = app.emit("download://finished", payload);
            true
        }
        _ => true,
    })
}

/// Open the OS file explorer with the file selected, when possible. Falls
/// back to opening the parent directory.
#[tauri::command]
pub async fn download_show_in_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    #[cfg(target_os = "windows")]
    {
        if target.exists() {
            // explorer.exe expects `/select,"<path>"` as a single token; use
            // raw_arg so std doesn't add its own quoting that confuses it.
            let mut quoted = String::from("/select,\"");
            quoted.push_str(&target.display().to_string());
            quoted.push('"');
            std::process::Command::new("explorer")
                .raw_arg(&quoted)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            let dir = target
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or(target.clone());
            std::process::Command::new("explorer")
                .arg(dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = std::process::Command::new("open");
        if target.exists() {
            cmd.arg("-R").arg(&target);
        } else if let Some(parent) = target.parent() {
            cmd.arg(parent);
        } else {
            cmd.arg(&target);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = if target.is_file() {
            target.parent().map(|p| p.to_path_buf()).unwrap_or(target.clone())
        } else {
            target.clone()
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

/// Open the file with the OS default application.
#[tauri::command]
pub async fn download_open_file(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("file not found: {path}"));
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

