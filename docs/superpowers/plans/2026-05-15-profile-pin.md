# Profile PIN Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional 4-digit PIN per Baobab profile that gates the picker-click flow, enforced server-side at `open_profile_window`. Casual-privacy UX gate for shared-computer scenarios — no data encryption.

**Architecture:** Add `pin_hash` field to the internal `Profile` struct; expose `pin_required: bool` to JS via a new `ProfileView` DTO (hash never crosses IPC). New `pin.rs` (PBKDF2-SHA256 hash + verify) and `pin_attempts.rs` (in-memory progressive lockout). Reusable `<PinInput>` component drives three new sheets — create, change-PIN, unlock — composed alongside the existing picker UI.

**Tech Stack:** Rust (pbkdf2 + sha2 + subtle + base64 + rand), Tauri 2 IPC, React 18 + Zustand, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-15-profile-pin-design.md`

---

## File Structure

### New Rust files
- `apps/desktop/src-tauri/src/pin.rs` — `hash_pin`, `verify_pin`, `validate_pin_format`; inline tests.
- `apps/desktop/src-tauri/src/pin_attempts.rs` — `PinAttempts` struct, `AttemptResult` enum, `record_wrong` / `record_correct` / `check`; inline tests.

### Modified Rust files
- `apps/desktop/src-tauri/Cargo.toml` — add `pbkdf2`, `sha2`, `subtle`, `base64`, `rand` deps.
- `apps/desktop/src-tauri/src/profiles.rs` — `Profile` gains `pin_hash: Option<String>` (with `#[serde(default)]`); new `ProfileView` DTO; `create_profile` accepts optional pin; new `set_profile_pin` and `remove_profile_pin` functions; `cmd_list_profiles` and `cmd_create_profile` return `ProfileView`.
- `apps/desktop/src-tauri/src/windows.rs` — `open_profile_window` takes optional `pin`, enforces it server-side using `PinAttempts` (registered as `tauri::State`).
- `apps/desktop/src-tauri/src/lib.rs` — `mod pin;`, `mod pin_attempts;`, register `PinAttempts` as managed state, register new commands.

### New frontend files
- `apps/desktop/src/picker/PinInput.tsx` — reusable 4-digit input.
- `apps/desktop/src/picker/UnlockSheet.tsx` — bottom-sheet that asks for PIN on locked tile click.
- `apps/desktop/src/picker/ChangePinSheet.tsx` — bottom-sheet for Set / Change / Remove PIN flows.

### Modified frontend files
- `apps/desktop/src/profiles/profile.api.ts` — `Profile` interface drops the (never-shipped) `pinHash` and gains `pinRequired: boolean`; `profileApi.create` gains optional `pin`; `profileApi.openProfileWindow` gains optional `pin`; new `profileApi.setPin`, `profileApi.removePin`.
- `apps/desktop/src/picker/usePickerData.ts` — `select(id)` opens `UnlockSheet` when target has `pinRequired`; new actions `setPin`, `removePin`; tracks the active unlock target id.
- `apps/desktop/src/picker/NewProfileSheet.tsx` — adds the "Lock this profile with a PIN" toggle and reveal-on-tick `<PinInput>` rows.
- `apps/desktop/src/picker/ProfileTile.tsx` — renders a lock badge on locked tiles; menu items reflect lock state (Set PIN / Change PIN / Remove PIN).
- `apps/desktop/src/picker/PickerApp.tsx` — renders `UnlockSheet` and `ChangePinSheet` in the same way it already renders `NewProfileSheet`.

### Test files
- `apps/desktop/src-tauri/src/pin.rs` — inline `#[cfg(test)] mod tests`.
- `apps/desktop/src-tauri/src/pin_attempts.rs` — inline `#[cfg(test)] mod tests`.
- `apps/desktop/src-tauri/src/profiles.rs` — extend existing test modules.
- `apps/desktop/tests/pin.input.test.tsx` — `<PinInput>` interactions.
- `apps/desktop/tests/profiles.api.test.ts` — extend to cover `setPin`, `removePin`, `openProfileWindow(id, pin)`, `create(name, color, pin)`.
- `apps/desktop/tests/unlock.sheet.test.tsx` — happy / wrong / locked paths.
- `apps/desktop/tests/picker.data.test.ts` — extend to cover `select` routing through UnlockSheet, plus `setPin` / `removePin` actions.

---

## Phase 1 — Rust crypto + rate limiter

### Task 1: Crypto dependencies + `pin.rs` hashing

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/pin.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (add `mod pin;`)

- [ ] **Step 1: Add crypto deps to Cargo.toml**

In `apps/desktop/src-tauri/Cargo.toml` under `[dependencies]`, add:

```toml
pbkdf2 = { version = "0.12", default-features = false, features = ["hmac"] }
sha2 = { version = "0.10", default-features = false }
subtle = "2"
base64 = "0.22"
rand = "0.8"
```

- [ ] **Step 2: Create `pin.rs` with hashing primitives + failing tests**

Create `apps/desktop/src-tauri/src/pin.rs`:

```rust
use base64::{engine::general_purpose::STANDARD_NO_PAD as B64, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use subtle::ConstantTimeEq;

pub const HASH_ALGO: &str = "pbkdf2-sha256";
pub const ITERATIONS: u32 = 100_000;
pub const SALT_BYTES: usize = 16;
pub const HASH_BYTES: usize = 32;

/// Validates that `pin` is exactly 4 ASCII digits.
pub fn validate_pin_format(pin: &str) -> Result<(), String> {
    if pin.len() != 4 {
        return Err("pin must be exactly 4 digits".into());
    }
    if !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("pin must contain only digits".into());
    }
    Ok(())
}

/// Hash a PIN with a fresh random salt. Returns the encoded "algo$iter$salt$hash" string.
pub fn hash_pin(pin: &str) -> Result<String, String> {
    validate_pin_format(pin)?;
    let mut salt = [0u8; SALT_BYTES];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut hash = [0u8; HASH_BYTES];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, ITERATIONS, &mut hash);
    Ok(format!(
        "{}${}${}${}",
        HASH_ALGO,
        ITERATIONS,
        B64.encode(salt),
        B64.encode(hash),
    ))
}

/// Verify a PIN against the encoded stored string. Constant-time on the hash compare.
pub fn verify_pin(stored: &str, pin: &str) -> Result<bool, String> {
    validate_pin_format(pin)?;
    let parts: Vec<&str> = stored.split('$').collect();
    if parts.len() != 4 || parts[0] != HASH_ALGO {
        return Err("malformed_hash".into());
    }
    let iter: u32 = parts[1].parse().map_err(|_| "malformed_hash".to_string())?;
    let salt = B64.decode(parts[2]).map_err(|_| "malformed_hash".to_string())?;
    let expected = B64.decode(parts[3]).map_err(|_| "malformed_hash".to_string())?;
    if expected.len() != HASH_BYTES {
        return Err("malformed_hash".into());
    }
    let mut got = [0u8; HASH_BYTES];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), &salt, iter, &mut got);
    Ok(got.ct_eq(&expected).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_pin_format_accepts_four_digits() {
        assert!(validate_pin_format("1234").is_ok());
        assert!(validate_pin_format("0000").is_ok());
    }

    #[test]
    fn validate_pin_format_rejects_wrong_length() {
        assert!(validate_pin_format("").is_err());
        assert!(validate_pin_format("123").is_err());
        assert!(validate_pin_format("12345").is_err());
    }

    #[test]
    fn validate_pin_format_rejects_non_digits() {
        assert!(validate_pin_format("12a4").is_err());
        assert!(validate_pin_format("12 4").is_err());
        assert!(validate_pin_format("1234\n").is_err());
    }

    #[test]
    fn hash_pin_produces_different_strings_for_same_pin() {
        let a = hash_pin("1234").unwrap();
        let b = hash_pin("1234").unwrap();
        assert_ne!(a, b, "two hashes of the same PIN must differ (random salt)");
    }

    #[test]
    fn hash_pin_format_matches_spec() {
        let s = hash_pin("1234").unwrap();
        let parts: Vec<&str> = s.split('$').collect();
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "pbkdf2-sha256");
        assert_eq!(parts[1], "100000");
    }

    #[test]
    fn verify_pin_accepts_original() {
        let s = hash_pin("1234").unwrap();
        assert_eq!(verify_pin(&s, "1234").unwrap(), true);
    }

    #[test]
    fn verify_pin_rejects_wrong() {
        let s = hash_pin("1234").unwrap();
        assert_eq!(verify_pin(&s, "0000").unwrap(), false);
        assert_eq!(verify_pin(&s, "1235").unwrap(), false);
    }

    #[test]
    fn verify_pin_rejects_malformed_stored() {
        assert!(verify_pin("garbage", "1234").is_err());
        assert!(verify_pin("a$b$c", "1234").is_err());
    }
}
```

