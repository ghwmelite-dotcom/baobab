# Baobab Desktop Smoke Checklist (v0.0.1)

Run on each OS for which a build artifact exists.

## Launch
- [ ] App launches in <3s on the dev box (cold start)
- [ ] Window opens at 1280×800, centered
- [ ] No native frame; custom titlebar shows "Baobab" left + min/max/close right (Win/Linux)
- [ ] Window drag works from titlebar empty area
- [ ] Min/Max/Close buttons all respond

## Theme
- [ ] Background uses Sahel canvas color (#15110d on dark)
- [ ] Text is warm-white, not pure white
- [ ] No emoji visible anywhere
- [ ] Reducing motion in OS settings disables all transitions

## Tabs
- [ ] Click `+` opens a new about:blank tab → NTP visible
- [ ] Type `github.com` + Enter in omnibar → page loads in active tab
- [ ] Open 5 tabs total — no leaks (Task Manager / Activity Monitor: stable RAM)
- [ ] Click between tabs — only the active webview is visible
- [ ] Close tab via `×` or Ctrl/Cmd+W — neighbor becomes active
- [ ] Ctrl/Cmd+T opens new tab; Ctrl+Tab cycles forward

## Omnibar
- [ ] Ctrl/Cmd+L focuses & selects the input
- [ ] `bus from accra to kumasi` → DDG search loads
- [ ] `https://example.com` is preserved as-is

## Status bar
- [ ] Within 2s of launch, residency shows "Home · {colo}" or "Roaming · {colo}"
- [ ] "Low bandwidth: auto" toggle to "on" / back to "auto"
- [ ] Ads counter shows `0 blocked` (real adblock is in P0b)

## NTP
- [ ] Visible when no tab active or active tab is about:blank
- [ ] Wordmark uses Recoleta (or General Sans Bold fallback if Recoleta isn't bundled)
- [ ] 6 capability cards visible

## P0b additions (v0.1.0)

### Auth
- [ ] Email signup completes; tokens persist across app restart
- [ ] Email login on a second machine restores session
- [ ] Phone OTP send + verify works (requires real Africa's Talking / Twilio creds in production)
- [ ] Logout from Settings clears session; AuthScreen reappears

### AI sidebar
- [ ] Ctrl/Cmd+\ toggles sidebar
- [ ] Typing in composer + Enter starts a streaming response
- [ ] Streamed tokens render incrementally; scroll-to-bottom works
- [ ] Model selector switches between Llama 70B / 8B / DeepSeek 32B
- [ ] Quick action "Summarize" on a real article returns a summary + key points

### Omnibar AI search
- [ ] Multi-word query opens sidebar and shows AI answer + 5–8 ranked sources
- [ ] Top results include African sources when query is Africa-relevant
- [ ] Blocked schemes (javascript:, data:, file:) fall through to AI search rather than navigating

### Reader Mode
- [ ] Reader toggle on omnibar opens Reader Panel
- [ ] Title, body, AI summary, ads_blocked all render
- [ ] "Save offline" button persists the article; appears in Saved drawer

### Offline articles
- [ ] Status-bar "Saved" toggle opens the side drawer
- [ ] Items list with title/url/min count
- [ ] Delete works

### History
- [ ] Visited pages appear in History drawer
- [ ] Omnibar typing shows top-5 history matches as a dropdown
- [ ] Clicking a suggestion navigates the active tab
- [ ] Clear all empties the drawer

### Bookmarks
- [ ] Star icon in omnibar toggles bookmark for current page (filled when bookmarked)
- [ ] BookmarksBar shows top-level bookmarks; click navigates
- [ ] BookmarksPanel drawer groups bookmarks by folder

### Settings
- [ ] Cmd/Ctrl+, opens Settings overlay
- [ ] Toggle privacy_mode — POST /api/history skips on next visit
- [ ] Toggle low_bandwidth_mode — next AI call uses the 8B model
- [ ] Change default model — persists across restart
- [ ] Sign out from Settings clears session

### Auto-updater
- [ ] (After signing key generated + manifest server deployed) A tagged release triggers update detection on next launch
- [ ] Toast appears bottom-right with Install + Later buttons
- [ ] Install button downloads and relaunches the app
