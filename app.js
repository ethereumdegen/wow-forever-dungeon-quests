"use strict";

const STORAGE_KEY = "wow-forever-dungeon-checklist-v1";
const CLASS_NAMES = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const CLASS_PATTERN = new RegExp(CLASS_NAMES.join("|"), "gi");
const byId = (id) => document.getElementById(id);
const completed = new Set();
const travelChecked = new Set();
let data;
let indexedSections = [];
let matchingIds = new Set();
let loading = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function link(label, href) {
  const node = element("a", null, label);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

function readableText(value) {
  return String(value ?? "").replace(/\*\*|__|`/g, "");
}

// A deliberately small text/link renderer: dataset strings never become HTML.
function richText(value) {
  const fragment = document.createDocumentFragment();
  const text = String(value ?? "");
  const tokens = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+)/g;
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    fragment.append(document.createTextNode(readableText(text.slice(offset, match.index))));
    const href = safeUrl(match[2] || match[3]);
    const label = readableText(match[1] || match[3]);
    fragment.append(href ? link(label, href) : document.createTextNode(label));
    offset = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(readableText(text.slice(offset))));
  return fragment;
}

function sourceLinks(urls) {
  const container = element("span", "source-links");
  const unique = [...new Set((urls || []).map(safeUrl).filter(Boolean))];
  unique.forEach((href, index) => {
    const host = new URL(href).hostname.replace(/^www\./, "");
    container.append(link(`${index + 1}. ${host}`, href));
  });
  if (!unique.length) container.append(document.createTextNode("No source linked; confirm in game."));
  return container;
}

function showStorageWarning() {
  byId("storage-warning").textContent = "Browser storage is unavailable or saved checkmarks could not be read. Checkmarks still work for this visit, but may not survive reloading. No progress is sent to a server.";
  byId("storage-warning").hidden = false;
}

function readProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.completedQuestIds) || !Array.isArray(saved.travelChecked)) throw new Error("Invalid saved checklist");
    saved.completedQuestIds.forEach((id) => {
      if (Number.isSafeInteger(id) && id > 0) completed.add(id);
    });
    saved.travelChecked.forEach((key) => {
      if (typeof key === "string") travelChecked.add(key);
    });
  } catch {
    showStorageWarning();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedQuestIds: [...completed], travelChecked: [...travelChecked] }));
  } catch {
    showStorageWarning();
  }
}

function restrictions(value) {
  // Comma-separated alternatives preserve combinations such as WarriorAlliance,
  // PaladinHorde; a class without a faction restriction applies to both factions.
  return String(value || "Both").split(/[,;]+/).map((part) => {
    const classes = (part.match(CLASS_PATTERN) || []).map((name) => CLASS_NAMES.find((known) => known.toLowerCase() === name.toLowerCase()));
    const factions = (part.match(/Alliance|Horde/gi) || []).map((name) => name.toLowerCase());
    return { classes, factions };
  });
}

function matchesCharacter(alternatives, faction, characterClass) {
  return alternatives.some(({ classes, factions }) =>
    (faction === "All" || !factions.length || factions.includes(faction.toLowerCase())) &&
    (characterClass === "All" || !classes.length || classes.includes(characterClass))
  );
}

function filters() {
  const level = Number(byId("max-level").value);
  return {
    search: byId("search").value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),
    faction: byId("faction").value,
    characterClass: byId("character-class").value,
    maxLevel: Number.isFinite(level) && level >= 1 ? Math.min(60, level) : 59,
    dungeon: byId("dungeon").value,
    requiredOnly: byId("required-only").checked,
    hideCompleted: byId("hide-completed").checked,
  };
}

function matchesQuest(row, section, selection) {
  const quest = row.quest;
  return (selection.dungeon === "All" || section.slug === selection.dungeon) &&
    matchesCharacter(row.restrictions, selection.faction, selection.characterClass) &&
    (quest.min_level === null || quest.min_level <= selection.maxLevel) &&
    (!selection.requiredOnly || quest.prerequisite_status === "Required") &&
    selection.search.every((term) => row.searchText.includes(term));
}

function statusClass(status) {
  return ({ Required: "required", "Optional breadcrumb": "optional", "None documented": "none", Unknown: "unknown" })[status] || "unknown";
}

function renderQuest(quest, sectionSlug, rowIndex) {
  const item = element("li", `quest-card${completed.has(quest.id) ? " is-completed" : ""}`);
  item.dataset.questId = String(quest.id);
  const top = element("div", "quest-top");
  const control = element("label", "completion-control");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.checked = completed.has(quest.id);
  checkbox.dataset.questCheckbox = String(quest.id);
  checkbox.id = `complete-${sectionSlug}-${rowIndex}`;
  control.htmlFor = checkbox.id;
  control.append(checkbox, element("span", "sr-only", `Mark ${quest.name} (#${quest.id}) completed`));
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) completed.add(quest.id);
    else completed.delete(quest.id);
    saveProgress();
    if (byId("hide-completed").checked) {
      render();
      byId("result-summary").focus({ preventScroll: true });
      return;
    }
    document.querySelectorAll("[data-quest-checkbox]").forEach((input) => {
      if (Number(input.dataset.questCheckbox) !== quest.id) return;
      input.checked = checkbox.checked;
      input.closest(".quest-card").classList.toggle("is-completed", checkbox.checked);
    });
    updateProgress();
  });
  const identity = element("div", "quest-identity");
  const title = element("h3", "quest-title");
  title.append(link(quest.name, `https://www.wowhead.com/forever/quest=${quest.id}`));
  const restrictionLabel = quest.faction_class.replace(/(Druid|Hunter|Mage|Paladin|Priest|Rogue|Shaman|Warlock|Warrior)(Alliance|Horde)/g, "$1 · $2");
  const minLevel = quest.min_level === null ? "? (unconfirmed)" : quest.min_level;
  identity.append(title, element("p", "quest-meta", `${restrictionLabel} · Min. acceptance ${minLevel} · #${quest.id}`));
  top.append(control, identity, element("span", `badge ${statusClass(quest.prerequisite_status)}`, quest.prerequisite_status));
  const facts = element("dl", "quest-facts");
  const addFact = (heading, value, className) => {
    const group = element("div", className);
    const description = element("dd");
    description.append(richText(value));
    group.append(element("dt", null, heading), description);
    facts.append(group);
  };
  addFact("Pick up from", quest.pickup || "Pickup location unconfirmed; check sources.");
  addFact("Prerequisite chain", quest.prerequisites || "No prerequisite detail provided; confirm in game.");
  if (quest.notes) addFact("Travel & quest notes", quest.notes, "quest-notes");
  const sources = element("div", "quest-sources");
  sources.append(document.createTextNode("Quest evidence: "), sourceLinks(quest.sources));
  item.append(top, facts, sources);
  return item;
}

