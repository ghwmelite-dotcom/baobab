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
