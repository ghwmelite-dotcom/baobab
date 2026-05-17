# Profile Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chrome-parity multi-profile support for the Baobab desktop browser with the "Baobab Grove" picker UI. Each profile is an independent local container with its own cookies, history, bookmarks, tabs, AI chat history, NTP customisation, and optional cloud-linked Baobab account. Profiles run side-by-side in separate Baobab windows.

**Architecture:** Profiles registered in `$APP_DATA/baobab/profiles.json`; per-profile data lives under `profiles/<uuid>/`. Each Tauri window is bound to exactly one profile (or to the picker / guest). Cookie isolation is enforced via `WebviewBuilder::data_directory(profile.user_data_dir)` on Windows. The picker is a separate Vite entry (`picker.html`) loaded into a dedicated picker window.

**Tech Stack:** Tauri 2, Rust (serde, serde_json, uuid, dirs, tempfile), React 18, Zustand, Vite multi-page build, Vitest + Testing Library, @tauri-apps/plugin-store.

**Spec:** `docs/superpowers/specs/2026-05-15-profile-picker-design.md`

---

## File Structure

### New Rust files
- `apps/desktop/src-tauri/src/profiles.rs` — Profile entity, registry, Tauri commands for CRUD + prefs + cloud-link
- `apps/desktop/src-tauri/src/windows.rs` — Multi-window orchestration (picker, profile, guest)
- `apps/desktop/src-tauri/src/migration.rs` — One-shot migration from pre-profile state

### Modified Rust files
- `apps/desktop/src-tauri/src/lib.rs` — Cold-start decision, command registration, plugin wiring
- `apps/desktop/src-tauri/src/tabs.rs` — Per-profile `data_directory`; window lookup by calling window's label
- `apps/desktop/src-tauri/src/downloads.rs` — Pass profile id into download records (no behaviour change yet, just plumbing)
- `apps/desktop/src-tauri/tauri.conf.json` — Remove the static `main` window; windows are created dynamically
- `apps/desktop/src-tauri/Cargo.toml` — Add `tempfile`, `chrono`

### New frontend files
- `apps/desktop/picker.html` — Picker entry HTML
- `apps/desktop/src/picker.tsx` — Picker entry script
- `apps/desktop/src/picker/PickerApp.tsx` — Top-level picker shell (sunset gradient bg)
- `apps/desktop/src/picker/GroveTree.tsx` — Decorative baobab emblem
- `apps/desktop/src/picker/ProfileGrid.tsx` — Grid container with new + guest tiles
- `apps/desktop/src/picker/ProfileTile.tsx` — One profile tile (fruit + name + menu)
- `apps/desktop/src/picker/NewProfileSheet.tsx` — Bottom sheet for creating a profile
- `apps/desktop/src/picker/picker.styles.ts` — Shared styles + colour constants
- `apps/desktop/src/picker/usePickerData.ts` — Zustand store for picker state
- `apps/desktop/src/profiles/ProfileContext.tsx` — React context exposing current window's profile
- `apps/desktop/src/profiles/useProfile.ts` — Hook returning current profile
- `apps/desktop/src/profiles/profile.api.ts` — Typed Tauri command wrappers
- `apps/desktop/src/profiles/fruitColors.ts` — Fruit colour palette constants

### Modified frontend files
- `apps/desktop/vite.config.ts` — Multi-page build (`index.html` + `picker.html`)
- `apps/desktop/src/state/persistence.ts` — Profile-scoped key namespacing
- `apps/desktop/src/auth/auth.store.ts` — Uses profile-scoped persistence keys
- `apps/desktop/src/state/tabs.store.ts` — Per-window (profile-scoped persistence)
- `apps/desktop/src/chrome/ChromeShell.tsx` — Wrap children in `<ProfileContext.Provider>`
- `apps/desktop/src/main.tsx` — Read profile id from window label/URL on boot
- `apps/desktop/src/App.tsx` — Consume `useProfile()`; add avatar button to chrome

### Test files
- `apps/desktop/src-tauri/src/profiles.rs` — Inline `#[cfg(test)] mod tests`
- `apps/desktop/src-tauri/src/migration.rs` — Inline `#[cfg(test)] mod tests`
- `apps/desktop/tests/profiles.api.test.ts` — TS Tauri wrapper tests
- `apps/desktop/tests/profile.context.test.tsx` — Context resolution
- `apps/desktop/tests/picker.data.test.ts` — usePickerData store
- `apps/desktop/tests/picker.tile.test.tsx` — ProfileTile interactions
- `apps/desktop/tests/picker.app.test.tsx` — PickerApp empty/one/many states
- `apps/desktop/tests/persistence.profile.test.ts` — Namespaced persistence
- `apps/desktop/tests/auth.store.test.ts` — UPDATE existing test to assert profile-namespaced keys

---

## Phase 1 — Rust profile registry

### Task 1: Profile + ProfilesFile types

**Files:**
- Create: `apps/desktop/src-tauri/src/profiles.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs:1-3` (add `mod profiles;`)
- Modify: `apps/desktop/src-tauri/Cargo.toml` (deps)

- [ ] **Step 1: Add `chrono` and `tempfile` to Cargo.toml**

In `apps/desktop/src-tauri/Cargo.toml`, under `[dependencies]`, add:

```toml
chrono = { version = "0.4", features = ["serde"] }
tempfile = "3"
```

- [ ] **Step 2: Write failing test for Profile serialization**

Create `apps/desktop/src-tauri/src/profiles.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FruitColor {
    Mango, Baobab, Shea, Indigo, Hibiscus, Palm, Kola, Baobwhite,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloudLink {
    pub baobab_user_id: String,
    pub account_email: Option<String>,
    pub account_phone: Option<String>,
    pub linked_at: String,
}

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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PickerPrefs {
    pub show_on_startup: bool,
    pub last_used_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesFile {
    pub schema_version: u32,
    pub profiles: Vec<Profile>,
    pub picker_prefs: PickerPrefs,
}

impl Default for ProfilesFile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            profiles: vec![],
            picker_prefs: PickerPrefs { show_on_startup: false, last_used_profile_id: None },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_file_round_trips_through_json() {
        let original = ProfilesFile {
            schema_version: 1,
            profiles: vec![Profile {
                id: "abc".to_string(),
                name: "Akua".to_string(),
                fruit_color: FruitColor::Mango,
                avatar_letter: "A".to_string(),
                created_at: "2026-05-15T00:00:00Z".to_string(),
                last_used_at: "2026-05-15T00:00:00Z".to_string(),
                cloud_link: None,
                user_data_dir_name: "userdata".to_string(),
            }],
            picker_prefs: PickerPrefs { show_on_startup: true, last_used_profile_id: Some("abc".to_string()) },
        };
        let json = serde_json::to_string(&original).unwrap();
        let parsed: ProfilesFile = serde_json::from_str(&json).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn profiles_file_serializes_camelcase_keys() {
        let f = ProfilesFile::default();
        let json = serde_json::to_string(&f).unwrap();
        assert!(json.contains("\"schemaVersion\""), "got: {}", json);
        assert!(json.contains("\"pickerPrefs\""), "got: {}", json);
        assert!(json.contains("\"showOnStartup\""), "got: {}", json);
    }
}
```

In `lib.rs`, add at line 1-3:

```rust
mod downloads;
mod profiles;
mod tabs;
```

- [ ] **Step 3: Run tests — should fail (module not yet compiling)**

```bash
cd apps/desktop/src-tauri && cargo test profiles::tests
```

Expected: tests compile and pass once the module is added; if there's any compile error, fix it before moving on.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/profiles.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(profiles): add Profile + ProfilesFile types"
```

---

### Task 2: `profiles::path_for` + `profiles::load`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append to `profiles.rs`:

```rust
use std::path::{Path, PathBuf};

/// Returns the absolute path to `profiles.json` under the app data dir.
/// Tests pass an explicit root; production code derives it from `dirs::data_dir()`.
pub fn profiles_json_path(app_data_root: &Path) -> PathBuf {
    app_data_root.join("baobab").join("profiles.json")
}

/// Read the profiles registry from disk.
///
/// Recovery rules:
/// - If file missing → return `Ok(ProfilesFile::default())`.
/// - If file present but unparseable → rename to `profiles.json.broken-<ts>` and return default.
pub fn load(app_data_root: &Path) -> Result<ProfilesFile, String> {
    let path = profiles_json_path(app_data_root);
    if !path.exists() {
        return Ok(ProfilesFile::default());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    match serde_json::from_slice::<ProfilesFile>(&bytes) {
        Ok(f) => Ok(f),
        Err(_) => {
            let ts = chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
            let broken = path.with_extension(format!("json.broken-{}", ts));
            let _ = std::fs::rename(&path, &broken);
            Ok(ProfilesFile::default())
        }
    }
}

#[cfg(test)]
mod load_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn missing_file_returns_default() {
        let dir = tempdir().unwrap();
        let f = load(dir.path()).unwrap();
        assert_eq!(f, ProfilesFile::default());
    }

    #[test]
    fn corrupted_file_is_renamed_and_default_returned() {
        let dir = tempdir().unwrap();
        let baobab = dir.path().join("baobab");
        std::fs::create_dir_all(&baobab).unwrap();
        std::fs::write(baobab.join("profiles.json"), b"{not json").unwrap();

        let f = load(dir.path()).unwrap();
        assert_eq!(f, ProfilesFile::default());

        let entries: Vec<_> = std::fs::read_dir(&baobab).unwrap().collect();
        let names: Vec<String> = entries.iter()
            .filter_map(|e| e.as_ref().ok().map(|e| e.file_name().to_string_lossy().into_owned()))
            .collect();
        assert!(names.iter().any(|n| n.starts_with("profiles.json.broken-")), "got: {:?}", names);
    }

    #[test]
    fn valid_file_round_trips() {
        let dir = tempdir().unwrap();
        let baobab = dir.path().join("baobab");
        std::fs::create_dir_all(&baobab).unwrap();
        let original = ProfilesFile::default();
        std::fs::write(baobab.join("profiles.json"), serde_json::to_vec(&original).unwrap()).unwrap();

        let parsed = load(dir.path()).unwrap();
        assert_eq!(parsed, original);
    }
}
```

- [ ] **Step 2: Run tests — should pass**

```bash
cd apps/desktop/src-tauri && cargo test profiles::load_tests
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): registry load with corruption recovery"
```

---

### Task 3: `profiles::save` (atomic write)

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
/// Write the profiles registry to disk atomically (temp file + rename).
pub fn save(app_data_root: &Path, file: &ProfilesFile) -> Result<(), String> {
    let path = profiles_json_path(app_data_root);
    let baobab_dir = path.parent().ok_or("no parent")?;
    std::fs::create_dir_all(baobab_dir).map_err(|e| e.to_string())?;
    let tmp = baobab_dir.join(format!(".profiles.json.tmp.{}", std::process::id()));
    let bytes = serde_json::to_vec_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod save_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn save_then_load_roundtrips() {
        let dir = tempdir().unwrap();
        let mut original = ProfilesFile::default();
        original.picker_prefs.show_on_startup = true;
        save(dir.path(), &original).unwrap();

        let loaded = load(dir.path()).unwrap();
        assert_eq!(loaded, original);
    }

    #[test]
    fn save_creates_baobab_directory_if_missing() {
        let dir = tempdir().unwrap();
        save(dir.path(), &ProfilesFile::default()).unwrap();
        assert!(dir.path().join("baobab").join("profiles.json").exists());
    }
}
```

