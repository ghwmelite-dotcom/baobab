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