In `apps/desktop/src-tauri/src/lib.rs`, add `mod pin;` after the existing `mod migration;`:

```rust
mod downloads;
mod migration;
mod pin;
mod profiles;
mod tabs;
mod windows;
```

- [ ] **Step 3: Run tests — expect 7 passing**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test pin::tests
```

Expected: `7 passed; 0 failed`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/pin.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(pin): PBKDF2-SHA256 hash + verify primitives"
```

---

### Task 2: `pin_attempts.rs` rate limiter

**Files:**
- Create: `apps/desktop/src-tauri/src/pin_attempts.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (add `mod pin_attempts;`)

- [ ] **Step 1: Write failing tests + implementation**

Create `apps/desktop/src-tauri/src/pin_attempts.rs`:

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Cumulative wrong-count milestones and the lockout duration each triggers.
/// Reading: `(count, seconds)` — when wrong_count reaches `count`, lock for `seconds`.
const LOCKOUT_LADDER: &[(u32, u64)] = &[
    (3, 30),
    (6, 5 * 60),
    (9, 30 * 60),
];

#[derive(Debug, Clone, Copy)]
struct AttemptState {
    wrong_count: u32,
    locked_until: Option<Instant>,
}

#[derive(Default)]
pub struct PinAttempts {
    inner: Mutex<HashMap<String, AttemptState>>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AttemptResult {
    Allowed,
    Locked { remaining_seconds: u64 },
}

impl PinAttempts {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn check(&self, profile_id: &str) -> AttemptResult {
        self.check_at(profile_id, Instant::now())
    }

    fn check_at(&self, profile_id: &str, now: Instant) -> AttemptResult {
        let guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        match guard.get(profile_id) {
            None => AttemptResult::Allowed,
            Some(state) => match state.locked_until {
                Some(until) if until > now => AttemptResult::Locked {
                    remaining_seconds: (until - now).as_secs().max(1),
                },
                _ => AttemptResult::Allowed,
            },
        }
    }

    /// Returns Some(seconds) if this attempt triggered a new lockout, else None.
    pub fn record_wrong(&self, profile_id: &str) -> Option<u64> {
        self.record_wrong_at(profile_id, Instant::now())
    }

    fn record_wrong_at(&self, profile_id: &str, now: Instant) -> Option<u64> {
        let mut guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        let state = guard.entry(profile_id.to_string()).or_insert(AttemptState {
            wrong_count: 0,
            locked_until: None,
        });
        // While locked, ignore further attempts (defence-in-depth — the UI shouldn't be calling).
        if let Some(until) = state.locked_until {
            if until > now {
                return None;
            }
        }
        state.wrong_count += 1;
        for (threshold, secs) in LOCKOUT_LADDER {
            if state.wrong_count == *threshold {
                state.locked_until = Some(now + Duration::from_secs(*secs));
                return Some(*secs);
            }
        }
        None
    }

    pub fn record_correct(&self, profile_id: &str) {
        let mut guard = self.inner.lock().expect("PinAttempts mutex poisoned");
        guard.remove(profile_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_id_is_allowed() {
        let pa = PinAttempts::new();
        assert_eq!(pa.check("p1"), AttemptResult::Allowed);
    }

    #[test]
    fn three_wrong_locks_for_30s() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), Some(30));
        let r = pa.check_at("p1", now + Duration::from_secs(1));
        match r {
            AttemptResult::Locked { remaining_seconds } => {
                assert!(remaining_seconds <= 30 && remaining_seconds >= 28);
            }
            _ => panic!("expected Locked, got {:?}", r),
        }
    }

    #[test]
    fn lockout_expires() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        let later = now + Duration::from_secs(31);
        assert_eq!(pa.check_at("p1", later), AttemptResult::Allowed);
    }

    #[test]
    fn correct_resets_count() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_correct("p1");
        // Two more wrongs should NOT trigger lockout — count was reset.
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.record_wrong_at("p1", now), None);
        assert_eq!(pa.check_at("p1", now), AttemptResult::Allowed);
    }

    #[test]
    fn second_threshold_triggers_5min() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        // First three wrongs → 30s lockout.
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        // After lockout expires, three more wrongs → 5 minute lockout.
        let after = now + Duration::from_secs(31);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), Some(300));
    }

    #[test]
    fn record_wrong_during_lockout_is_noop() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now); // triggers 30s lock
        // During lockout, further wrongs do nothing — count stays at 3.
        assert_eq!(pa.record_wrong_at("p1", now + Duration::from_secs(5)), None);
        // After lockout expires, the NEXT wrong is the 4th overall, then 5th, then 6th = 5min.
        let after = now + Duration::from_secs(31);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), None);
        assert_eq!(pa.record_wrong_at("p1", after), Some(300));
    }

    #[test]
    fn ids_are_independent() {
        let pa = PinAttempts::new();
        let now = Instant::now();
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        pa.record_wrong_at("p1", now);
        // p2 is untouched.
        assert_eq!(pa.check_at("p2", now), AttemptResult::Allowed);
    }
}
```

In `apps/desktop/src-tauri/src/lib.rs`, add `mod pin_attempts;` after `mod pin;`:

```rust
mod pin;
mod pin_attempts;
```

- [ ] **Step 2: Run tests**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test pin_attempts::tests
```

Expected: `7 passed; 0 failed`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/pin_attempts.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(pin): in-memory progressive lockout (3/30s, 6/5min, 9/30min)"
```

---

## Phase 2 — Profile struct + DTO + create-with-PIN

### Task 3: `pin_hash` field on `Profile` + serde-default migration

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Add `pin_hash` field with default**

In `apps/desktop/src-tauri/src/profiles.rs`, edit the `Profile` struct (in the file, search for `pub struct Profile`):

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub fruit_color: FruitColor,
    pub avatar_letter: String,
    pub created_at: String,
    pub last_used_at: String,
    pub cloud_link: Option<CloudLink>,
    pub user_data_dir_name: String,
    #[serde(default)]
    pub pin_hash: Option<String>,
}
```

In every `Profile { ... }` constructor in this file (e.g. inside `create_profile`), add `pin_hash: None,` to the field list. Look for occurrences and update each.

- [ ] **Step 2: Add a regression test that v1.0 profiles.json files still load**

Append to the existing `mod load_tests` (in `profiles.rs`):

```rust
#[test]
fn loads_v1_profiles_json_without_pin_hash_field() {
    use tempfile::tempdir;
    let dir = tempdir().unwrap();
    let baobab = dir.path().join("baobab");
    std::fs::create_dir_all(&baobab).unwrap();
    // Hand-written v1.0 schema: no pinHash field at all.
    let raw = r#"{
        "schemaVersion": 1,
        "profiles": [{
            "id": "abc",
            "name": "Akua",
            "fruitColor": "mango",
            "avatarLetter": "A",
            "createdAt": "2026-01-01T00:00:00Z",
            "lastUsedAt": "2026-01-01T00:00:00Z",
            "cloudLink": null,
            "userDataDirName": "userdata"
        }],
        "pickerPrefs": { "showOnStartup": false, "lastUsedProfileId": null }
    }"#;
    std::fs::write(baobab.join("profiles.json"), raw).unwrap();
    let f = load(dir.path()).unwrap();
    assert_eq!(f.profiles.len(), 1);
    assert_eq!(f.profiles[0].pin_hash, None);
}
```

- [ ] **Step 3: Run tests**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test profiles::
```

Expected: all existing profiles tests still pass (the migration test from this task plus all prior ones).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): pin_hash field with serde default for v1.0 compatibility"
```

---

### Task 4: `ProfileView` DTO + `From` impl

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Add `ProfileView` struct**

In `profiles.rs`, append after the `Profile` struct definition:

```rust
/// JSON-facing view of a profile. Omits `pin_hash` so it never crosses the IPC boundary;
/// exposes `pin_required: bool` so the frontend can render a lock badge.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileView {
    pub id: String,
    pub name: String,
    pub fruit_color: FruitColor,
    pub avatar_letter: String,
    pub created_at: String,
    pub last_used_at: String,
    pub cloud_link: Option<CloudLink>,
    pub user_data_dir_name: String,
    pub pin_required: bool,
}

