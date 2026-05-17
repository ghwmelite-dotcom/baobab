# Profile PIN Lock — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-15
**Branch context:** Profile picker v1 shipped on `feat/desktop-p0b`. PIN is a v1.5 follow-up that builds on the same data model.

## Goal

Let a Baobab profile be optionally locked with a 4-digit PIN. Clicking a locked tile in the picker prompts for the PIN; a correct entry opens the profile window, a wrong entry refuses access. Designed for shared-computer scenarios — multiple people on the same device, casual privacy.

## Honest threat model (and what this is NOT)

**Protects against:** A casual user at the keyboard who clicks your tile and wants to see your tabs/history/email sessions. They will be presented with a PIN prompt and won't trivially get past it.

**Does NOT protect against:**
- Someone with file-system access to `%APPDATA%\africa.baobab.desktop\baobab\profiles\<id>\userdata\`. Cookies, history, bookmarks, IndexedDB live there in plaintext (per WebView2's storage). No encryption.
- Brute force given disk access: 10,000 PIN combinations × even an expensive hash function is minutes of compute. The hash is there to keep the PIN itself from being stored in cleartext on disk, not to be a security primitive.
- A user who modifies `picker.html` to bypass the prompt — though Rust-side IPC enforcement (see Architecture) makes this harder than a one-line tweak.

This is documented verbatim at PIN setup so users have realistic expectations.

## Non-goals

- At-rest encryption of profile data dir (deferred to v2.0; needs an architectural rework of how WebView2 sees storage).
- Master backup password / forget-PIN recovery flow (deferred; v1.5 takes the simple "forget = delete" path).
- Biometrics (Windows Hello, Touch ID) (deferred).
- Per-tab / per-site PIN gating (out of scope — protection is at the profile-window granularity).
- Cross-device PIN sync (out of scope; PIN is local-only to the install).
- Mobile (out of scope; mobile is single-account).

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Security model | UX gate only — no data encryption | Honest about the threat model. Adequate for casual privacy on a shared device. Real encryption is genuinely hard on WebView2. |
| PIN format | Exactly 4 numeric digits | Familiar from phone/ATM. Fast entry. 10,000 combos is enough for a UX gate when paired with rate limiting. |
| Recovery | None — delete profile to reset | Simplest. Avoids master-password UX. Matches "casual gate" expectations. |
| Edit-after-creation | Yes — Set / Change / Remove PIN from the tile "···" menu | More flexible than create-only without much extra code. Each operation gates on the current PIN. |
| Rate limit | 3 wrong = 30 s lockout, 6 wrong = 5 min, in-memory only | Slows manual brute-force in the UI. In-memory because surviving across restart isn't worth the complexity for a UX gate. |
| Server-side enforcement | Yes — `open_profile_window` requires PIN | Frontend tampering doesn't bypass the gate. |
| Hashing | PBKDF2-SHA256, 100k iterations, 16-byte random salt | Matches the project's existing PBKDF2 use in the worker. Stored as `"pbkdf2-sha256$100000$<salt-b64>$<hash-b64>"`. |

## New Rust dependencies

Add to `apps/desktop/src-tauri/Cargo.toml`:

```toml
pbkdf2 = { version = "0.12", default-features = false, features = ["hmac"] }
sha2 = { version = "0.10", default-features = false }
subtle = "2"             # constant-time comparison for verify
base64 = "0.22"          # encode salt + hash in the stored string
rand = "0.8"             # CSPRNG for salts
```

All four are pure-Rust crypto primitives — no system dependencies, no build complications.

## Architecture

### Data model

Add to the existing `Profile` struct (`apps/desktop/src-tauri/src/profiles.rs`):

```rust
pub struct Profile {
    // ... existing fields ...
    pub pin_hash: Option<String>,        // None = unlocked; Some = locked
}
```

**Serialisation: split internal vs. DTO.** The hash never leaves Rust:

```rust
// Internal struct — written to profiles.json. Has pin_hash.
pub struct Profile { ... pub pin_hash: Option<String> }

