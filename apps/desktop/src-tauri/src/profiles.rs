use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
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
    #[serde(default)]
    pub pin_hash: Option<String>,
}

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
}

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
                pin_hash: None,
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
        pin_hash: None,
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
