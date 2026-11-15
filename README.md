# WoW Forever quest field guides

Dependency-free, JSON-backed travel checklists for dungeon quests and open-world elite chains. Both pages use the same native-DOM renderer, local checkmarks, and linked quest evidence. No account, analytics, CDN, or external scripts.

[Dungeon checklist](https://ethereumdegen.github.io/wow-forever-dungeon-quests/) · [Open-world elites](https://ethereumdegen.github.io/wow-forever-dungeon-quests/elites.html) · [Dungeon Markdown](guide.md) · [Elite Markdown](elites.md)

## Use and publish

Serve this directory with any static HTTP server; opening the HTML with `file://` will not reliably load JSON. The dungeon page fetches `quests.json`; `elites.html` fetches `elite-quests.json`. Searching, filtering, and checkmarks do not make network requests; opening an evidence link leaves the site.

After updating the dataset, regenerate the complete Markdown guide with either:

```sh
node generate-markdown.mjs
# or
bun generate-markdown.mjs
```

The generator resolves paths relative to its own location and writes `guide.md` from `quests.json` and `elites.md` from `elite-quests.json`. It requires a current Node.js or Bun runtime and only uses built-in modules. No package installation or site build is required. Do not hand-edit generated quest tables.

For GitHub Pages, publish this directory as the site root, including both HTML pages, both JSON datasets, both Markdown guides, `styles.css`, `app.js`, `.nojekyll`, and the `fonts/` directory. All site assets and download links use relative paths, so repository-subpath Pages hosting works. Configure Pages to deploy the repository root or upload that directory as a Pages artifact. Do not publish credentials or research tooling.

## Open-world elite coverage

The elite guide contains 36 route sections and 341 individually identified quests, including solo prerequisite steps before the group payoff. It covers both factions, classic-origin routes, and new Forever lines in Wetlands, Riverglades, Zephras Isle, Shen’dralas, and Mount Hyjal.

The [Wetlands Dragonmaw route](elites.html#wetlands-dragonmaw) includes the observed AND gates before Death to the Dragonmaw and the Stopping the Cycle dragonkin finale. The [Dun Modr route](elites.html#wetlands-dun-modr) includes Dark Iron War, Thandol Span, and the new dwarf errands. Sources, disputed faction access, unknown acceptance levels, and external dungeon prerequisites are explicit in the dataset. This is a curated planning guide, not exhaustive coverage or a numerical XP ranking.

## Theme and typography

The screen theme is always dark: charcoal surfaces, restrained blue accents, gold headings and quest titles, and off-white body text. It does not switch to a light theme with the operating-system preference; printing uses a separate light palette.

Geist is served locally from `fonts/Geist-Variable.woff2`, with no third-party font request. The unmodified variable font comes from [Vercel’s Geist font project](https://github.com/vercel/geist-font), font blob `71dab8bedba3bfef5dccd7875ed05cac44c7345d`, and is redistributed under the [SIL Open Font License](fonts/OFL.txt).

On phones and short landscape screens, the sticky filter panel starts collapsed to a compact character summary; tap it to open the controls. Expanded controls are height-limited and internally scrollable in landscape. Inputs use 16px text on mobile to avoid automatic focus zoom; navigation and completion controls provide 44px touch targets. Section headings wrap without horizontal page scrolling.

## Filters and saved progress

Defaults are Alliance, Warlock, and maximum acceptance level 59. Class filters include unrestricted quests as well as the selected class; “All classes” removes the class restriction. Faction/class filtering applies to quest cards **and** preparation bullets. Shared quests with different faction starts display only the selected faction’s instructions; “All factions” displays the full variant. Search uses only those applicable instructions, not hidden opposing-faction pickups. Words are matched together, case-insensitively, across section names, summaries, applicable preparation, quest IDs, names, faction/class, pickups, status, chains, and notes. The level filter refers to **minimum acceptance**, not quest level; unknown (`null`) minimums remain visible.

Section headings include recommended group level ranges; navigation pills and select options retain plain names. Those ranges are planning advice, not acceptance gates, and do not drive the acceptance-level filter. Guide navigation carries faction, class, and acceptance cap via URL parameters; search and section selections remain page-specific.

The progress denominator is unique quest IDs matching the current character, search, level, section, and prerequisite filters **before** “Hide completed” is applied. Repeated IDs across wings and across the dungeon/elite guides share completion. Before-travel items are separate checkmarks and do not affect quest progress.

Progress is saved in `localStorage` under `wow-forever-dungeon-checklist-v1`, as `{completedQuestIds: number[], travelChecked: string[]}`. Travel keys combine the section slug and item text. Existing unsplit preparation text retains its previous key; split faction/class instructions have new independent keys. Checkmarks are local to this browser, site origin, and device, not per character; they do not sync to other tabs or devices. Reset filters leaves checkmarks intact. If storage is blocked, full, or malformed, the page warns and continues with in-memory progress. Clearing site storage removes saved progress.

Section links use `#section-slug` anchors. Opening a link to a section hidden by current filters selects that section so its applicable preparation and sources remain accessible, even when no quests match.

## Dataset contract

`quests.json` and `elite-quests.json` share this contract:

- `meta`: `title`, `updated`, `scope` (strings), `source_notes` (array of strings), and `sources` (array of URL strings).
- `sections`: an ordered array of sections. Each has a unique lowercase hyphenated `slug`, plain `title`, `level_range: {min, max, note}`, `before_travel` (objects with `text` and `faction_class`), `quests` (quest array), and `sources` (URL array). Ranges describe recommended group levels, not unlocks. Optional `zone` and `summary` strings add route context.
- `excluded_min60`: an array of target quest IDs deliberately omitted for confirmed minimum acceptance level 60.
- `coverage_notes`: an array of research-boundary or uncertainty notes.

Each quest has `id` (positive integer), `name`, `faction_class`, `min_level` (number or `null`), `pickup`, `prerequisite_status`, `prerequisites`, `notes`, and `sources` (URL array). Quest IDs may intentionally repeat between sections and datasets. `pickup`, `prerequisites`, and `notes` are shared strings or `{All, Alliance, Horde}` objects whose string values preserve the full route and each faction-specific version. The browser selects the matching variant; Markdown renders `All`.

`faction_class` describes alternatives separated by commas or semicolons: for example `Alliance`, `Horde`, `Both`, `Warlock`, `WarriorAlliance`, `PaladinAlliance`, or `Warrior, Paladin`. A class-only restriction applies to both factions; a faction-only restriction applies to all classes. Multiple alternatives preserve their own faction/class pairing. Class names are Druid, Hunter, Mage, Paladin, Priest, Rogue, Shaman, Warlock, and Warrior.

`prerequisite_status` is one of `Required`, `None documented`, `Optional breadcrumb`, or `Unknown`. “None documented” is not a guarantee that no gate exists. Preserve disagreements and incomplete evidence in the chain/notes fields rather than hiding uncertainty.

Travel items, pickups, chains, and notes may contain Markdown-style `[label](https://example.com)` links. The browser renders text and HTTP(S) links with DOM nodes, never dataset HTML; limited emphasis markers are displayed as readable text. Generated Markdown preserves links and escapes table separators and raw HTML. Source URLs must use HTTP(S). Each quest name links to `https://www.wowhead.com/forever/quest=ID`.

## Files

- `index.html`, `elites.html`, `styles.css`, `app.js`: accessible responsive static guides sharing filters, rendering, sources, loading/error states, and browser-local progress.
- `quests.json`, `elite-quests.json`: researched sources of truth, maintained separately from the UI.
- `generate-markdown.mjs`: complete unfiltered guide generator for both datasets.
- `guide.md`, `elites.md`: generated downloadable guides with scope, legend, table of contents, level ranges, travel checklists, quest tables, sources, and exclusions.
- `.nojekyll`: bypasses Jekyll processing on GitHub Pages.
- `fonts/Geist-Variable.woff2`, `fonts/OFL.txt`: self-hosted Geist variable font and its redistribution license.
