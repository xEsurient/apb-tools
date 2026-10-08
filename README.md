# APB Reloaded tools (web)

Two static web tools for APB Reloaded. There's no server and no build step: they run in the browser and can be
hosted on GitHub Pages as they are.

| Tool | What it does |
|---|---|
| [Config merge](config/) | Compares a localisation config (e.g. a German `.GER` pack) with the game's English `INT` files. It adds the missing lines at the right places, optionally adds whole missing files, and gives the config back as a zip with a `SUMMARY.md` of what was added to which file. Your files stay in your browser. |
| [Map viewer](maps/) | Every district and map in 2D (pan, zoom, search, object details) and 3D (fly through the districts with a 2D minimap). |

## Using the config merge
1. **Reference:** pick your game's `APBGame/Localization/INT` folder, or a zip of it. The files are read locally and
   not uploaded. Without it, item names (`InventoryItemTypes`) can still be checked against
   [APBDB](https://apbdb.com), whose item list uses the same row names as the game's keys.
2. **Your config:** pick its zip or folder. Files are paired by name (`APBGame.GER` ↔ `APBGame.int`).
3. **Compare.** Click a file for a line-by-line list:
   | Status | Meaning |
   |---|---|
   | `added` | missing in your file; the game's English line is inserted |
   | `duplicate-in-custom` | your file repeats the key |
   | `only-in-custom` | the key isn't in the game's file: a typo or a custom key, which the game ignores |
   | `changed` | translated or edited |
   | `same-text` | same as the reference, possibly untranslated |
4. **Download the merged config.** The zip keeps the original folders, and the reports are in `_merge_report/`.

How the merge works:
- **Placement:** a missing key goes after the nearest preceding key of the same section that your file already has;
  a missing section is inserted whole.
- **Nothing else changes:** existing lines stay as they are, along with the file's encoding (UTF-16 with BOM, as the
  game uses) and line endings.
- **Repairs:** some stock INT files have damaged UTF-16 line endings. They are repaired when read, and the report
  says so.

## Using the map viewer
- **2D:** drag to pan, use the wheel to zoom, and click an object for its details. Search by name, label or class,
  and tick or untick object kinds.
- **3D:** drag to look around, use WASD or the arrows to move, Q/E to go down/up, Shift to go faster and the wheel to
  change speed. The "Top view" and "Overview" buttons reposition the camera; click the minimap to jump there.
- **Both ways:** "View in 3D" on an object, or a double-click on the 2D map, flies the 3D camera to it.

The map data in `maps/data/` comes from the game's own map files:

| File | Contents |
|---|---|
| `<district>.json` | object placements: position, rotation, scale, class, name, beacon label |
| `meshes_<n>.bin` | simplified, untextured models: buildings at their second level of detail, 16-bit positions, one colour per material taken from its texture |
| `meshes.json` | the index of those models |

That comes to about 50 MB for 9 districts, 222,000 placements and 3,990 models.

## Hosting
Push this folder to a GitHub repository and turn on **Settings → Pages → Deploy from a branch** (root). The
`.nojekyll` file makes GitHub serve the folders as they are. Locally, any static server works, for example
`python3 -m http.server`, then open http://localhost:8000. Opening the files directly with `file://` doesn't work,
because browsers block module scripts and data loading there.

## Credits and notice
This is an unofficial fan project. APB Reloaded, its maps, models and texts belong to their owners; the map data is
derived from the game files for reference. Item names can be loaded live from APBDB. three.js (MIT, `vendor/`) is
used for the 3D view.
