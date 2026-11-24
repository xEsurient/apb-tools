# APB Reloaded tools

Static fan-made tools for APB Reloaded, served with GitHub Pages:

- **Map viewer** (`maps/`): every district in 2D and 3D. The 2D map rotates in 90° steps (buttons under the zoom, or R / Shift+R; the arrow points to the original top and resets).
- **GeoGuesser** (in `maps/`): you are dropped at street level somewhere in a district; find the spot on the map.
- **Config merge** (`config/`): keep localisation configs in sync with the game.
- **Image lookup** (`images/`): find the right image markup for localisation text.
- **Text designer** (`designer/`): generate stat texts from the game's data, colour tools and a localisation editor.
- **Stat tables** (`stats/`): sortable weapon and vehicle stats and a modification comparison.

## GeoGuesser

Press **GeoGuesser** in the map viewer's top bar.

- **Daily challenge**: 5 rounds on two of the six maps, the same spots for everyone on the same day (UTC). Your first attempt of the
  day is saved in this browser from the first guess on: leaving and coming back continues it where you left off (it
  can't be restarted). Replays after that, and replays of earlier days, are not saved and don't touch your free-play bests.
- **Free play**: pick the map (or Mixed: two maps picked at random per game, which keeps the download down; a big
  district is about 25 MB), 3 / 5 / 10 rounds, a time limit, walking, hard mode and the spot types
  (streets, alleys, open areas, rooftops, indoors).
- **A round**: drag to look around, wheel (or pinch) to zoom. With walking on you can move up to 40 m with WASD / the
  arrow keys (Shift runs) after confirming: every metre walked takes 25 points off that round's 5,000 maximum
  (4,000 at 40 m), and walking back does not raise it again. Walls stop you and you can't walk off roofs. On phones and tablets an on-screen joystick does the walking. Press **G** (or **Guess on the
  map**) to open the map, click to drop a pin, **Guess** (or Enter) to confirm; **G** goes back to the street.
- **Score**: up to 5,000 per round, falling with the distance and scaled to the district's size, so the small maps are
  as hard as the big ones (on Waterfront: 25 m off ≈ 4,380, 100 m ≈ 2,940, 500 m ≈ 350). Within 3 m you get the maximum.
  The reveal shows the distance (also on the map, with a ring around the spot at your distance), the area the spot is
  in, whether your pin landed in the same one, and which way the view faced at the start (green arrow).
- **Hard mode**: no icons, labels or tooltips on the guessing map (the map imagery stays).
- The daily card shows how long until the next daily, your streak (days in a row), your best streak and a calendar of
  the last 10 weeks (coloured by your average points per round).
- **Your stats** (tab in the GeoGuesser card): rounds, average points, average distance and best per map and per spot
  type. Replays of spots you already played don't count; Reset clears them.
