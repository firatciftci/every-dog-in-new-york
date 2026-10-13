import { browser } from "$app/env";
import type { Rival } from "#lib/compare.js";
import type { ParkId } from "#lib/game/parks.js";
import type { Filter, HitKind } from "#lib/query.js";
import type { Query, Shared } from "#lib/share.js";
import type {
  Detent,
  Facet,
  Focus,
  LayerId,
  Lightbox,
  PaintedProperties,
  Pointing,
  StoryId,
  View,
} from "#lib/types.js";
import type { Asked } from "#lib/view.js";
import { boutOf, MAX_RIVALS, rivalKey } from "#lib/compare.js";
import { SWELL } from "#lib/components/map/tide.js";
import {
  DEFAULT_LAYER,
  dogBreed,
  layerDef,
  layerOfField,
  question,
} from "#lib/layers.js";
import { isNarrowLayout } from "#lib/narrow-layout.svelte.js";
import { facetOfField, filterKey } from "#lib/query.js";
import {
  readFilters,
  readFocus,
  readLayer,
  readRivals,
  readSelected,
  writeShared,
} from "#lib/share.js";
import { FACET_FIELDS } from "#lib/types.js";
import { resolveView } from "#lib/view.js";
import { SUNK_BOROUGH } from "#lib/world.js";

const INTRO_SEEN = "edny:intro-seen";

const RESTS: ReadonlyArray<Detent> = ["shut", "peek", "full"];

const DRYING = 120_000; // 2 minutes

// ms; delay before a ducked sheet comes back after the map stops moving.
const BACK = 700;

function introAlreadySeen() {
  if (!browser) {
    return false;
  }

  try {
    return sessionStorage.getItem(INTRO_SEEN) != null;
  } catch {
    return false;
  }
}

class Explorer {
  #query = $state<Query | null>(null);

  /**
   * One $derived per field; deriving the whole query would rerun every reader on any key change.
   */
  #layer = $derived(readLayer(this.#query?.v ?? ""));
  #breed = $derived(this.#query?.breed ?? "");
  #name = $derived(this.#query?.name ?? "");
  #focus = $derived(readFocus(this.#breed, this.#name));
  #rules = $derived(this.#query?.f ?? "");
  #filters = $derived(readFilters(this.#rules));
  #selected = $derived(readSelected(this.#query?.at ?? ""));
  #vs = $derived(this.#query?.vs ?? "");
  #rivals = $derived(readRivals(this.#vs));

  #towel: ReturnType<typeof setTimeout> | undefined;
  #settling: ReturnType<typeof setTimeout> | undefined;

  #ducked: Detent | null = null;
  /**
   * The rest the sheet had before an expanded park notice shut it.
   */
  #behind: Detent | null = null;
  /**
   * Separate from #ducked: a reader raising the sheet mid-pan must not be re-ducked by inertia frames.
   */
  #moving = false;
  #back: ReturnType<typeof setTimeout> | undefined;
  #calm: ReturnType<typeof setTimeout> | undefined;

