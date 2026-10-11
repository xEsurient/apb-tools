# APB Reloaded tools

Static fan-made tools for APB Reloaded, served with GitHub Pages:

- **Map viewer** (`maps/`): every district in 2D and 3D.
- **Config merge** (`config/`): keep localisation configs in sync with the game.
- **Image lookup** (`images/`): find the right image markup for localisation text.
- **Text designer** (`designer/`): generate stat texts from the game's data, colour tools and a localisation editor.

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

## Text designer

Previews look like the game: item tooltips carry the item's own icon, every `<Images:>`, `<APB_Images:>`,
`<hudtexture:>` and `<hudicon:>` in a line shows the real picture (with its `<ImageColour:>` tint), HUD text is shown
over the game's own background and street names over the minimap. Pictures come from the Image lookup's data.

**Game folder** (top of the page): pick your APB game folder (or just `APBGame/Localization`). The page lists the files
but reads only the localisation files in `APBGame/Localization/INT` and `GER`; nothing is uploaded (the browser may
still ask to confirm "uploading" the folder: it only means the page may read it). With a folder set, the Generators
and Presets merge into your GER files automatically (a file without a GER copy starts from the game's full English
INT file and is saved as GER), and the Editor lists every INT/GER file to open.

Builds localisation text from the game's own item, role, contact and mission data, so the numbers match the game.
The data file (`designer/data.json`) is kept current by a weekly GitHub Action that pulls [APBDB](https://apbdb.com) (`.github/workflows/sync-apbdb.yml`, also runnable by hand from the Actions tab with
"force"); the page shows which APBDB version it holds. Pick a generator, set it up, optionally pick your own file to merge into, then **Download**. Changed lines
are replaced in place, missing ones are added to the right section, and the file keeps its encoding (UTF-16 for INT/GER
files). Your settings are remembered in the browser.

| Generator | File | What it writes |
|---|---|---|
| Weapon stats | `WeaponItemTypes` | time/shots to kill (or stun), past-falloff shots, damage, stamina/hard damage, rate of fire, magazine, reload, equip, range, built-in modifications |
| Vehicle stats | `VehicleItemTypes` | health, top/reverse speed (m/s and km/h), cargo, explosion, built-in modifications |
| Item name colours | `InventoryItemTypes` | weapon names coloured by shop category, modification names by slot (solid, stepped, smooth, triple, rainbow, font) |
| Modification descriptions | `ModifierItemTypes` | slot heading plus the modification's effect lines |
| Player roles | `PlayerRoles` | every rank with the total needed and its rewards |
| Role rank titles | `RoleMilestones` | the total needed after each rank title |
| Contact descriptions | `Contacts` | what each contact level unlocks (standing, items, cash) |
| Daily activities | `DailyActivityContacts` | reward names in titles, recoloured or shortened HUD lines |
| Mission stage briefs | `TaskObjectives` | a compact list of all stages with counts and time limits, the current stage highlighted |
| Reload, resupply & tutorial | `APBUserInterface` | styled RELOAD / RESUPPLY / TUTORIAL words |

How the numbers are worked out:

- **Time to kill** is the time from the first to the last shot needed, with every shot (and every shotgun pellet) hitting:
  1000 health, or 1000 stamina for less-than-lethal weapons. Burst weapons wait their burst interval after each
  burst; weapons with a wind-up add it. Mission stages with no time limit set use the 5:00 default. **Shots to kill past falloff** uses the weapon's minimum damage percentage.
- **Built-in modifications** (for example the UL-3 'Jersey Devil' Speed Demon Special, +10% fire rate) are applied:
  fire rate, damage, magazine, ammo, reload, equip time and range. Turn this off to see the base weapon.
- Rocket launchers, grenade launchers and grenades show explosion damage, stamina damage and blast radius.
- Role ranks show what each rank needs and the running total for the whole role, e.g. `Rank 2: 30 kills // 42 total kills`.

