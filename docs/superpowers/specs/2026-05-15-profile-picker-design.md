# Baobab Profile Picker — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-15
**Branch context:** desktop is on `feat/desktop-p0b`; auth is currently single-account; multi-window does not yet exist.

## Goal

Ship Chrome-parity multi-profile support for the Baobab desktop browser, with a distinctive "Baobab Grove" picker UI. Each profile is an independent local container with its own cookies, history, bookmarks, tabs, downloads, AI chat history, NTP customisation, and optional cloud-linked Baobab account. Profiles run side-by-side in separate Baobab windows.

## Non-goals

- Mobile profiles (Expo/iOS/Android) — out of scope; mobile stays single-account for now.
- Profile sync across devices — the Baobab cloud-link enables it conceptually, but the sync engine itself is its own future spec.
- Migrating arbitrary profiles in from Chrome — manual recreate only.
- Extension model — N/A; Baobab has no extensions today.
- Family / parental controls — out of scope.
- macOS-quality cookie isolation in v1 — see "Platform scope" below.

## Platform scope

**v1 ships Windows-first.** The cookie-isolation contract uses Tauri's `WebviewBuilder::data_directory()`, which is implemented against WebView2 on Windows. macOS uses `WKWebsiteDataStore` (identifier-based, not path-based) and Tauri's mapping there is partial; per the project memory, macOS CI is disabled until billing is funded, so we treat macOS as deferred. The data model (profiles registry, per-profile files, multi-window) is fully cross-platform and ships on both; only the cookie/storage isolation guarantee is Windows-only in v1. On macOS, v1 behaves as "profiles with shared web cookies" — explicitly called out in release notes — and the macOS isolation upgrade is its own v1.x ticket. This is acceptable because the existing release pipeline excludes macOS builds anyway.

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Isolation depth | Full browser-level (cookies + storage + history + bookmarks + tabs per profile) | Anything less is a Trojan horse; the whole reason users want profiles is two-Gmail-at-once. |
| Visual direction | Baobab Grove (warm sunset, fruits-on-tree iconography) | Brand-coherent, unique, scales with the tree-and-grid hybrid layout. |
| Layout | L3: small tree emblem on top, grid of fruit tiles below | Tree adds soul; grid scales to 20+ profiles cleanly. |
| Account model | Hybrid: local-first with opinionated cloud-link nudge per profile | Profiles aren't gated on signup; cloud sync is opt-in per profile. |
| Window model | One Tauri window per profile; multiple can run side-by-side | Matches Chrome semantics; required for real cookie isolation across simultaneous sessions. |
| Launch flow | Picker shown when ≥2 profiles exist (or "Show on startup" override) | Matches Chrome; cold-start is fast for single-profile users. |
| Guest mode | Ephemeral profile-less window, wiped on close | Standard Chrome behaviour; useful for borrowed devices. |
| Per-profile data scope | See "Data scope" table below | Identity-bearing surfaces are per-profile; app-level prefs are global. |
| Release packaging | v1 = data model + real isolation (single user-facing release); v1.1 = polish | Never ship a picker without real cookie isolation. |

## Architecture

### Conceptual model

A **Profile** is the identity that owns a browsing session. The Baobab app may have many profiles. At any time, zero or more **profile windows** are open, plus optionally **one picker window**. Each profile window is bound to exactly one profile; each profile may have zero, one, or many windows open at once.

```
+------------------+        +------------------+
|  Picker window   |        |  Picker window   |   (only one ever exists)
|  (Grove UI)      |        |                  |
+------------------+        +------------------+
        |
        | launches
        v
+------------------+        +------------------+        +------------------+
| Profile window   |        | Profile window   |        | Guest window     |
| profile=Akua     |        | profile=Kofi     |        | profile=<eph>    |
| webviews share   |        | webviews share   |        | webviews share   |
| akua.userDataDir |        | kofi.userDataDir |        | $TMP/baobab-g-N  |
+------------------+        +------------------+        +------------------+
```

### Storage layout

All persistent profile data lives under Tauri's app-data dir, resolved via `dirs::data_dir()` + the bundle id (existing convention):