impl From<&Profile> for ProfileView {
    fn from(p: &Profile) -> Self {
        Self {
            id: p.id.clone(),
            name: p.name.clone(),
            fruit_color: p.fruit_color.clone(),
            avatar_letter: p.avatar_letter.clone(),
            created_at: p.created_at.clone(),
            last_used_at: p.last_used_at.clone(),
            cloud_link: p.cloud_link.clone(),
            user_data_dir_name: p.user_data_dir_name.clone(),
            pin_required: p.pin_hash.is_some(),
        }
    }
}
```

- [ ] **Step 2: Add unit tests**

Append a new test module to `profiles.rs`:

```rust
#[cfg(test)]
mod view_tests {
    use super::*;

    #[test]
    fn view_strips_pin_hash_from_serialization() {
        let p = Profile {
            id: "abc".into(),
            name: "Akua".into(),
            fruit_color: FruitColor::Mango,
            avatar_letter: "A".into(),
            created_at: "x".into(),
            last_used_at: "x".into(),
            cloud_link: None,
            user_data_dir_name: "userdata".into(),
            pin_hash: Some("pbkdf2-sha256$100000$AAAA$BBBB".into()),
        };
        let view = ProfileView::from(&p);
        let json = serde_json::to_string(&view).unwrap();
        assert!(!json.contains("pinHash"), "DTO must not leak pin_hash: {}", json);
        assert!(!json.contains("pbkdf2"), "DTO must not leak hash material: {}", json);
        assert!(json.contains("\"pinRequired\":true"), "got: {}", json);
    }

    #[test]
    fn view_pin_required_false_when_no_hash() {
        let p = Profile {
            id: "abc".into(),
            name: "Akua".into(),
            fruit_color: FruitColor::Mango,
            avatar_letter: "A".into(),
            created_at: "x".into(),
            last_used_at: "x".into(),
            cloud_link: None,
            user_data_dir_name: "userdata".into(),
            pin_hash: None,
        };
        assert_eq!(ProfileView::from(&p).pin_required, false);
    }
}
```

- [ ] **Step 3: Run tests**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test profiles::view_tests
```

Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): ProfileView DTO strips pin_hash; exposes pin_required"
```

---

### Task 5: `create_profile` accepts optional PIN

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Update signature + behaviour**

In `profiles.rs`, find the existing `pub fn create_profile(...)` (the pure function, not the `#[tauri::command]` shim). Update it to:

```rust
pub fn create_profile(
    app_data_root: &Path,
    name: String,
    fruit_color: Option<FruitColor>,
    pin: Option<String>,
) -> Result<Profile, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 {
        return Err("name must be 1-48 chars".to_string());
    }
    if name.chars().any(|c| c.is_control()) {
        return Err("name contains control chars".to_string());
    }

    let pin_hash = match pin {
        Some(p) => Some(crate::pin::hash_pin(&p)?),
        None => None,
    };

    let mut file = load(app_data_root)?;
    let color = fruit_color.unwrap_or_else(|| next_default_color(&file.profiles));
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    let profile = Profile {
        id: id.clone(),
        name: name.to_string(),
        fruit_color: color,
        avatar_letter: derive_avatar_letter(name),
        created_at: now.clone(),
        last_used_at: now,
        cloud_link: None,
        user_data_dir_name: "userdata".to_string(),
        pin_hash,
    };
    let profile_dir = app_data_root.join("baobab").join("profiles").join(&id).join("userdata");
    std::fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    file.profiles.push(profile.clone());
    if file.profiles.len() >= 2 {
        file.picker_prefs.show_on_startup = true;
    }
    save(app_data_root, &file)?;
    Ok(profile)
}
```

- [ ] **Step 2: Update existing callers**

Search for `create_profile(` in the repo. Callers to update:
- `apps/desktop/src-tauri/src/migration.rs` — `profiles::create_profile(app_data_root, "My Baobab".to_string(), Some(FruitColor::Shea))` becomes `profiles::create_profile(app_data_root, "My Baobab".to_string(), Some(FruitColor::Shea), None)`.
- `apps/desktop/src-tauri/src/profiles.rs` itself — every test in `create_tests`, `rename_color_tests`, `delete_tests`, `prefs_tests`, `cloud_link_tests` that calls `create_profile(dir.path(), ...)` needs a trailing `, None` argument. Run `cargo build` to find the broken calls.

- [ ] **Step 3: Add a test for the new PIN argument**

Append to `mod create_tests`:

```rust
#[test]
fn create_profile_with_pin_stores_hash() {
    let dir = tempdir().unwrap();
    let p = create_profile(dir.path(), "Akua".to_string(), None, Some("1234".to_string())).unwrap();
    assert!(p.pin_hash.is_some(), "expected pin_hash to be set");
    let hash = p.pin_hash.unwrap();
    assert!(hash.starts_with("pbkdf2-sha256$100000$"), "got: {}", hash);
}

#[test]
fn create_profile_with_invalid_pin_errors() {
    let dir = tempdir().unwrap();
    let r = create_profile(dir.path(), "Akua".to_string(), None, Some("123".to_string()));
    assert!(r.is_err());
}
```

- [ ] **Step 4: Run tests + build**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo build && cargo test profiles::create_tests
```

Expected: build clean, 7 tests pass (5 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs apps/desktop/src-tauri/src/migration.rs
git commit -m "feat(profiles): create_profile accepts optional PIN"
```

---

### Task 6: `set_profile_pin` + `remove_profile_pin`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append a new test module to `profiles.rs`:

```rust
#[cfg(test)]
mod pin_management_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn set_pin_on_unlocked_profile_no_current_required() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None, None).unwrap();
        set_profile_pin(dir.path(), &p.id, "1234", None).unwrap();
        let f = load(dir.path()).unwrap();
        assert!(f.profiles[0].pin_hash.is_some());
    }

    #[test]
    fn set_pin_on_locked_profile_requires_current() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None, Some("1234".to_string())).unwrap();
        // Without current_pin → error
        assert!(set_profile_pin(dir.path(), &p.id, "5678", None).is_err());
        // Wrong current_pin → error
        assert!(set_profile_pin(dir.path(), &p.id, "5678", Some("0000")).is_err());
        // Correct current_pin → ok
        set_profile_pin(dir.path(), &p.id, "5678", Some("1234")).unwrap();
        let f = load(dir.path()).unwrap();
        let new_hash = f.profiles[0].pin_hash.as_ref().unwrap();
        assert!(crate::pin::verify_pin(new_hash, "5678").unwrap());
        assert!(!crate::pin::verify_pin(new_hash, "1234").unwrap());
    }

    #[test]
    fn remove_pin_requires_correct_current() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None, Some("1234".to_string())).unwrap();
        assert!(remove_profile_pin(dir.path(), &p.id, "0000").is_err());
        remove_profile_pin(dir.path(), &p.id, "1234").unwrap();
        let f = load(dir.path()).unwrap();
        assert_eq!(f.profiles[0].pin_hash, None);
    }

    #[test]
    fn remove_pin_on_unlocked_errors() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None, None).unwrap();
        assert!(remove_profile_pin(dir.path(), &p.id, "1234").is_err());
    }
}
```

- [ ] **Step 2: Implement the functions**

Append to `profiles.rs` (after the existing pure-function definitions, before the `#[tauri::command]` shims):

```rust
pub fn set_profile_pin(
    app_data_root: &Path,
    id: &str,
    new_pin: &str,
    current_pin: Option<&str>,
) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    // If a PIN is already set, the caller must prove they know it.
    if let Some(existing) = &p.pin_hash {
        let supplied = current_pin.ok_or("current_pin_required")?;
        if !crate::pin::verify_pin(existing, supplied)? {
            return Err("wrong_pin".into());
        }
    }
    p.pin_hash = Some(crate::pin::hash_pin(new_pin)?);
    save(app_data_root, &file)
}

pub fn remove_profile_pin(
    app_data_root: &Path,
    id: &str,
    current_pin: &str,
) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    let existing = p.pin_hash.as_ref().ok_or("no_pin_set")?;
    if !crate::pin::verify_pin(existing, current_pin)? {
        return Err("wrong_pin".into());
    }
    p.pin_hash = None;
    save(app_data_root, &file)
}
```

- [ ] **Step 3: Run tests**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test profiles::pin_management_tests
```

Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): set_profile_pin and remove_profile_pin functions"
```

---

## Phase 3 — Tauri commands + window enforcement

### Task 7: Update Tauri command shims; `cmd_list_profiles` returns `Vec<ProfileView>`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Update existing command shims**

In `profiles.rs`, modify these command shims:

```rust
#[tauri::command]
pub async fn cmd_list_profiles(app: AppHandle) -> Result<Vec<ProfileView>, String> {
    let root = app_data_root(&app)?;
    Ok(load(&root)?.profiles.iter().map(ProfileView::from).collect())
}

#[tauri::command]
pub async fn cmd_create_profile(
    app: AppHandle,
    name: String,
    fruit_color: Option<FruitColor>,
    pin: Option<String>,
) -> Result<ProfileView, String> {
    let root = app_data_root(&app)?;
    let p = create_profile(&root, name, fruit_color, pin)?;
    Ok(ProfileView::from(&p))
}
```

- [ ] **Step 2: Add new PIN command shims**

Append in `profiles.rs`:

```rust
#[tauri::command]
pub async fn cmd_set_profile_pin(
    app: AppHandle,
    id: String,
    new_pin: String,
    current_pin: Option<String>,
) -> Result<(), String> {
    let root = app_data_root(&app)?;
    set_profile_pin(&root, &id, &new_pin, current_pin.as_deref())
}

#[tauri::command]
pub async fn cmd_remove_profile_pin(
    app: AppHandle,
    id: String,
    current_pin: String,
) -> Result<(), String> {
    let root = app_data_root(&app)?;
    remove_profile_pin(&root, &id, &current_pin)
}
```

- [ ] **Step 3: Register new commands in `lib.rs`**

Add to the `tauri::generate_handler![...]` macro in `apps/desktop/src-tauri/src/lib.rs`:

```rust
profiles::cmd_set_profile_pin,
profiles::cmd_remove_profile_pin,
```

(These go alongside the existing `profiles::cmd_*` lines.)

- [ ] **Step 4: Verify build**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(profiles): expose Tauri commands for PIN set/remove; list returns ProfileView"
```

---

### Task 8: `open_profile_window` enforces PIN; register `PinAttempts` state

**Files:**
- Modify: `apps/desktop/src-tauri/src/windows.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Update `open_profile_window` signature + body**

In `apps/desktop/src-tauri/src/windows.rs`, replace the existing `open_profile_window` command with:

```rust
use crate::pin;
use crate::pin_attempts::{AttemptResult, PinAttempts};
use crate::profiles;

#[tauri::command]
pub async fn open_profile_window(
    app: AppHandle,
    attempts: tauri::State<'_, PinAttempts>,
    profile_id: String,
    pin: Option<String>,
) -> Result<(), String> {
    let label = profile_window_label(&profile_id);
    // Existing focus-or-create early return; we still check PIN before focusing
    // a closed window, but a window already open belongs to a session that
    // already proved knowledge of the PIN. Focusing is fine.
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let file = profiles::load(&root)?;
    let profile = file
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or("profile_not_found")?;

    if let Some(hash) = &profile.pin_hash {
        // Rate-limit check first.
        if let AttemptResult::Locked { remaining_seconds } = attempts.check(&profile_id) {
            return Err(format!("locked:{}", remaining_seconds));
        }
        let supplied = pin.as_deref().ok_or("pin_required")?;
        if !pin::verify_pin(hash, supplied).map_err(|e| e.to_string())? {
            if let Some(secs) = attempts.record_wrong(&profile_id) {
                return Err(format!("locked:{}", secs));
            }
            return Err("wrong_pin".into());
        }
        attempts.record_correct(&profile_id);
    }

    let url = WebviewUrl::App(format!("index.html?profileId={}", profile_id).into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    let _ = profiles::record_profile_used(&root, &profile_id);
    Ok(())
}
```

- [ ] **Step 2: Register `PinAttempts` as managed state in `lib.rs`**

In `apps/desktop/src-tauri/src/lib.rs`, inside the `tauri::Builder::default()` chain (above `.setup(...)`), add:

```rust
.manage(crate::pin_attempts::PinAttempts::new())
```

So the chain looks like:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(crate::pin_attempts::PinAttempts::new())
    .setup(|app| {
        // ... existing setup code unchanged ...
    })
    .invoke_handler(tauri::generate_handler![...])
    .run(...)
```

- [ ] **Step 3: Verify build**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo build
```

