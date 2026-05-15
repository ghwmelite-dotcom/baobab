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