function renderBeforeTravel(section) {
  const box = element("div", "before-travel");
  box.append(element("h3", null, "Before you travel"));
  const list = element("ul");
  section.before_travel.forEach((value, index) => {
    const text = value.replace(/^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?/, "");
    const key = `${section.slug}:${text}`;
    const item = element("li", "travel-item");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.id = `travel-${section.slug}-${index}`;
    checkbox.checked = travelChecked.has(key);
    const label = element("label");
    label.htmlFor = checkbox.id;
    label.append(richText(text));
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) travelChecked.add(key);
      else travelChecked.delete(key);
      saveProgress();
    });
    item.append(checkbox, label);
    list.append(item);
  });
  if (!section.before_travel.length) list.append(element("li", null, "Review the pickup and prerequisite details below before leaving."));
  box.append(list);
  return box;
}

function updateProgress() {
  const count = [...matchingIds].filter((id) => completed.has(id)).length;
  const progress = byId("quest-progress");
  progress.max = matchingIds.size || 1;
  progress.value = count;
  progress.textContent = `${count} of ${matchingIds.size}`;
  byId("progress-label").textContent = `${count} / ${matchingIds.size} matching unique quests completed`;
  const visible = byId("hide-completed").checked ? matchingIds.size - count : matchingIds.size;
  byId("result-summary").textContent = `${visible} unique ${visible === 1 ? "quest" : "quests"} shown · ${count} of ${matchingIds.size} matching completed. Shared IDs count once.`;
}

