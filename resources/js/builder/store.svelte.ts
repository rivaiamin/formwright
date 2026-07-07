// =============================================================================
// store.svelte.ts — the builder's single source of truth.
//
// The canonical SurveyJS survey JSON lives here. Palette, canvas, property
// panel, JSON editor and preview are all PROJECTIONS of this object — per the
// guide's rule that the schema is the contract and both views are projections
// of one JSON (never a proprietary intermediate format).
//
// `rev` bumps only on WHOLESALE replacement (load / JSON-apply). The canvas
// keeps a local drag projection and rebuilds it when `rev` changes; in-place
// edits (property panel, dnd) do NOT bump `rev`, which prevents the visual<->JSON
// sync loop the guide warns about.
// =============================================================================

import { extractReferences } from '../schema/logic-expression';
import {
  blockById,
  createElement,
  registry,
  resolveBlock,
  type LocalizedString,
  type SurveyElement,
} from '../schema/type-registry';

/** The element properties the logic builder can target. */
export const LOGIC_TARGETS = ['visibleIf', 'enableIf', 'requiredIf'] as const;
export type LogicTarget = (typeof LOGIC_TARGETS)[number];

/**
 * What the property panel is currently editing. The panel is a projection of
 * this, exactly like the canvas is a projection of the schema: an element, a
 * page, the whole survey, or nothing. Pages are tracked by NAME (stable across
 * reorder), elements by name, the survey needs no key.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'element'; name: string }
  | { kind: 'page'; name: string }
  | { kind: 'survey' };

/** One row of the dependency ("logic map") view. */
export interface LogicDependency {
  name: string;
  label: string;
  dependsOn: string[];
}

/** A page in the survey. */
export interface SurveyPage {
  name: string;
  title?: LocalizedString;
  elements: SurveyElement[];
  [key: string]: unknown;
}

/** The whole survey document. */
export interface SurveySchema {
  title?: LocalizedString;
  locale?: string;
  pages: SurveyPage[];
  [key: string]: unknown;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Turn a display label into a stable snake_case value. */
function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'option';
}

/** Write a plain (non-localized) property onto a target, deleting empties. */
function assignPlain(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === '' || value === undefined || value === null) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

/**
 * Write a localized string into `target[key]` for a locale, always keeping a
 * `default` present. Shared by element, page and survey editors.
 */
function assignLocalized(target: Record<string, unknown>, key: string, value: string, locale: string): void {
  const current = target[key];
  let next: Record<string, string> =
    current && typeof current === 'object' ? { ...(current as Record<string, string>) } : {};

  if (typeof current === 'string') {
    next = { default: current };
  }

  if (value === '') {
    delete next[locale];
  } else {
    next[locale] = value;
  }
  if (locale !== 'default' && next.default === undefined && value !== '') {
    next.default = value;
  }

  if (Object.keys(next).length === 0) {
    delete target[key];
  } else {
    target[key] = next;
  }
}

/** Read a possibly-localized string for a given locale, falling back to default. */
export function localizedValue(value: LocalizedString | undefined, locale: string): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return (value[locale] as string) ?? value.default ?? '';
}

/** RTL locales — direction is derived from the active locale, never hand-set
 *  per field. Mirrors config/formbuilder.php `rtl_locales`. */
export const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'dv']);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale);
}

export interface BuilderStoreOptions {
  locales?: string[];
  editingLocale?: string;
  onDirty?: (dirty: boolean) => void;
}

export class BuilderStore {
  schema = $state<SurveySchema>({ pages: [] });
  selection = $state<Selection>({ kind: 'none' });
  editingLocale = $state('default');
  /** Locales available for authoring/preview; always includes 'default'. */
  locales = $state<string[]>(['default']);
  rev = $state(0);
  dirty = $state(false);
  /** True when an AI proposal has been applied and can be undone. */
  undoAvailable = $state(false);

