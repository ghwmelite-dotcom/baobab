// Per-tab byte usage relayed from the init-script via Tauri command.
// We accept fire-and-forget invokes from the init-script ~1×/sec/tab,
// debounce in-process by emitting `data://usage` events at most once
// per 500ms per window, and let the chrome webview's data.store
// accumulate the totals.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, Window};

#[derive(Debug, Default)]
struct PendingUsage {
    bytes_used: u64,
    bytes_saved: u64,
    last_emit: Option<Instant>,
}

#[derive(Debug, Default)]
pub struct UsageState {
    inner: Mutex<HashMap<String, PendingUsage>>, // keyed by window_label
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsagePayload {
    pub bytes_used: u64,
    pub bytes_saved: u64,
}

const FLUSH_INTERVAL: Duration = Duration::from_millis(500);

#[tauri::command]
pub async fn record_tab_usage(
    app: AppHandle,
    window: Window,
    state: tauri::State<'_, UsageState>,
    bytes_used: u64,
    bytes_saved: u64,
) -> Result<(), String> {
    let label = window.label().to_string();
    let payload_to_emit = {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        let entry = map.entry(label.clone()).or_default();
        entry.bytes_used += bytes_used;
        entry.bytes_saved += bytes_saved;
        let now = Instant::now();
        let should_emit = entry
            .last_emit
            .map_or(true, |t| now.duration_since(t) >= FLUSH_INTERVAL);
        if should_emit {
            entry.last_emit = Some(now);
            let payload = UsagePayload {
                bytes_used: entry.bytes_used,
                bytes_saved: entry.bytes_saved,
            };
            entry.bytes_used = 0;
            entry.bytes_saved = 0;
            Some(payload)
        } else {
            None
        }
    };

    if let Some(payload) = payload_to_emit {
        // Find the host window for this tab. Tab labels are tab-<id>; the
        // host is the parent profile-* / picker / guest-* window. We just
        // emit globally — the chrome subscribers in every window will
        // hear and accumulate; if that turns out to cross-contaminate
        // across profiles we'll add per-window scoping later.
        let _ = app.emit("data://usage", payload);
    }
    Ok(())
}