```
$APP_DATA/baobab/
├── profiles.json                  ← registry: list of profiles + global picker prefs
├── profiles/
│   ├── <uuid-akua>/
│   │   ├── userdata/              ← passed to WebView2 / WKWebsiteDataStore (cookies, IDB, localStorage)
│   │   ├── history.db             ← sqlite (history, downloads)
│   │   ├── bookmarks.json
│   │   ├── tabs.json              ← restore-on-launch session
│   │   ├── ai-chat.db
│   │   ├── ntp.json               ← NTP customisation
│   │   └── auth.json              ← cloud-link tokens (encrypted at rest, see Security)
│   ├── <uuid-kofi>/
│   │   └── ...
│   └── <uuid-osei>/
│       └── ...
```

`profiles.json` schema:

```ts
type ProfilesFile = {
  schemaVersion: 1
  profiles: Profile[]
  pickerPrefs: {
    showOnStartup: boolean      // default: true once ≥2 profiles
    lastUsedProfileId: string | null
  }
}

type Profile = {
  id: string                    // uuid v4
  name: string                  // user-editable, 1–48 chars
  fruitColor: FruitColor        // one of 8 preset hues
  avatarLetter: string          // 1–2 chars, defaults to first letter of name
  createdAt: string             // ISO 8601
  lastUsedAt: string            // ISO 8601, updated on window close
  cloudLink: null | {
    baobabUserId: string
    accountEmail: string | null
    accountPhone: string | null
    linkedAt: string
  }
  userDataDirName: string       // relative dir name under profiles/<id>/userdata
}

type FruitColor =
  | 'mango'    // #c44a1f (sunset orange)
  | 'baobab'   // #c4881f (warm amber)
  | 'shea'     // #5a8a1f (verdant green)
  | 'indigo'   // #1f5a8a (deep blue)
  | 'hibiscus' // #8a1f5a (magenta rose)
  | 'palm'     // #4a8a5a (palm green)
  | 'kola'     // #c4661f (warm rust)
  | 'baobwhite' // #d4c8a8 (pale bark — for placeholder/unlinked)
```

### Data scope