- [ ] **Step 2: Run tests — should pass**

```bash
cd apps/desktop/src-tauri && cargo test profiles::save_tests
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): atomic save with temp-and-rename"
```

---

### Task 4: `create_profile`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
use uuid::Uuid;

const DEFAULT_FRUIT_ORDER: [FruitColor; 8] = [
    FruitColor::Mango, FruitColor::Baobab, FruitColor::Shea, FruitColor::Indigo,
    FruitColor::Hibiscus, FruitColor::Palm, FruitColor::Kola, FruitColor::Baobwhite,
];

fn next_default_color(existing: &[Profile]) -> FruitColor {
    let used: std::collections::HashSet<&FruitColor> = existing.iter().map(|p| &p.fruit_color).collect();
    DEFAULT_FRUIT_ORDER.iter().find(|c| !used.contains(c)).cloned().unwrap_or(FruitColor::Mango)
}

fn derive_avatar_letter(name: &str) -> String {
    name.chars().next().map(|c| c.to_uppercase().to_string()).unwrap_or_else(|| "?".to_string())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn create_profile(
    app_data_root: &Path,
    name: String,
    fruit_color: Option<FruitColor>,
) -> Result<Profile, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 {
        return Err("name must be 1-48 chars".to_string());
    }
    if name.chars().any(|c| c.is_control()) {
        return Err("name contains control chars".to_string());
    }

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

#[cfg(test)]
mod create_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn create_profile_writes_registry_and_dir() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        assert_eq!(p.name, "Akua");
        assert_eq!(p.avatar_letter, "A");
        assert_eq!(p.fruit_color, FruitColor::Mango);
        assert!(dir.path().join("baobab").join("profiles").join(&p.id).join("userdata").is_dir());
        let f = load(dir.path()).unwrap();
        assert_eq!(f.profiles.len(), 1);
    }

    #[test]
    fn second_profile_flips_show_on_startup() {
        let dir = tempdir().unwrap();
        create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        assert!(!load(dir.path()).unwrap().picker_prefs.show_on_startup);
        create_profile(dir.path(), "Kofi".to_string(), None).unwrap();
        assert!(load(dir.path()).unwrap().picker_prefs.show_on_startup);
    }

    #[test]
    fn second_profile_gets_different_default_color() {
        let dir = tempdir().unwrap();
        let p1 = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let p2 = create_profile(dir.path(), "Kofi".to_string(), None).unwrap();
        assert_ne!(p1.fruit_color, p2.fruit_color);
    }

    #[test]
    fn rejects_empty_or_too_long_name() {
        let dir = tempdir().unwrap();
        assert!(create_profile(dir.path(), "".to_string(), None).is_err());
        assert!(create_profile(dir.path(), "   ".to_string(), None).is_err());
        let long = "x".repeat(49);
        assert!(create_profile(dir.path(), long, None).is_err());
    }

    #[test]
    fn rejects_control_chars_in_name() {
        let dir = tempdir().unwrap();
        assert!(create_profile(dir.path(), "Hi\nthere".to_string(), None).is_err());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test profiles::create_tests
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): create_profile with name validation"
```

---

### Task 5: `rename_profile` + `update_profile_color`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
pub fn rename_profile(app_data_root: &Path, id: &str, new_name: String) -> Result<(), String> {
    let new_name = new_name.trim();
    if new_name.is_empty() || new_name.chars().count() > 48 || new_name.chars().any(|c| c.is_control()) {
        return Err("invalid name".to_string());
    }
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    p.name = new_name.to_string();
    p.avatar_letter = derive_avatar_letter(new_name);
    save(app_data_root, &file)
}

pub fn update_profile_color(app_data_root: &Path, id: &str, color: FruitColor) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    p.fruit_color = color;
    save(app_data_root, &file)
}

#[cfg(test)]
mod rename_color_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rename_updates_name_and_avatar_letter() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        rename_profile(dir.path(), &p.id, "Brilla".to_string()).unwrap();
        let f = load(dir.path()).unwrap();
        assert_eq!(f.profiles[0].name, "Brilla");
        assert_eq!(f.profiles[0].avatar_letter, "B");
    }

    #[test]
    fn rename_unknown_id_errors() {
        let dir = tempdir().unwrap();
        assert!(rename_profile(dir.path(), "nope", "X".to_string()).is_err());
    }

    #[test]
    fn rename_rejects_invalid_name() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        assert!(rename_profile(dir.path(), &p.id, "".to_string()).is_err());
    }

    #[test]
    fn update_color_changes_fruit_color() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        update_profile_color(dir.path(), &p.id, FruitColor::Indigo).unwrap();
        let f = load(dir.path()).unwrap();
        assert_eq!(f.profiles[0].fruit_color, FruitColor::Indigo);
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test profiles::rename_color_tests
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): rename_profile + update_profile_color"
```

---

### Task 6: `delete_profile`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
/// Delete a profile from registry and remove its data directory.
/// Callers (the Tauri command layer) must ensure no profile window is open
/// for this id before calling — this function does not enforce that.
pub fn delete_profile(app_data_root: &Path, id: &str) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let before = file.profiles.len();
    file.profiles.retain(|p| p.id != id);
    if file.profiles.len() == before {
        return Err("profile not found".to_string());
    }
    if file.picker_prefs.last_used_profile_id.as_deref() == Some(id) {
        file.picker_prefs.last_used_profile_id = None;
    }
    if file.profiles.len() < 2 {
        file.picker_prefs.show_on_startup = false;
    }
    save(app_data_root, &file)?;
    let profile_dir = app_data_root.join("baobab").join("profiles").join(id);
    if profile_dir.exists() {
        std::fs::remove_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod delete_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn delete_removes_from_registry_and_disk() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let profile_dir = dir.path().join("baobab").join("profiles").join(&p.id);
        assert!(profile_dir.exists());

        delete_profile(dir.path(), &p.id).unwrap();
        assert_eq!(load(dir.path()).unwrap().profiles.len(), 0);
        assert!(!profile_dir.exists());
    }

    #[test]
    fn delete_unknown_id_errors() {
        let dir = tempdir().unwrap();
        assert!(delete_profile(dir.path(), "nope").is_err());
    }

    #[test]
    fn deleting_last_used_clears_pointer() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let mut f = load(dir.path()).unwrap();
        f.picker_prefs.last_used_profile_id = Some(p.id.clone());
        save(dir.path(), &f).unwrap();

        delete_profile(dir.path(), &p.id).unwrap();
        assert_eq!(load(dir.path()).unwrap().picker_prefs.last_used_profile_id, None);
    }

    #[test]
    fn dropping_below_two_disables_show_on_startup() {
        let dir = tempdir().unwrap();
        let p1 = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let _p2 = create_profile(dir.path(), "Kofi".to_string(), None).unwrap();
        assert!(load(dir.path()).unwrap().picker_prefs.show_on_startup);

        delete_profile(dir.path(), &p1.id).unwrap();
        assert!(!load(dir.path()).unwrap().picker_prefs.show_on_startup);
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test profiles::delete_tests
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): delete_profile removes registry entry + dir"
```

---

### Task 7: Picker prefs + `resolve_user_data_dir`

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
pub fn set_show_on_startup(app_data_root: &Path, value: bool) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    file.picker_prefs.show_on_startup = value;
    save(app_data_root, &file)
}

pub fn record_profile_used(app_data_root: &Path, id: &str) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    p.last_used_at = now_iso();
    file.picker_prefs.last_used_profile_id = Some(id.to_string());
    save(app_data_root, &file)
}

pub fn resolve_user_data_dir(app_data_root: &Path, profile: &Profile) -> PathBuf {
    app_data_root.join("baobab").join("profiles").join(&profile.id).join(&profile.user_data_dir_name)
}

#[cfg(test)]
mod prefs_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn set_show_on_startup_persists() {
        let dir = tempdir().unwrap();
        set_show_on_startup(dir.path(), true).unwrap();
        assert!(load(dir.path()).unwrap().picker_prefs.show_on_startup);
    }

    #[test]
    fn record_profile_used_updates_pointer_and_timestamp() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let before = p.last_used_at.clone();
        std::thread::sleep(std::time::Duration::from_millis(10));
        record_profile_used(dir.path(), &p.id).unwrap();
        let f = load(dir.path()).unwrap();
        assert_eq!(f.picker_prefs.last_used_profile_id.as_deref(), Some(p.id.as_str()));
        assert_ne!(f.profiles[0].last_used_at, before);
    }

    #[test]
    fn resolve_user_data_dir_builds_correct_path() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        let got = resolve_user_data_dir(dir.path(), &p);
        assert!(got.ends_with(PathBuf::from("baobab").join("profiles").join(&p.id).join("userdata")));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test profiles::prefs_tests
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): picker prefs + user-data-dir resolver"
```