Expected: clean. (Tauri's `State<'_, T>` parameter is the standard way to inject managed state into a command — Tauri's macro handles it automatically.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/windows.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(windows): open_profile_window enforces PIN with rate limit"
```

---

## Phase 4 — Frontend typed API

### Task 9: Update `profile.api.ts` for PIN

**Files:**
- Modify: `apps/desktop/src/profiles/profile.api.ts`
- Modify: `apps/desktop/tests/profiles.api.test.ts`

- [ ] **Step 1: Write failing tests**

In `apps/desktop/tests/profiles.api.test.ts`, append to the `describe('profileApi', () => { ... })` block:

```ts
it('create with PIN forwards the pin arg', async () => {
  invokeMock.mockResolvedValue({
    id: '1', name: 'A', fruitColor: 'mango', avatarLetter: 'A',
    createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
    pinRequired: true,
  })
  await profileApi.create('A', 'mango', '1234')
  expect(invokeMock).toHaveBeenCalledWith('cmd_create_profile', { name: 'A', fruitColor: 'mango', pin: '1234' })
})

it('setPin sends id + newPin + currentPin', async () => {
  invokeMock.mockResolvedValue(undefined)
  await profileApi.setPin('id-1', '1234', '0000')
  expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'id-1', newPin: '1234', currentPin: '0000' })
})

it('setPin without currentPin still sends the field as null', async () => {
  invokeMock.mockResolvedValue(undefined)
  await profileApi.setPin('id-1', '1234')
  expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'id-1', newPin: '1234', currentPin: null })
})

it('removePin sends id + currentPin', async () => {
  invokeMock.mockResolvedValue(undefined)
  await profileApi.removePin('id-1', '1234')
  expect(invokeMock).toHaveBeenCalledWith('cmd_remove_profile_pin', { id: 'id-1', currentPin: '1234' })
})

it('openProfileWindow forwards optional pin', async () => {
  invokeMock.mockResolvedValue(undefined)
  await profileApi.openProfileWindow('id-1', '1234')
  expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1', pin: '1234' })
})

it('openProfileWindow without pin sends null', async () => {
  invokeMock.mockResolvedValue(undefined)
  await profileApi.openProfileWindow('id-1')
  expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1', pin: null })
})
```

Update the existing `create sends name + color` test from the prior run (Task 17 of the picker plan) — its expected payload was `{ name: 'A', fruitColor: 'mango' }`. The signature now adds `pin`, so the payload becomes `{ name: 'A', fruitColor: 'mango', pin: null }`. Update that one assertion.

- [ ] **Step 2: Run tests — expect failures**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/profiles.api.test.ts
```

Expected: new tests fail (functions not yet updated); existing `create` test fails (payload mismatch).

- [ ] **Step 3: Update `profile.api.ts`**

In `apps/desktop/src/profiles/profile.api.ts`, replace the file content with:

```ts
import { invoke } from '@tauri-apps/api/core'
import type { FruitColor } from './fruitColors'

export interface Profile {
  id: string
  name: string
  fruitColor: FruitColor
  avatarLetter: string
  createdAt: string
  lastUsedAt: string
  cloudLink: null | {
    baobabUserId: string
    accountEmail: string | null
    accountPhone: string | null
    linkedAt: string
  }
  userDataDirName: string
  pinRequired: boolean
}

export interface PickerPrefs {
  showOnStartup: boolean
  lastUsedProfileId: string | null
}

export const profileApi = {
  list: () => invoke<Profile[]>('cmd_list_profiles'),
  pickerPrefs: () => invoke<PickerPrefs>('cmd_get_picker_prefs'),
  create: (name: string, fruitColor?: FruitColor, pin?: string) =>
    invoke<Profile>('cmd_create_profile', { name, fruitColor: fruitColor ?? null, pin: pin ?? null }),
  rename: (id: string, name: string) => invoke<void>('cmd_rename_profile', { id, name }),
  updateColor: (id: string, color: FruitColor) =>
    invoke<void>('cmd_update_profile_color', { id, color }),
  delete: (id: string) => invoke<void>('cmd_delete_profile', { id }),
  setShowOnStartup: (value: boolean) => invoke<void>('cmd_set_show_on_startup', { value }),
  recordUsed: (id: string) => invoke<void>('cmd_record_profile_used', { id }),
  setPin: (id: string, newPin: string, currentPin?: string) =>
    invoke<void>('cmd_set_profile_pin', { id, newPin, currentPin: currentPin ?? null }),
  removePin: (id: string, currentPin: string) =>
    invoke<void>('cmd_remove_profile_pin', { id, currentPin }),
  openProfileWindow: (profileId: string, pin?: string) =>
    invoke<void>('open_profile_window', { profileId, pin: pin ?? null }),
  openPickerWindow: () => invoke<void>('open_picker_window'),
  openGuestWindow: () => invoke<void>('open_guest_window'),
  currentProfileId: () => invoke<string | null>('current_profile_id'),
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/profiles.api.test.ts
```

Expected: all profiles.api tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/profiles/profile.api.ts apps/desktop/tests/profiles.api.test.ts
git commit -m "feat(profiles-api): pin params on create/openProfileWindow; new setPin/removePin"
```

---

## Phase 5 — Reusable PinInput component

### Task 10: `<PinInput>` component

**Files:**
- Create: `apps/desktop/src/picker/PinInput.tsx`
- Create: `apps/desktop/tests/pin.input.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/pin.input.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PinInput } from '~/picker/PinInput'

describe('PinInput', () => {
  it('renders 4 digit boxes', () => {
    render(<PinInput value="" onChange={() => undefined} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('typing a digit advances focus and fires onChange', () => {
    const onChange = vi.fn()
    render(<PinInput value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    boxes[0].focus()
    fireEvent.change(boxes[0], { target: { value: '1' } })
    expect(onChange).toHaveBeenCalledWith('1')
    // Test rerender with the new value to drive focus advance.
  })

  it('rejects non-digit input', () => {
    const onChange = vi.fn()
    render(<PinInput value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    fireEvent.change(boxes[0], { target: { value: 'a' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fires onComplete once value reaches 4 digits', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<PinInput value="123" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()
    rerender(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('does not fire onComplete twice for the same value', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    rerender(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('backspace on empty box moves focus back', () => {
    const onChange = vi.fn()
    render(<PinInput value="12" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    boxes[2].focus()
    fireEvent.keyDown(boxes[2], { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('disabled prop disables all boxes', () => {
    render(<PinInput value="" onChange={() => undefined} disabled />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes.every((b) => b.disabled)).toBe(true)
  })

  it('shake prop sets data-shake attr (CSS hook)', () => {
    const { container } = render(<PinInput value="" onChange={() => undefined} shake />)
    expect(container.querySelector('[data-shake="true"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/pin.input.test.tsx
```

Expected: module not found.

- [ ] **Step 3: Implement `PinInput.tsx`**

Create `apps/desktop/src/picker/PinInput.tsx`:

```tsx
import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (next: string) => void
  onComplete?: (pin: string) => void
  disabled?: boolean
  shake?: boolean
  autoFocus?: boolean
}

export function PinInput({ value, onChange, onComplete, disabled, shake, autoFocus }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])
  const firedFor = useRef<string | null>(null)

  // Fire onComplete exactly once per completed value.
  useEffect(() => {
    if (value.length === 4 && onComplete && firedFor.current !== value) {
      firedFor.current = value
      onComplete(value)
    }
    if (value.length < 4) {
      firedFor.current = null
    }
  }, [value, onComplete])

  // Move focus forward as digits are added.
  useEffect(() => {
    if (disabled) return
    const idx = Math.min(value.length, 3)
    refs.current[idx]?.focus()
  }, [value.length, disabled])

  // Initial autofocus.
  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus()
  }, [autoFocus, disabled])

  function handleChange(i: number, raw: string) {
    if (raw === '') {
      // Browser cleared the box (e.g. via Delete).
      const next = value.slice(0, i)
      onChange(next)
      return
    }
    const ch = raw.slice(-1)
    if (!/^[0-9]$/.test(ch)) return  // ignore non-digit input
    const next = (value.slice(0, i) + ch).slice(0, 4)
    onChange(next)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && value.length === i) {
      // Box i is empty (value has length i). Backspace removes the last filled digit.
      e.preventDefault()
      onChange(value.slice(0, Math.max(0, i - 1)))
    }
  }

  return (
    <div
      data-shake={shake ? 'true' : 'false'}
      style={{
        display: 'flex',
        gap: 10,
        animation: shake ? 'baobab-pin-shake 0.4s ease' : undefined,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          role="textbox"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`PIN digit ${i + 1}`}
          style={{
            width: 44,
            height: 56,
            fontSize: 28,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            textAlign: 'center',
            border: '2px solid rgba(60,30,15,0.3)',
            borderRadius: 10,
            background: 'rgba(255,250,240,0.95)',
            color: '#3c1810',
            outline: 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes baobab-pin-shake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-6px); }
          75%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect 8 pass**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/pin.input.test.tsx
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/picker/PinInput.tsx apps/desktop/tests/pin.input.test.tsx
git commit -m "feat(picker): reusable 4-digit PinInput with auto-advance and shake"
```

---

## Phase 6 — Sheets that use PinInput

### Task 11: Extend `NewProfileSheet` with the "Lock" toggle

**Files:**
- Modify: `apps/desktop/src/picker/NewProfileSheet.tsx`

- [ ] **Step 1: Update the component**

Replace `apps/desktop/src/picker/NewProfileSheet.tsx` with:

```tsx
import { useState } from 'react'
import { FRUIT_COLOR_ORDER, FRUIT_HEX, type FruitColor } from '~/profiles/fruitColors'
import { PinInput } from './PinInput'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, color: FruitColor, pin?: string) => Promise<void>
}

export function NewProfileSheet({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<FruitColor>('mango')
  const [lock, setLock] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  const pinValid = !lock || (pin.length === 4 && pin === confirmPin)
  const canSubmit = name.trim().length > 0 && pinValid && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr(null)
    try {
      await onCreate(name.trim(), color, lock ? pin : undefined)
      setName(''); setColor('mango'); setLock(false); setPin(''); setConfirmPin('')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'create failed')
    } finally { setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal aria-label="Create a new profile"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ margin: 0, color: '#3c1810' }}>New profile</h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#3c1810', fontSize: 13 }}>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
            required
            style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(60,30,15,0.2)', fontSize: 14 }}
          />
        </label>
        <div>
          <div style={{ color: '#3c1810', fontSize: 13, marginBottom: 6 }}>Fruit colour</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {FRUIT_COLOR_ORDER.map((c) => (
              <button
                key={c} type="button" aria-label={`Use ${c}`} aria-pressed={c === color}
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 30%, ${FRUIT_HEX[c].from}, ${FRUIT_HEX[c].to})`,
                  border: c === color ? '3px solid #3c1810' : '2px solid rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3c1810', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={lock}
            onChange={(e) => setLock(e.target.checked)}
            aria-label="Lock this profile with a PIN"
          />
          Lock this profile with a 4-digit PIN
        </label>
        {lock && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: 'rgba(60,24,16,0.75)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              Anyone using this computer will need the PIN to open this profile. If you forget it,
              you&apos;ll need to delete the profile to start over. The PIN does not encrypt your data on disk.
            </p>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>PIN</div>
              <PinInput value={pin} onChange={setPin} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Confirm PIN</div>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </div>
            {pin.length === 4 && confirmPin.length === 4 && pin !== confirmPin && (
              <div role="alert" style={{ color: '#a23a1f', fontSize: 12 }}>PINs don&apos;t match.</div>
            )}
          </div>
        )}
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck + existing picker tests still pass**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck && npx vitest run tests/picker.app.test.tsx
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/picker/NewProfileSheet.tsx
git commit -m "feat(picker): Lock-with-PIN toggle in NewProfileSheet"
```

---

### Task 12: `UnlockSheet`

**Files:**
- Create: `apps/desktop/src/picker/UnlockSheet.tsx`
- Create: `apps/desktop/tests/unlock.sheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/unlock.sheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { UnlockSheet } from '~/picker/UnlockSheet'

const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u', pinRequired: true,
}

beforeEach(() => { invokeMock.mockReset() })

function type4(digits: string) {
  const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
  for (let i = 0; i < 4; i++) {
    fireEvent.change(boxes[i], { target: { value: digits[i] } })
  }
}