  #undoSnapshot: SurveySchema | null = null;
  #onDirty?: (dirty: boolean) => void;

  constructor(schema: SurveySchema, options: BuilderStoreOptions = {}) {
    this.schema = normalizeSchema(schema);
    this.locales = Array.from(new Set(['default', ...(options.locales ?? [])]));
    this.editingLocale = options.editingLocale ?? 'default';
    this.#onDirty = options.onDirty;
  }

  /** Add a locale to the authoring set (and switch to editing it). */
  addLocale(code: string): void {
    const locale = code.trim().toLowerCase();
    if (locale === '' || this.locales.includes(locale)) {
      if (locale !== '') {
        this.editingLocale = locale;
      }
      return;
    }
    this.locales = [...this.locales, locale];
    this.editingLocale = locale;
  }

  // -- derived helpers --------------------------------------------------------

  /** All element names across every page (incl. nested), for uniqueness checks. */
  allNames(): Set<string> {
    const names = new Set<string>();
    const walk = (els: SurveyElement[]) => {
      for (const el of els) {
        if (typeof el.name === 'string') {
          names.add(el.name);
        }
        for (const key of ['elements', 'templateElements'] as const) {
          const nested = el[key];
          if (Array.isArray(nested)) {
            walk(nested as SurveyElement[]);
          }
        }
      }
    };
    for (const page of this.schema.pages) {
      walk(page.elements ?? []);
    }
    return names;
  }

  findElement(name: string): { el: SurveyElement; pageIndex: number; index: number } | null {
    for (let p = 0; p < this.schema.pages.length; p++) {
      const els = this.schema.pages[p].elements ?? [];
      const i = els.findIndex((e) => e.name === name);
      if (i !== -1) {
        return { el: els[i], pageIndex: p, index: i };
      }
    }
    return null;
  }

  /** The selected element's name, or null — kept for the many element-centric
   *  callers that predate the wider selection model. */
  get selectedName(): string | null {
    return this.selection.kind === 'element' ? this.selection.name : null;
  }

  get selected(): SurveyElement | null {
    return this.selectedName ? (this.findElement(this.selectedName)?.el ?? null) : null;
  }

  /** The selected page (resolved by name, so reorder can't stale it), or null. */
  get selectedPage(): { page: SurveyPage; index: number } | null {
    if (this.selection.kind !== 'page') {
      return null;
    }
    const name = this.selection.name;
    const index = this.schema.pages.findIndex((p) => p.name === name);
    return index === -1 ? null : { page: this.schema.pages[index], index };
  }

  /** Top-level element names in document order (for logic clause pickers). */
  elementNamesInOrder(): string[] {
    const out: string[] = [];
    for (const page of this.schema.pages) {
      for (const el of page.elements ?? []) {
        if (typeof el.name === 'string') {
          out.push(el.name);
        }
      }
    }
    return out;
  }

  /** Elements that reference other questions in any logic target. */
  logicDependencies(): LogicDependency[] {
    const rows: LogicDependency[] = [];
    for (const page of this.schema.pages) {
      for (const el of page.elements ?? []) {
        const deps = new Set<string>();
        for (const target of LOGIC_TARGETS) {
          for (const ref of extractReferences(el[target] as string | undefined)) {
            deps.add(ref);
          }
        }
        if (deps.size > 0) {
          rows.push({
            name: el.name,
            label: localizedValue(el.title as LocalizedString | undefined, this.editingLocale) || el.name,
            dependsOn: [...deps],
          });
        }
      }
    }
    return rows;
  }

  // -- selection --------------------------------------------------------------

  select(name: string | null): void {
    this.selection = name ? { kind: 'element', name } : { kind: 'none' };
  }

  /** Edit a page's own attributes in the property panel. */
  selectPage(name: string): void {
    this.selection = { kind: 'page', name };
  }

  /** Edit the survey (form) attributes in the property panel. */
  selectSurvey(): void {
    this.selection = { kind: 'survey' };
  }

