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