---

### Task 8: Cloud-link link/unlink

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`

- [ ] **Step 1: Write failing tests**

Append:

```rust
pub fn link_baobab_account(app_data_root: &Path, id: &str, link: CloudLink) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    p.cloud_link = Some(link);
    save(app_data_root, &file)
}

pub fn unlink_baobab_account(app_data_root: &Path, id: &str) -> Result<(), String> {
    let mut file = load(app_data_root)?;
    let p = file.profiles.iter_mut().find(|p| p.id == id).ok_or("profile not found")?;
    p.cloud_link = None;
    save(app_data_root, &file)
}

#[cfg(test)]
mod cloud_link_tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_link() -> CloudLink {
        CloudLink {
            baobab_user_id: "u1".to_string(),
            account_email: Some("a@b.com".to_string()),
            account_phone: None,
            linked_at: now_iso(),
        }
    }

    #[test]
    fn link_sets_cloud_link() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        link_baobab_account(dir.path(), &p.id, sample_link()).unwrap();
        let f = load(dir.path()).unwrap();
        assert!(f.profiles[0].cloud_link.is_some());
        assert_eq!(f.profiles[0].cloud_link.as_ref().unwrap().baobab_user_id, "u1");
    }

    #[test]
    fn unlink_clears_cloud_link() {
        let dir = tempdir().unwrap();
        let p = create_profile(dir.path(), "Akua".to_string(), None).unwrap();
        link_baobab_account(dir.path(), &p.id, sample_link()).unwrap();
        unlink_baobab_account(dir.path(), &p.id).unwrap();
        assert!(load(dir.path()).unwrap().profiles[0].cloud_link.is_none());
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test profiles::cloud_link_tests
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs
git commit -m "feat(profiles): cloud-link link/unlink"
```

---

## Phase 2 — Tauri commands for profiles

### Task 9: App-data-root helper + Tauri commands

**Files:**
- Modify: `apps/desktop/src-tauri/src/profiles.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (register commands)

- [ ] **Step 1: Add Tauri command shims**

Append to `profiles.rs`:

```rust
use tauri::{AppHandle, Manager};

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        // The Tauri-resolved app data dir already includes the identifier
        // (e.g. .../africa.baobab.desktop). We then nest a "baobab" dir
        // inside it via profiles_json_path/save/etc. so the layout reads:
        //   <appdata>/africa.baobab.desktop/baobab/profiles.json
}

#[tauri::command]
pub async fn cmd_list_profiles(app: AppHandle) -> Result<Vec<Profile>, String> {
    let root = app_data_root(&app)?;
    Ok(load(&root)?.profiles)
}

#[tauri::command]
pub async fn cmd_get_picker_prefs(app: AppHandle) -> Result<PickerPrefs, String> {
    let root = app_data_root(&app)?;
    Ok(load(&root)?.picker_prefs)
}

#[tauri::command]
pub async fn cmd_create_profile(app: AppHandle, name: String, fruit_color: Option<FruitColor>) -> Result<Profile, String> {
    let root = app_data_root(&app)?;
    create_profile(&root, name, fruit_color)
}

#[tauri::command]
pub async fn cmd_rename_profile(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let root = app_data_root(&app)?;
    rename_profile(&root, &id, name)
}

#[tauri::command]
pub async fn cmd_update_profile_color(app: AppHandle, id: String, color: FruitColor) -> Result<(), String> {
    let root = app_data_root(&app)?;
    update_profile_color(&root, &id, color)
}

#[tauri::command]
pub async fn cmd_delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    let root = app_data_root(&app)?;
    // Refuse if any window for this profile is currently open.
    for (label, _) in app.webview_windows() {
        if label == format!("profile-{id}") {
            return Err("close all windows for this profile first".to_string());
        }
    }
    delete_profile(&root, &id)
}

#[tauri::command]
pub async fn cmd_set_show_on_startup(app: AppHandle, value: bool) -> Result<(), String> {
    let root = app_data_root(&app)?;
    set_show_on_startup(&root, value)
}

#[tauri::command]
pub async fn cmd_record_profile_used(app: AppHandle, id: String) -> Result<(), String> {
    let root = app_data_root(&app)?;
    record_profile_used(&root, &id)
}
```

- [ ] **Step 2: Register commands in `lib.rs`**

Replace the `.invoke_handler(...)` block in `apps/desktop/src-tauri/src/lib.rs` with:

```rust
.invoke_handler(tauri::generate_handler![
    tabs::create_tab,
    tabs::close_tab,
    tabs::show_tab,
    tabs::hide_tab,
    tabs::hide_all_tabs,
    tabs::navigate_tab,
    tabs::list_tabs,
    tabs::tab_go_back,
    tabs::tab_go_forward,
    downloads::download_show_in_folder,
    downloads::download_open_file,
    profiles::cmd_list_profiles,
    profiles::cmd_get_picker_prefs,
    profiles::cmd_create_profile,
    profiles::cmd_rename_profile,
    profiles::cmd_update_profile_color,
    profiles::cmd_delete_profile,
    profiles::cmd_set_show_on_startup,
    profiles::cmd_record_profile_used,
])
```

- [ ] **Step 3: Run cargo build**

```bash
cd apps/desktop/src-tauri && cargo build
```

Expected: builds clean. Fix any unused-import warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/profiles.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(profiles): expose Tauri commands for profile CRUD + prefs"
```

---

## Phase 3 — Multi-window infrastructure

### Task 10: Remove static `main` window from tauri.conf.json

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Remove the static window entry**

Replace `app.windows` array with `[]`:

```json
"app": {
  "withGlobalTauri": false,
  "windows": [],
  "security": { ... }
}
```

(Leave `security` block untouched.)

- [ ] **Step 2: Verify build still compiles**

```bash
cd apps/desktop/src-tauri && cargo build
```

Expected: builds. The app won't open any window yet on launch — that's handled in Task 13.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/tauri.conf.json
git commit -m "chore(tauri): remove static main window; windows are created dynamically"
```

---

### Task 11: `windows::open_profile_window`

**Files:**
- Create: `apps/desktop/src-tauri/src/windows.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (`mod windows;`)

- [ ] **Step 1: Create `windows.rs`**

```rust
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::profiles;

pub const PICKER_LABEL: &str = "picker";
pub const GUEST_LABEL_PREFIX: &str = "guest-";

pub fn profile_window_label(profile_id: &str) -> String {
    format!("profile-{profile_id}")
}

#[tauri::command]
pub async fn open_profile_window(app: AppHandle, profile_id: String) -> Result<(), String> {
    let label = profile_window_label(&profile_id);
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let url = WebviewUrl::App(format!("index.html?profileId={profile_id}").into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    // Persist last-used pointer + bump timestamp.
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let _ = profiles::record_profile_used(&root, &profile_id);
    Ok(())
}
```

In `lib.rs`, add `mod windows;` after `mod tabs;`.

- [ ] **Step 2: Register the command in `lib.rs`**

Add to the `invoke_handler` macro:

```rust
windows::open_profile_window,
```

- [ ] **Step 3: Run cargo build**

```bash
cd apps/desktop/src-tauri && cargo build
```

Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/windows.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(windows): open_profile_window with per-profile label"
```

---

### Task 12: `windows::open_picker_window` + `open_guest_window`

**Files:**
- Modify: `apps/desktop/src-tauri/src/windows.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add picker + guest window commands**

Append to `windows.rs`:

```rust
#[tauri::command]
pub async fn open_picker_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(PICKER_LABEL) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let url = WebviewUrl::App("picker.html".into());
    WebviewWindowBuilder::new(&app, PICKER_LABEL, url)
        .title("Baobab — Profiles")
        .inner_size(960.0, 720.0)
        .min_inner_size(640.0, 560.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_guest_window(app: AppHandle) -> Result<(), String> {
    let suffix = uuid::Uuid::new_v4().to_string();
    let label = format!("{GUEST_LABEL_PREFIX}{suffix}");
    let url = WebviewUrl::App("index.html?profileId=guest".into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Baobab — Guest")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .decorations(false)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn current_profile_id(window: tauri::Window) -> Option<String> {
    profile_id_from_label(window.label())
}

pub fn profile_id_from_label(label: &str) -> Option<String> {
    if let Some(rest) = label.strip_prefix("profile-") {
        Some(rest.to_string())
    } else if label.starts_with(GUEST_LABEL_PREFIX) {
        Some("guest".to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_id_from_label_recognizes_profile_prefix() {
        assert_eq!(profile_id_from_label("profile-abc-123"), Some("abc-123".to_string()));
    }

    #[test]
    fn profile_id_from_label_recognizes_guest_prefix() {
        assert_eq!(profile_id_from_label("guest-xyz"), Some("guest".to_string()));
    }

    #[test]
    fn profile_id_from_label_returns_none_for_picker() {
        assert_eq!(profile_id_from_label("picker"), None);
    }
}
```

- [ ] **Step 2: Register commands in `lib.rs`**

Add to `invoke_handler`:

```rust
windows::open_picker_window,
windows::open_guest_window,
windows::current_profile_id,
```

- [ ] **Step 3: Run tests + build**

```bash
cd apps/desktop/src-tauri && cargo test windows && cargo build
```

Expected: 3 tests pass, build clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/windows.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(windows): picker + guest window commands; current_profile_id helper"
```

---

## Phase 4 — tabs.rs becomes profile-aware

### Task 13: tabs.rs uses calling window + per-profile data_directory

**Files:**
- Modify: `apps/desktop/src-tauri/src/tabs.rs`

- [ ] **Step 1: Add a helper to resolve the calling window's profile dir**

In `tabs.rs`, add after the existing `fn tab_label`:

```rust
use crate::profiles;
use crate::windows;

fn data_dir_for_window(app: &AppHandle, window_label: &str) -> Option<std::path::PathBuf> {
    let profile_id = windows::profile_id_from_label(window_label)?;
    if profile_id == "guest" {
        return Some(std::env::temp_dir().join(format!("baobab-guest-{window_label}")));
    }
    let root = app.path().app_data_dir().ok()?;
    let file = profiles::load(&root).ok()?;
    let profile = file.profiles.iter().find(|p| p.id == profile_id)?;
    Some(profiles::resolve_user_data_dir(&root, profile))
}
```

- [ ] **Step 2: Make `create_tab` take a window label and use the per-profile dir**

Change `create_tab` signature and body:

```rust
#[tauri::command]
pub async fn create_tab(
    app: AppHandle,
    window_label: String,
    id: String,
    url: String,
    incognito: Option<bool>,
) -> Result<TabInfo, String> {
    let host = app
        .get_window(&window_label)
        .ok_or_else(|| format!("window {window_label} not found"))?;
    let size = host.inner_size().map_err(|e| e.to_string())?;
    let scale = host.scale_factor().map_err(|e| e.to_string())?;
    let logical_w = size.width as f64 / scale;
    let logical_h = size.height as f64 / scale;

    let label = tab_label(&id);
    let webview_url = WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?);

    let mut builder = tauri::webview::WebviewBuilder::new(&label, webview_url);

    if incognito.unwrap_or(false) {
        let dir = std::env::temp_dir().join(format!("baobab-incognito-{}", id));
        builder = builder.data_directory(dir);
    } else if let Some(dir) = data_dir_for_window(&app, &window_label) {
        builder = builder.data_directory(dir);
    }

    let builder = downloads::attach(builder, app.clone());
    let builder = builder.on_document_title_changed(|webview, title| {
        let label = webview.label().to_string();
        if !title.is_empty() { cache_title(&label, &title); }
        let url = webview.url().map(|u| u.to_string()).unwrap_or_default();
        emit_tab_loaded(&webview, &label, url, if title.is_empty() { None } else { Some(title) });
    });
    let builder = builder.on_page_load(|webview, payload| {
        use tauri::webview::PageLoadEvent;
        if payload.event() != PageLoadEvent::Finished { return; }
        let label = webview.label().to_string();
        let url = payload.url().to_string();
        let title = lookup_title(&label);
        emit_tab_loaded(&webview, &label, url, title);
    });

    host.add_child(
        builder,
        LogicalPosition::new(0.0, CHROME_HEIGHT),
        LogicalSize::new(logical_w, (logical_h - CHROME_HEIGHT - STATUS_HEIGHT).max(0.0)),
    )
    .map_err(|e| e.to_string())?;

    if let Some(wv) = app.get_webview(&label) {
        let _ = wv.hide();
    }

    Ok(TabInfo { id, url })
}
```

- [ ] **Step 3: Replace remaining `app.get_window("main")` calls**

In `show_tab`, `hide_all_tabs`, and `list_tabs`, replace the hard-coded `"main"` with a `window_label: String` parameter. Each function gains `window_label` as its first param after `app`. Their bodies become:

```rust
let host = app
    .get_window(&window_label)
    .ok_or_else(|| format!("window {window_label} not found"))?;
```

- [ ] **Step 4: Run build**

```bash
cd apps/desktop/src-tauri && cargo build
```

Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/tabs.rs
git commit -m "feat(tabs): per-profile data_directory; window resolved from caller label"
```

---

## Phase 5 — Migration + cold-start

### Task 14: Migration from pre-profile state

**Files:**
- Create: `apps/desktop/src-tauri/src/migration.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/src-tauri/src/migration.rs`:

```rust
use std::path::Path;

use crate::profiles::{self, FruitColor, Profile};

const MIGRATION_MARKER: &str = "migration.v1.completed";

/// One-shot migration from the pre-profile (single-account) state.
///
/// Pre-profile state means: `profiles.json` is missing AND we have any
/// of the old top-level keys (auth tokens, tabs.json, etc.) in the legacy
/// `tauri-plugin-store` file. We can't read that file from Rust easily, so
/// the migration here only creates a "default" profile when no profiles
/// exist yet. The frontend is responsible for moving its existing
/// persistence keys into the newly-created profile's namespace.
///
/// Returns the created profile (if migration ran) or None.
pub fn maybe_migrate(app_data_root: &Path) -> Result<Option<Profile>, String> {
    let marker = app_data_root.join("baobab").join(MIGRATION_MARKER);
    if marker.exists() {
        return Ok(None);
    }
    let file = profiles::load(app_data_root)?;
    if !file.profiles.is_empty() {
        // Someone else (or a previous run) already created profiles.
        std::fs::create_dir_all(marker.parent().unwrap()).ok();
        std::fs::write(&marker, b"v1").ok();
        return Ok(None);
    }
    let profile = profiles::create_profile(app_data_root, "My Baobab".to_string(), Some(FruitColor::Shea))?;
    std::fs::write(&marker, b"v1").map_err(|e| e.to_string())?;
    Ok(Some(profile))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn migration_creates_default_profile_on_fresh_install() {
        let dir = tempdir().unwrap();
        let p = maybe_migrate(dir.path()).unwrap().expect("expected a profile");
        assert_eq!(p.name, "My Baobab");
        assert_eq!(p.fruit_color, FruitColor::Shea);
    }

    #[test]
    fn migration_is_idempotent() {
        let dir = tempdir().unwrap();
        let first = maybe_migrate(dir.path()).unwrap();
        assert!(first.is_some());
        let second = maybe_migrate(dir.path()).unwrap();
        assert!(second.is_none());
        // Still exactly one profile.
        assert_eq!(profiles::load(dir.path()).unwrap().profiles.len(), 1);
    }

    #[test]
    fn migration_skipped_when_profiles_already_exist() {
        let dir = tempdir().unwrap();
        profiles::create_profile(dir.path(), "Existing".to_string(), None).unwrap();
        let result = maybe_migrate(dir.path()).unwrap();
        assert!(result.is_none());
        assert_eq!(profiles::load(dir.path()).unwrap().profiles.len(), 1);
    }
}
```

In `lib.rs`, add `mod migration;` after `mod profiles;`.

- [ ] **Step 2: Run tests**

```bash
cd apps/desktop/src-tauri && cargo test migration
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/migration.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(migration): one-shot default-profile creation on first launch"
```

---

### Task 15: Cold-start orchestration in `lib.rs#run`

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Wire startup logic into `tauri::Builder::setup`**

Replace the existing `.setup(|app| { ... })` block with:

```rust
.setup(|app| {
    use tauri::Manager;
    let handle = app.handle().clone();
    let root = handle.path().app_data_dir().map_err(|e| e.to_string())?;

    // Run one-shot migration (creates "My Baobab" on fresh install).
    let _ = migration::maybe_migrate(&root);

    let file = profiles::load(&root).map_err(|e| e.to_string())?;
    let count = file.profiles.len();
    let show_picker = match count {
        0 => false,  // migration should have created one; if not, we fall through to picker
        1 => file.picker_prefs.show_on_startup,
        _ => true,
    };

    if show_picker {
        tauri::async_runtime::block_on(windows::open_picker_window(handle.clone()))
            .map_err(|e| e.to_string())?;
    } else if let Some(p) = file.profiles.first() {
        tauri::async_runtime::block_on(windows::open_profile_window(handle.clone(), p.id.clone()))
            .map_err(|e| e.to_string())?;
    } else {
        // No profiles and migration didn't create one — show picker so user can create one.
        tauri::async_runtime::block_on(windows::open_picker_window(handle.clone()))
            .map_err(|e| e.to_string())?;
    }

    #[cfg(debug_assertions)]
    {
        for (_label, win) in handle.webview_windows() {
            win.open_devtools();
        }
    }
    Ok(())
})
```

- [ ] **Step 2: Run cargo build**

```bash
cd apps/desktop/src-tauri && cargo build
```

Expected: builds. (Picker UI doesn't exist yet — opening it will load a missing `picker.html` until Task 16 lands. That's fine; we wire it next.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(boot): cold-start picks picker vs profile window from registry"
```

---

## Phase 6 — Vite multi-entry

### Task 16: Picker HTML entry + Vite multi-page config

**Files:**
- Create: `apps/desktop/picker.html`
- Create: `apps/desktop/src/picker.tsx`
- Create: `apps/desktop/src/picker/PickerApp.tsx` (stub)
- Modify: `apps/desktop/vite.config.ts`

- [ ] **Step 1: Create `picker.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Baobab — Profiles</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/picker.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/picker.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PickerApp } from './picker/PickerApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <PickerApp />
  </StrictMode>,
)
```

- [ ] **Step 3: Create stub `src/picker/PickerApp.tsx`**

```tsx
export function PickerApp() {
  return <div style={{ padding: 24, color: '#3c1810' }}>Picker stub</div>
}
```

- [ ] **Step 4: Update `vite.config.ts` for multi-page build**

Replace the file with:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        picker: path.resolve(__dirname, 'picker.html'),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
```

- [ ] **Step 5: Verify build works**

```bash
cd apps/desktop && npm run build
```

Expected: `dist/index.html` and `dist/picker.html` both produced.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/picker.html apps/desktop/src/picker.tsx apps/desktop/src/picker/PickerApp.tsx apps/desktop/vite.config.ts
git commit -m "feat(picker): vite multi-page entry + PickerApp stub"
```

---

## Phase 7 — Frontend profile API + context

### Task 17: `profile.api.ts` typed wrappers

**Files:**
- Create: `apps/desktop/src/profiles/profile.api.ts`
- Create: `apps/desktop/src/profiles/fruitColors.ts`
- Create: `apps/desktop/tests/profiles.api.test.ts`

- [ ] **Step 1: Create fruit colour palette**

`apps/desktop/src/profiles/fruitColors.ts`:

```ts
export type FruitColor =
  | 'mango' | 'baobab' | 'shea' | 'indigo'
  | 'hibiscus' | 'palm' | 'kola' | 'baobwhite'

export const FRUIT_HEX: Record<FruitColor, { from: string; to: string }> = {
  mango:    { from: '#ff8a5b', to: '#c44a1f' },
  baobab:   { from: '#ffd86f', to: '#c4881f' },
  shea:     { from: '#b8d96f', to: '#5a8a1f' },
  indigo:   { from: '#6fb2d9', to: '#1f5a8a' },
  hibiscus: { from: '#d96fb8', to: '#8a1f5a' },
  palm:     { from: '#afd9b8', to: '#4a8a5a' },
  kola:     { from: '#ffaf6f', to: '#c4661f' },
  baobwhite:{ from: '#e8ddc4', to: '#a8987a' },
}

export const FRUIT_COLOR_ORDER: FruitColor[] = [
  'mango', 'baobab', 'shea', 'indigo', 'hibiscus', 'palm', 'kola', 'baobwhite',
]
```

- [ ] **Step 2: Write failing test**

`apps/desktop/tests/profiles.api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { profileApi } from '~/profiles/profile.api'

beforeEach(() => { invokeMock.mockReset() })

describe('profileApi', () => {
  it('listProfiles calls cmd_list_profiles', async () => {
    invokeMock.mockResolvedValue([])
    await profileApi.list()
    expect(invokeMock).toHaveBeenCalledWith('cmd_list_profiles')
  })

  it('create sends name + color', async () => {
    invokeMock.mockResolvedValue({
      id: '1', name: 'A', fruitColor: 'mango', avatarLetter: 'A',
      createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
    })
    await profileApi.create('A', 'mango')
    expect(invokeMock).toHaveBeenCalledWith('cmd_create_profile', { name: 'A', fruitColor: 'mango' })
  })

  it('rename sends id + name', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.rename('id-1', 'New')
    expect(invokeMock).toHaveBeenCalledWith('cmd_rename_profile', { id: 'id-1', name: 'New' })
  })

  it('delete sends id', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.delete('id-1')
    expect(invokeMock).toHaveBeenCalledWith('cmd_delete_profile', { id: 'id-1' })
  })

  it('setShowOnStartup sends bool', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.setShowOnStartup(true)
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
  })

  it('openProfileWindow sends profileId', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openProfileWindow('id-1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1' })
  })

  it('openGuestWindow takes no args', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openGuestWindow()
    expect(invokeMock).toHaveBeenCalledWith('open_guest_window')
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/profiles.api.test.ts`
Expected: FAIL — `profile.api` not yet created.

- [ ] **Step 3: Implement `profile.api.ts`**

`apps/desktop/src/profiles/profile.api.ts`:

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
}

export interface PickerPrefs {
  showOnStartup: boolean
  lastUsedProfileId: string | null
}

export const profileApi = {
  list: () => invoke<Profile[]>('cmd_list_profiles'),
  pickerPrefs: () => invoke<PickerPrefs>('cmd_get_picker_prefs'),
  create: (name: string, fruitColor?: FruitColor) =>
    invoke<Profile>('cmd_create_profile', { name, fruitColor: fruitColor ?? null }),
  rename: (id: string, name: string) => invoke<void>('cmd_rename_profile', { id, name }),
  updateColor: (id: string, color: FruitColor) =>
    invoke<void>('cmd_update_profile_color', { id, color }),
  delete: (id: string) => invoke<void>('cmd_delete_profile', { id }),
  setShowOnStartup: (value: boolean) => invoke<void>('cmd_set_show_on_startup', { value }),
  recordUsed: (id: string) => invoke<void>('cmd_record_profile_used', { id }),
  openProfileWindow: (profileId: string) => invoke<void>('open_profile_window', { profileId }),
  openPickerWindow: () => invoke<void>('open_picker_window'),
  openGuestWindow: () => invoke<void>('open_guest_window'),
  currentProfileId: () => invoke<string | null>('current_profile_id'),
}
```

Adjust the test to omit `null` fruitColor when not provided. Update the `create` test in the test file to send `fruitColor: 'mango'` (already correct above); ensure the `list` test asserts no second arg. If the `invoke` call signature when passing `null` differs from what the test expects, normalise — the test uses `'mango'` so the `null` path isn't exercised by it. Leave the optional-arg behaviour as in the impl.

- [ ] **Step 4: Run tests — should pass**

```bash
cd apps/desktop && npx vitest run tests/profiles.api.test.ts
```

Expected: 7 tests pass. If `create` fails because `fruitColor: null` shows up unexpectedly, change the impl to `fruitColor` (without default) and pass through; rerun.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/profiles/profile.api.ts apps/desktop/src/profiles/fruitColors.ts apps/desktop/tests/profiles.api.test.ts
git commit -m "feat(profiles): typed Tauri command wrappers + fruit color palette"
```

---

### Task 18: ProfileContext + useProfile

**Files:**
- Create: `apps/desktop/src/profiles/ProfileContext.tsx`
- Create: `apps/desktop/src/profiles/useProfile.ts`
- Create: `apps/desktop/tests/profile.context.test.tsx`

- [ ] **Step 1: Write failing test**

`apps/desktop/tests/profile.context.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { ProfileProvider, useProfile } from '~/profiles/ProfileContext'

function Probe() {
  const p = useProfile()
  return <div data-testid="probe">{p ? `${p.id}|${p.name}` : 'no-profile'}</div>
}

beforeEach(() => { invokeMock.mockReset() })

describe('ProfileProvider', () => {
  it('renders the profile resolved from current_profile_id', async () => {
    const sample = {
      id: 'abc', name: 'Akua', fruitColor: 'mango', avatarLetter: 'A',
      createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'userdata',
    }
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'current_profile_id') return Promise.resolve('abc')
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample])
      return Promise.resolve()
    })

    render(<ProfileProvider><Probe /></ProfileProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('abc|Akua'))
  })

  it('falls back to guest sentinel when window is guest', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'current_profile_id') return Promise.resolve('guest')
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      return Promise.resolve()
    })

    render(<ProfileProvider><Probe /></ProfileProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('guest|Guest'))
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/profile.context.test.tsx`
Expected: FAIL — module not yet created.

- [ ] **Step 2: Implement context**

`apps/desktop/src/profiles/ProfileContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { profileApi, type Profile } from './profile.api'