**HUD text vs UI text**: HUD text files (`DailyActivityContacts`, `TaskObjectives`, `HUDMessages`, `PopupDialogs`, …)
only understand the game's colour names (`<col:Yellow>…</col>`) and ignore `<Fonts:>`; UI text files take any colour
(`<Color:R=1 G=0.6 B=0>…<Color:/>`) and fonts. The designer picks the right form for each file.

**Presets**: pick a bundle and download one merged config zip. **Custom colours** asks for three colours, a main
colour (a game colour name such as `Valentine_Pink`, or any hex code), a friendly and an enemy colour (as in the kill
feed), and themes every file with them: current mission stage, daily values, kill and rank lines, equipment, HUD
highlights and combat names. **Fine-tune** on a file opens its generator with those settings for detailed changes; the
file then uses your Generators-tab settings ("My settings"). Other bundles: Clean stock, Designer default, six colour sets
in the style of iazer's APB CFG Loader (Dark Blue/Dark Red, Green/Red, Grey/White, Light Pink, Hot Pink, Purple) and
the writch style. Every file can then be switched on its own: daily activities, mission briefs (stage list, stage chain
with item sizes, "Current Stage / Next Stage", "Current | Next | … until the last stage"), mission titles with the
equipment needed (as names or as the game's equipment icons), weapon and vehicle stat sheets, role ranks, item name colours, weapon categories (your layout from
the Weapon categories tab), HUD and combat messages, one-letter chat tags, objective names and street/block/beacon
names. The **Event: show street names** switch turns street, block and beacon names back on over any preset (handy
for finding the next pumpkin in the Halloween event), in white, the iazer small font, the bundle colour or your own
colour, opacity and font. The styles are recreated from the game's own text and data; no file from those packs is
included. Pick your config zip to merge into. Every file is written as UTF-16 with its `[Section]` header (some
community packs ship `TaskObjectives` without one, which the game likely ignores).

Mission stage lists name every objective the way the community configs do (Capture, Raid, Drop Off, Scav, Point Hold,
Item Hold, Car Theft, Car Loot, Hack, Invest, …); the **Wording** switch selects the iazer / writch words instead (Drop,
Area, Investigate, Spray, Vandal).

**Weapon categories**: lay out the weapon category lists of the deploy screen (primary weapons), the inventory and the
Joker store on an inventory-style panel. Drag the categories (or use ▲ ▼) into your order, rename them, colour them
(solid, smooth, triple, rainbow) and prefix each with a weapon icon. The icon picker lists the weapons of that category
(or all weapons) by name with their kill-feed or inventory icon, or every weapon icon texture; an icon can be tinted
(`<ImageColour:>`, multiplies the picture) and **Default icons for empty categories** fills the rest in one click.
Sample weapons of the selected category are shown next to the list. The lists sort categories by their name text, so every name starts with an invisible sort
key, `<Color:F=00 A=1>`, `<Color:F=01 A=1>` … (the colour tag ignores `F=`; the same method the community configs
use), or with visible numbers if you prefer. The Valentines and Christmas categories are included; the game gives them
no shop, so they normally do not appear. Download writes `ShopUIFilters` (merged into your file if you pick one) with
every list you edited.

Gun Game and event weapons (Legacy and Gun Game sets, snowball and egg launchers, Ghostly Flare Gun, …) are part of
the weapon stats and name generators; their preview can be hidden with one switch.

Other tabs: **Colours** (converter between HEX/RGB/APB tags with the nearest game colour name, gradient maker, all 208
game colour names), **Editor** (open any INT/GER file, search, edit with live preview, recolour or find/replace many
lines at once, save with the original encoding) and **Stat tables** (sortable weapon and vehicle tables).

## Run locally

Any static file server works, e.g. `python3 -m http.server` in this folder, then open http://localhost:8000.
Opening the pages straight from disk does not work (the browser blocks loading the data files).

## Credits

- iazer: [APB CFG Loader](https://github.com/lvzxr/apb-cfg-loader)
- writch: [writchcraft/apb](https://github.com/writchcraft/apb)
- Speed: [APBDB](https://apbdb.com/) (API)

Unofficial fan tool. APB Reloaded and all game content belong to their owners.