| Per-profile | Global |
|---|---|
| Web cookies, localStorage, IndexedDB, ServiceWorkers (the entire WebView2 / WKWebsiteDataStore) | App auto-update channel + last-checked-at |
| History (sqlite) | Picker prefs: `showOnStartup`, `lastUsedProfileId` |
| Bookmarks (json) | Telemetry opt-in |
| Open tabs / restore-on-launch session | App-wide keyboard shortcuts (immutable) |
| Downloads list metadata (files themselves live in user's OS downloads dir, shared) | Window position memory (per-window, not per-profile) |
| Baobab account auth tokens | Updater UI dismissals |
| AI assistant chat history | Crash report opt-in |
| Reader-mode saved articles | |
| NTP customisation (Sahel Sunrise variants) | |
| Theme, default search engine, per-profile preferences | |

### Rust side (`apps/desktop/src-tauri/`)

New modules:

- **`profiles.rs`** — Profile registry: read/write `profiles.json`, create/delete/rename profile, resolve `userDataDir` paths, compute "should picker show on launch" boolean.
- **`windows.rs`** — Multi-window orchestration: open picker window, open profile window for a `profileId`, open guest window. Replaces the current single-`main`-window assumption.

Modifications:

- **`lib.rs#run()`** — On startup: read `profiles.json`, decide whether to open picker or a profile window, register all new commands.
- **`tabs.rs`** — Every tab-creating function takes a `profileId` (resolved from the calling window). `WebviewBuilder::data_directory()` is set to `profiles/<id>/userdata` for every tab webview. The incognito branch keeps using `$TMP`. The `app.get_window("main")` calls become `lookup window by label` based on the call site's window.
- **`downloads.rs`** — Downloads listener writes the download record to the profile's `history.db` (not a single global).

New Tauri commands (over the IPC boundary):

```rust
// profiles.rs
list_profiles() -> Vec<Profile>
create_profile(name, fruit_color) -> Profile
rename_profile(id, name) -> ()
update_profile_color(id, fruit_color) -> ()
delete_profile(id) -> ()                          // also rm -rf the profile dir
set_picker_show_on_startup(value: bool) -> ()
link_baobab_account(id, tokens) -> ()
unlink_baobab_account(id) -> ()

// windows.rs
open_picker_window() -> ()
open_profile_window(profile_id) -> ()
open_guest_window() -> ()
close_profile_window(window_label) -> ()          // also persists lastUsedAt
get_current_profile_id() -> Option<String>        // from the calling window's state
```

### Frontend side (`apps/desktop/src/`)

New folders:

- **`src/picker/`** — Picker app. This is its own Vite entry (`picker.html` + `picker.tsx`) that renders only when the picker window is open. It is independent from the browser app. Components:
  - `PickerApp.tsx` — top-level frame, dark sunset gradient background
  - `GroveTree.tsx` — the decorative baobab tree at the top
  - `ProfileGrid.tsx` — the 4-column grid of fruit tiles with names; new-profile tile; guest tile
  - `ProfileTile.tsx` — one tile (fruit + name + per-tile "···" menu for rename/delete/customise)
  - `NewProfileSheet.tsx` — bottom sheet for creating a profile (name + fruit color picker)
  - `usePickerData.ts` — Zustand store wrapping the `list_profiles` IPC and selection state
- **`src/profiles/`** — Profile context for the *browser* app:
  - `ProfileContext.tsx` — React context exposing the current window's profile
  - `useProfile.ts` — hook returning `Profile`
  - `profile.api.ts` — typed wrappers around the Tauri commands

Restructured:

- **`src/auth/auth.store.ts`** — Currently a singleton Zustand store. Becomes a **profile-scoped store** instantiated against the current profile's auth tokens. The hook signature stays the same; the underlying persistence key is `profile-<id>:auth.accessToken`.
- **`src/state/persistence.ts`** — Today stores everything under flat keys. Becomes profile-aware: writes go to `profiles/<id>/...` for per-profile data; the global picker prefs stay at the root.
- **`src/state/tabs.store.ts`** — Becomes per-window. Window id maps 1:1 to profile id at runtime.
- **`src/chrome/ChromeShell.tsx`** — Wraps in `<ProfileContext.Provider>` derived from `get_current_profile_id`.
- **`src/main.tsx`** — Splits into two entries: the existing browser entry, and a new `picker.tsx` for the picker window.

New Vite config — multi-page build with two HTML entry points (`index.html` and `picker.html`). Tauri loads `index.html` for profile windows and `picker.html` for the picker window.

### Visual spec — Grove picker (L3)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                              🌳  (small baobab emblem)                 │
│                                                                        │
│                       Who's using Baobab?                              │
│                       Eight profiles in this grove                     │
│                                                                        │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                                   │
│   │  A  │  │  B  │  │  K  │  │  O  │                                   │
│   │Akua │  │Brila│  │Kofi │  │Osei │                                   │
│   └─────┘  └─────┘  └─────┘  └─────┘                                   │
│   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                                   │
│   │  M  │  │  Y  │  │  G  │  │  +  │                                   │
│   │Ama  │  │Yaa  │  │Guest│  │ New │                                   │
│   └─────┘  └─────┘  └─────┘  └─────┘                                   │
│                                                                        │
│  [☑ Show on startup]                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

- **Background:** vertical gradient `#fde7c4 → #f4b878 → #d97a3a → #6b2814` (Sahel Sunrise).
- **Tree emblem:** a stylised baobab (~120px tall), centred above the title. Subtly animated: gentle 0.3° sway, 6s loop, paused if `prefers-reduced-motion`.
- **Fruit tile:** 120×120, rounded 16px, soft tan card on dark backdrop. Fruit-coloured circle (44px) at top, name underneath. Hover: tile lifts 2px, fruit grows 4%, faint glow in fruit colour. The avatar fruit on each tile has a tiny stem sprite at the top.
- **"+" tile:** dashed border, no fill, large `+`. Opens `NewProfileSheet`.
- **Guest tile:** distinct from profiles — slate-grey fruit, italic "Guest" label.
- **"···" menu per tile:** opens dropdown with Rename / Customise colour / Sign in to Baobab (if unlinked) / Delete. Visible on tile hover, top-right.
- **Show on startup checkbox:** bottom-left of the window. Mirrors Chrome's checkbox.
- **Animation in/out:** picker fades in (200ms); on profile select, the chosen fruit grows + the rest fade (180ms), then the picker window closes and the profile window opens.

### NewProfileSheet flow

1. User clicks `+` tile → sheet slides up from the bottom.
2. Sheet contents:
   - Input: profile name (required, 1–48 chars, autofocus)
   - Fruit-color picker: 8 chips in a row, defaults to next-available color
   - "Sign in to Baobab account" toggle (default off) — if on, embeds the existing `EmailAuthForm` / `PhoneAuthForm` from the auth folder
   - Buttons: Cancel, Create
3. On Create: call `create_profile`, get back a `Profile`. If account-link toggle was on, the new profile window opens and immediately runs the signup/login flow within it (rather than blocking the picker on a network call).
4. Picker re-renders with the new tile.

## Data flow

### Cold start

```
main.rs#run()
  → profiles::load() reads profiles.json
  → decide:
      if profiles.is_empty():
        profiles::create_default() → "My Baobab" with shea color
        windows::open_profile_window(default.id)
      elif profiles.len() == 1 and not picker_prefs.show_on_startup:
        windows::open_profile_window(only.id)
      else:
        windows::open_picker_window()
```

### Profile selection

```
Picker UI clicks ProfileTile
  → invoke("open_profile_window", { profileId })
  → Rust:
      • create new Tauri window with label `profile-<id>`
      • new window loads index.html with ?profileId=<id> query
      • close picker window (or keep open if it was launched from menu)
  → Frontend in new window:
      • ProfileContext reads window's profileId from URL/IPC
      • auth.store hydrates with profile's tokens
      • tabs.store hydrates with profile's tabs.json
      • all subsequent tab creations pass profileId → tabs::create_tab uses data_directory(profile.userDataDir)
```

### Tab creation inside a profile window

```
React calls createTab(url)
  → invoke("create_tab", { id, url, profileId: useProfile().id })
  → tabs::create_tab:
      • resolve profile → user_data_dir
      • WebviewBuilder::new(label, url).data_directory(user_data_dir)
      • main.add_child(builder, ...)   ← "main" here = the profile window
```

Existing incognito path stays the same (still `$TMP/baobab-incognito-<id>`).

### Window close

```
Profile window onCloseRequested
  → flush tabs.json, bookmarks.json
  → invoke("close_profile_window", { windowLabel })
  → Rust:
      • update profile.lastUsedAt
      • write profiles.json
  → if no other profile windows open:
      • exit app (unless picker is also open)
```

## Error handling

- **`profiles.json` corrupted or missing fields.** Boot recovery: if parse fails, rename to `profiles.json.broken-<timestamp>`, log loud error, write a fresh default-profile registry, open picker with a one-time toast. Never crash the app; never silently delete user data.
- **Profile dir missing on disk but listed in registry.** Mark profile as "broken" in the registry; tile renders greyed-out with "Repair" menu item (recreates `userdata/` empty). Don't auto-delete.
- **Profile dir present on disk but not in registry.** Ignore — orphan. Surface in a settings page later (v1.1) as "Found unregistered profile, add to picker? / delete?".
- **Profile delete fails partway** (e.g., file locked because a window is still open). Refuse delete if any profile window is open. Show error toast: "Close all windows for this profile first."
- **Cloud-link tokens become invalid.** Same behaviour as today's auth.store — clear tokens, fall back to "unlinked" state, NTP shows the sign-in nudge again.
- **Disk full when creating a new profile.** Fail the `create_profile` IPC with a clear error string; sheet shows the error inline and stays open.
- **Picker window crashes / closed by OS.** Reopen it if it was the only open window; otherwise let it stay closed (user can reopen via avatar menu).

## Security

- **`auth.json` per profile** is stored as plaintext JSON under the per-profile dir in v1 — matching today's security level for the existing single-account tokens (which already live in `tauri-plugin-store`'s plaintext file). The refresh token's only privilege is calling the Baobab API; an attacker with disk access already controls the user's browsing data anyway. **OS-keyring-backed encryption is a separate v1.x ticket** that will use the `keyring` crate (Windows DPAPI / macOS Keychain) and is out of scope here to keep this spec single-implementation-plan-sized.
- **Per-profile `userdata` dir** is the WebView2 boundary on Windows; this is the cookie-isolation contract. Verify with a manual test: log into Gmail in profile A, open profile B, confirm Gmail asks for credentials. (macOS isolation is deferred — see "Platform scope".)
- **No cross-window IPC of profile tokens.** Each window's frontend can only read its own profile's tokens. The `get_current_profile_id` IPC is derived from the window's label and cannot be spoofed from JS.
- **Profile name input** is plain text; we never `dangerouslySetInnerHTML` it. Limit to 48 chars; reject control characters.
- **Profile dir paths** are constructed from `dirs::data_dir()` + uuid, never from user input — no path injection.
- **Guest mode dir** under `$TMP` with a random suffix is wiped when the window closes. Use `tempfile::TempDir` so cleanup is automatic even on crash (best-effort; OS reaps `$TMP` eventually).