const ProfileContext = createContext<Profile | null>(null)

export const GUEST_PROFILE: Profile = {
  id: 'guest',
  name: 'Guest',
  fruitColor: 'baobwhite',
  avatarLetter: 'G',
  createdAt: '',
  lastUsedAt: '',
  cloudLink: null,
  userDataDirName: '',
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = await profileApi.currentProfileId().catch(() => null)
      if (cancelled || !id) return
      if (id === 'guest') {
        setProfile(GUEST_PROFILE)
        return
      }
      const list = await profileApi.list().catch(() => [])
      if (cancelled) return
      const match = list.find((p) => p.id === id) ?? null
      setProfile(match)
    })()
    return () => { cancelled = true }
  }, [])

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile(): Profile | null {
  return useContext(ProfileContext)
}
```

`apps/desktop/src/profiles/useProfile.ts`:

```ts
export { useProfile } from './ProfileContext'
```

- [ ] **Step 3: Run tests**

```bash
cd apps/desktop && npx vitest run tests/profile.context.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/profiles/ProfileContext.tsx apps/desktop/src/profiles/useProfile.ts apps/desktop/tests/profile.context.test.tsx
git commit -m "feat(profiles): ProfileProvider resolves current window's profile"
```

---

## Phase 8 — Persistence becomes profile-aware

### Task 19: Profile-namespaced persistence

**Files:**
- Modify: `apps/desktop/src/state/persistence.ts`
- Create: `apps/desktop/tests/persistence.profile.test.ts`

- [ ] **Step 1: Write failing test**

`apps/desktop/tests/persistence.profile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, unknown>()
const storeApi = {
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); return undefined }),
  delete: vi.fn(async (k: string) => { store.delete(k); return undefined }),
  save: vi.fn(async () => undefined),
}
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => storeApi),
}))