- On phones and tablets a joystick appears for walking (with a Run toggle); walking still has to be confirmed first.
- **View the spot** (after a guess) shows the guesses as labelled pins in 3D (yours and, in a challenge, the other
  players') and turns towards your guess.
- A plain `#geo` link (e.g. `maps/#geo`) opens the GeoGuesser card.
- **Copy result** copies a share line such as
  `APB GeoGuesser · Daily 2026-11-12 · Waterfront + Crate · 18,420 / 25,000 🟩🟩🟨🟥🟩 <link>`
  (🟩 4,000+, 🟨 2,000+, 🟧 500+, 🟥 less, ⬛ no guess, 🚶 walked that round, 🔒 hard mode).
- **Challenge friends / Pass it on**: the link holds the spots, the settings and every player's guesses. A friend opens
  it, plays the same spots (other players' pins show only after their own guess in each round) and passes the new link
  on. Two people playing the same link make two links: the page remembers every player it has seen for a challenge,
  so opening both shows one scoreboard. Each name counts once, with its best game. **Rematch with new spots** (after a
  challenge) starts a game with the same settings on new spots, which you can then pass on as a new challenge. There is no server: links and browser storage are all there is, and nothing
  stops anyone from editing a link, so keep it friendly.

**Daily schedule**: the daily spots are listed per date in `maps/data/daily.json`, about a year ahead, so new spot data
never changes a day that is already scheduled (a date that isn't listed falls back to a pick made from the date). The
**GeoGuesser daily schedule** workflow (`.github/workflows/geo-daily.yml`, script `.github/scripts/geo-daily.mjs`) runs on
the 1st of every month and tops the list up to 365 days ahead, committing as *GeoGuesser*; it only adds days, never
changes existing ones. Run it by hand from the Actions tab: **force** tops up right away, **rebuild_from** (a date after
today) redoes every day from that date on, e.g. after new spot data. Locally: `node .github/scripts/geo-daily.mjs
[--force] [--rebuild-from=YYYY-MM-DD]`. GitHub can switch off scheduled workflows in repositories without activity for
60 days; if that happens, re-enable it in the Actions tab (the list still covers the rest of the year). When `maps/data/geo.json` changes on the default branch (new spot data), the workflow runs by itself and
redoes every day from three days ahead (today and the next two days stay as they are).

**Bot data and uploads**: the two Actions update `designer/data.json` and `maps/data/daily.json` in the repository, so a
local copy of the site soon holds older versions of those two files; uploading them would undo the bots' work. Before
uploading, take those two files from the repository, or leave them out: a web upload only adds or replaces the files
you drop in, so the repository keeps the bots' copies. Don't add them to `.gitignore`: the bots commit them with git, and
the site is served from the repository's files. Optional, to avoid this completely: set the
repository variable `DATA_BRANCH` (Settings > Secrets and variables > Actions > Variables, e.g. `site-data`) and switch
**Settings > Pages > Source** to **GitHub Actions**. The bots then commit to that branch only, and the **Deploy site with
the bot data** workflow publishes your branch with the bot files laid over it, so uploads can never overwrite them.
Without the variable everything works as before. In data-branch mode the branch copies always win, so a
`designer/data.json` or `daily.json` you rebuild locally only takes effect once you upload it to the data branch
itself (or run the matching workflow there). **DB Update APBDB** skips APBDB versions that are not newer than the held
data; **force** re-syncs the same version, and **allow_older** (with force) is needed to accept an older APBDB version
over the game data. A run where APBDB fails part-way still saves what it got but does not mark the version as synced,
so the next run tries again.

The spots (`maps/data/geo.json`) are made automatically from the map data: a top-down height map of every district
finds flat ground near streets and flat roofs, then each spot is checked by rendering the scene around it (floor under
the feet, distance to walls in 32 directions, sky above or not). Only directions with a view are used for the start
facing. A spot list made for older map data is ignored for that district.

## Config merge

Pick the game's `APBGame/Localization/INT` folder as the reference and your config as a zip or folder; the page adds
the lines your files are missing (in English, ready to translate) and gives the merged config back as a zip.

**Add the lines the game defines but its INT files leave out** (on by default) also adds 513 lines from the game's
design data that the game's own INT files lack: mission titles and mission briefs (`MissionTemplates`,
`TaskObjectives`), the Infected Pumpkin event texts and a few team names. Some belong to test missions; turn the
option off to compare against the INT files only.

**Previous game version** (optional, step 3): give the INT files of the game version your config was made for, and
the report lists your lines whose English original changed in the update (old English, new English, your text), so
you can see which translations or restyled lines may be out of date. **English changed (.csv)** saves that list as a
spreadsheet (file, section, key, old English, new English, yours).

Each step has a **Clear** button. When you pick a whole folder, only localisation files (and zips) are read for the
reference and the previous version, so picking a bigger folder by mistake stays quick; for your config, other files
over 5 MB are left out (the info line says so). Zips are checked while reading: damaged entries (checksum mismatch),
password-protected entries and ZIP64 archives give a clear error instead of a broken merge.

Options (off by default; press Compare again after changing them):
- **Update lines that are still the old English** (needs step 3): a line whose text is exactly the previous version's
  English, where the game's English has since changed, gets the new English. Even when it is off, the summary shows how
  many such lines there are.
- **Remove lines the game's files don't have** (keys only in yours; never for .ini/.txt files) and **Remove repeated
  keys in a section** (keeps the first copy: that is
  the one this page reads; which copy the game reads is not confirmed).
Every removed or updated line is listed in the detail view, the per-file report and SUMMARY.md. The detail view also
shows every inserted block with two lines of context, and marks added lines that come from the game's design data.

## Image lookup

Browse every image you can put into APB Reloaded localisation text and copy the exact markup for it.

- **Images**: textures and materials of the game's UI packages, as `<Images:Package.Group.Name;Resize=TRUE XL=16 YL=16>`.
- **HUD textures**: named HUD textures, as `<APB_Images:Name;XL=16 YL=16 Resize=TRUE HUDTexture=TRUE>` (UI text files)
  or `<hudtexture:Name;Resize=TRUE XL=16 YL=16>` (HUD message files).
- **HUD icons**: named HUD icons built from the icon atlas, as `<APB_Images:Name;…HUDIcon=TRUE>` or `<hudicon:Name;…>`.
- **Icon atlas**: every 32×32 cell of the HUD icon atlas with the names that use it.

Selecting an image puts it in the address (`#tab/group?item=…`), so **Copy link** (next to Copy to clipboard) shares the
exact image; opening such a link selects it. **Recently copied** (top bar) keeps the last 12 markups you copied in this
browser: click one to copy it again, Clear empties the list.

**Animate** (top bar) plays the 50 animated materials and flipbooks in the grid; the **▶ Animated** group lists
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
and Presets merge into your GER files automatically (a file without a GER copy becomes a new GER file holding only
the new lines; the game keeps its English text for the rest. Presets can start from the full English file instead, but
that freezes every line against later game updates), and the Editor lists every INT/GER file to open.

**Your config** (next to it): pick your config zip (or loose INT/GER files). Its files win over the game folder, the
same way your GER files win over the game's INT text in game. With a config or folder set, the page previews what you
have in game: Generators show your current line under each new one ("yours"), Presets show your text for files left on
Game default, and the Editor lists your files and previews each line in its in-game context (HUD bar, map labels,
tooltip, filter list, chat), optionally with the game's default line underneath.

Builds localisation text from the game's own item, role, contact and mission data, so the numbers match the game.
The data file (`designer/data.json`) is kept current by a weekly GitHub Action that pulls [APBDB](https://apbdb.com) (`.github/workflows/sync-apbdb.yml`, also runnable by hand from the Actions tab with
"force"); the page shows which APBDB version it holds. Pick a generator, set it up, optionally pick your own file to merge into, then **Download**. Changed lines
are replaced in place, missing ones are added to the right section, and the file keeps its encoding (UTF-16 for INT/GER
files). Your settings are remembered in the browser.

| Generator | File | What it writes |
|---|---|---|
| Weapon stats | `WeaponItemTypes` | time/shots to kill (or stun), past-falloff shots, damage, stamina/hard damage, rate of fire, magazine, reload, equip, range, built-in modifications |
| Vehicle stats | `VehicleItemTypes` | Max Health, Max Speed and Max Reverse Speed (m/s and km/h), Cargo Capacity, Explosion Max Damage, Explosion Radius, EMP Vulnerability (%, Immune at 0), built-in modifications |
| Item name colours | `InventoryItemTypes` | weapon names coloured by shop category, modification names by slot (solid, stepped, smooth, triple, rainbow, font); tick several groups (or Select All / Weapons / Mods) to style them together, or apply one style to all groups |
| Modification descriptions | `ModifierItemTypes` | slot heading plus the modification's effect lines, with your own colours for positive / negative values and the effect text, and a font |
| Player roles | `PlayerRoles` | every rank with the total needed and its rewards |
| Role rank titles | `RoleMilestones` | the total needed after each rank title |
| Contact descriptions | `Contacts` | what each contact level unlocks (standing, items, cash) |
| Daily activities | `DailyActivityContacts` | reward names in titles, recoloured or shortened HUD lines |
| Mission stage briefs | `TaskObjectives` | a compact list of all stages with counts and time limits, the current stage highlighted |
| Reload, resupply & tutorial | `APBUserInterface` | styled RELOAD / RESUPPLY / TUTORIAL words |

How the numbers are worked out:

- **Time to kill** is the time from the first to the last shot needed, with every shot (and every shotgun pellet) hitting:
  1000 health, or 1000 stamina for less-than-lethal weapons. Burst weapons wait their burst interval after each
  burst; weapons with a wind-up add it; when more shots are needed than the magazine holds, each reload is added
  (e.g. the PDW57-S). **Shots to kill past falloff** uses the weapon's minimum damage percentage.
- **Mission stage times**: stages with no time limit set use the 5:00 default.
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
in the style of iazer's APB CFG Loader (Navy / Dark Red, Green / Red, Black / White, Pink / White, Red / White, Blue / White, named by their actual colours) and
the writch style. Every file can then be switched on its own; **Preset** follows the selected bundle, so the
same choice gives the designer, iazer or writch look depending on the bundle. Files: daily activities, mission briefs (stage list, stage chain
with item sizes, "Current / Next", labels in white), mission titles as Title [Equipment] or
Title [Equipment Icons], weapon and vehicle stat sheets, role ranks, item name colours, categories (your layout from
the Categories tab), HUD and combat messages (kill-feed names in the bundle's friendly / enemy colours, highlights and
error messages in its main colour), one-letter chat tags, objective names and street/block/beacon names (small font,
a HUD icon in place of the name like writch's config, a **Custom image** from the image picker with or
without the name, or hidden). The street preview places street, block and beacon labels on a map at game size. The **Event: show street names** switch turns street, block and beacon names back on over any preset (handy
for finding the next pumpkin in the Halloween event), in white, the iazer small font, the bundle colour or your own
colour, opacity and font. The styles are recreated from the game's own text and data; no file from those packs is
included. Pick your config zip to merge into. Every file is written as UTF-16 with its `[Section]` header (some
community packs ship `TaskObjectives` without one, which the game likely ignores).

Mission stage lists name every objective the way the community configs do (Capture, Raid, Drop Off, Scav, Point Hold,
Item Hold, Car Theft, Car Loot, Hack, Invest, …); the **Wording** switch selects the iazer / writch words instead (Drop,
Area, Investigate, Spray, Vandal).

**Categories**: every category list of the game on an inventory-style panel: weapon tabs (deploy, inventory, Joker),
wardrobe clothing types (Belts: High / Loose / Low …), inventory, Fixer, deploy, armory and Joker store filters
(`ShopUIFilters`) and the marketplace names (`InventoryItemInfraCategories`, published rows). Drag the categories (or
use ▲ ▼) into your order, rename them, colour them (solid, smooth, triple, rainbow) and put an image in front of each,
or use the image alone. The image picker offers HUD icons and HUD textures (written as `<APB_Images:…>`) and every
package image (`<Images:…>`, by package or search); weapon lists also suggest the kill-feed and inventory icons of
their weapons. Images can be tinted (`<ImageColour:>`, multiplies the picture); **Default icons for empty categories**
fills weapon lists in one click. Sample weapons of the selected weapon category are shown next to the list. The game lists the categories in the order their lines come in the file, so
Download writes each changed list as one block in your order (where its first line was in your file). Visible numbers
(1. 2. …) only add the number to the name. The Valentines and Christmas categories are included; the game gives them
no shop, so they normally do not appear. Download writes the list's file (`ShopUIFilters` or
`InventoryItemInfraCategories`, merged into your file if you pick one) with every list of that file you changed (marked
✎). Marketplace names may also
show where the game names an item's category. With your config (or game folder) set at the top, the lists start from your
names and your order (the order of the lines in your file); categories you leave unchanged
keep your lines, and Download merges into your GER file. Moving a category starts your own order.

Gun Game and event weapons (Legacy and Gun Game sets, snowball and egg launchers, Ghostly Flare Gun, …) are part of
the weapon stats and name generators; their preview can be hidden with one switch.

Other tabs: **Colours** (converter between HEX/RGB/APB tags with the nearest game colour name, gradient maker, all 208
game colour names), **Editor** (open any INT/GER file or one from your config, search, edit with an in-game preview, recolour or find/replace many
lines at once). Bulk tools change only the page you see unless you pick "All matching lines" (asked first); Undo
reverts the last bulk action but keeps lines you typed since. Find/replace can match case, whole words only, and
leaves markup tags alone by default. Saving shows every changed line first. The file keeps its encoding: an 8-bit file
is only saved as UTF-16 when your new text uses characters it cannot hold (such as the ↵ line break), and you are told
first. English (INT) files are offered as .GER, so your copy overrides the game's file instead of replacing it.
"Only the changed lines" saves a small GER file with just your edits, so every other line keeps following the game.
With the game folder set, lines whose key the game doesn't know are marked (the game ignores them), and changed lines
with broken markup (a closing `<Color:/>` or `</col>` without its opening tag, `<col:>` in UI text, `<Color:>` in HUD text, …) are flagged; an opening tag without a closing one is normal in the game's own text and is not flagged. Unsaved edits are kept in
this browser and offered again when you reopen the same file. In the Generators, **Copy lines** adds `[Section]`
headers when the lines belong to sections, and the merge base file you picked is remembered per generator for this
browser tab (**Clear file** forgets it). Generators and Presets also show the line changes
before the download. Search with `[Section] text` to look in one section only (files such as APBUserInterface repeat key
names in many sections; an exact section name wins, otherwise every section containing the text). **Font only** wraps
lines in the picked font without touching their colours. **Next warning** jumps to the next marked line, also on other
pages. Keys: **Ctrl+S** save, **Ctrl+Z** undo (outside a text box, where the browser's own undo works), **F3** /
**Shift+F3** next / previous Find match, **Alt+N** / **Alt+Shift+N** next / previous warning, **Ctrl+Y** /
**Ctrl+Shift+Z** redo (also the **Redo** button). **History** lists the last 30 changes: click one to step back to just before it (or forward
again). **Differs from game** shows only the lines that differ from the game's English (needs the game folder or your
config); each such line has **Reset to game default**, and the bulk tool of the same name resets many at once.
**Export patch** saves just your changed lines with their sections as a small `.patch.GER` file to share;
**Import patch…** applies such a file to the open file (matched by section and key, one undo step).

## Stat tables

`stats/` (uses the Text designer's data file). **Tables**: sortable weapon and vehicle stats (TTK, shots to kill,
damage, rate of fire, magazine, reload, equip, range; vehicle health, speed, cargo, explosion, EMP), with or without
built-in modifications (vehicle built-ins such as Steel Plating or Nitro change health and speed too). Vehicles show the
game's shop category (Cars, Trucks, Vans) in their own column; the filter box matches it. Sort by clicking a
column (or focusing it and pressing Enter) or with the **Sort** control (e.g. lowest or highest TTK, fastest or slowest vehicle).
**CSV** saves every shown row (filter and sort as on screen) as a spreadsheet file; **Copy link** copies a link that
opens the table with the same settings. The Mod comparison has both too: its link carries the mods, scope and sort,
and its CSV lists every item × stat with one column per slot step.
Pin up to two rows (☆) to see them side by side above the table, with the better value marked.

**TTK by distance**: pick up to four weapons to see their time to kill from 0 m to their maximum range, as a step
chart (hover for values; "Show as table" lists them). Assumed falloff: full damage up to the falloff start, then a
straight fall to the minimum damage over the "min damage range" length, no hits past the maximum range; that reading
of the game's falloff length is not confirmed in game. Copy link keeps the picked weapons.

**Mod comparison**: pick up to three modifications in slot order (the picker shows each mod's icon, grouped by slot)
and a scope: all weapons, one category (e.g. Sub-Machine Guns, or Cars / Trucks / Vans) or one weapon; the same for vehicles and vehicle mods.
The cards can be sorted by name or any stat (the value with all picked mods).
Every item gets a card with its stats with no mods, with the first mod, the first two and all three, so you see what
each extra slot adds (e.g. Cooling Jacket 3 → + Reflex Sight 3 → + 3-Point Sling 3); changes are marked green (better)
or red (worse). A **Combined effects** table lists every effect of the chosen mods per step, including the ones the
stats cannot show (accuracy, handling, steering…), in the game's own wording: one mod shows the game's own number,
and when several mods change the same effect the game's number is scaled by the combined change.
Vehicle cards add health against gunfire and against collisions (armour mods). Max Speed includes nitro's top-speed
bonus as the game states it (+1 / +2 / +3 m/s) and percentage changes such as Steel Plating; mods apply one after
another in slot order (e.g. 20 m/s + 3 = 23, then −6% = 21.6).
A warning appears when two picked mods share a mod type (barrel, magazine, receiver, upper rail; for vehicles chassis,
engine, generic, trunk, activated): the game fits one mod per type. Clashes with an item's built-in mods are not checked.

## Run locally

Any static file server works, e.g. `python3 -m http.server` in this folder, then open http://localhost:8000.
Opening the pages straight from disk does not work (the browser blocks loading the data files).

## Credits

- iazer: [APB CFG Loader](https://github.com/lvzxr/apb-cfg-loader)
- writch: [writchcraft/apb](https://github.com/writchcraft/apb)
- Speed: [APBDB](https://apbdb.com/) (API)

Unofficial fan tool. APB Reloaded and all game content belong to their owners.
