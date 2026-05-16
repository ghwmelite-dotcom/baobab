# Ad-blocker bundled resources

These files are compiled into the Baobab desktop binary via `include_str!`
in `apps/desktop/src-tauri/src/adblock.rs`. They serve as the offline
fallback / first-launch snapshot. The runtime can refresh
`hostnames.txt`-equivalent data from upstream (EasyList) into the
on-disk cache at `$APP_DATA/baobab/adblock/payload.json` — but
`youtube.js` and `engine.js` ship only via app releases.

## Refreshing `hostnames.txt` manually

The committed list is extracted from EasyList + EasyPrivacy `||domain.tld^`
rules. To regenerate:

1. Download <https://easylist.to/easylist/easylist.txt> and <https://easylist.to/easylist/easyprivacy.txt>.
2. From each file, take lines matching `^\|\|([^\^/\*$]+)\^` and extract the
   captured hostname.
3. Deduplicate, sort, write one per line to `hostnames.txt`.
4. Commit. App update ships the new list to all users.

## YouTube scriptlets (`youtube.js`)

Hand-curated patches that run when `location.hostname` is a YouTube domain.
They strip `adPlacements` from `/youtubei/v1/player` response, CSS-hide
ad slot containers, and auto-click skip buttons. Maintenance burden:
when YouTube changes their player API or DOM, these need updating.

## Engine (`engine.js`)

The generic init-script body. Receives a `BAOBAB_ADBLOCK` global with
`{ blockedHostnames, youtubeScriptlets, lastUpdated, source }` and
installs hooks on fetch / XHR / Image / MutationObserver. Should change
rarely; structural-only.
