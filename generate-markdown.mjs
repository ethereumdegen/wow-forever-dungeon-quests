import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const input = join(root, "quests.json");
const output = join(root, "guide.md");
const questUrl = (id) => `https://www.wowhead.com/forever/quest=${id}`;

function text(value) {
  return String(value ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cell(value) {
  return text(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function label(value) {
  return text(value).replace(/([\\\[\]])/g, "\\$1").replace(/\r?\n/g, " ");
}

function sources(urls, separator = " · ") {
  return [...new Set(urls || [])].map((raw, index) => {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error(`Unsupported source URL: ${raw}`);
    const href = url.href.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\|/g, "%7C");
    return `[${index + 1}. ${label(url.hostname.replace(/^www\./, ""))}](<${href}>)`;
  }).join(separator) || "No source linked; confirm in game.";
}

function validate(value) {
  if (!value || !value.meta || !Array.isArray(value.sections)) throw new Error("quests.json must contain meta and sections.");
  const slugs = new Set();
  for (const section of value.sections) {
    if (typeof section.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(section.slug) || slugs.has(section.slug)) throw new Error(`Invalid or duplicate dungeon slug: ${section.slug}`);
    slugs.add(section.slug);
    if (typeof section.title !== "string" || !Array.isArray(section.before_travel) || !Array.isArray(section.quests) || !Array.isArray(section.sources)) throw new Error(`Incomplete dungeon: ${section.slug}`);
    for (const quest of section.quests) {
      if (!Number.isSafeInteger(quest.id) || quest.id <= 0 || typeof quest.name !== "string" || typeof quest.faction_class !== "string" || (quest.min_level !== null && (!Number.isFinite(quest.min_level) || quest.min_level < 1)) || !Array.isArray(quest.sources)) throw new Error(`Invalid quest entry in ${section.slug}: ${quest.id}`);
    }
  }
  return value;
}

async function main() {
  const data = validate(JSON.parse(await readFile(input, "utf8")));
  const allQuests = data.sections.flatMap((section) => section.quests);
  const uniqueIds = new Set(allQuests.map((quest) => quest.id));
  const lines = [
    `# ${text(data.meta.title || "WoW Forever dungeon quest prerequisites")}`,
    "",
    "> **Never arrive without the quest.** Check the pickup, finish the prerequisites, then head to the dungeon.",
    "",
    ...(data.meta.updated ? [`Updated: ${text(data.meta.updated)}`, ""] : []),
    `${uniqueIds.size} unique quests across ${data.sections.length} dungeon sections (${allQuests.length} section entries). Repeated quest IDs across dungeon wings are intentional; completing one ID completes that quest everywhere.`,
    "",
    "## Scope and evidence",
    "",
    text(data.meta.scope || "See the dataset source notes for the guide’s researched coverage."),
    "",
    "WoW Forever can differ from other versions of WoW. Minimum acceptance level is not quest level. Confirm uncertain requirements in game using the linked evidence. This guide is not an eligibility guarantee.",
    "",
    ...(data.meta.source_notes || []).map((note) => `- ${text(note)}`),
    "",
    `Dataset sources: ${sources(data.meta.sources)}`,
    "",
    "## Legend and use",
    "",
    "- **Required** — complete the documented prerequisite chain before the target quest becomes available.",
    "- **Optional breadcrumb** — a lead-in or routing quest, not a documented hard gate.",
    "- **None documented** — no prerequisite was found in the consulted sources; this does not prove that none exists.",
    "- **Unknown** — the requirement is unresolved or conflicting; confirm in game.",
    "- **Min. ?** — minimum acceptance level is unconfirmed. The interactive guide keeps these quests visible at every level cap.",
    "- **Faction / class** — class-only restrictions apply to both factions unless a faction is explicitly included. Unrestricted quests apply to every class of the named faction.",
    "- Complete each dungeon’s **Before you travel** checklist, then collect the target quests. Checkmarks in this Markdown copy are independent of the browser checklist.",
    "- The [interactive checklist](./) defaults to Alliance, Warlock, and maximum acceptance level 59. It supports search, filters, and browser-local progress keyed by unique quest ID. This Markdown guide contains every dataset entry, without those filters.",
    "",
    "## Dungeons",
    "",
    ...data.sections.map((section) => `- [${label(section.title)}](#${section.slug}) (${section.quests.length} ${section.quests.length === 1 ? "quest" : "quests"})`),
    "",
  ];

  for (const section of data.sections) {
    lines.push(
      `<a id="${section.slug}"></a>`,
      "",
      `## ${text(section.title)}`,
      "",
      "### Before you travel",
      "",
    );
    if (section.before_travel.length) {
      for (const item of section.before_travel) {
        const content = String(item).replace(/^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?/, "");
        lines.push(`- [ ] ${text(content).replace(/\r?\n/g, " ")}`);
      }
    } else lines.push("- [ ] Review each pickup location and prerequisite chain below before leaving.");
    lines.push(
      "",
      "### Quest checklist",
      "",
      "| Done | Quest | Faction / class | Min. acceptance | Pickup | Prerequisite status | Prerequisite chain & notes | Evidence |",
      "| :---: | --- | --- | :---: | --- | --- | --- | --- |",
    );
    for (const quest of section.quests) {
      const name = label(quest.name).replace(/\|/g, "\\|");
      const detail = [
        cell(quest.prerequisites || "No prerequisite detail provided; confirm in game."),
        ...(quest.notes ? [`**Notes:** ${cell(quest.notes)}`] : []),
      ].join("<br><br>");
      const faction = quest.faction_class.replace(/(Druid|Hunter|Mage|Paladin|Priest|Rogue|Shaman|Warlock|Warrior)(Alliance|Horde)/g, "$1 · $2");
      lines.push(`| [ ] | [${name}](${questUrl(quest.id)}) (#${quest.id}) | ${cell(faction)} | ${quest.min_level === null ? "?" : quest.min_level} | ${cell(quest.pickup || "Pickup unconfirmed; check sources.")} | ${cell(quest.prerequisite_status)} | ${detail} | ${sources(quest.sources, "<br>")} |`);
    }
    if (!section.quests.length) lines.push("", "No quests are documented for this section in the dataset.");
    lines.push("", `Dungeon sources: ${sources(section.sources)}`, "", "[Back to dungeon list](#dungeons)", "");
  }

  lines.push("## Coverage notes", "");
  if (data.coverage_notes?.length) lines.push(...data.coverage_notes.map((note) => `- ${text(note)}`));
  else lines.push("Consult the scope and source notes above for research boundaries and uncertainty.");
  lines.push("", "## Confirmed minimum-60 exclusions", "");
  if (data.excluded_min60?.length) lines.push("These target quest IDs are excluded because their documented minimum acceptance level is 60:", "", data.excluded_min60.map((id) => `[${id}](${questUrl(id)})`).join(", "));
  else lines.push("No explicit minimum-60 exclusion IDs were supplied in this dataset.");
  lines.push("", "---", "", "Generated from [quests.json](quests.json) by `generate-markdown.mjs`. Edit the JSON source, then regenerate this file; do not hand-edit generated quest tables.", "");
  await writeFile(output, lines.join("\n"), "utf8");
  console.log(`Generated guide.md: ${uniqueIds.size} unique quests, ${allQuests.length} section entries, ${data.sections.length} dungeons.`);
}

main().catch((error) => {
  console.error(`Could not generate guide.md: ${error.message}`);
  process.exitCode = 1;
});