// DTO — returned to the frontend over IPC. pin_hash omitted, pin_required added.
#[derive(Serialize)]
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
impl From<&Profile> for ProfileView { /* maps fields, computes pin_required */ }
```

`cmd_list_profiles` now returns `Vec<ProfileView>` instead of `Vec<Profile>`. The hash stays in `profiles.json` on disk and in the Rust process memory; it is never sent to the renderer.

### Rust commands (new + modified)

**New module `apps/desktop/src-tauri/src/pin.rs`:**

```rust
const HASH_ALGO: &str = "pbkdf2-sha256";
const ITERATIONS: u32 = 100_000;
const SALT_BYTES: usize = 16;
const HASH_BYTES: usize = 32;

pub fn hash_pin(pin: &str) -> Result<String, String>;       // generates salt + PBKDF2 hash, returns the encoded string
pub fn verify_pin(stored: &str, pin: &str) -> Result<bool, String>;  // parses, recomputes, constant-time compare
fn validate_pin_format(pin: &str) -> Result<(), String>;    // exactly 4 ASCII digits
```

Inline unit tests:
- `hash_pin` produces different hashes for the same PIN (random salt).
- `verify_pin` accepts the original PIN and rejects others.
- Stored format is `pbkdf2-sha256$100000$<salt-b64>$<hash-b64>`.
- `validate_pin_format` accepts `"1234"`, rejects `"123"`, `"12345"`, `"12a4"`, `""`, `"1234\n"`.

**New module `apps/desktop/src-tauri/src/pin_attempts.rs`:**

```rust
pub struct PinAttempts {
    inner: Mutex<HashMap<String, AttemptState>>,
}

pub struct AttemptState {
    wrong_count: u32,
    locked_until: Option<Instant>,
}

pub enum AttemptResult { Allowed, Locked { remaining_seconds: u64 } }

impl PinAttempts {
    pub fn check(&self, profile_id: &str) -> AttemptResult;        // checks lockout
    pub fn record_wrong(&self, profile_id: &str) -> Option<u64>;   // increments; returns lockout seconds if triggered
    pub fn record_correct(&self, profile_id: &str);                // clears state
}
```

Lockout schedule, counting cumulative wrong attempts:
- The 3rd wrong attempt in a row triggers a 30-second lockout.
- The 6th wrong attempt (3 more wrong after the first lockout expires) triggers a 5-minute lockout.
- The 9th wrong attempt triggers a 30-minute lockout.
- A successful PIN entry resets `wrong_count` to 0 immediately.
- An app restart wipes the entire `PinAttempts` map (in-memory only).

During a lockout window, `check()` returns `Locked { remaining_seconds }`. `record_wrong()` is a no-op while locked (the UI won't be calling it, but defence-in-depth).

Inline tests:
- `record_wrong` 3 times triggers a 30 s lockout.
- `check` returns `Locked` during lockout window, `Allowed` after.
- `record_correct` clears state.

**Modified commands in `profiles.rs`:**

```rust
#[tauri::command]
async fn cmd_create_profile(
    app: AppHandle,
    name: String,
    fruit_color: Option<FruitColor>,
    pin: Option<String>,    // ← new
) -> Result<ProfileView, String>;   // ← returns DTO

#[tauri::command]
async fn cmd_list_profiles(app: AppHandle) -> Result<Vec<ProfileView>, String>;  // ← DTO

#[tauri::command]
async fn cmd_set_profile_pin(
    app: AppHandle,
    id: String,
    new_pin: String,
    current_pin: Option<String>,    // required if profile already has a PIN
) -> Result<(), String>;

