# WoW Forever dungeon quest checklist

A dependency-free, JSON-backed dungeon travel checklist: **Never arrive without the quest.** The page uses native browser DOM APIs, local checkmarks, and linked quest evidence. No account, analytics, CDN, or external scripts.

[Live checklist](https://ethereumdegen.github.io/wow-forever-dungeon-quests/) · [Markdown guide](https://ethereumdegen.github.io/wow-forever-dungeon-quests/guide.md) · [Quest JSON](https://ethereumdegen.github.io/wow-forever-dungeon-quests/quests.json)

## Use and publish

Serve this directory with any static HTTP server; opening `index.html` with `file://` will not reliably load JSON. The page fetches `quests.json` once. Searching, filtering, and checkmarks do not make network requests; opening an evidence link leaves the site.

After updating the dataset, regenerate the complete Markdown guide with either:

```sh
node generate-markdown.mjs
# or
bun generate-markdown.mjs
```

The generator resolves paths relative to its own location, reads `quests.json`, and writes `guide.md`. It requires a current Node.js or Bun runtime and only uses built-in modules. No package installation or site build is required. Do not hand-edit generated quest tables.

For GitHub Pages, publish this directory as the site root, including `index.html`, `styles.css`, `app.js`, `quests.json`, `guide.md`, and `.nojekyll`. All site assets and download links use relative paths, so repository-subpath Pages hosting works. Configure Pages to deploy the repository root or upload that directory as a Pages artifact. Do not publish credentials or research tooling.

## Filters and saved progress

Defaults are Alliance, Warlock, and maximum acceptance level 59. Class filters include unrestricted quests as well as the selected class; “All classes” removes the class restriction. Search matches dungeon names, travel checklist text, quest IDs, names, faction/class, pickups, prerequisite status, chains, and notes. Words are matched together, case-insensitively. The level filter refers to **minimum acceptance**, not quest level; unknown (`null`) minimums remain visible.

The progress denominator is unique quest IDs matching the current character, search, level, dungeon, and prerequisite filters **before** “Hide completed” is applied. Repeated IDs across wings therefore count once, and their checkboxes stay synchronized. Before-travel items are separate checkmarks and do not affect quest progress.

Progress is saved in `localStorage` under `wow-forever-dungeon-checklist-v1`, as `{completedQuestIds: number[], travelChecked: string[]}`. Travel keys combine the dungeon slug and item text. Checkmarks are local to this browser, site origin, and device, not per character; they do not sync to other tabs or devices. Reset filters leaves checkmarks intact. If storage is blocked, full, or malformed, the page warns and continues with in-memory progress. Clearing site storage removes saved progress.

Dungeon links use `#section-slug` anchors. Opening a link to a dungeon hidden by the current filters selects that dungeon so its travel checklist and sources remain accessible, even when no quests match.

## Dataset contract

`quests.json` contains:

- `meta`: `title`, `updated`, `scope` (strings), `source_notes` (array of strings), and `sources` (array of URL strings).
- `sections`: an ordered array of dungeon sections. Each section has a unique lowercase hyphenated `slug`, `title`, `before_travel` (string array), `quests` (quest array), and `sources` (URL array).
- `excluded_min60`: an array of target quest IDs deliberately omitted for confirmed minimum acceptance level 60.
- `coverage_notes`: an array of research-boundary or uncertainty notes.

Each quest has `id` (positive integer), `name`, `faction_class`, `min_level` (number or `null`), `pickup`, `prerequisite_status`, `prerequisites`, `notes`, and `sources` (URL array). Strings are required even when empty. Quest IDs may intentionally repeat between sections.

`faction_class` describes alternatives separated by commas or semicolons: for example `Alliance`, `Horde`, `Both`, `Warlock`, `WarriorAlliance`, `PaladinAlliance`, or `Warrior, Paladin`. A class-only restriction applies to both factions; a faction-only restriction applies to all classes. Multiple alternatives preserve their own faction/class pairing. Class names are Druid, Hunter, Mage, Paladin, Priest, Rogue, Shaman, Warlock, and Warrior.

`prerequisite_status` is one of `Required`, `None documented`, `Optional breadcrumb`, or `Unknown`. “None documented” is not a guarantee that no gate exists. Preserve disagreements and incomplete evidence in the chain/notes fields rather than hiding uncertainty.

Travel items, pickups, chains, and notes may contain Markdown-style `[label](https://example.com)` links. The browser renders text and HTTP(S) links with DOM nodes, never dataset HTML; limited emphasis markers are displayed as readable text. Generated Markdown preserves links and escapes table separators and raw HTML. Source URLs must use HTTP(S). Each quest name links to `https://www.wowhead.com/forever/quest=ID`.

## Files

- `index.html`, `styles.css`, `app.js`: accessible responsive static checklist, filters, sources, loading/error states, and browser-local progress.
- `quests.json`: researched source of truth, maintained separately from the UI.
- `generate-markdown.mjs`: complete unfiltered guide generator.
- `guide.md`: generated downloadable guide with scope, legend, table of contents, travel checklists, quest tables, sources, and exclusions.
- `.nojekyll`: bypasses Jekyll processing on GitHub Pages.