  // -- mutations (do NOT bump rev; canvas projection already reflects them) ----

  #markDirty(): void {
    this.dirty = true;
    this.#onDirty?.(true);
  }

  /** A structural change made OUTSIDE drag-and-drop; rebuilds the canvas
   *  projection by bumping `rev`. DnD commits deliberately skip this. */
  #structuralChange(): void {
    this.rev++;
    this.#markDirty();
  }

  markSaved(): void {
    this.dirty = false;
    this.#onDirty?.(false);
  }

  /** Insert a fresh element (from a palette block) into a page at an index. */
  addBlock(blockId: string, pageIndex: number, atIndex?: number): SurveyElement {
    const el = createElement(blockId, this.allNames());
    const els = this.schema.pages[pageIndex].elements ??= [];
    els.splice(atIndex ?? els.length, 0, el);
    this.#structuralChange();
    this.select(el.name);
    return el;
  }

  /** Replace a page's element list wholesale (used by drag reorder / cross-page). */
  setPageElements(pageIndex: number, elements: SurveyElement[]): void {
    this.schema.pages[pageIndex].elements = elements;
    this.#markDirty();
  }

  /** Replace the page list wholesale (used by page reorder). */
  setPages(pages: SurveyPage[]): void {
    this.schema.pages = pages;
    this.#markDirty();
  }

  /** Deep-copy an element in place (unique name), select the copy. */
  duplicateElement(name: string): void {
    const found = this.findElement(name);
    if (!found) {
      return;
    }
    const copy = clone($state.snapshot(found.el) as SurveyElement);
    const taken = this.allNames();
    let candidate = `${found.el.name}_copy`;
    let i = 1;
    while (taken.has(candidate)) {
      candidate = `${found.el.name}_copy_${++i}`;
    }
    copy.name = candidate;
    this.schema.pages[found.pageIndex].elements.splice(found.index + 1, 0, copy);
    this.#structuralChange();
    this.select(copy.name);
  }

  removeElement(name: string): void {
    const found = this.findElement(name);
    if (!found) {
      return;
    }
    this.schema.pages[found.pageIndex].elements.splice(found.index, 1);
    if (this.selectedName === name) {
      this.select(null);
    }
    this.#structuralChange();
  }

  /** Set a plain (non-localized) property; deletes the key when value is empty. */
  setProp(name: string, key: string, value: unknown): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    assignPlain(el, key, value);
    this.#markDirty();
  }

  /** Set a localized property into a locale (default: the current editing locale),
   *  always keeping a `default` value present. */
  setLocalizedProp(name: string, key: string, value: string, locale: string = this.editingLocale): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    assignLocalized(el, key, value, locale);
    this.#markDirty();
  }

  // -- survey (form) attributes -----------------------------------------------

  /** Set a plain attribute on the survey root (title/description live locale-side). */
  setSurveyProp(key: string, value: unknown): void {
    assignPlain(this.schema, key, value);
    this.#markDirty();
  }

  setSurveyLocalizedProp(key: string, value: string, locale: string = this.editingLocale): void {
    assignLocalized(this.schema, key, value, locale);
    this.#markDirty();
  }

  // -- page attributes --------------------------------------------------------

  /** Set a plain attribute on a page (found by name). */
  setPageProp(name: string, key: string, value: unknown): void {
    const page = this.schema.pages.find((p) => p.name === name);
    if (!page) {
      return;
    }
    assignPlain(page, key, value);
    this.#markDirty();
  }

  setPageLocalizedProp(name: string, key: string, value: string, locale: string = this.editingLocale): void {
    const page = this.schema.pages.find((p) => p.name === name);
    if (!page) {
      return;
    }
    assignLocalized(page, key, value, locale);
    this.#markDirty();
  }

  /** Rename a page, guaranteeing uniqueness. Bumps rev (the canvas keys on name).
   *  Returns the applied name. */
  renamePage(oldName: string, requested: string): string {
    const page = this.schema.pages.find((p) => p.name === oldName);
    if (!page) {
      return oldName;
    }
    const next = requested.trim().replace(/\s+/g, '_');
    if (next === '' || next === oldName) {
      return oldName;
    }
    const taken = new Set(this.schema.pages.map((p) => p.name));
    taken.delete(oldName);
    let candidate = next;
    let i = 1;
    while (taken.has(candidate)) {
      candidate = `${next}_${++i}`;
    }
    page.name = candidate;
    if (this.selection.kind === 'page' && this.selection.name === oldName) {
      this.selection = { kind: 'page', name: candidate };
    }
    this.#structuralChange();
    return candidate;
  }

  /** Rename an element, guaranteeing uniqueness. Returns the applied name. */
  renameElement(oldName: string, requested: string): string {
    const el = this.findElement(oldName)?.el;
    if (!el) {
      return oldName;
    }
    let next = requested.trim().replace(/\s+/g, '_');
    if (next === '' || next === oldName) {
      return oldName;
    }
    const taken = this.allNames();
    taken.delete(oldName);
    let candidate = next;
    let i = 1;
    while (taken.has(candidate)) {
      candidate = `${next}_${++i}`;
    }
    el.name = candidate;
    if (this.selection.kind === 'element' && this.selection.name === oldName) {
      this.selection = { kind: 'element', name: candidate };
    }
    this.#structuralChange();
    return candidate;
  }

  // -- quiz scoring -----------------------------------------------------------

  /** True when the element is marked as scored (carries points/correctAnswer). */
  isScored(el: SurveyElement): boolean {
    return 'points' in el || 'correctAnswer' in el;
  }

  /** Turn scoring on/off for an element. On adds `points` (the scored marker);
   *  off strips both `points` and `correctAnswer`. */
  setScored(name: string, on: boolean): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    if (on) {
      if (el.points === undefined) {
        el.points = 1;
      }
    } else {
      delete el.points;
      delete el.correctAnswer;
    }
    this.#markDirty();
  }

  setPoints(name: string, points: number): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    el.points = Number.isFinite(points) ? points : 1;
    this.#markDirty();
  }

  /** Set the native `correctAnswer`. An empty value clears it (still scored). */
  setCorrectAnswer(name: string, value: unknown): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    const empty = value === '' || value === undefined || value === null || (Array.isArray(value) && value.length === 0);
    if (empty) {
      delete el.correctAnswer;
    } else {
      el.correctAnswer = value;
    }
    this.#markDirty();
  }

  /** Toggle one choice value in a multi-answer (checkbox) correctAnswer array. */
  toggleCorrectChoice(name: string, value: string, checked: boolean): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    const current = Array.isArray(el.correctAnswer) ? [...(el.correctAnswer as string[])] : [];
    const i = current.indexOf(value);
    if (checked && i === -1) {
      current.push(value);
    } else if (!checked && i !== -1) {
      current.splice(i, 1);
    }
    if (current.length > 0) {
      el.correctAnswer = current;
    } else {
      delete el.correctAnswer;
    }
    this.#markDirty();
  }

  // -- choices editing (radiogroup/checkbox/dropdown) -------------------------

  addChoice(name: string): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    const choices = (el.choices ??= []) as Array<{ value: string; text?: LocalizedString }>;
    const value = `option_${choices.length + 1}`;
    choices.push({ value, text: { default: `Option ${choices.length + 1}` } });
    this.#markDirty();
  }

  /** Add a choice from a display label; the value is a unique slug of the label. */
  addChoiceFromText(name: string, text: string): void {
    const label = text.trim();
    if (label === '') {
      return;
    }
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    const choices = (el.choices ??= []) as Array<{ value: string; text?: LocalizedString }>;
    const taken = new Set(choices.map((c) => c.value));
    const base = slugify(label);
    let value = base;
    let i = 1;
    while (taken.has(value)) {
      value = `${base}_${++i}`;
    }
    const textObj: Record<string, string> = { default: label };
    if (this.editingLocale !== 'default') {
      textObj[this.editingLocale] = label;
    }
    choices.push({ value, text: textObj });
    this.#markDirty();
  }

  /** Bulk-add choices, one per non-empty line (for paste). */
  addChoicesFromLines(name: string, lines: string[]): void {
    for (const line of lines) {
      this.addChoiceFromText(name, line);
    }
  }

  updateChoice(name: string, index: number, patch: { value?: string; text?: string }): void {
    const el = this.findElement(name)?.el;
    const choices = el?.choices as Array<{ value: string; text?: LocalizedString }> | undefined;
    if (!choices?.[index]) {
      return;
    }
    if (patch.value !== undefined) {
      choices[index].value = patch.value;
    }
    if (patch.text !== undefined) {
      const locale = this.editingLocale;
      const current = choices[index].text;
      const next: Record<string, string> =
        current && typeof current === 'object' ? { ...(current as Record<string, string>) } : {};
      next[locale] = patch.text;
      if (locale !== 'default' && next.default === undefined) {
        next.default = patch.text;
      }
      choices[index].text = next;
    }
    this.#markDirty();
  }

  removeChoice(name: string, index: number): void {
    const el = this.findElement(name)?.el;
    const choices = el?.choices as unknown[] | undefined;
    if (!choices) {
      return;
    }
    choices.splice(index, 1);
    this.#markDirty();
  }

  // -- field validators -------------------------------------------------------

  /** Append a validator of a given type to a field. */
  addValidator(name: string, type: string): void {
    const el = this.findElement(name)?.el;
    if (!el) {
      return;
    }
    // Re-read after ensuring the array exists: assigning `[]` into the $state
    // proxy stores a *proxied* array, but the assignment expression yields the
    // raw one — pushing to that raw array would not be tracked.
    if (!Array.isArray(el.validators)) {
      el.validators = [];
    }
    (el.validators as Array<Record<string, unknown>>).push({ type });
    this.#markDirty();
  }

  /** Patch one property of a validator (empty value deletes the key). */
  setValidatorProp(name: string, index: number, key: string, value: unknown): void {
    const list = this.findElement(name)?.el.validators as Array<Record<string, unknown>> | undefined;
    if (!list?.[index]) {
      return;
    }
    assignPlain(list[index], key, value);
    this.#markDirty();
  }

  removeValidator(name: string, index: number): void {
    const el = this.findElement(name)?.el;
    const list = el?.validators as unknown[] | undefined;
    if (!el || !list) {
      return;
    }
    list.splice(index, 1);
    if (list.length === 0) {
      delete el.validators;
    }
    this.#markDirty();
  }

  // -- survey completion conditions -------------------------------------------

  /** Append a per-condition thank-you page (expression → html). */
  addCompletedCondition(): void {
    // See addValidator: re-read after ensuring the array exists so we push into
    // the tracked proxy, not the raw array the assignment expression returns.
    if (!Array.isArray(this.schema.completedHtmlOnCondition)) {
      this.schema.completedHtmlOnCondition = [];
    }
    (this.schema.completedHtmlOnCondition as Array<Record<string, unknown>>).push({ expression: '', html: '' });
    this.#markDirty();
  }

  setCompletedConditionProp(index: number, key: string, value: unknown): void {
    const list = this.schema.completedHtmlOnCondition as Array<Record<string, unknown>> | undefined;
    if (!list?.[index]) {
      return;
    }
    assignPlain(list[index], key, value);
    this.#markDirty();
  }

  removeCompletedCondition(index: number): void {
    const list = this.schema.completedHtmlOnCondition as unknown[] | undefined;
    if (!list) {
      return;
    }
    list.splice(index, 1);
    if (list.length === 0) {
      delete this.schema.completedHtmlOnCondition;
    }
    this.#markDirty();
  }

  // -- pages ------------------------------------------------------------------

  addPage(): void {
    const names = new Set(this.schema.pages.map((p) => p.name));
    let i = this.schema.pages.length + 1;
    let pageName = `page${i}`;
    while (names.has(pageName)) {
      pageName = `page${++i}`;
    }
    this.schema.pages.push({ name: pageName, elements: [] });
    this.#structuralChange();
  }

  removePage(index: number): void {
    if (this.schema.pages.length <= 1) {
      return;
    }
    const removed = this.schema.pages[index];
    this.schema.pages.splice(index, 1);
    if (this.selection.kind === 'page' && this.selection.name === removed?.name) {
      this.selection = { kind: 'none' };
    }
    this.#structuralChange();
  }

  // -- wholesale replacement (bumps rev so projections rebuild) ---------------

  replaceSchema(schema: SurveySchema, { markDirty = true }: { markDirty?: boolean } = {}): void {
    this.schema = normalizeSchema(schema);
    this.selection = { kind: 'none' };
    this.rev++;
    if (markDirty) {
      this.#markDirty();
    }
  }

  /** Apply an AI-proposed schema, saving the current one so it can be undone. */
  applyProposal(schema: SurveySchema): void {
    this.#undoSnapshot = this.export();
    this.replaceSchema(schema);
    this.undoAvailable = true;
  }

  /** Restore the schema from before the last applied AI proposal. */
  undo(): void {
    if (this.#undoSnapshot === null) {
      return;
    }
    const snapshot = this.#undoSnapshot;
    this.#undoSnapshot = null;
    this.undoAvailable = false;
    this.replaceSchema(snapshot);
  }

  /** A clean, serializable copy of the schema for saving/preview. */
  export(): SurveySchema {
    return clone($state.snapshot(this.schema) as SurveySchema);
  }

  /** True when an element has no visual editor (advanced/unknown → locked). */
  isLocked(el: SurveyElement): boolean {
    return resolveBlock(el) === null;
  }
}