function render() {
  if (!data) return;
  const selection = filters();
  matchingIds = new Set();
  let visibleRows = 0;
  const fragment = document.createDocumentFragment();
  const navList = element("ul");
  indexedSections.forEach(({ section, rows }) => {
    const matching = rows.filter((row) => matchesQuest(row, section, selection));
    matching.forEach(({ quest }) => matchingIds.add(quest.id));
    const visible = matching.filter(({ quest }) => !selection.hideCompleted || !completed.has(quest.id));
    if (!visible.length && selection.dungeon !== section.slug) return;
    visibleRows += visible.length;
    const block = element("section", "dungeon-section");
    block.id = section.slug;
    block.setAttribute("aria-labelledby", `heading-${section.slug}`);
    const header = element("div", "dungeon-header");
    const heading = element("h2");
    heading.id = `heading-${section.slug}`;
    const anchor = element("a", null, section.title);
    anchor.href = `#${encodeURIComponent(section.slug)}`;
    heading.append(anchor);
    header.append(heading, element("span", "dungeon-count", `${visible.length} ${visible.length === 1 ? "quest" : "quests"}`));
    block.append(header, renderBeforeTravel(section));
    if (visible.length) {
      const list = element("ul", "quest-list");
      visible.forEach(({ quest }, index) => list.append(renderQuest(quest, section.slug, index)));
      block.append(list);
    } else block.append(element("p", "muted", "No quests in this dungeon match your current filters."));
    const evidence = element("p", "dungeon-sources");
    evidence.append(document.createTextNode("Dungeon sources: "), sourceLinks(section.sources));
    block.append(evidence);
    fragment.append(block);
    const navItem = element("li");
    const navAnchor = element("a");
    navAnchor.href = `#${encodeURIComponent(section.slug)}`;
    if (currentHash() === section.slug) navAnchor.setAttribute("aria-current", "location");
    navAnchor.append(element("span", null, section.title), element("span", "nav-count", visible.length));
    navItem.append(navAnchor);
    navList.append(navItem);
  });
  byId("sections").replaceChildren(fragment);
  byId("dungeon-nav").replaceChildren(navList.childElementCount ? navList : element("p", "muted", "No matching dungeons."));
  byId("empty-state").hidden = visibleRows !== 0;
  updateProgress();
}

function currentHash() {
  try { return decodeURIComponent(location.hash.slice(1)); }
  catch { return ""; }
}

function navigateToHash() {
  const slug = currentHash();
  if (!data || !data.sections.some((section) => section.slug === slug)) return;
  if (!document.getElementById(slug)) {
    byId("dungeon").value = slug;
    render();
  }
  document.querySelectorAll("#dungeon-nav a").forEach((anchor) => {
    if (anchor.hash === `#${encodeURIComponent(slug)}`) anchor.setAttribute("aria-current", "location");
    else anchor.removeAttribute("aria-current");
  });
  requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
}

function renderSourceNotes() {
  const content = byId("source-content");
  content.replaceChildren();
  if (data.meta.scope) {
    const scope = element("p");
    scope.append(richText(data.meta.scope));
    content.append(scope);
  }
  const notes = [...(data.meta.source_notes || []), ...(data.coverage_notes || [])];
  if (notes.length) {
    const list = element("ul");
    notes.forEach((note) => {
      const item = element("li");
      item.append(richText(note));
      list.append(item);
    });
    content.append(list);
  }
  if (data.excluded_min60?.length) {
    const excluded = element("p");
    excluded.append(document.createTextNode("Excluded: confirmed minimum-60 quest IDs "));
    data.excluded_min60.forEach((id, index) => {
      if (index) excluded.append(document.createTextNode(", "));
      excluded.append(link(String(id), `https://www.wowhead.com/forever/quest=${id}`));
    });
    content.append(excluded);
  }
  const sources = element("p");
  sources.append(document.createTextNode("Dataset sources: "), sourceLinks(data.meta.sources));
  content.append(sources);
}