import { persistence, profileScoped, GLOBAL_KEYS } from '~/state/persistence'

beforeEach(() => { store.clear(); vi.clearAllMocks() })

describe('profileScoped persistence', () => {
  it('writes to a namespaced key', async () => {
    const ns = profileScoped('abc')
    await ns.set('auth.accessToken', 'tok')
    expect(storeApi.set).toHaveBeenCalledWith('profile.abc.auth.accessToken', 'tok')
  })

  it('reads from the namespaced key', async () => {
    store.set('profile.abc.auth.accessToken', 'tok')
    const ns = profileScoped('abc')
    expect(await ns.get('auth.accessToken')).toBe('tok')
  })

  it('delete removes the namespaced key', async () => {
    store.set('profile.abc.auth.accessToken', 'tok')
    await profileScoped('abc').delete('auth.accessToken')
    expect(storeApi.delete).toHaveBeenCalledWith('profile.abc.auth.accessToken')
  })

  it('GLOBAL_KEYS bypasses the namespace', async () => {
    expect(GLOBAL_KEYS).toContain('picker.showOnStartup')
    await persistence.set('picker.showOnStartup', true)
    expect(storeApi.set).toHaveBeenCalledWith('picker.showOnStartup', true)
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/persistence.profile.test.ts`
Expected: FAIL — `profileScoped` doesn't exist yet.

- [ ] **Step 2: Update `persistence.ts`**

Replace `apps/desktop/src/state/persistence.ts`:

```ts
import { load, type Store } from '@tauri-apps/plugin-store'

const STORE_FILE = 'baobab.store.json'

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) storePromise = load(STORE_FILE, { defaults: {}, autoSave: false })
  return storePromise
}

// Keys NOT scoped to a profile — picker preferences, updater state, etc.
export const GLOBAL_KEYS: readonly string[] = [
  'picker.showOnStartup',
  'picker.lastUsedProfileId',
  'updater.lastCheckAt',
  'updater.dismissedVersion',
]

export const persistence = {
  async get<T>(key: string): Promise<T | undefined> {
    const s = await getStore()
    const v = await s.get<T>(key)
    return v ?? undefined
  },
  async set<T>(key: string, value: T): Promise<void> {
    const s = await getStore()
    await s.set(key, value)
    await s.save()
  },
  async delete(key: string): Promise<void> {
    const s = await getStore()
    await s.delete(key)
    await s.save()
  },
}

export function profileScoped(profileId: string) {
  const prefix = `profile.${profileId}.`
  return {
    get<T>(key: string): Promise<T | undefined> {
      return persistence.get<T>(prefix + key)
    },
    set<T>(key: string, value: T): Promise<void> {
      return persistence.set<T>(prefix + key, value)
    },
    delete(key: string): Promise<void> {
      return persistence.delete(prefix + key)
    },
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/desktop && npx vitest run tests/persistence.profile.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/state/persistence.ts apps/desktop/tests/persistence.profile.test.ts
git commit -m "feat(persistence): profileScoped wrapper + GLOBAL_KEYS"
```

---

### Task 20: auth.store uses profile-scoped persistence

**Files:**
- Modify: `apps/desktop/src/auth/auth.store.ts`
- Modify: `apps/desktop/tests/auth.store.test.ts`

- [ ] **Step 1: Update the auth store**

Replace the `persistTokens` / `clearTokens` helpers and the `persistence.get<string>('auth.accessToken')` call in `hydrate` to use a profile-scoped persistence. Add a `setProfileId` action to the store and read tokens from that scope. Modify the top of `auth.store.ts`:

```ts
import { create } from 'zustand'
import type { MeResponse } from '@baobab/cloud-client'
import { client, authClient } from './api'
import { persistence, profileScoped } from '~/state/persistence'

type Scoped = ReturnType<typeof profileScoped>

let currentScope: Scoped | null = null
function scope(): Scoped {
  if (!currentScope) {
    throw new Error('auth store used before setProfileId — wrap App in <ProfileProvider>')
  }
  return currentScope
}

async function persistTokens(access: string, refresh: string): Promise<void> {
  await scope().set('auth.accessToken', access)
  await scope().set('auth.refreshToken', refresh)
}
async function clearTokens(): Promise<void> {
  await scope().delete('auth.accessToken')
  await scope().delete('auth.refreshToken')
}
```

In the `AuthState` interface and store creator, add:

```ts
interface AuthState {
  // ...existing fields...
  setProfileId: (profileId: string) => void
}

setProfileId: (profileId) => {
  currentScope = profileScoped(profileId)
},
```

Replace every `persistence.set('auth.accessToken', ...)` etc. inside the action implementations with the local `persistTokens`/`clearTokens` helpers — they already abstract the scope.

In the `hydrate` action:

```ts
hydrate: async () => {
  const a = await scope().get<string>('auth.accessToken')
  const r = await scope().get<string>('auth.refreshToken')
  // ...rest unchanged...
}
```

- [ ] **Step 2: Update the existing auth test**

In `apps/desktop/tests/auth.store.test.ts`, replace the assertions on `persistence.set` calls and add a `setProfileId` call before each test that hits the store. Update test header:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, status: 'idle', error: null })
  useAuthStore.getState().setProfileId('test-profile')
})
```

And update the persistence assertions:

```ts
expect(persistence.set).toHaveBeenCalledWith('profile.test-profile.auth.accessToken', 'a')
expect(persistence.set).toHaveBeenCalledWith('profile.test-profile.auth.refreshToken', 'r')
```

(and similarly for `delete`).

- [ ] **Step 3: Wire `setProfileId` from `ProfileProvider`**

Modify `apps/desktop/src/profiles/ProfileContext.tsx` to also call `useAuthStore.getState().setProfileId(profile.id)` after resolving the profile. Add at the top:

```tsx
import { useAuthStore } from '~/auth/auth.store'
```

And after `setProfile(match)`:

```tsx
if (match) useAuthStore.getState().setProfileId(match.id)
```

(Do the same in the guest branch with `'guest'`.)

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run tests/auth.store.test.ts tests/profile.context.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/auth/auth.store.ts apps/desktop/tests/auth.store.test.ts apps/desktop/src/profiles/ProfileContext.tsx
git commit -m "feat(auth): tokens stored under profile namespace"
```

---

### Task 21: tabs.store uses profile-scoped persistence + passes window_label to IPC

**Files:**
- Modify: `apps/desktop/src/state/tabs.store.ts`
- Modify: `apps/desktop/src/ipc/tabs.ts`

- [ ] **Step 1: Update IPC wrappers**

Read existing `apps/desktop/src/ipc/tabs.ts` first (it wraps the Tauri commands). Modify every wrapper to accept and forward `windowLabel`:

```ts
import { invoke } from '@tauri-apps/api/core'
import { getCurrent } from '@tauri-apps/api/window'

function thisWindow(): string {
  return getCurrent().label
}

export const ipcCreateTab = (id: string, url: string, incognito = false) =>
  invoke<{ id: string; url: string }>('create_tab', { windowLabel: thisWindow(), id, url, incognito })

export const ipcShowTab = (id: string) =>
  invoke<void>('show_tab', { windowLabel: thisWindow(), id })

export const ipcHideTab = (id: string) =>
  invoke<void>('hide_tab', { windowLabel: thisWindow(), id })

export const ipcHideAllTabs = () =>
  invoke<void>('hide_all_tabs', { windowLabel: thisWindow() })

export const ipcCloseTab = (id: string) => invoke<void>('close_tab', { id })
export const ipcNavigateTab = (id: string, url: string) => invoke<void>('navigate_tab', { id, url })
export const ipcListTabs = () => invoke<Array<{ id: string; url: string }>>('list_tabs', { windowLabel: thisWindow() })
export const ipcTabGoBack = (tabId: string) => invoke<void>('tab_go_back', { tabId })
export const ipcTabGoForward = (tabId: string) => invoke<void>('tab_go_forward', { tabId })
```

(Drop any wrappers that don't need a window label — `close_tab`, `navigate_tab`, `tab_go_back`, `tab_go_forward` are tab-scoped, not window-scoped.)

- [ ] **Step 2: Update tabs.store to scope persistence per-profile**

In `apps/desktop/src/state/tabs.store.ts`, replace its persistence calls (`persistence.get`/`set`/`delete` with keys like `'tabs.list'`) with a profile-scoped wrapper acquired the same way as the auth store. Add a `setProfileId` action that swaps the internal scope and replays hydration.

```ts
import { profileScoped } from './persistence'
let tabsScope: ReturnType<typeof profileScoped> | null = null
function scope() {
  if (!tabsScope) throw new Error('tabs store used before setProfileId')
  return tabsScope
}
// add to store actions:
setProfileId: (id: string) => { tabsScope = profileScoped(id) },
```

Replace existing `persistence.set('tabs.list', ...)` with `scope().set('tabs.list', ...)` etc.

- [ ] **Step 3: Wire `setProfileId` from ProfileProvider**

In `ProfileContext.tsx`, after `useAuthStore.getState().setProfileId(...)`, also call:

```tsx
import { useTabsStore } from '~/state/tabs.store'
// ...
useTabsStore.getState().setProfileId(match.id)
```

(And the guest branch.)

- [ ] **Step 4: Run typecheck + existing tests**

```bash
cd apps/desktop && npm run typecheck && npm test
```

Expected: typecheck passes; all existing tests pass. If any test fails because `setProfileId` wasn't called in setup, fix that test's `beforeEach`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/state/tabs.store.ts apps/desktop/src/ipc/tabs.ts apps/desktop/src/profiles/ProfileContext.tsx
git commit -m "feat(tabs): profile-scoped persistence; window label forwarded to IPC"
```

---

## Phase 9 — Picker UI

### Task 22: usePickerData store

**Files:**
- Create: `apps/desktop/src/picker/usePickerData.ts`
- Create: `apps/desktop/tests/picker.data.test.ts`

- [ ] **Step 1: Write failing test**

`apps/desktop/tests/picker.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { usePickerData } from '~/picker/usePickerData'

beforeEach(() => {
  invokeMock.mockReset()
  usePickerData.setState({ profiles: [], showOnStartup: false, loading: false, error: null })
})

const sampleProfile = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: overrides.id ?? 'p1',
  name: overrides.name ?? 'Akua',
  fruitColor: 'mango' as const,
  avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
})

describe('usePickerData', () => {
  it('hydrate loads profiles + prefs', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sampleProfile()])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: 'p1' })
      return Promise.resolve()
    })
    await usePickerData.getState().hydrate()
    const s = usePickerData.getState()
    expect(s.profiles).toHaveLength(1)
    expect(s.showOnStartup).toBe(true)
  })

  it('create adds a profile and hydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_create_profile') return Promise.resolve(sampleProfile({ id: 'p2', name: 'Kofi' }))
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sampleProfile(), sampleProfile({ id: 'p2', name: 'Kofi' })])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().create('Kofi')
    expect(usePickerData.getState().profiles).toHaveLength(2)
  })

  it('toggleShowOnStartup persists and updates store', async () => {
    invokeMock.mockResolvedValue(undefined)
    await usePickerData.getState().toggleShowOnStartup(true)
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
    expect(usePickerData.getState().showOnStartup).toBe(true)
  })

  it('select calls open_profile_window', async () => {
    invokeMock.mockResolvedValue(undefined)
    await usePickerData.getState().select('p1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1' })
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/picker.data.test.ts`
Expected: FAIL — module not yet created.

- [ ] **Step 2: Implement `usePickerData.ts`**

`apps/desktop/src/picker/usePickerData.ts`:

```ts
import { create } from 'zustand'
import { profileApi, type Profile } from '~/profiles/profile.api'
import type { FruitColor } from '~/profiles/fruitColors'

interface PickerState {
  profiles: Profile[]
  showOnStartup: boolean
  loading: boolean
  error: string | null
  hydrate: () => Promise<void>
  create: (name: string, color?: FruitColor) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  delete: (id: string) => Promise<void>
  toggleShowOnStartup: (value: boolean) => Promise<void>
  select: (id: string) => Promise<void>
  openGuest: () => Promise<void>
}

export const usePickerData = create<PickerState>((set, get) => ({
  profiles: [],
  showOnStartup: false,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const [profiles, prefs] = await Promise.all([profileApi.list(), profileApi.pickerPrefs()])
      set({ profiles, showOnStartup: prefs.showOnStartup, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'failed to load profiles' })
    }
  },

  create: async (name, color) => {
    await profileApi.create(name, color)
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
    await profileApi.openProfileWindow(id)
  },

  openGuest: async () => {
    await profileApi.openGuestWindow()
  },
}))
```

- [ ] **Step 3: Run tests**

```bash
cd apps/desktop && npx vitest run tests/picker.data.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/picker/usePickerData.ts apps/desktop/tests/picker.data.test.ts
git commit -m "feat(picker): usePickerData store with hydrate/create/select"
```

---

### Task 23: GroveTree decorative component

**Files:**
- Create: `apps/desktop/src/picker/GroveTree.tsx`

- [ ] **Step 1: Implement (purely presentational, no test)**

`apps/desktop/src/picker/GroveTree.tsx`:

```tsx
export function GroveTree({ size = 96 }: { size?: number }) {
  // Stylised baobab: trunk + ellipse canopy + three highlight fruits.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Baobab tree"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="canopy" cx="40%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#2a5240" />
          <stop offset="70%" stopColor="#0d2418" />
          <stop offset="100%" stopColor="#0d2418" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a2814" />
          <stop offset="100%" stopColor="#2d130a" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="42" rx="40" ry="30" fill="url(#canopy)" />
      <path d="M 38 50 Q 36 70 32 90 L 64 90 Q 60 70 58 50 Z" fill="url(#trunk)" />
      <circle cx="32" cy="36" r="3.5" fill="#c44a1f" />
      <circle cx="52" cy="30" r="3.5" fill="#c4881f" />
      <circle cx="64" cy="44" r="3.5" fill="#5a8a1f" />
    </svg>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/picker/GroveTree.tsx
git commit -m "feat(picker): GroveTree decorative SVG emblem"
```

---

### Task 24: ProfileTile component

**Files:**
- Create: `apps/desktop/src/picker/ProfileTile.tsx`
- Create: `apps/desktop/tests/picker.tile.test.tsx`

- [ ] **Step 1: Write failing test**

`apps/desktop/tests/picker.tile.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileTile } from '~/picker/ProfileTile'

const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
}

describe('ProfileTile', () => {
  it('renders name + avatar letter', () => {
    render(<ProfileTile profile={profile} onSelect={() => undefined} />)
    expect(screen.getByText('Akua')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<ProfileTile profile={profile} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /open akua/i }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('exposes a per-tile menu with Rename + Delete', () => {
    const onRename = vi.fn(); const onDelete = vi.fn()
    render(<ProfileTile profile={profile} onSelect={() => undefined} onRename={onRename} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
    expect(onRename).toHaveBeenCalledWith('p1')
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/picker.tile.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement `ProfileTile.tsx`**

```tsx
import { useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  profile: Profile
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ProfileTile({ profile, onSelect, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { from, to } = FRUIT_HEX[profile.fruitColor]

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
            width: 44, height: 44, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
            border: '2px solid rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, marginBottom: 8,
            boxShadow: '0 3px 8px rgba(60,20,10,0.35), inset 0 -3px 6px rgba(0,0,0,0.2)',
          }}
        >
          {profile.avatarLetter}
        </span>
        <span style={{ fontSize: 13 }}>{profile.name}</span>
      </button>
      {(onRename || onDelete) && (
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
                padding: 4, minWidth: 120, zIndex: 10,
              }}
            >
              {onRename && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  Rename
                </button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#a23a1f' }}>
                  Delete
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/desktop && npx vitest run tests/picker.tile.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/picker/ProfileTile.tsx apps/desktop/tests/picker.tile.test.tsx
git commit -m "feat(picker): ProfileTile with hover menu (rename/delete)"
```

---

### Task 25: NewProfileSheet

**Files:**
- Create: `apps/desktop/src/picker/NewProfileSheet.tsx`

- [ ] **Step 1: Implement (test in Task 26)**

```tsx
import { useState } from 'react'
import { FRUIT_COLOR_ORDER, FRUIT_HEX, type FruitColor } from '~/profiles/fruitColors'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, color: FruitColor) => Promise<void>
}

export function NewProfileSheet({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<FruitColor>('mango')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setErr(null)
    try {
      await onCreate(name.trim(), color)
      setName(''); setColor('mango'); onClose()
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
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: 'pointer' }}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/picker/NewProfileSheet.tsx
git commit -m "feat(picker): NewProfileSheet with name + fruit colour picker"
```

---

### Task 26: ProfileGrid + PickerApp end-to-end

**Files:**
- Create: `apps/desktop/src/picker/ProfileGrid.tsx`
- Modify: `apps/desktop/src/picker/PickerApp.tsx`
- Create: `apps/desktop/tests/picker.app.test.tsx`

- [ ] **Step 1: Implement `ProfileGrid.tsx`**

```tsx
import type { Profile } from '~/profiles/profile.api'
import { ProfileTile } from './ProfileTile'

interface Props {
  profiles: Profile[]
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onGuest: () => void
}

export function ProfileGrid({ profiles, onSelect, onRename, onDelete, onAdd, onGuest }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 120px)', gap: 16, justifyContent: 'center' }}>
      {profiles.map((p) => (
        <ProfileTile key={p.id} profile={p} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />
      ))}
      <button
        type="button" aria-label="Create new profile" onClick={onAdd}
        style={{
          width: 120, height: 120, borderRadius: 16,
          background: 'rgba(255,250,240,0.15)', border: '2px dashed rgba(255,250,240,0.6)',
          color: 'rgba(255,250,240,0.9)', fontSize: 32, fontWeight: 300, cursor: 'pointer',
        }}
      >+</button>
      <button
        type="button" aria-label="Open guest window" onClick={onGuest}
        style={{
          width: 120, height: 120, borderRadius: 16, background: 'rgba(255,250,240,0.7)',
          border: 'none', color: '#3c1810', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span aria-hidden style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #c0b5a0, #6a5a48)',
          border: '2px solid rgba(255,255,255,0.85)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, marginBottom: 8,
        }}>G</span>
        <span style={{ fontStyle: 'italic', fontSize: 13 }}>Guest</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write failing test for PickerApp**

`apps/desktop/tests/picker.app.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { PickerApp } from '~/picker/PickerApp'
import { usePickerData } from '~/picker/usePickerData'

const sample = (id: string, name: string) => ({
  id, name, fruitColor: 'mango' as const, avatarLetter: name[0],
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
})

beforeEach(() => {
  invokeMock.mockReset()
  usePickerData.setState({ profiles: [], showOnStartup: false, loading: false, error: null })
})

describe('PickerApp', () => {
  it('shows tiles for each profile on mount', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua'), sample('p2', 'Kofi')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => {
      expect(screen.getByText('Akua')).toBeInTheDocument()
      expect(screen.getByText('Kofi')).toBeInTheDocument()
    })
  })

  it('clicking a tile invokes open_profile_window', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => screen.getByText('Akua'))
    fireEvent.click(screen.getByRole('button', { name: /open akua/i }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1' })
    })
  })

  it('toggling Show on startup persists to Rust', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => screen.getByText('Akua'))
    fireEvent.click(screen.getByRole('checkbox', { name: /show on startup/i }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
    })
  })
})
```

Run: `cd apps/desktop && npx vitest run tests/picker.app.test.tsx`
Expected: FAIL — `PickerApp` is still the stub.

- [ ] **Step 3: Replace `PickerApp.tsx` with the real implementation**

```tsx
import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
import { usePickerData } from './usePickerData'

export function PickerApp() {
  const profiles = usePickerData((s) => s.profiles)
  const showOnStartup = usePickerData((s) => s.showOnStartup)
  const error = usePickerData((s) => s.error)
  const hydrate = usePickerData((s) => s.hydrate)
  const create = usePickerData((s) => s.create)
  const renameAction = usePickerData((s) => s.rename)
  const deleteAction = usePickerData((s) => s.delete)
  const toggleShow = usePickerData((s) => s.toggleShowOnStartup)
  const select = usePickerData((s) => s.select)
  const openGuest = usePickerData((s) => s.openGuest)

  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => { void hydrate() }, [hydrate])

  async function handleRename(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    const next = window.prompt('Rename profile', p.name)
    if (next && next.trim()) await renameAction(id, next.trim())
  }
  async function handleDelete(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    if (window.confirm(`Delete profile "${p.name}"? This wipes its data.`)) await deleteAction(id)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fde7c4 0%, #f4b878 30%, #d97a3a 65%, #6b2814 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 24px',
    }}>
      <GroveTree size={96} />
      <h1 style={{ color: '#3c1810', fontSize: 24, margin: '16px 0 4px' }}>Who's using Baobab?</h1>
      <p style={{ color: 'rgba(60,24,16,0.7)', fontSize: 13, margin: 0 }}>
        {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
      </p>
      <div style={{ marginTop: 32 }}>
        <ProfileGrid
          profiles={profiles}
          onSelect={(id) => void select(id)}
          onRename={handleRename}
          onDelete={handleDelete}
          onAdd={() => setSheetOpen(true)}
          onGuest={() => void openGuest()}
        />
      </div>
      <label style={{
        position: 'absolute', bottom: 16, left: 16,
        color: 'rgba(255,250,240,0.95)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <input
          type="checkbox"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
        />
        Show on startup
      </label>
      {error && <div role="alert" style={{ position: 'absolute', bottom: 16, right: 16, color: '#fff8ee' }}>{error}</div>}
      <NewProfileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(name, color) => create(name, color)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/desktop && npx vitest run tests/picker.app.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/picker/ProfileGrid.tsx apps/desktop/src/picker/PickerApp.tsx apps/desktop/tests/picker.app.test.tsx
git commit -m "feat(picker): full PickerApp with grid, sheet, and show-on-startup toggle"
```

---

## Phase 10 — Wire ProfileProvider into the browser app

### Task 27: Wrap App.tsx in ProfileProvider + read profileId from URL

**Files:**
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Wrap App in ProfileProvider in main.tsx**

Replace render block in `apps/desktop/src/main.tsx`:

```tsx
import { ProfileProvider } from './profiles/ProfileContext'

// ...

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 2: Guard App.tsx render until profile is resolved**

In `App.tsx`, at the top of the component body, add:

```tsx
import { useProfile } from './profiles/useProfile'
// ...
const profile = useProfile()
if (!profile) {
  return <div style={{ padding: 24, color: 'rgba(255,255,255,0.7)' }}>Loading profile…</div>
}
```

This keeps the existing behaviour pure once a profile is present and avoids tearing during hydration.

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
cd apps/desktop && npm test
```

Expected: all existing tests still pass. Several test files render `<App />` directly — they may need a small update: wrap them in `<ProfileProvider>` in setup, or stub the context. Update the failing tests' setups by injecting a profile via `useAuthStore.getState().setProfileId(...)` and `useTabsStore.getState().setProfileId(...)` before render, then importing a `<ProfileContext.Provider value={fakeProfile}>` wrapper from the context module instead of `<ProfileProvider>` for these tests.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.tsx apps/desktop/src/App.tsx apps/desktop/tests/
git commit -m "feat(app): wire ProfileProvider; render gated on profile resolution"
```

---

### Task 28: Avatar button in chrome bar → reopen picker

**Files:**
- Modify: `apps/desktop/src/chrome/ChromeShell.tsx` or `apps/desktop/src/chrome/TabStrip.tsx`
- Use existing `profileApi.openPickerWindow`

- [ ] **Step 1: Read existing ChromeShell + TabStrip to pick the right insertion point**

```bash
cat apps/desktop/src/chrome/ChromeShell.tsx apps/desktop/src/chrome/TabStrip.tsx | head -120
```

Find the slot at the right edge of the tab strip (after the `+` new-tab button) and insert an avatar button.

- [ ] **Step 2: Add an avatar button**

In the appropriate location (typically the right end of the tab strip):

```tsx
import { useProfile } from '~/profiles/useProfile'
import { profileApi } from '~/profiles/profile.api'
import { FRUIT_HEX } from '~/profiles/fruitColors'

// ...inside the component:
const p = useProfile()
if (!p) return null
const { from, to } = FRUIT_HEX[p.fruitColor]

return (
  <button
    type="button"
    aria-label={`Switch profile (current: ${p.name})`}
    onClick={() => void profileApi.openPickerWindow()}
    style={{
      width: 28, height: 28, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
      border: '1.5px solid rgba(255,255,255,0.7)',
      color: 'white', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', marginLeft: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >{p.avatarLetter}</button>
)
```

- [ ] **Step 3: Verify build + tests**

```bash
cd apps/desktop && npm run typecheck && npm test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/chrome/
git commit -m "feat(chrome): avatar button in tab strip opens picker window"
```

---

## Phase 11 — End-to-end manual integration

### Task 29: Manual cookie-isolation integration test

**Files:** None — this is a manual smoke test against `npm run tauri dev`.

- [ ] **Step 1: Wipe local app data for a clean run**

On Windows, delete:
```
%APPDATA%\africa.baobab.desktop\baobab\
```

- [ ] **Step 2: Launch dev build**

```bash
cd apps/desktop && npm run tauri dev
```

Expected behaviour:
- Migration creates "My Baobab" profile silently.
- One browser window opens (single profile + `showOnStartup` defaults to false).

- [ ] **Step 3: Create a second profile**

- Click the avatar in the tab strip → picker window opens.
- Click `+` → enter name "Test 2" → choose any colour → Create.
- Click the new tile → second browser window opens.

- [ ] **Step 4: Verify cookie isolation**

- In **My Baobab** window: navigate to `mail.google.com`, sign into a test Google account.
- In **Test 2** window: navigate to `mail.google.com`.
- Expected: Test 2 asks for credentials (no shared session with the other window).

If the second window shows the first window's logged-in session, isolation is NOT working. Check:
- `apps/desktop/src-tauri/target/debug/` log for the resolved `user_data_dir` path.
- Confirm `tabs::create_tab` is reaching the `data_directory(dir)` branch — log `dir` to stderr if unsure.

- [ ] **Step 5: Verify "Show on startup" persistence**

- Close all windows. Relaunch dev. Picker should NOT show (we never toggled the checkbox).
- Open the picker, tick "Show on startup", close all windows.
- Relaunch dev → picker should appear.

- [ ] **Step 6: Document any deviations**

If any step fails, file the deviation in `memory/plan_deviations.md` (in the project memory, not in the repo) before continuing. Do not skip this step — the cookie-isolation contract is the acceptance gate for this whole feature.

- [ ] **Step 7: Commit (manual-test marker)**

There's nothing to commit unless a fix was made. If a fix was needed, commit it as `fix(profiles): <what was wrong>`.

---

## Phase 12 — Acceptance sweep

### Task 30: Run the full acceptance checklist

- [ ] **Step 1: Run the full test suite**

```bash
cd apps/desktop && npm test && npm run typecheck && cd src-tauri && cargo test
```

Expected: all green.

- [ ] **Step 2: Walk through every acceptance criterion from the spec**

For each criterion in `docs/superpowers/specs/2026-05-15-profile-picker-design.md` § "Acceptance criteria for v1", manually verify and tick:

- [ ] Can create / rename / delete profiles from picker
- [ ] Two profiles open simultaneously, both visible
- [ ] Cookies isolated (Gmail test from Task 29)
- [ ] History, bookmarks, tabs, AI chat, NTP customisation persist per-profile
- [ ] Cold start with 1 profile + `showOnStartup=false` shows no picker
- [ ] Cold start with ≥2 profiles shows picker
- [ ] "Show on startup" persists across restarts
- [ ] Guest window has its own cookie jar, wiped on close
- [ ] Migration from pre-profile state produces a single working profile with all data intact
- [ ] No regressions in existing P0b tests

- [ ] **Step 3: If everything passes, declare v1 done**

Create a final commit summarising the feature:

```bash
git commit --allow-empty -m "feat(profiles): v1 — Baobab Grove profile picker with cookie isolation

Acceptance criteria verified manually per
docs/superpowers/specs/2026-05-15-profile-picker-design.md."
```

---

## Self-Review Notes

After writing this plan, the following were re-verified against the spec:

- **Spec § Storage layout** → covered by Tasks 1–8 (registry) and Task 13 (`data_directory` plumbing).
- **Spec § Per-profile data scope** → auth (Task 20), tabs (Task 21), NTP/history/bookmarks not explicitly migrated in this plan but rely on the same `profileScoped` pattern from Task 19; they pick it up automatically once their stores adopt `setProfileId`. **If any existing store reads persistence at module-load time** (not in `hydrate`), it must be moved into a `setProfileId`-triggered hydrate; left as discovered work in Task 21's step 4.
- **Spec § Visual spec** → Tasks 23–26 cover the Grove tree, fruit tiles, sheet, grid. Subtle animations described in the spec (3° tree sway, hover lift, fruit grow on select) are intentionally NOT in v1 — they're polish that v1.1 absorbs. Acceptable because the spec calls them "nice-to-have."
- **Spec § Error handling** → corruption recovery (Task 2), delete-with-window-open guard (Task 9 cmd), missing profile dir/orphan dir handled by the `find` fallback (Task 13). Disk-full path returns the error string via the `?`-propagated `Result`s.
- **Spec § Security** → plaintext token storage in v1 is explicit (Task 20 stores under namespaced key in `tauri-plugin-store` — matches today's level). Per-window IPC profile id from window label only (Task 12 `current_profile_id`). Profile name validation (Task 4).
- **Spec § Testing** → Rust unit tests cover registry; TS unit tests cover API wrappers, context, persistence, picker store, and PickerApp. Manual integration test in Task 29 covers cookie isolation (the only thing unit tests cannot prove).
- **Spec § Migration** → Task 14 creates the default profile; the spec also asks the frontend to move existing keys into the new namespace, which Task 19's `profileScoped` enables — but the actual key-by-key migration isn't explicitly scripted. For a clean v1 release, accept that existing dev installs will appear "fresh" inside the new "My Baobab" profile and bookmark / history / tab data won't migrate. The auth tokens will need re-login. This is an acceptable migration cost given current alpha-stage usage and is called out here so the engineer flags it in release notes.