/** Ensure the working schema always has a pages array with element arrays. */
function normalizeSchema(input: SurveySchema): SurveySchema {
  const schema: SurveySchema = input && typeof input === 'object' ? clone(input) : { pages: [] };
  if (!Array.isArray(schema.pages) || schema.pages.length === 0) {
    schema.pages = [{ name: 'page1', elements: [] }];
  }
  schema.pages = schema.pages.map((page, i) => ({
    ...page,
    name: page.name ?? `page${i + 1}`,
    elements: Array.isArray(page.elements) ? page.elements : [],
  }));
  return schema;
}

/** The palette entries, projected from the type-registry. */
export const paletteBlocks = registry.map((b) => ({ id: b.id, label: b.label, icon: b.icon }));

/** One palette block's display metadata. */
export interface PaletteBlock {
  id: string;
  label: string;
  icon: string;
}

/** A named palette section. */
export interface PaletteGroup {
  label: string;
  blocks: PaletteBlock[];
}

function resolveGroup(label: string, ids: string[]): PaletteGroup {
  const blocks = ids
    .map((id) => blockById(id))
    .filter((b): b is NonNullable<typeof b> => b != null)
    .map((b) => ({ id: b.id, label: b.label, icon: b.icon }));
  return { label, blocks };
}

/**
 * The palette, grouped for display (order independent of the registry's
 * match-precedence order).
 */
export const PALETTE_GROUPS: PaletteGroup[] = [
  resolveGroup('Essentials', ['short_text', 'long_text', 'number', 'date']),
  resolveGroup('Choices', ['single_choice', 'multiple_choice', 'dropdown', 'boolean', 'rating']),
  resolveGroup('Content', ['statement', 'image']),
  resolveGroup('Uploads', ['file', 'signature']),
];