describe('UnlockSheet', () => {
  it('renders the profile name', () => {
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    expect(screen.getByText(/Akua/)).toBeInTheDocument()
  })

  it('correct PIN calls open_profile_window and closes', async () => {
    invokeMock.mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<UnlockSheet open profile={profile} onClose={onClose} />)
    type4('1234')
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1', pin: '1234' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('wrong PIN shows error and re-enables input', async () => {
    invokeMock.mockRejectedValueOnce('wrong_pin')
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    type4('0000')
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/wrong/i)
    })
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes[0].disabled).toBe(false)
  })

  it('locked response shows countdown and disables input', async () => {
    invokeMock.mockRejectedValueOnce('locked:30')
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    type4('0000')
    await waitFor(() => {
      expect(screen.getByText(/Try again in/i)).toBeInTheDocument()
    })
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes[0].disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — FAIL**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/unlock.sheet.test.tsx
```

Expected: module not found.

- [ ] **Step 3: Implement `UnlockSheet.tsx`**

Create `apps/desktop/src/picker/UnlockSheet.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import { profileApi, type Profile } from '~/profiles/profile.api'
import { PinInput } from './PinInput'

interface Props {
  open: boolean
  profile: Profile | null
  onClose: () => void
}

export function UnlockSheet({ open, profile, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lockSecs, setLockSecs] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  // Tick down lockout countdown.
  useEffect(() => {
    if (lockSecs === null) return
    if (lockSecs <= 0) { setLockSecs(null); return }
    const t = setTimeout(() => setLockSecs(lockSecs - 1), 1000)
    return () => clearTimeout(t)
  }, [lockSecs])

  // Reset state on close.
  useEffect(() => {
    if (!open) {
      setPin(''); setShake(false); setErr(null); setLockSecs(null); setBusy(false)
    }
  }, [open])

  if (!open || !profile) return null
  const { from, to } = FRUIT_HEX[profile.fruitColor]
  const locked = lockSecs !== null && lockSecs > 0

  async function tryUnlock(entered: string) {
    if (busy || locked || !profile) return
    setBusy(true); setErr(null); setShake(false)
    try {
      await profileApi.openProfileWindow(profile.id, entered)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith('locked:')) {
        const secs = parseInt(msg.slice('locked:'.length), 10)
        setLockSecs(isNaN(secs) ? 30 : secs)
        setErr(null)
      } else if (msg === 'wrong_pin') {
        setShake(true)
        setErr('Wrong PIN. Try again.')
        // Clear the input on the next tick so the boxes empty after the shake registers.
        setTimeout(() => { setPin(''); setShake(false) }, 450)
      } else {
        setErr(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  function fmt(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div role="dialog" aria-modal aria-label={`Unlock ${profile.name}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => e.preventDefault()}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}
      >
        <div aria-hidden style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
          border: '2px solid rgba(255,255,255,0.85)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700,
        }}>{profile.avatarLetter}</div>
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>Unlock {profile.name}</h2>
        <PinInput
          value={pin}
          onChange={setPin}
          onComplete={tryUnlock}
          disabled={busy || locked}
          shake={shake}
          autoFocus
        />
        {locked && (
          <div style={{ color: '#a23a1f', fontSize: 13 }}>
            Try again in {fmt(lockSecs!)}
          </div>
        )}
        {err && !locked && (
          <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>
        )}
        <button type="button" onClick={onClose}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect 4 pass**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/unlock.sheet.test.tsx
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/picker/UnlockSheet.tsx apps/desktop/tests/unlock.sheet.test.tsx
git commit -m "feat(picker): UnlockSheet with wrong-PIN shake and lockout countdown"
```

---

### Task 13: `ChangePinSheet`

**Files:**
- Create: `apps/desktop/src/picker/ChangePinSheet.tsx`

- [ ] **Step 1: Implement**

Create `apps/desktop/src/picker/ChangePinSheet.tsx`:

```tsx
import { useState } from 'react'
import { profileApi, type Profile } from '~/profiles/profile.api'
import { PinInput } from './PinInput'

type Mode = 'set' | 'change' | 'remove'

interface Props {
  open: boolean
  mode: Mode
  profile: Profile | null
  onClose: () => void
}

export function ChangePinSheet({ open, mode, profile, onClose }: Props) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open || !profile) return null

  const requiresCurrent = mode !== 'set'  // 'set' only valid when profile has no PIN; rendered by caller
  const requiresNew = mode !== 'remove'

  const currentValid = !requiresCurrent || currentPin.length === 4
  const newValid = !requiresNew || (newPin.length === 4 && newPin === confirmPin)
  const canSubmit = currentValid && newValid && !busy

  function reset() {
    setCurrentPin(''); setNewPin(''); setConfirmPin(''); setErr(null); setBusy(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !profile) return
    setBusy(true); setErr(null)
    try {
      if (mode === 'set') {
        await profileApi.setPin(profile.id, newPin)
      } else if (mode === 'change') {
        await profileApi.setPin(profile.id, newPin, currentPin)
      } else {
        await profileApi.removePin(profile.id, currentPin)
      }
      reset(); onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'wrong_pin') setErr('Current PIN is wrong.')
      else if (msg.startsWith('locked:')) setErr(`Too many wrong attempts. Try again later.`)
      else setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'set' ? `Set a PIN for ${profile.name}`
              : mode === 'change' ? `Change PIN for ${profile.name}`
              : `Remove PIN from ${profile.name}`

  return (
    <div role="dialog" aria-modal aria-label={title}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>{title}</h2>
        {requiresCurrent && (
          <div>
            <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Current PIN</div>
            <PinInput value={currentPin} onChange={setCurrentPin} autoFocus disabled={busy} />
          </div>
        )}
        {requiresNew && (
          <>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>New PIN</div>
              <PinInput value={newPin} onChange={setNewPin} disabled={busy} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Confirm new PIN</div>
              <PinInput value={confirmPin} onChange={setConfirmPin} disabled={busy} />
            </div>
            {newPin.length === 4 && confirmPin.length === 4 && newPin !== confirmPin && (
              <div role="alert" style={{ color: '#a23a1f', fontSize: 12 }}>PINs don&apos;t match.</div>
            )}
          </>
        )}
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { reset(); onClose() }} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {busy ? 'Saving…' : mode === 'remove' ? 'Remove PIN' : 'Save PIN'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/picker/ChangePinSheet.tsx
git commit -m "feat(picker): ChangePinSheet (set/change/remove modes)"
```

---

## Phase 7 — Wire sheets into the picker

### Task 14: ProfileTile lock badge + menu entries

**Files:**
- Modify: `apps/desktop/src/picker/ProfileTile.tsx`
- Modify: `apps/desktop/tests/picker.tile.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `apps/desktop/tests/picker.tile.test.tsx`:

```tsx
const lockedProfile = {
  ...profile,
  pinRequired: true,
}

describe('ProfileTile (locked)', () => {
  it('shows the lock badge when pinRequired is true', () => {
    render(<ProfileTile profile={lockedProfile} onSelect={() => undefined} />)
    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument()
  })

  it('does not show lock badge when pinRequired is false', () => {
    render(<ProfileTile profile={profile} onSelect={() => undefined} />)
    expect(screen.queryByLabelText(/locked/i)).toBeNull()
  })

  it('locked menu offers Change PIN and Remove PIN, not Set PIN', () => {
    const onChangePin = vi.fn(); const onRemovePin = vi.fn(); const onSetPin = vi.fn()
    render(<ProfileTile profile={lockedProfile} onSelect={() => undefined}
      onSetPin={onSetPin} onChangePin={onChangePin} onRemovePin={onRemovePin} />)
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    expect(screen.getByRole('menuitem', { name: /change pin/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /remove pin/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /^set pin$/i })).toBeNull()
  })

  it('unlocked menu offers Set PIN, not Change/Remove', () => {
    const onChangePin = vi.fn(); const onRemovePin = vi.fn(); const onSetPin = vi.fn()
    render(<ProfileTile profile={profile} onSelect={() => undefined}
      onSetPin={onSetPin} onChangePin={onChangePin} onRemovePin={onRemovePin} />)
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    expect(screen.getByRole('menuitem', { name: /^set pin$/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /change pin/i })).toBeNull()
  })
})
```

The existing `profile` constant at the top of the test file uses `pinRequired: false` (or doesn't include the field). Make sure `profile` is declared with `pinRequired: false` explicitly:

```ts
const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
  pinRequired: false,
}
```

(If the existing test file's `profile` const lacks the `pinRequired` field, TypeScript will start complaining once we update the `Profile` interface — adding it explicitly avoids that.)

- [ ] **Step 2: Run tests — expect fail**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/picker.tile.test.tsx
```

Expected: failures around lock-badge / menu entries.

- [ ] **Step 3: Update `ProfileTile.tsx`**

Replace `apps/desktop/src/picker/ProfileTile.tsx`:

```tsx
import { useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  profile: Profile
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onDelete?: (id: string) => void
  onSetPin?: (id: string) => void
  onChangePin?: (id: string) => void
  onRemovePin?: (id: string) => void
}

export function ProfileTile({
  profile, onSelect, onRename, onDelete, onSetPin, onChangePin, onRemovePin,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { from, to } = FRUIT_HEX[profile.fruitColor]
  const hasAnyMenuItem = onRename || onDelete || onSetPin || onChangePin || onRemovePin

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Open ${profile.name}`}
        onClick={() => onSelect(profile.id)}
        style={{
          appearance: 'none', cursor: 'pointer', border: 'none', background: 'rgba(255,250,240,0.95)',
          borderRadius: 16, padding: 16, width: 120, height: 120,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(60,20,10,0.25)',
          color: '#3c1810', fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'relative',
            width: 44, height: 44, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
            border: '2px solid rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, marginBottom: 8,
            boxShadow: '0 3px 8px rgba(60,20,10,0.35), inset 0 -3px 6px rgba(0,0,0,0.2)',
          }}
        >
          {profile.avatarLetter}
          {profile.pinRequired && (
            <span
              aria-label={`${profile.name} is locked`}
              style={{
                position: 'absolute', bottom: -2, right: -4,
                width: 18, height: 18, borderRadius: '50%',
                background: '#3c1810', color: '#fde7c4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                border: '2px solid #fff8ee',
              }}
            >
              {/* Tiny lock glyph */}
              🔒
            </span>
          )}
        </span>
        <span style={{ fontSize: 13 }}>{profile.name}</span>
      </button>
      {hasAnyMenuItem && (
        <>
          <button
            type="button"
            aria-label={`More options for ${profile.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            style={{
              position: 'absolute', top: 6, right: 6, width: 24, height: 24,
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#3c1810',
              fontSize: 16, lineHeight: 1, borderRadius: 12,
            }}
          >···</button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute', top: 32, right: 6, background: 'white',
                borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                padding: 4, minWidth: 140, zIndex: 10,
              }}
            >
              {onRename && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(profile.id) }}
                  style={menuItemStyle}>Rename</button>
              )}
              {!profile.pinRequired && onSetPin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSetPin(profile.id) }}
                  style={menuItemStyle}>Set PIN</button>
              )}
              {profile.pinRequired && onChangePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onChangePin(profile.id) }}
                  style={menuItemStyle}>Change PIN</button>
              )}
              {profile.pinRequired && onRemovePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRemovePin(profile.id) }}
                  style={menuItemStyle}>Remove PIN</button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(profile.id) }}
                  style={{ ...menuItemStyle, color: '#a23a1f' }}>Delete</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '6px 10px', border: 'none', background: 'transparent',
  cursor: 'pointer', fontSize: 13,
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/picker.tile.test.tsx
```

Expected: 7 passing (3 original + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/picker/ProfileTile.tsx apps/desktop/tests/picker.tile.test.tsx
git commit -m "feat(picker): lock badge on tile + Set/Change/Remove PIN menu entries"
```

---

### Task 15: `usePickerData` routes select through UnlockSheet; adds PIN actions

**Files:**
- Modify: `apps/desktop/src/picker/usePickerData.ts`
- Modify: `apps/desktop/tests/picker.data.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/desktop/tests/picker.data.test.ts`:

```ts
const lockedProfile = (id: string, name: string) => ({
  id, name, fruitColor: 'mango' as const, avatarLetter: name[0],
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
  pinRequired: true,
})
const unlockedProfile = (id: string, name: string) => ({
  ...lockedProfile(id, name),
  pinRequired: false,
})

describe('usePickerData PIN routing', () => {
  it('select on unlocked profile calls open_profile_window directly', async () => {
    invokeMock.mockResolvedValue(undefined)
    usePickerData.setState({ profiles: [unlockedProfile('p1', 'Akua')], showOnStartup: false, loading: false, error: null, unlockTarget: null })
    await usePickerData.getState().select('p1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1', pin: null })
    expect(usePickerData.getState().unlockTarget).toBeNull()
  })

  it('select on locked profile does NOT call open_profile_window; sets unlockTarget', async () => {
    invokeMock.mockResolvedValue(undefined)
    usePickerData.setState({ profiles: [lockedProfile('p1', 'Akua')], showOnStartup: false, loading: false, error: null, unlockTarget: null })
    await usePickerData.getState().select('p1')
    expect(invokeMock).not.toHaveBeenCalled()
    expect(usePickerData.getState().unlockTarget).toBe('p1')
  })

  it('clearUnlockTarget resets', () => {
    usePickerData.setState({ unlockTarget: 'p1' } as any)
    usePickerData.getState().clearUnlockTarget()
    expect(usePickerData.getState().unlockTarget).toBeNull()
  })

  it('setPin calls cmd_set_profile_pin and rehydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_set_profile_pin') return Promise.resolve()
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().setPin('p1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'p1', newPin: '1234', currentPin: null })
  })

  it('removePin calls cmd_remove_profile_pin and rehydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_remove_profile_pin') return Promise.resolve()
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().removePin('p1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_remove_profile_pin', { id: 'p1', currentPin: '1234' })
  })
})
```

- [ ] **Step 2: Update `usePickerData.ts`**

Replace `apps/desktop/src/picker/usePickerData.ts`:

```ts
import { create } from 'zustand'
import { profileApi, type Profile } from '~/profiles/profile.api'
import type { FruitColor } from '~/profiles/fruitColors'

interface PickerState {
  profiles: Profile[]
  showOnStartup: boolean
  loading: boolean
  error: string | null
  unlockTarget: string | null   // profile id awaiting PIN entry
  hydrate: () => Promise<void>
  create: (name: string, color?: FruitColor, pin?: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  delete: (id: string) => Promise<void>
  toggleShowOnStartup: (value: boolean) => Promise<void>
  select: (id: string) => Promise<void>
  clearUnlockTarget: () => void
  setPin: (id: string, newPin: string, currentPin?: string) => Promise<void>
  removePin: (id: string, currentPin: string) => Promise<void>
  openGuest: () => Promise<void>
}

export const usePickerData = create<PickerState>((set, get) => ({
  profiles: [],
  showOnStartup: false,
  loading: false,
  error: null,
  unlockTarget: null,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const [profiles, prefs] = await Promise.all([profileApi.list(), profileApi.pickerPrefs()])
      set({ profiles, showOnStartup: prefs.showOnStartup, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'failed to load profiles' })
    }
  },

  create: async (name, color, pin) => {
    await profileApi.create(name, color, pin)
    await get().hydrate()
  },

  rename: async (id, name) => {
    await profileApi.rename(id, name)
    await get().hydrate()
  },

  delete: async (id) => {
    await profileApi.delete(id)
    await get().hydrate()
  },

  toggleShowOnStartup: async (value) => {
    await profileApi.setShowOnStartup(value)
    set({ showOnStartup: value })
  },

  select: async (id) => {
    const p = get().profiles.find((x) => x.id === id)
    if (p?.pinRequired) {
      set({ unlockTarget: id })
      return
    }
    await profileApi.openProfileWindow(id)
  },

  clearUnlockTarget: () => set({ unlockTarget: null }),

  setPin: async (id, newPin, currentPin) => {
    await profileApi.setPin(id, newPin, currentPin)
    await get().hydrate()
  },

  removePin: async (id, currentPin) => {
    await profileApi.removePin(id, currentPin)
    await get().hydrate()
  },

  openGuest: async () => {
    await profileApi.openGuestWindow()
  },
}))
```

- [ ] **Step 3: Run tests — expect green**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/picker.data.test.ts
```

Expected: all picker.data tests pass (existing + new).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/picker/usePickerData.ts apps/desktop/tests/picker.data.test.ts
git commit -m "feat(picker): route select through unlockTarget for locked profiles; setPin/removePin actions"
```

---

### Task 16: `PickerApp` renders `UnlockSheet` + `ChangePinSheet`

**Files:**
- Modify: `apps/desktop/src/picker/PickerApp.tsx`

- [ ] **Step 1: Update `PickerApp.tsx`**

Replace the full content of `apps/desktop/src/picker/PickerApp.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
import { UnlockSheet } from './UnlockSheet'
import { ChangePinSheet } from './ChangePinSheet'
import { usePickerData } from './usePickerData'
import { profileApi } from '~/profiles/profile.api'

type PinSheet = { mode: 'set' | 'change' | 'remove'; profileId: string } | null

export function PickerApp() {
  const profiles = usePickerData((s) => s.profiles)
  const showOnStartup = usePickerData((s) => s.showOnStartup)
  const error = usePickerData((s) => s.error)
  const unlockTarget = usePickerData((s) => s.unlockTarget)
  const hydrate = usePickerData((s) => s.hydrate)
  const create = usePickerData((s) => s.create)
  const renameAction = usePickerData((s) => s.rename)
  const deleteAction = usePickerData((s) => s.delete)
  const toggleShow = usePickerData((s) => s.toggleShowOnStartup)
  const select = usePickerData((s) => s.select)
  const clearUnlockTarget = usePickerData((s) => s.clearUnlockTarget)
  const openGuest = usePickerData((s) => s.openGuest)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [pinSheet, setPinSheet] = useState<PinSheet>(null)

  useEffect(() => { void hydrate() }, [hydrate])

  // When UnlockSheet successfully unlocks, it calls onClose which closes the sheet.
  // After it closes, also clear the unlockTarget from the store.
  function handleUnlockClose() {
    // If the open_profile_window IPC succeeded, the new profile window is up.
    // Either way, dismiss the sheet by clearing the target.
    clearUnlockTarget()
  }

  async function handleRename(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    const next = window.prompt('Rename profile', p.name)
    if (next && next.trim()) await renameAction(id, next.trim())
  }
  async function handleDelete(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    if (window.confirm(`Delete profile "${p.name}"? This wipes its data.`)) await deleteAction(id)
  }

  const unlockingProfile = profiles.find((p) => p.id === unlockTarget) ?? null
  const pinSheetProfile = pinSheet ? profiles.find((p) => p.id === pinSheet.profileId) ?? null : null

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #fde7c4 0%, #f4b878 30%, #d97a3a 65%, #6b2814 100%)',
    }}>
      <div style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 24px 64px',
      }}>
        <GroveTree size={72} />
        <h1 style={{ color: '#3c1810', fontSize: 22, margin: '12px 0 4px' }}>Who's using Baobab?</h1>
        <p style={{ color: 'rgba(60,24,16,0.7)', fontSize: 12, margin: 0 }}>
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
        </p>
        <div style={{ marginTop: 24 }}>
          <ProfileGrid
            profiles={profiles}
            onSelect={(id) => void select(id)}
            onRename={handleRename}
            onDelete={handleDelete}
            onSetPin={(id) => setPinSheet({ mode: 'set', profileId: id })}
            onChangePin={(id) => setPinSheet({ mode: 'change', profileId: id })}
            onRemovePin={(id) => setPinSheet({ mode: 'remove', profileId: id })}
            onAdd={() => setSheetOpen(true)}
            onGuest={() => void openGuest()}
          />
        </div>
      </div>
      <label style={{
        position: 'absolute', bottom: 12, left: 16,
        color: 'rgba(255,250,240,0.95)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <input
          type="checkbox"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
        />
        Show on startup
      </label>
      {error && <div role="alert" style={{ position: 'absolute', bottom: 12, right: 16, color: '#fff8ee', fontSize: 12 }}>{error}</div>}

      <NewProfileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(name, color, pin) => create(name, color, pin)}
      />
      <UnlockSheet
        open={!!unlockTarget}
        profile={unlockingProfile}
        onClose={handleUnlockClose}
      />
      <ChangePinSheet
        open={!!pinSheet}
        mode={pinSheet?.mode ?? 'set'}
        profile={pinSheetProfile}
        onClose={() => setPinSheet(null)}
      />
    </div>
  )
}
```

Note: `ProfileGrid`'s props need to accept the three new menu callbacks. Update its type signature in `ProfileGrid.tsx` to thread them through to `ProfileTile`:

In `apps/desktop/src/picker/ProfileGrid.tsx`, update `interface Props` and the `<ProfileTile>` element:

```tsx
interface Props {
  profiles: Profile[]
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onSetPin: (id: string) => void
  onChangePin: (id: string) => void
  onRemovePin: (id: string) => void
  onAdd: () => void
  onGuest: () => void
}
// ...inside the map:
<ProfileTile
  key={p.id}
  profile={p}
  onSelect={onSelect}
  onRename={onRename}
  onDelete={onDelete}
  onSetPin={onSetPin}
  onChangePin={onChangePin}
  onRemovePin={onRemovePin}
/>
```

- [ ] **Step 2: Run all tests**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck && npm test
```

Expected: typecheck clean, full TS suite green.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/picker/PickerApp.tsx apps/desktop/src/picker/ProfileGrid.tsx
git commit -m "feat(picker): wire UnlockSheet and ChangePinSheet into PickerApp"
```

---

## Phase 8 — Final integration + manual test

### Task 17: Full Rust build + manual smoke test

**Files:** None — runtime verification only.

- [ ] **Step 1: Run full Rust test suite**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test
```

Expected: every existing test plus the new `pin::tests`, `pin_attempts::tests`, `profiles::view_tests`, `profiles::pin_management_tests`, the new test in `profiles::load_tests` all pass.

- [ ] **Step 2: Run full TS test suite**

```bash
cd C:\dev\baobab\apps\desktop && npm test && npm run typecheck
```

Expected: all green.

- [ ] **Step 3: Build the desktop app**

```bash
cd C:\dev\baobab\apps\desktop && npm run build
```

Expected: clean. `dist/index.html`, `dist/picker.html` produced.

- [ ] **Step 4: Manual smoke**

Run `cd C:\dev\baobab\apps\desktop && npm run tauri dev` and verify:

1. Existing unlocked profiles still work — clicking their tile opens the window directly (no PIN prompt).
2. Create a new profile with the "Lock with PIN" toggle on, PIN `1234`. Tile gains the lock badge.
3. Close the locked profile window if it auto-opens. Reopen the picker via the avatar in another profile window. Click the locked tile → UnlockSheet appears.
4. Enter `0000` → shake animation, "Wrong PIN" message, boxes clear.
5. Enter `0000` three times in a row → on the third wrong, the boxes disable and "Try again in 0:30" countdown shows.
6. Wait 30 seconds. Enter `1234` → window opens, sheet closes.
7. From the locked tile's "···" menu, choose **Change PIN**. Enter `1234` (current) then `5678` (twice). Save. New PIN sticks.
8. From the locked tile's "···" menu, choose **Remove PIN**. Enter `5678`. Lock badge disappears from tile.
9. Restart `npm run tauri dev` (Ctrl+C the dev process, restart). Confirm the previously-locked-and-now-unlocked profile is still unlocked; locked profiles still have their badge.
10. Confirm a locked profile can still be **Deleted** without entering its PIN — the menu shows Delete, clicking it confirms+deletes. Per spec this is the recovery path.

- [ ] **Step 5: Document manual results**

If any step fails, do NOT commit / declare done. Instead, write the failure into `memory/plan_deviations.md` (in project memory) and fix forward.

- [ ] **Step 6: Final commit**

If everything passes:

```bash
git commit --allow-empty -m "feat(pin): v1.5 — profile PIN lock manually verified

Acceptance criteria from docs/superpowers/specs/2026-05-15-profile-pin-design.md
verified manually."
```

---

## Self-Review Notes

Coverage check against the spec:

- **Data model — `pin_hash` field + `#[serde(default)]`** → Task 3.
- **Split DTO (Rust `Profile` vs `ProfileView`)** → Task 4.
- **PBKDF2-SHA256 + constant-time verify** → Task 1.
- **`PinAttempts` rate limiter with 3/30s, 6/5min, 9/30min ladder** → Task 2.
- **`cmd_create_profile` accepts optional PIN** → Tasks 5 + 7.
- **`cmd_set_profile_pin` + `cmd_remove_profile_pin`** → Tasks 6 + 7.
- **`open_profile_window` enforces PIN with rate limit** → Task 8.
- **Frontend `Profile.pinRequired`, `profileApi.setPin/removePin`, `openProfileWindow(id, pin)`** → Task 9.
- **`<PinInput>` reusable component** → Task 10.
- **`NewProfileSheet` Lock toggle** → Task 11.
- **`UnlockSheet`** → Task 12.
- **`ChangePinSheet` (set/change/remove modes)** → Task 13.
- **`ProfileTile` lock badge + menu entries** → Task 14.
- **`usePickerData.select` routing + `setPin/removePin` actions** → Task 15.
- **`PickerApp` wiring** → Task 16.
- **Acceptance criteria walked end-to-end** → Task 17.

Type consistency: `Profile` (TS) gains `pinRequired: boolean`; the Rust `ProfileView` serialises to this exact field via `#[serde(rename_all = "camelCase")]`. `profileApi.create(name, color?, pin?)` matches the IPC handler `cmd_create_profile(name, fruit_color, pin)`. `profileApi.openProfileWindow(profileId, pin?)` matches the Rust signature `(profile_id, pin)`. Error strings used in tests (`"wrong_pin"`, `"locked:30"`) match the Rust returns in Task 8.

No placeholders, every step has runnable code or commands, every test step is followed by an expected outcome.
