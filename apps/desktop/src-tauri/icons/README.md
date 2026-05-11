# Icons (placeholder)

These are placeholder icons generated from a 1024×1024 amber square with a white "B" — created via `npx @tauri-apps/cli icon icon-source.png` during Task 11. They unblock `cargo check` (which validates `icons/icon.ico` at proc-macro time via `tauri::generate_context!`) and let `tauri build` produce installer bundles.

**They are NOT production artwork.** Before any user-facing release:

1. Drop a 1024×1024 baobab-silhouette PNG (transparent background, on-brand amber `#d97706` accents) at `icon-source.png`.
2. From `apps/desktop/`: `npx @tauri-apps/cli icon src-tauri/icons/icon-source.png`
3. Verify the regenerated `icon.ico`, `icon.icns`, `icon.png`, and PNG size variants.
4. Replace this README with a note describing the source artwork (designer credit, source file location, brand-guideline reference).

Files committed (kept):
- `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` — bundled per `tauri.conf.json`
- `icon.png`, `icon.ico`, `icon.icns` — runtime window icon + Windows/macOS bundle icons
- `Square*Logo.png`, `StoreLogo.png` — Windows Store / MSIX packaging variants (auto-picked when MSIX targets land)

Files explicitly deleted from the CLI's output (regenerable):
- `android/`, `ios/` — only relevant when `apps/mobile` (Expo) lands; regenerate then.
- `icon-source.png` — the source PNG; regenerate from real artwork.
