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