## Testing

### Unit (TS, vitest)

- `profiles.api.ts` — Tauri command wrappers with mocked invoke.
- `auth.store` profile-keyed persistence — each profile's tokens are isolated in the persistence layer.
- `ProfileContext` — yields the right profile based on URL query / IPC.
- `usePickerData` — list, create, delete, rename actions update store correctly.
- Visual snapshot of `GroveTree` and `ProfileTile` (Storybook + Chromatic-style snapshot if configured, else jsdom render snapshot).

### Unit (Rust, `cargo test`)

- `profiles::load` happy path + corrupted file fallback.
- `profiles::create_profile` writes registry + creates dir tree.
- `profiles::delete_profile` removes dir, fails if window open.
- `windows::should_show_picker_on_launch` over all combinations of profile count + `showOnStartup`.

### Integration (manual, in dev build)

- Cold start with 0 profiles → default profile created → picker NOT shown → browser opens.
- Cold start with 1 profile + `showOnStartup=false` → browser opens directly.
- Cold start with 1 profile + `showOnStartup=true` → picker opens.
- Cold start with 2 profiles → picker opens.
- Open profile A, open profile B from picker → both windows visible, focus works.
- Log into Gmail in A, switch focus to B, navigate to gmail.com → asks for credentials (cookie isolation verified).
- Close all windows except picker → app stays alive; closing picker exits.
- Close profile window with open tabs → reopen profile → tabs restored.
- Delete profile from picker → dir removed, registry updated, tile gone.
- Create profile with sign-in toggle ON → new window opens with auth flow primed.
- Guest window → cookie set on a site → close guest → reopen guest → cookie gone.