#[tauri::command]
async fn cmd_remove_profile_pin(
    app: AppHandle,
    id: String,
    current_pin: String,
) -> Result<(), String>;
```

**Modified `open_profile_window` in `windows.rs`:**

```rust
#[tauri::command]
async fn open_profile_window(
    app: AppHandle,
    profile_id: String,
    pin: Option<String>,    // ← new
) -> Result<(), String> {
    // 1. Load profile. If no pin_hash → open as today.
    // 2. If pin_hash exists:
    //    a. Check rate limit. If locked, return Err("locked:<seconds>").
    //    b. If pin arg is None, return Err("pin_required").
    //    c. Verify pin against pin_hash.
    //    d. On wrong, attempts.record_wrong, return Err("wrong_pin") (with lockout if triggered).
    //    e. On correct, attempts.record_correct, then proceed to build window.
    // 3. PinAttempts is stored as a tauri::State<PinAttempts> registered at startup.
}
```

The frontend MUST pass `pin` whenever the profile has `pin_required: true`. Without it the command errors back.

### Frontend changes

**`apps/desktop/src/profiles/profile.api.ts`:**
- `Profile` interface updates: drop the `pinHash` field (was never there) and add `pinRequired: boolean`.
- `profileApi.create(name, fruitColor?, pin?: string)` — extra optional `pin` arg.
- New `profileApi.setPin(id, newPin, currentPin?)` and `profileApi.removePin(id, currentPin)`.
- `profileApi.openProfileWindow(profileId, pin?: string)` — accepts optional pin.

**`apps/desktop/src/picker/NewProfileSheet.tsx`:**
- Add a "Lock this profile with a PIN" toggle, default off.
- When on, reveal two 4-digit input rows (PIN + confirm).
- The 4-digit input is a custom `<PinInput>` component (see below), used in 3 places: create sheet, change-PIN sheet, unlock sheet.
- "Create" button disabled until name valid AND (PIN toggle off OR PIN+confirm match and are 4 digits).
- Submit passes `pin` to `profileApi.create`.

**New `apps/desktop/src/picker/PinInput.tsx`:**
- Four 44 × 56 input boxes with large monospace digits.
- Auto-advance on digit entry; backspace moves back.
- Numeric only; rejects non-digits.
- Exposes `value: string` (`""` to `"1234"`), `onChange`, `onComplete(pin: string)` (fires when length 4), `shake: boolean` (triggers a CSS shake animation, used on wrong PIN), `disabled: boolean`.
- Visual: dark brown border, soft-yellow background, focus glow in the fruit's accent colour.

**New `apps/desktop/src/picker/UnlockSheet.tsx`:**
- Bottom sheet (same pattern as NewProfileSheet) with a single `<PinInput>` and the profile's name/fruit at the top.
- On `onComplete(pin)`: call `profileApi.openProfileWindow(profileId, pin)`. Success → close sheet. Error:
  - `pin_required` (shouldn't happen here since we always send pin) → generic error.
  - `wrong_pin` → shake animation, clear input, count down attempts.
  - `locked:<n>` → disable input, show "Try again in MM:SS" countdown.

**`apps/desktop/src/picker/ProfileTile.tsx`:**
- If `profile.pinRequired`, render a small lock badge at the bottom-right of the fruit avatar (12 px lock SVG icon, soft brown). The fruit itself stays the same colour.
- "···" menu entries change based on `pinRequired`:
  - If false: "Rename", "Set PIN", "Delete".
  - If true: "Rename", "Change PIN", "Remove PIN", "Delete".
- Set / Change / Remove PIN open dedicated sheets that gate on the current PIN where required.

**`apps/desktop/src/picker/usePickerData.ts`:**
- `select(id)`: if the selected profile has `pinRequired`, open `UnlockSheet` instead of calling `openProfileWindow` directly. Once unlocked the sheet calls `openProfileWindow(id, pin)` directly and closes itself.
- New action: `setPin(id, newPin, currentPin?)`, `removePin(id, currentPin)`.

### Copy at PIN setup

The "Set PIN" / create-sheet PIN reveal includes this caption:

> Lock this profile with a 4-digit PIN. Anyone using this computer will need the PIN to open this profile.
>
> **If you forget your PIN, you'll need to delete the profile and start over.** Your bookmarks, history, and tabs in this profile will be lost. The PIN does not encrypt your data on disk; someone with file access to this computer can still read it.

## Data flow

### Setting a PIN at profile creation

```
User types name, ticks "Lock", enters PIN + confirm
  → NewProfileSheet validates equality and 4-digit format
  → handleSubmit → profileApi.create(name, color, pin)
  → invoke('cmd_create_profile', { name, fruitColor, pin })
  → Rust: validate_pin_format → hash_pin → write Profile with pin_hash
  → Returns ProfileView (pinRequired: true)
  → Store hydrates, picker re-renders with lock badge on the new tile