function validateData(value) {
  if (!value || !value.meta || !Array.isArray(value.sections)) throw new Error("The quest dataset does not have the expected structure.");
  const slugs = new Set();
  value.sections.forEach((section) => {
    if (typeof section.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(section.slug) || slugs.has(section.slug) || document.getElementById(section.slug)) throw new Error("The dataset contains an invalid or duplicate dungeon anchor.");
    slugs.add(section.slug);
    if (typeof section.title !== "string" || !Array.isArray(section.quests) || !Array.isArray(section.before_travel) || !Array.isArray(section.sources)) throw new Error("A dungeon entry is incomplete.");
    section.quests.forEach((quest) => {
      if (!Number.isSafeInteger(quest.id) || quest.id <= 0 || typeof quest.name !== "string" || typeof quest.faction_class !== "string" || (quest.min_level !== null && (!Number.isFinite(quest.min_level) || quest.min_level < 1)) || !Array.isArray(quest.sources)) throw new Error("A quest entry is incomplete or has an invalid acceptance level.");
    });
  });
  return value;
}

async function load() {
  if (loading) return;
  loading = true;
  byId("load-error").hidden = true;
  byId("results").setAttribute("aria-busy", "true");
  byId("result-summary").textContent = "Loading quest data…";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("quests.json", { signal: controller.signal });
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status} for quests.json.`);
    data = validateData(await response.json());
    indexedSections = data.sections.map((section) => ({
      section,
      rows: section.quests.map((quest) => ({
        quest,
        restrictions: restrictions(quest.faction_class),
        searchText: [section.title, ...section.before_travel, quest.id, quest.name, quest.faction_class, quest.pickup, quest.prerequisite_status, quest.prerequisites, quest.notes].join(" ").toLocaleLowerCase(),
      })),
    }));
    byId("dataset-meta").textContent = `${data.meta.title || "Dungeon quest checklist"}${data.meta.updated ? ` · Updated ${data.meta.updated}` : ""}`;
    const dungeonSelect = byId("dungeon");
    dungeonSelect.replaceChildren(new Option("All dungeons", "All"));
    data.sections.forEach((section) => dungeonSelect.add(new Option(section.title, section.slug)));
    renderSourceNotes();
    byId("filter-fields").disabled = false;
    render();
    navigateToHash();
  } catch (error) {
    byId("load-error").hidden = false;
    byId("load-error-detail").textContent = error.name === "AbortError" ? "Loading quests.json timed out. Check your connection and try again." : error.message;
    byId("result-summary").textContent = "Quest data unavailable.";
    byId("dungeon-nav").replaceChildren(element("p", "muted", "Dungeon data unavailable."));
  } finally {
    clearTimeout(timer);
    byId("results").setAttribute("aria-busy", "false");
    loading = false;
  }
}

function resetFilters() {
  byId("filters").reset();
  render();
}

byId("filters").addEventListener("submit", (event) => event.preventDefault());
byId("search").addEventListener("input", render);
byId("max-level").addEventListener("input", render);
["faction", "character-class", "dungeon", "required-only", "hide-completed"].forEach((id) => byId(id).addEventListener("change", render));
byId("reset-filters").addEventListener("click", resetFilters);
byId("empty-reset").addEventListener("click", resetFilters);
byId("retry-load").addEventListener("click", load);
window.addEventListener("hashchange", navigateToHash);
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(([entry]) => document.documentElement.style.setProperty("--toolbar-height", `${entry.target.getBoundingClientRect().height}px`)).observe(byId("filters"));
}
readProgress();
load();