### Cross-platform smoke

- Manual test on Windows 11 (WebView2) — primary platform.
- macOS test deferred (mac CI is disabled per memory).

## Migration plan

There is exactly one existing user state to migrate: today's single signed-in user.

1. Detect "pre-profile" state: `profiles.json` missing AND old `auth.accessToken` key exists in `tauri-plugin-store`.
2. Create a single profile named "My Baobab" (or derived from the signed-in account's email local-part, if available).
3. Move every key currently under the global store into that profile's namespace:
   - `auth.accessToken` / `auth.refreshToken` → `profiles/<id>/auth.json`
   - Tabs, history, bookmarks, NTP prefs → corresponding per-profile files
4. Run once on first launch after upgrade; leave a `migration.v1.completed` marker so it's idempotent.
5. Old keys are deleted only after successful migration; on failure, leave them alone and surface an error log.

## Open questions / known gaps

None blocking. Items deferred to v1.1:

- Fruit-color editor UI (v1 ships with auto-assigned colors and rename only)
- Profile management page in Settings
- Cloud-link nudge UI on NTP
- Multi-profile drag-and-drop reordering in picker
- Profile-aware crash reports
- Profile sync engine (separate spec)

## Acceptance criteria for v1

- ✅ User can create, rename, and delete profiles from the picker.
- ✅ Two profiles can be open simultaneously in separate windows.
- ✅ Cookies set in profile A are not visible in profile B (verified by manual Gmail test).
- ✅ History, bookmarks, tabs, AI chat, and NTP customisation persist per-profile.
- ✅ Cold start with 1 profile + `showOnStartup=false` shows no picker.
- ✅ Cold start with ≥2 profiles shows the Grove picker.
- ✅ "Show on startup" checkbox state persists across restarts.
- ✅ Guest window has its own cookie jar and is wiped on close.
- ✅ Migration from pre-profile state produces a single working profile with all data intact.
- ✅ No regressions in existing P0b tests (`apps/desktop`).