```

### Selecting a locked profile

```
User clicks locked tile
  → ProfileGrid.onSelect(id)
  → usePickerData.select(id) checks profile.pinRequired
  → setUnlockTarget(id) → UnlockSheet opens
  → User types 4 digits → PinInput.onComplete(pin)
  → profileApi.openProfileWindow(id, pin)
  → invoke('open_profile_window', { profileId, pin })
  → Rust: load profile → check lockout → verify_pin
      • wrong: record_wrong → Err("wrong_pin") (or "locked:<seconds>" if threshold)
      • correct: record_correct → record_profile_used → build window
  → Frontend success: close UnlockSheet, picker stays open (user can pick another)
  → Frontend error wrong_pin: PinInput.shake, clear value, decrement remaining attempts
  → Frontend error locked: disable input, start countdown
```

### Changing a PIN

```
Tile menu → "Change PIN" → opens a 2-step sheet:
  Step 1: enter current PIN (4-digit PinInput)
  Step 2: enter new PIN + confirm (two PinInputs)
  → profileApi.setPin(id, newPin, currentPin)
  → invoke('cmd_set_profile_pin', { id, newPin, currentPin })
  → Rust: verify_pin(stored, current_pin) → if ok, hash_pin(new_pin), save
  → On success: sheet closes with toast "PIN updated"
```

### Removing a PIN

```
Tile menu → "Remove PIN" → opens single-step sheet:
  Step: enter current PIN
  → profileApi.removePin(id, currentPin)
  → invoke('cmd_remove_profile_pin', { id, currentPin })
  → Rust: verify_pin → set pin_hash = None → save
  → On success: sheet closes, lock badge disappears from tile
```

## Error handling

- **Empty / non-4-digit PIN input at create time** — Create button stays disabled. No error path needed; UI prevents bad data.
- **PIN mismatch in create/change sheet** — inline message "PINs don't match." Button stays disabled.
- **Wrong PIN at unlock** — UI shows shake animation, "Wrong PIN — X attempts left" (counts down to lockout). Rust returns `Err("wrong_pin")`.
- **Lockout triggered** — Rust returns `Err("locked:30")` (seconds remaining). UI disables PinInput, shows "Try again in 0:30" with a live-updating countdown.
- **Lockout while user is on the unlock sheet** — Countdown ticks down in real time. When zero, input re-enables.
- **`current_pin` wrong on change/remove** — same error type as wrong_pin, but contained to that sheet. Lockout still triggers via the same `PinAttempts` map.
- **Profile delete while locked** — Allowed without PIN (per "no recovery" decision). Anyone with picker access can delete a locked profile. They can't read its data; they can wipe it. This is explicitly chosen to provide a recovery path for a legitimate owner who forgot.
- **Migration: existing profiles** — All profiles created before this feature have `pin_hash = None`. No migration needed.
- **Disk corruption / invalid pin_hash string** — `verify_pin` returns `Err("malformed_hash")`. UI treats this as a hard error, surfaces "Profile data corrupted — delete and recreate."

## Security

- **PIN never logged** — no `println!`/`tracing` of the raw PIN. The hash is fine in logs (it's already a hash). Add a `// SECURITY:` comment near each `hash_pin` / `verify_pin` call.
- **PIN never written to disk except as hash** — `profiles.json` writes `pin_hash` (already a hash), not the raw PIN.
- **Constant-time comparison** — `verify_pin` uses `subtle::ConstantTimeEq` to avoid timing leaks. Even though 4 digits is fast either way, this is a defensive default that costs nothing.
- **PIN never sent to JS** — `ProfileView` does not include `pin_hash` (split DTO pattern). The renderer only knows `pin_required: bool`.
- **PIN argument over IPC** — The PIN crosses the IPC boundary in plain text inside the Tauri-internal IPC channel. Tauri's IPC is local-process-to-local-process — not network. This is the same trust model as the existing password fields in `EmailAuthForm`. No additional risk.
- **Rate limit on the picker UI is the only enforcement against user-driven brute-force.** A determined attacker reading the disk skips this entirely.
- **No persistent rate-limit state** — restarting the app clears the lockout. Acceptable for a UX gate; persisting would require another file + migration.

## Testing

### Rust unit (`cargo test`)