  #asked = $derived<Asked>({
    layer: this.#layer,
    focus: this.#focus,
    filters: this.#filters,
    rivals: this.#rivals,
  });

  #resolved = $derived(resolveView(this.#asked));

  /**
   * Topmost first. A new overlay is one entry here, and nothing else: both the
   * Escape ladder and dialogUp read this list.
   */
  #overlays: ReadonlyArray<{ up: () => boolean; shut: () => void }> = [
    { up: () => this.game != null, shut: () => (this.game = null) },
    { up: () => this.story != null, shut: () => (this.story = null) },
    { up: () => this.lightbox != null, shut: () => (this.lightbox = null) },
    { up: () => this.shelter != null, shut: () => (this.shelter = null) },
    { up: () => this.maker, shut: () => (this.maker = false) },
    { up: () => this.adopting != null, shut: () => (this.adopting = null) },
    { up: () => this.about, shut: () => (this.about = false) },
    { up: () => this.help, shut: () => (this.help = false) },
    { up: () => this.search, shut: () => (this.search = false) },
    { up: () => this.shelfOpen, shut: () => (this.shelfOpen = false) },
    { up: () => this.intro, shut: () => this.dismissIntro() },
  ];

  #front = $state<"city" | "place" | "pet">("place");

  #petOpen = $state(false);

  /**
   * Private on purpose: every rest has to pass holdSheet, and a two-way bind on this
   * field would walk straight past it.
   */
  #sheet = $state<Detent>("peek");
  #frontFor = $state<string | null>(null);

  #pointing = $state<Pointing | null>(null);

  searchScope = $state<HitKind | null>(null);

  searchSeed = $state<string | null>(null);

  intro = $state(!introAlreadySeen());
  about = $state(false);
  maker = $state(false);
  /**
   * The dog form: a new dog, or the open card's dog.
   */
  adopting = $state<"new" | "edit" | null>(null);
  help = $state(false);
  search = $state(false);
  shelfOpen = $state(false);

  shelter = $state<string | null>(null);
  game = $state<ParkId | null>(null);
  story = $state<StoryId | null>(null);
  lightbox = $state<Lightbox | null>(null);

  /**
   * The reader's own dog on a train: a route and the terminal it signs.
   */
  ride = $state<{ route: string; sign: string; id: string } | null>(null);

  /**
   * Counter, not payload: bumped to bring the camera back to the riding dog.
   */
  follow = $state(0);

  /**
   * Counter, not payload: bumped each time a dog card opens, so the map goes to meet them.
   */
  petTick = $state(0);

  sank = $state(false);

  sinking = $state(false);

  settled = $state(false);

  dripping = $state(false);

  /**
   * -1 is the folded walk; otherwise the stop the reader is on.
   */
  walk = $state(-1);

  /**
   * The narrator bubble's hook page, phone only. The phone reader meets the hook
   * there instead of being dropped straight into the first stop.
   */
  greeting = $state(false);

  /**
   * Counter, not payload, so the effect that reads it never writes what it reads.
   */
  zoomTick = $state(0);

  /**
   * True while the reader's own hand moves the map, plus a cooldown. The walk card
   * steps out of the way for as long as it holds.
   */
  roaming = $state(false);

  #ask(next: Partial<Shared>) {
    this.#query?.update(
      writeShared({
        /**
         * this.layer (the derived reading), not #layer, so a stale link resyncs.
         */
        layer: this.layer,
        focus: this.#focus,
        filters: this.#filters,
        selected: this.#selected,
        rivals: this.#rivals,
        ...next,
      }),
    );
  }

  get rivals(): Array<Rival> {
    return this.#rivals;
  }

  get bout() {
    return this.#resolved.bout;
  }

  isRival(rival: Rival) {
    const key = rivalKey(rival);

    return this.rivals.some((r) => rivalKey(r) === key);
  }

  addRival(rival: Rival) {
    if (this.isRival(rival)) {
      this.removeRival(rival);

      return;
    }

    const keep = this.rivals.filter((r) => boutOf([r, rival]) != null);
    if (keep.length >= MAX_RIVALS) {
      keep.shift();
    }

    const next = [...keep, rival];

    const facets = new Set(
      next
        .map((r) => (r.kind === "breeds" || r.kind === "names" ? r.kind : null))
        .filter((f): f is Facet => f != null),
    );
    const rules =
      facets.size === 0
        ? this.#filters
        : this.#filters.filter((f) => {
            if (f.kind !== "in") {
              return true;
            }

            const facet = facetOfField(f.field);

            return facet == null || !facets.has(facet);
          });

    const isSupersedes = next.length >= 2 && boutOf(next) === "subject";

    this.#ask({
      rivals: next,
      filters: rules,
      ...(isSupersedes && { focus: null }),
    });

    if (next.length >= 2 && boutOf(next) != null) {
      this.showCity();
    }

    this.capSheet("peek");
  }

  tryInSearch(text: string) {
    this.help = false;
    this.searchSeed = text;
    this.openSearch();
  }

  openCompare(rival: Rival) {
    if (!this.isRival(rival)) {
      this.addRival(rival);
    }

    this.searchScope =
      rival.kind === "breeds"
        ? "breed"
        : rival.kind === "names"
          ? "name"
          : rival.kind;
    this.openSearch();
  }

  leap(next: {
    layer: LayerId;
    focus: Focus | null;
    filters: Array<Filter>;
    rivals: Array<Rival>;
    at: string | null;
  }) {
    this.#ask({
      layer: next.layer,
      focus: next.focus,
      filters: next.filters,
      rivals: next.rivals,
      selected: next.at,
    });
    this.#front = next.at == null ? "city" : "place";
    this.#frontFor = next.at;
    this.capSheet("peek");

    if (next.rivals.length >= 2) {
      this.showCity();
    }
  }

  removeRival(rival: Rival) {
    const key = rivalKey(rival);

    this.#ask({ rivals: this.rivals.filter((r) => rivalKey(r) !== key) });
  }

  clearRivals() {
    this.#ask({ rivals: [] });
  }

  get layer(): LayerId {
    return this.#resolved.layer;
  }

  get question() {
    return question(this.layer);
  }

  dogHere(p: PaintedProperties) {
    return dogBreed(this.view, this.layer, p);
  }

  get focus(): Focus | null {
    return this.#focus;
  }

  set focus(next: Focus | null) {
    this.#ask({ focus: next });
  }

  get filters(): Array<Filter> {
    return this.#filters;
  }

  get selected(): string | null {
    return this.#selected;
  }

  get pointing(): Pointing | null {
    return this.#pointing;
  }

  /**
   * Only assign on change; a fresh object per mouse move would rerun every reader.
   */
  point(field: Pointing["field"], value: string | null) {
    const now = this.#pointing;

    if (value == null) {
      if (now != null) {
        this.#pointing = null;
      }

      return;
    }

    if (now?.field !== field || now.value !== value) {
      this.#pointing = { field, value };
    }
  }

  isPointing(field: Pointing["field"], value: string) {
    return this.#pointing?.field === field && this.#pointing.value === value;
  }

  get tab(): "city" | "place" | "pet" {
    if (
      this.#petOpen &&
      this.#front === "pet" &&
      this.#frontFor === this.selected
    ) {
      return "pet";
    }

    if (this.selected == null) {
      return "city";
    }

    return this.#frontFor === this.selected && this.#front === "city"
      ? "city"
      : "place";
  }

  get petOpen() {
    return this.#petOpen;
  }

  showPet() {
    this.petTick += 1;
    this.#petOpen = true;
    this.#front = "pet";
    this.#frontFor = this.selected;
    this.raiseSheet("full");
  }

  closePet() {
    this.#petOpen = false;
    this.ride = null;
    if (this.#front === "pet") {
      this.#front = this.selected == null ? "city" : "place";
      this.#frontFor = this.selected;
    }
  }

  get subject(): Focus | null {
    return this.#resolved.subject;
  }

  get view(): View {
    return this.#resolved.view;
  }

  get viewLabel(): string {
    if (this.bout === "subject") {
      return this.rivals.map((r) => r.label).join(" vs ");
    }

    return this.focus?.label ?? layerDef(this.layer).label;
  }

  get viewBrief(): { short: string; gloss: string | null } {
    if (this.bout === "subject") {
      return {
        short: this.rivals.map((r) => r.label).join(" vs "),
        gloss: null,
      };
    }

    if (this.focus != null) {
      return { short: this.focus.label, gloss: null };
    }

    const def = layerDef(this.layer);

    return { short: def.short, gloss: def.gloss };
  }

  isActiveLayer(id: LayerId) {
    return this.focus == null && this.layer === id;
  }

  isActiveFocus(facet: Facet, label: string) {
    return this.focus?.facet === facet && this.focus.label === label;
  }

  bindQuery(query: Query) {
    this.#query = query;
  }

  get gone() {
    return this.sinking || this.sank;
  }

  sink() {
    this.sinking = true;
    this.capSheet("peek");
    clearTimeout(this.#towel);
    this.dripping = false;
    clearTimeout(this.#settling);
    this.settled = false;
  }

  soaked(borough: string) {
    return this.dripping && borough === SUNK_BOROUGH;
  }

  drown() {
    this.sinking = false;
    this.sank = true;

    clearTimeout(this.#settling);
    this.#settling = setTimeout(() => {
      this.settled = true;
    }, SWELL);

    const live = this.filterAt("in:borough");
    if (live?.kind !== "in") {
      return;
    }

    const kept = live.values.filter((v) => v !== SUNK_BOROUGH);
    if (kept.length === 0) {
      this.removeFilter("in:borough");
    } else if (kept.length !== live.values.length) {
      this.addFilter({ ...live, values: kept });
    }
  }

  /**
   * Called on every frame the reader's own hand drives. The cooldown is armed here
   * and not on moveend: a wheel against the zoom floor moves nothing, and the card
   * would stay out of the way for good.
   */
  roam() {
    this.roaming = true;
    clearTimeout(this.#calm);
    this.#calm = setTimeout(() => {
      this.roaming = false;
    }, BACK);
  }

  duckSheet() {
    clearTimeout(this.#back);
    if (this.#moving) {
      return;
    }

    this.#moving = true;
    if (this.#sheet !== "shut") {
      this.#ducked = this.#sheet;
      this.#sheet = "shut";
    }
  }

  freeSheet() {
    this.#moving = false;
    if (this.#ducked == null) {
      return;
    }

    clearTimeout(this.#back);
    this.#back = setTimeout(() => {
      if (this.#sheet === "shut" && this.#behind == null) {
        this.#sheet = this.#ducked ?? "peek";
      }

      this.#ducked = null;
    }, BACK);
  }

  coverSheet() {
    if (this.#behind != null) {
      return;
    }

    this.holdSheet();
    this.#behind = this.#sheet;
    this.#sheet = "shut";
  }

  uncoverSheet() {
    if (this.#behind == null) {
      return;
    }

    if (this.#sheet === "shut") {
      this.#sheet = this.#behind;
    }

    this.#behind = null;
  }

  get sheet() {
    return this.#sheet;
  }

  /** The sheet came to rest under its own drag. */
  restSheet(next: Detent) {
    this.holdSheet();
    this.#sheet = next;
  }

  /**
   * Every manual rest must pass through here or a pending #back timer re-raises the sheet.
   */
  holdSheet() {
    clearTimeout(this.#back);
    this.#ducked = null;
  }

  shutSheet() {
    this.holdSheet();
    this.#sheet = "shut";
  }

  raiseSheet(least: Detent) {
    if (RESTS.indexOf(this.#sheet) < RESTS.indexOf(least)) {
      this.#sheet = least;
    }
  }

  capSheet(most: Detent) {
    if (RESTS.indexOf(this.#sheet) > RESTS.indexOf(most)) {
      this.#sheet = most;
    }
  }

  unsink() {
    this.sinking = false;
    this.sank = false;
    this.capSheet("peek");
    clearTimeout(this.#settling);
    this.settled = false;

    if (!browser) {
      return;
    }

    clearTimeout(this.#towel);
    this.dripping = true;
    this.#towel = setTimeout(() => {
      this.dripping = false;
    }, DRYING);
  }

  openShelter(slug: string) {
    this.shelter = slug;
    this.capSheet("peek");
  }

  openSearch() {
    this.search = true;
    this.raiseSheet("full");
  }

  setLayer(layer: LayerId) {
    const def = layerDef(layer);
    const held = this.subject;

    if (def.kind === "categorical" && held?.facet === def.facet) {
      this.showSubject(
        def.facet,
        held.label,
        def.key === FACET_FIELDS[def.facet].top ? "lead" : "stand",
      );

      return;
    }

    this.#ask({ layer, focus: null });
    this.capSheet("peek");
  }

  setFocus(facet: Facet, label: string | null) {
    this.#ask({ focus: label == null ? null : { facet, label } });
    this.capSheet("peek");
    this.zoomIfNarrow();
  }

  addFilter(filter: Filter) {
    const key = filterKey(filter);
    this.#ask({
      filters: [...this.filters.filter((f) => filterKey(f) !== key), filter],
    });
  }

  removeFilter(key: string) {
    this.#ask({ filters: this.filters.filter((f) => filterKey(f) !== key) });
    this.capSheet("peek");
  }

  filterAt(key: string) {
    return this.filters.find((f) => filterKey(f) === key) ?? null;
  }

  get boroughs(): Array<string> {
    const live = this.filterAt("in:borough");

    return live?.kind === "in" ? live.values : [];
  }

  toggleBorough(borough: string) {
    const on = this.boroughs;
    const next = on.includes(borough)
      ? on.filter((b) => b !== borough)
      : [...on, borough];

    if (next.length === 0) {
      this.removeFilter("in:borough");

      return;
    }

    this.addFilter({
      kind: "in",
      field: "borough",
      values: next,
      negate: false,
    });
    this.capSheet("peek");
  }

  /**
   * One #ask; removeFilter then setFocus would be two writes in one tick and a race.
   */
  showSubject(facet: Facet, label: string, as: "live" | "lead" | "stand") {
    const { top, distinct } = FACET_FIELDS[facet];
    const mine = new Set([`in:${top}`, `in:${distinct}`]);
    const kept = this.filters.filter((f) => !mine.has(filterKey(f)));
    const field = as === "lead" ? top : distinct;

    this.#ask({
      layer: as === "live" ? this.layer : layerOfField(field),
      focus: as === "live" ? { facet, label } : null,
      filters:
        as === "live"
          ? kept
          : [...kept, { kind: "in", field, values: [label], negate: false }],
    });
    this.capSheet("peek");
    this.zoomIfNarrow();
  }

  clearFilters() {
    this.#ask({ filters: [] });
    this.capSheet("peek");
  }

  clearAll() {
    this.#ask({ filters: [], focus: null, rivals: [] });
    this.capSheet("peek");
  }

  zoomToMatches() {
    this.zoomTick += 1;
    this.capSheet("peek");
  }

  /**
   * The phone map is too small to find a newly lit set by eye, so a breed or a name
   * brings the camera with it. The wide map already shows the whole city.
   */
  zoomIfNarrow() {
    if (browser && isNarrowLayout()) {
      this.zoomToMatches();
    }
  }

  select(slug: string | null) {
    if (slug == null || (this.selected === slug && this.tab === "place")) {
      this.clearSelection();

      return;
    }

    this.goTo(slug);
  }

  goTo(slug: string) {
    this.#ask({ selected: slug });
    this.raiseSheet("full");
  }

  showCity() {
    this.#front = "city";
    this.#frontFor = this.selected;
  }

  showPlace() {
    this.#front = "place";
    this.#frontFor = this.selected;
  }

  clearSelection(shouldCollapse = true) {
    this.#ask({ selected: null });

    if (shouldCollapse) {
      this.capSheet("peek");
    }
  }

  greet() {
    if (!browser || !isNarrowLayout()) {
      return;
    }

    this.greeting = true;
  }

  get hookInBubble() {
    return this.greeting && this.#sheet !== "full";
  }

  startWalk() {
    this.greeting = false;
    this.walk = 0;
    this.leap({
      layer: DEFAULT_LAYER,
      focus: null,
      filters: [],
      rivals: [],
      at: null,
    });
    this.shutSheet();
  }

  endWalk() {
    this.greeting = false;
    this.walk = -1;
    this.leap({
      layer: DEFAULT_LAYER,
      focus: null,
      filters: [],
      rivals: [],
      at: null,
    });
    this.showCity();
    this.holdSheet();
    this.#sheet = "peek";
  }

  dismissIntro() {
    this.intro = false;

    if (!browser) {
      return;
    }

    try {
      sessionStorage.setItem(INTRO_SEEN, "1");
    } catch {
      // Storage access throws in private mode and locked-down browsers.
    }
  }

  get dialogUp() {
    return this.#overlays.some((overlay) => overlay.up());
  }

  dismissTop() {
    const top = this.#overlays.find((overlay) => overlay.up());
    if (top != null) {
      top.shut();

      return;
    }

    if (this.ride != null) {
      this.ride = null;

      return;
    }

    if (this.tab === "pet") {
      this.closePet();

      return;
    }

    if (this.selected != null && this.tab === "place") {
      this.showCity();

      return;
    }

    if (this.selected != null) {
      this.clearSelection();

      return;
    }

    this.clearAll();
  }
}

export const explorer = new Explorer();
