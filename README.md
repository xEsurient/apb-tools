# APB Reloaded tools

Static fan-made tools for APB Reloaded, served with GitHub Pages:

- **Map viewer** (`maps/`): every district in 2D and 3D.
- **Config merge** (`config/`): keep localisation configs in sync with the game.
- **Image lookup** (`images/`): find the right image markup for localisation text.

## Config merge

Pick the game's `APBGame/Localization/INT` folder as the reference and your config as a zip or folder; the page adds
the lines your files are missing (in English, ready to translate) and gives the merged config back as a zip.

**Add the lines the game defines but its INT files leave out** (on by default) also adds 517 lines from the game's
design data that the game's own INT files lack: mission titles and mission briefs (`MissionTemplates`,
`TaskObjectives`), the Infected Pumpkin event texts and a few team names. Some belong to test missions; turn the
option off to compare against the INT files only.

## Image lookup

Browse every image you can put into APB Reloaded localisation text and copy the exact markup for it.

- **Images**: textures and materials of the game's UI packages, as `<Images:Package.Group.Name;Resize=TRUE XL=16 YL=16>`.
- **HUD textures**: named HUD textures, as `<APB_Images:Name;XL=16 YL=16 Resize=TRUE HUDTexture=TRUE>` (UI text files)
  or `<hudtexture:Name;Resize=TRUE XL=16 YL=16>` (HUD message files).
- **HUD icons**: named HUD icons built from the icon atlas, as `<APB_Images:Name;…HUDIcon=TRUE>` or `<hudicon:Name;…>`.
- **Icon atlas**: every 32×32 cell of the HUD icon atlas with the names that use it.

**Animate** (top bar) plays the 49 animated materials and flipbooks in the grid; the **▶ Animated** group lists
them, and the detail view has its own Play / Pause button. The animations are rendered from each material's node
graph (time, panning, rotation, pulsing, texture switching) with the game's default parameter values, so they are a
close approximation, not a capture from the game. Materials the game only animates through values it sets while
playing (progress circles, hit indicators, the radar compass) stay still.

Click an image to open the line builder (size, `Resize`, optional `<ImageColour:…>` tint, UI text or HUD message
form), then **Copy to clipboard**. With **Resize** ticked, the preview takes the XL × YL shape, so you can see how stretched the image
will look. Double-click an image to copy its line with the current settings.

### Which files take which tags

- UI text files (e.g. `APBUserInterface`, item type files, `HudGroupStates`, `HUDMarkerVisualText`):
  `<Images:>`, `<APB_Images:>`, `<ImageColour:>`.
- HUD message files (`HUDMessages`, `TaskObjectives`, `PopupDialogs`, `DailyActivityContacts`, …):
  `<hudtexture:>`, `<hudicon:>`. `<Images:>` does not work there.

Localisation keys must match the game's English (`INT`) key exactly, or the line is ignored.

### Notes

- Images come from the current retail client. HUD texture names, HUD icon names and their atlas layers come from the
  current client's own design data (3,349 HUD textures, 405 HUD icons), so every name in the list exists in the game
  and its picture is the one the game uses. Two HUD textures point at effect textures outside the UI packages and
  have no preview; five HUD icons have no atlas layers and draw nothing.
- Material previews show the material's main texture; in game the material may animate or tint differently.
- Atlas cells list the HUD icons that use them. Cells no HUD icon uses only show their atlas layer name (e.g.
  `Task_Diamond`), which the markup does not accept: icons are only addressable by HUD icon name, and the markup
  cannot select part of the atlas.
- With **ImageColour** ticked, every preview is tinted with the chosen colour and alpha (multiplied, like the game).

## Run locally

Any static file server works, e.g. `python3 -m http.server` in this folder, then open http://localhost:8000.
Opening the pages straight from disk does not work (the browser blocks loading the data files).

Unofficial fan tool. APB Reloaded and all game content belong to their owners.
