# Baobab Desktop — Tauri shell

This package builds the native shell that wraps the Vite renderer at
`../dist`. Run `npm run tauri dev` from `apps/desktop/` to launch.

## Toolchain

CI runners (`desktop-release.yml`) build with the default MSVC toolchain.

This dev box uses MinGW-w64 because the local MSVC install is incomplete
(see `plan_deviations.md` "Task 11"). To match locally:

- Install MSYS2: `winget install MSYS2.MSYS2`
- Install GCC + binutils: `C:/msys64/usr/bin/pacman.exe -S --noconfirm mingw-w64-x86_64-gcc mingw-w64-x86_64-binutils`
- Add the GNU std lib: `rustup target add x86_64-pc-windows-gnu`
- Set `CARGO_BUILD_TARGET=x86_64-pc-windows-gnu` in your shell profile (or pass `--target x86_64-pc-windows-gnu` on every cargo command).
- Add `C:\msys64\mingw64\bin` to your PATH so the linker can find auxiliary tools at link time.

The committed `.cargo/config.toml` carries only the linker path for this target — harmless on other platforms.

## Icons

See `icons/README.md`. Placeholder amber-with-"B" icons; replace before user release.