- `pin::hash_pin` — different salts produce different hashes for the same PIN; format is the expected `pbkdf2-sha256$<iter>$<salt>$<hash>` string.
- `pin::verify_pin` — accepts correct PIN, rejects wrong PIN, rejects malformed hash.
- `pin::validate_pin_format` — accepts `"1234"`, rejects `"123"`, `"12345"`, `"12a4"`, `""`, `"1234\n"`, leading/trailing whitespace.
- `pin_attempts::PinAttempts` — 3 wrong → 30 s lockout returned; correct resets; `check` returns Locked during window, Allowed after.
- `profiles::create_profile` with a PIN argument hashes and stores it.
- `profiles::cmd_create_profile` → `ProfileView` has `pin_required: true` when PIN supplied, `false` when None.
- `profiles::set_profile_pin` requires correct current PIN if one is set.
- `profiles::remove_profile_pin` requires correct current PIN.

### TS unit (`vitest`)

- `profileApi.create` forwards `pin` to `invoke`.
- `profileApi.openProfileWindow` forwards `pin` to `invoke`.
- `profileApi.setPin` and `removePin` payload shapes.
- `<PinInput>` — auto-advances, accepts only digits, fires `onComplete` at length 4, `shake` triggers the animation class.
- `<UnlockSheet>` — happy path (correct PIN → openProfileWindow called), wrong PIN → PinInput shakes and clears, locked → input disabled with countdown.
- `usePickerData.select` — opens UnlockSheet when `pinRequired`, calls openProfileWindow directly otherwise.

### Manual integration

- Create a locked profile, close picker, reopen, click locked tile, enter PIN → window opens.
- Enter wrong PIN 3 times → 30 s lockout countdown appears and persists.
- During lockout, close picker, reopen → countdown still active (because lockout state is in-memory in Rust, surviving picker close).
- Restart the app → lockout cleared (in-memory state lost).
- Set PIN on an unlocked profile via "···" menu → lock badge appears on the tile.
- Change PIN with correct current → succeeds. With wrong current → wrong_pin error.
- Remove PIN with correct current → lock badge disappears.
- Delete a locked profile from "···" menu → profile and its data dir are wiped without PIN required (consistent with the "no recovery" decision).

## Migration

No migration required. Existing profiles get `pin_hash: None` on next read because the field defaults to `Option::None` when the JSON doesn't include it. Add `#[serde(default)]` on `pin_hash` to be explicit:

```rust
pub struct Profile {
    // ...
    #[serde(default)]
    pub pin_hash: Option<String>,
}
```

`profiles.json` files written by v1.0 lack the key entirely. `profiles.json` files written by v1.5 include `"pinHash": null` for unlocked profiles. Both round-trip correctly.

## Acceptance criteria for PIN v1.5

- ✅ User can create a profile with a 4-digit PIN. Tile shows a lock badge.
- ✅ Clicking a locked tile opens an UnlockSheet; correct PIN opens the window, wrong PIN refuses.
- ✅ 3 consecutive wrong PINs trigger a 30 s lockout; the UnlockSheet disables input and shows a live countdown.
- ✅ Lockout state persists across closing and reopening the picker window (within the same app session).
- ✅ Lockout state clears on app restart.
- ✅ User can set a PIN on an existing unlocked profile via the tile menu.
- ✅ User can change a PIN by entering the current one followed by the new one.
- ✅ User can remove a PIN by entering the current one.
- ✅ Locked profiles can be deleted without PIN (recovery path). Data dir is wiped.
- ✅ `cmd_list_profiles` returns `ProfileView` objects with `pinRequired: bool` and no `pinHash`.
- ✅ `open_profile_window` refuses a locked profile when the `pin` argument is missing or wrong, even when called directly via devtools.
- ✅ Existing v1.0 profile registries load without errors after upgrade (no `pin_hash` field → defaults to `None`).
- ✅ All existing v1 acceptance criteria still pass (no regressions in the cookie-isolation picker behaviour).

## Open questions / known gaps

None blocking. Items deferred:

- Master backup password / forget-PIN recovery → v1.6+ if user demand surfaces.
- Biometrics (Windows Hello / Touch ID) → v2.0; needs platform-specific plugins.
- Per-tab or per-site auth gating → out of scope.
- Persistent rate-limit state across restarts → out of scope (in-memory is enough for a UX gate).
- True encryption-at-rest of profile data dir → v2.0; needs a custom storage layer or OS-level filesystem hooks for WebView2.
