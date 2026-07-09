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
    convertMatrixCellType,
    createElement,
    registry,
    resolveBlock,
} from '../schema/type-registry';
import type { LocalizedString, SurveyElement } from '../schema/type-registry';

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

/**
 * Every SurveyJS property whose value is a localized string. The translations
 * view walks the schema for these keys rather than hard-coding a list of places
 * they can appear — so choices, matrix rows, validator messages and any future
 * localized property are picked up for free.
 */
export const LOCALIZED_KEYS = new Set([
    'title',
    'description',
    'html',
    'text',
    'altText',
    'placeholder',
    'requiredErrorText',
    'labelTrue',
    'labelFalse',
    'completedHtml',
    'completedBeforeHtml',
    'loadingHtml',
    'pagePrevText',
    'pageNextText',
    'completeText',
    'startSurveyText',
    'navigationTitle',
    'navigationDescription',
]);

/** Human labels for the localized keys, for the translations grid. */
const LOCALIZED_KEY_LABELS: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    html: 'Content',
    text: 'Text',
    altText: 'Alt text',
    placeholder: 'Placeholder',
    requiredErrorText: 'Required message',
    labelTrue: '“Yes” label',
    labelFalse: '“No” label',
    completedHtml: 'Thank-you page',
    completedBeforeHtml: 'Already-submitted message',
    loadingHtml: 'Loading message',
    pagePrevText: 'Previous button',
    pageNextText: 'Next button',
    completeText: 'Submit button',
    startSurveyText: 'Start button',
    navigationTitle: 'Menu title',
    navigationDescription: 'Menu description',
};

/** One translatable string found in the schema. */
export interface TranslationEntry {
    /** Path from the schema root to the property, e.g. ['pages',0,'title']. */
    path: (string | number)[];
    /** Where it lives — 'Form', a page name, a field name, a choice value… */
    context: string;
    /** The property's human label. */
    label: string;
}

/** True when a value is a localized string (plain or `{default,…}`). */
function isLocalizedValue(value: unknown): boolean {
    if (typeof value === 'string') {
        return true;
    }

    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'default' in (value as object)
    );
}

/**
 * Recursively collect every localized string, tracking a readable context from
 * the nearest identifying field (`name` for pages/fields/items, `value` for
 * choices and matrix rows/columns).
 */
function collectTranslations(
    node: unknown,
    path: (string | number)[],
    context: string,
    out: TranslationEntry[],
): void {
    if (Array.isArray(node)) {
        node.forEach((item, i) =>
            collectTranslations(item, [...path, i], context, out),
        );

        return;
    }

    if (!node || typeof node !== 'object') {
        return;
    }

    const obj = node as Record<string, unknown>;
    let ctx = context;

    if (typeof obj.name === 'string' && obj.name !== '') {
        ctx = obj.name;
    } else if (typeof obj.value === 'string' && obj.value !== '') {
        ctx = `${context} › ${obj.value}`;
    }

    for (const [key, value] of Object.entries(obj)) {
        if (LOCALIZED_KEYS.has(key) && isLocalizedValue(value)) {
            out.push({
                path: [...path, key],
                context: ctx,
                label: LOCALIZED_KEY_LABELS[key] ?? key,
            });
        } else if (value && typeof value === 'object') {
            collectTranslations(value, [...path, key], ctx, out);
        }
    }
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

/**
 * Deep copy. Always snapshot first: `structuredClone` throws DataCloneError on a
 * Svelte `$state` proxy, and callers routinely hand us live reactive objects.
 * `$state.snapshot` is a no-op on plain values, so this is safe either way.
 */
function clone<T>(value: T): T {
    return structuredClone($state.snapshot(value) as T);
}

/** Element properties whose value is a nested list of elements. */
const NESTED_KEYS = ['elements', 'templateElements'] as const;

/** `base`, or `base_2`, `base_3`… until it is not already taken. */
function uniqueName(base: string, taken: Set<string>): string {
    if (!taken.has(base)) {
        return base;
    }

    let i = 1;
    let candidate = base;

    while (taken.has(candidate)) {
        candidate = `${base}_${++i}`;
    }

    return candidate;
}

/** Give every nested child of `el` a name that is unique against `taken`. */
function renameChildren(el: SurveyElement, taken: Set<string>): void {
    for (const key of NESTED_KEYS) {
        const nested = el[key];

        if (!Array.isArray(nested)) {
            continue;
        }

        for (const child of nested as SurveyElement[]) {
            child.name = uniqueName(String(child.name), taken);
            taken.add(child.name);
            renameChildren(child, taken);
        }
    }
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
function assignPlain(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
): void {
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
function assignLocalized(
    target: Record<string, unknown>,
    key: string,
    value: string,
    locale: string,
): void {
    const current = target[key];
    let next: Record<string, string> =
        current && typeof current === 'object'
            ? { ...(current as Record<string, string>) }
            : {};

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
export function localizedValue(
    value: LocalizedString | undefined,
    locale: string,
): string {
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
    /** History availability, for the toolbar buttons. */
    canUndo = $state(false);
    canRedo = $state(false);

    /**
     * Undo history. `#past` holds states BEFORE the current one and `#future`
     * holds states undone away from. `#present` mirrors the schema as of the last
     * committed history entry, so `#markDirty()` (the single choke point every
     * mutator already calls) can push the PRE-mutation state without each mutator
     * having to snapshot itself.
     */
    #past: SurveySchema[] = [];
    #future: SurveySchema[] = [];
    #present: SurveySchema = { pages: [] };
    /** Guards history writes while we are restoring a snapshot. */
    #restoring = false;
    /** Timestamp of the last history push, for coalescing typing bursts. */
    #lastPushAt = 0;
    /**
     * What the last edit touched. Only consecutive edits to the SAME target (a
     * typing burst in one field) coalesce. A `null` key marks a discrete action
     * (add/delete/drag/…) which neither coalesces nor can be coalesced into.
     */
    #lastKey: string | null = null;

    static readonly HISTORY_LIMIT = 50;
    /** Edits closer together than this collapse into one history entry. */
    static readonly COALESCE_MS = 450;

    #onDirty?: (dirty: boolean) => void;

    constructor(schema: SurveySchema, options: BuilderStoreOptions = {}) {
        this.schema = normalizeSchema(schema);
        this.locales = Array.from(
            new Set(['default', ...(options.locales ?? [])]),
        );
        this.editingLocale = options.editingLocale ?? 'default';
        this.#onDirty = options.onDirty;
        this.#resetHistory();
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

    /**
     * Locate an element anywhere in the tree, including inside panels
     * (`elements`) and repeating groups (`templateElements`). Returns the array
     * that actually holds it, so mutators can splice without knowing the depth.
     */
    #locate(name: string): {
        el: SurveyElement;
        container: SurveyElement[];
        index: number;
        pageIndex: number;
    } | null {
        const search = (
            els: SurveyElement[],
            pageIndex: number,
        ): {
            el: SurveyElement;
            container: SurveyElement[];
            index: number;
            pageIndex: number;
        } | null => {
            for (let i = 0; i < els.length; i++) {
                const el = els[i];

                if (el.name === name) {
                    return { el, container: els, index: i, pageIndex };
                }

                for (const key of NESTED_KEYS) {
                    const nested = el[key];

                    if (Array.isArray(nested)) {
                        const hit = search(
                            nested as SurveyElement[],
                            pageIndex,
                        );

                        if (hit) {
                            return hit;
                        }
                    }
                }
            }

            return null;
        };

        for (let p = 0; p < this.schema.pages.length; p++) {
            const hit = search(this.schema.pages[p].elements ?? [], p);

            if (hit) {
                return hit;
            }
        }

        return null;
    }

    findElement(
        name: string,
    ): { el: SurveyElement; pageIndex: number; index: number } | null {
        const hit = this.#locate(name);

        return hit
            ? { el: hit.el, pageIndex: hit.pageIndex, index: hit.index }
            : null;
    }

    /** The child array a container element holds its children in. */
    childKeyOf(el: SurveyElement): 'elements' | 'templateElements' {
        return el.type === 'paneldynamic' ? 'templateElements' : 'elements';
    }

    /** True when this element nests other elements (panel / repeating group). */
    isContainer(el: SurveyElement): boolean {
        return el.type === 'panel' || el.type === 'paneldynamic';
    }

    /** Replace a container's children wholesale (used by its own drag zone). */
    setContainerElements(name: string, elements: SurveyElement[]): void {
        const el = this.#locate(name)?.el;

        if (!el) {
            return;
        }

        el[this.childKeyOf(el)] = elements;
        this.#markDirty();
    }

    /** Add a fresh palette block inside a container. */
    addBlockToContainer(
        blockId: string,
        containerName: string,
        atIndex?: number,
    ): SurveyElement | null {
        const container = this.#locate(containerName)?.el;

        if (!container) {
            return null;
        }

        const key = this.childKeyOf(container);

        if (!Array.isArray(container[key])) {
            container[key] = [];
        }

        const children = container[key] as SurveyElement[];
        const el = createElement(blockId, this.allNames());
        children.splice(atIndex ?? children.length, 0, el);
        this.#structuralChange();
        this.select(el.name);

        return el;
    }

    /** The selected element's name, or null — kept for the many element-centric
     *  callers that predate the wider selection model. */
    get selectedName(): string | null {
        return this.selection.kind === 'element' ? this.selection.name : null;
    }

    get selected(): SurveyElement | null {
        return this.selectedName
            ? (this.findElement(this.selectedName)?.el ?? null)
            : null;
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

    /**
     * Question names in document order, for logic clause pickers. Descends into
     * panels (their children share the survey's data scope) but NOT into repeating
     * groups, whose `templateElements` are per-row and not addressable this way.
     */
    elementNamesInOrder(): string[] {
        const out: string[] = [];
        const walk = (els: SurveyElement[]): void => {
            for (const el of els) {
                if (el.type === 'panel') {
                    walk((el.elements as SurveyElement[] | undefined) ?? []);
                } else if (
                    typeof el.name === 'string' &&
                    el.type !== 'paneldynamic'
                ) {
                    out.push(el.name);
                }
            }
        };

        for (const page of this.schema.pages) {
            walk(page.elements ?? []);
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
                    for (const ref of extractReferences(
                        el[target] as string | undefined,
                    )) {
                        deps.add(ref);
                    }
                }

                if (deps.size > 0) {
                    rows.push({
                        name: el.name,
                        label:
                            localizedValue(
                                el.title as LocalizedString | undefined,
                                this.editingLocale,
                            ) || el.name,
                        dependsOn: [...deps],
                    });
                }
            }
        }

        return rows;
    }

    // -- translations -----------------------------------------------------------

    /** Every translatable string in the schema, in document order. */
    translationEntries(): TranslationEntry[] {
        const out: TranslationEntry[] = [];
        collectTranslations(this.schema, [], 'Form', out);

        return out;
    }

    /** The object that owns the property at `path` (i.e. everything but the leaf). */
    #resolveParent(path: (string | number)[]): Record<string, unknown> | null {
        let node: unknown = this.schema;

        for (let i = 0; i < path.length - 1; i++) {
            node = (node as Record<string, unknown> | undefined)?.[path[i]];

            if (node == null || typeof node !== 'object') {
                return null;
            }
        }

        return node as Record<string, unknown>;
    }

    /** Read one locale of a localized string by path — NO fallback to default. */
    localizedAtPath(path: (string | number)[], locale: string): string {
        const parent = this.#resolveParent(path);
        const value = parent?.[path[path.length - 1]];

        if (value == null) {
            return '';
        }

        if (typeof value === 'string') {
            return locale === 'default' ? value : '';
        }

        return ((value as Record<string, string>)[locale] as string) ?? '';
    }

    /** Write one locale of a localized string by path. */
    setLocalizedAtPath(
        path: (string | number)[],
        value: string,
        locale: string,
    ): void {
        const parent = this.#resolveParent(path);

        if (!parent) {
            return;
        }

        assignLocalized(parent, String(path[path.length - 1]), value, locale);
        this.#markDirty(`tr:${path.join('.')}:${locale}`);
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

    // -- undo / redo history -----------------------------------------------------

    #syncHistoryFlags(): void {
        this.canUndo = this.#past.length > 0;
        this.canRedo = this.#future.length > 0;
    }

    /** Forget all history and re-baseline on the current schema. */
    #resetHistory(): void {
        this.#past = [];
        this.#future = [];
        this.#present = this.export();
        this.#lastPushAt = 0;
        this.#lastKey = null;
        this.#syncHistoryFlags();
    }

    /**
     * Record a history entry. Called post-mutation, so the state we push is
     * `#present` — the schema as it was before this mutation. A burst of edits to
     * the same target within COALESCE_MS collapses into one entry; anything else
     * (a different field, or any discrete action) opens a new one.
     */
    #pushHistory(key: string | null): void {
        const now = Date.now();
        const coalesce =
            key !== null &&
            key === this.#lastKey &&
            now - this.#lastPushAt < BuilderStore.COALESCE_MS;

        if (!coalesce) {
            this.#past.push(this.#present);

            if (this.#past.length > BuilderStore.HISTORY_LIMIT) {
                this.#past.shift();
            }

            this.#future = []; // a fresh edit invalidates the redo branch
        }

        this.#lastKey = key;
        this.#lastPushAt = now;
        this.#present = this.export();
        this.#syncHistoryFlags();
    }

    /** Swap the schema for a history snapshot without recording new history. */
    #restore(schema: SurveySchema): void {
        this.#restoring = true;

        try {
            this.replaceSchema(clone(schema), { markDirty: false });
        } finally {
            this.#restoring = false;
        }

        this.#present = clone(schema);
        this.#lastPushAt = 0; // the next edit opens a fresh coalescing window
        this.#lastKey = null;
        this.dirty = true;
        this.#onDirty?.(true);
        this.#syncHistoryFlags();
    }

    /** Step back one history entry. */
    undo(): void {
        if (this.#past.length === 0) {
            return;
        }

        this.#future.push(this.export());
        this.#restore(this.#past.pop()!);
    }

    /** Step forward one history entry. */
    redo(): void {
        if (this.#future.length === 0) {
            return;
        }

        this.#past.push(this.export());
        this.#restore(this.#future.pop()!);
    }

    // -- mutations (do NOT bump rev; canvas projection already reflects them) ----

    /**
     * The single choke point every mutator calls. `coalesceKey` identifies what
     * was edited; pass it for per-keystroke edits so a typing burst in one field
     * becomes one undo step. Omit it (null) for discrete actions.
     */
    #markDirty(coalesceKey: string | null = null): void {
        this.dirty = true;
        this.#onDirty?.(true);

        if (!this.#restoring) {
            this.#pushHistory(coalesceKey);
        }
    }

    /** A structural change made OUTSIDE drag-and-drop; rebuilds the canvas
     *  projection by bumping `rev`. DnD commits deliberately skip this.
     *  Structural edits are discrete actions, so they never coalesce. */
    #structuralChange(): void {
        this.rev++;
        this.#markDirty();
    }

    markSaved(): void {
        this.dirty = false;
        this.#onDirty?.(false);
    }

    /** Insert a fresh element (from a palette block) into a page at an index. */
    addBlock(
        blockId: string,
        pageIndex: number,
        atIndex?: number,
    ): SurveyElement {
        const el = createElement(blockId, this.allNames());
        const els = (this.schema.pages[pageIndex].elements ??= []);
        els.splice(atIndex ?? els.length, 0, el);
        this.#structuralChange();
        this.select(el.name);

        return el;
    }

    /** Insert an existing element (e.g. from the saved-block library), renaming it
     *  if needed so names stay unique. Returns the inserted copy. */
    insertElement(
        element: SurveyElement,
        pageIndex: number,
        atIndex?: number,
    ): SurveyElement {
        const copy = clone(element);
        const taken = this.allNames();
        const base =
            typeof copy.name === 'string' && copy.name !== ''
                ? copy.name
                : 'field';
        let candidate = base;
        let i = 1;

        while (taken.has(candidate)) {
            candidate = `${base}_${++i}`;
        }

        copy.name = candidate;
        const els = this.schema.pages[pageIndex].elements;
        els.splice(atIndex ?? els.length, 0, copy);
        this.#structuralChange();
        this.select(copy.name);

        return copy;
    }

    /** Replace a page's element list wholesale (used by drag reorder / cross-page). */
    setPageElements(pageIndex: number, elements: SurveyElement[]): void {
        this.schema.pages[pageIndex].elements = elements;
        this.#markDirty(); // a drop is discrete — its own history entry
    }

    /** Replace the page list wholesale (used by page reorder). */
    setPages(pages: SurveyPage[]): void {
        this.schema.pages = pages;
        this.#markDirty();
    }

    /** Deep-copy an element in place (unique name), select the copy. */
    duplicateElement(name: string): void {
        const found = this.#locate(name);

        if (!found) {
            return;
        }

        const copy = clone($state.snapshot(found.el) as SurveyElement);
        const taken = this.allNames();

        copy.name = uniqueName(`${found.el.name}_copy`, taken);
        taken.add(copy.name);
        // A duplicated panel brings its children with it — rename those too, or the
        // copy would reuse names that already exist elsewhere in the form.
        renameChildren(copy, taken);

        found.container.splice(found.index + 1, 0, copy);
        this.#structuralChange();
        this.select(copy.name);
    }

    removeElement(name: string): void {
        const found = this.#locate(name);

        if (!found) {
            return;
        }

        found.container.splice(found.index, 1);

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
        this.#markDirty(`prop:${name}:${key}`);
    }

    /** Set a localized property into a locale (default: the current editing locale),
     *  always keeping a `default` value present. */
    setLocalizedProp(
        name: string,
        key: string,
        value: string,
        locale: string = this.editingLocale,
    ): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        assignLocalized(el, key, value, locale);
        this.#markDirty(`loc:${name}:${key}:${locale}`);
    }

    // -- survey (form) attributes -----------------------------------------------

    /** Set a plain attribute on the survey root (title/description live locale-side). */
    setSurveyProp(key: string, value: unknown): void {
        assignPlain(this.schema, key, value);
        this.#markDirty(`survey:${key}`);
    }

    setSurveyLocalizedProp(
        key: string,
        value: string,
        locale: string = this.editingLocale,
    ): void {
        assignLocalized(this.schema, key, value, locale);
        this.#markDirty(`surveyloc:${key}:${locale}`);
    }

    // -- page attributes --------------------------------------------------------

    /** Set a plain attribute on a page (found by name). */
    setPageProp(name: string, key: string, value: unknown): void {
        const page = this.schema.pages.find((p) => p.name === name);

        if (!page) {
            return;
        }

        assignPlain(page, key, value);
        this.#markDirty(`page:${name}:${key}`);
    }

    setPageLocalizedProp(
        name: string,
        key: string,
        value: string,
        locale: string = this.editingLocale,
    ): void {
        const page = this.schema.pages.find((p) => p.name === name);

        if (!page) {
            return;
        }

        assignLocalized(page, key, value, locale);
        this.#markDirty(`pageloc:${name}:${key}:${locale}`);
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

        const next = requested.trim().replace(/\s+/g, '_');

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

        if (
            this.selection.kind === 'element' &&
            this.selection.name === oldName
        ) {
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
        this.#markDirty(`points:${name}`);
    }

    /** Set the native `correctAnswer`. An empty value clears it (still scored). */
    setCorrectAnswer(name: string, value: unknown): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        const empty =
            value === '' ||
            value === undefined ||
            value === null ||
            (Array.isArray(value) && value.length === 0);

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

        const current = Array.isArray(el.correctAnswer)
            ? [...(el.correctAnswer as string[])]
            : [];
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

        // Re-read after ensuring the array exists (the assignment expression yields
        // the raw array, not the tracked $state proxy — see addValidator).
        if (!Array.isArray(el.choices)) {
            el.choices = [];
        }

        const choices = el.choices as Array<{
            value: string;
            text?: LocalizedString;
        }>;
        const value = `option_${choices.length + 1}`;
        choices.push({
            value,
            text: { default: `Option ${choices.length + 1}` },
        });
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

        if (!Array.isArray(el.choices)) {
            el.choices = [];
        }

        const choices = el.choices as Array<{
            value: string;
            text?: LocalizedString;
        }>;
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

    updateChoice(
        name: string,
        index: number,
        patch: { value?: string; text?: string },
    ): void {
        const el = this.findElement(name)?.el;
        const choices = el?.choices as
            Array<{ value: string; text?: LocalizedString }> | undefined;

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
                current && typeof current === 'object'
                    ? { ...(current as Record<string, string>) }
                    : {};
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

    /** Set an arbitrary plain property on one choice (e.g. an imagepicker's
     *  `imageLink`). Empty values delete the key. */
    setChoiceProp(
        name: string,
        index: number,
        prop: string,
        value: unknown,
    ): void {
        const choices = this.findElement(name)?.el.choices as
            Array<Record<string, unknown>> | undefined;

        if (!choices?.[index]) {
            return;
        }

        assignPlain(choices[index], prop, value);
        this.#markDirty();
    }

    // -- dynamic choice sources (choicesByUrl / choicesFromQuestion) -------------

    /** Names of choice-based questions (for carry-forward), excluding one. */
    choiceQuestionNames(exclude?: string): string[] {
        const CHOICE_TYPES = new Set([
            'radiogroup',
            'checkbox',
            'dropdown',
            'tagbox',
            'ranking',
            'imagepicker',
            'buttongroup',
        ]);
        const out: string[] = [];
        const walk = (els: SurveyElement[]): void => {
            for (const el of els) {
                if (el.type === 'panel') {
                    walk((el.elements as SurveyElement[] | undefined) ?? []);
                } else if (CHOICE_TYPES.has(el.type) && el.name !== exclude) {
                    out.push(el.name);
                }
            }
        };

        for (const page of this.schema.pages) {
            walk(page.elements ?? []);
        }

        return out;
    }

    /** Switch where a field's choices come from, clearing the other sources. */
    setChoiceSource(name: string, source: 'static' | 'question' | 'url'): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        if (source === 'static') {
            delete el.choicesByUrl;
            delete el.choicesFromQuestion;
            delete el.choicesFromQuestionMode;
        } else if (source === 'url') {
            // A dynamic source supersedes any manual list; drop it for clean JSON.
            delete el.choices;
            delete el.choicesFromQuestion;
            delete el.choicesFromQuestionMode;

            if (!el.choicesByUrl || typeof el.choicesByUrl !== 'object') {
                el.choicesByUrl = {};
            }
        } else {
            delete el.choices;
            delete el.choicesByUrl;

            if (typeof el.choicesFromQuestion !== 'string') {
                el.choicesFromQuestion =
                    this.choiceQuestionNames(name)[0] ?? '';
            }
        }

        this.#markDirty();
    }

    /** Patch one property of `choicesByUrl` (url/path/valueName/titleName). */
    setChoicesByUrlProp(name: string, key: string, value: unknown): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        if (!el.choicesByUrl || typeof el.choicesByUrl !== 'object') {
            el.choicesByUrl = {};
        }

        assignPlain(el.choicesByUrl as Record<string, unknown>, key, value);
        this.#markDirty(`cbu:${name}:${key}`);
    }

    // -- generic sub-item lists (matrix rows/columns, multipletext items) --------

    /** Append an item to a named array on a field (e.g. `rows`, `columns`, `items`). */
    addListItem(
        name: string,
        key: string,
        item: Record<string, unknown>,
    ): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        if (!Array.isArray(el[key])) {
            el[key] = [];
        }

        (el[key] as Array<Record<string, unknown>>).push(item);
        this.#markDirty();
    }

    /** Set a plain property on one list item (empty value deletes the key). */
    setListItemProp(
        name: string,
        key: string,
        index: number,
        prop: string,
        value: unknown,
    ): void {
        const list = this.findElement(name)?.el[key] as
            Array<Record<string, unknown>> | undefined;

        if (!list?.[index]) {
            return;
        }

        assignPlain(list[index], prop, value);
        this.#markDirty(`list:${name}:${key}:${index}:${prop}`);
    }

    /** Set a localized property on one list item, keeping a `default` present. */
    setListItemLocalized(
        name: string,
        key: string,
        index: number,
        prop: string,
        value: string,
        locale: string = this.editingLocale,
    ): void {
        const list = this.findElement(name)?.el[key] as
            Array<Record<string, unknown>> | undefined;

        if (!list?.[index]) {
            return;
        }

        assignLocalized(list[index], prop, value, locale);
        this.#markDirty(`listloc:${name}:${key}:${index}:${prop}:${locale}`);
    }

    removeListItem(name: string, key: string, index: number): void {
        const el = this.findElement(name)?.el;
        const list = el?.[key] as unknown[] | undefined;

        if (!el || !list) {
            return;
        }

        list.splice(index, 1);

        if (list.length === 0) {
            delete el[key];
        }

        this.#markDirty();
    }

    /**
     * Switch a simple Matrix between radio and other cell inputs. `radio` keeps
     * the native single-select `matrix`; any other value stores it as a uniform
     * `matrixdropdown` (see `convertMatrixCellType`). A discrete history entry.
     */
    setMatrixCellType(name: string, cellType: string): void {
        const el = this.findElement(name)?.el;

        if (!el) {
            return;
        }

        convertMatrixCellType(el, cellType);
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
    setValidatorProp(
        name: string,
        index: number,
        key: string,
        value: unknown,
    ): void {
        const list = this.findElement(name)?.el.validators as
            Array<Record<string, unknown>> | undefined;

        if (!list?.[index]) {
            return;
        }

        assignPlain(list[index], key, value);
        this.#markDirty(`validator:${name}:${index}:${key}`);
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

        (
            this.schema.completedHtmlOnCondition as Array<
                Record<string, unknown>
            >
        ).push({ expression: '', html: '' });
        this.#markDirty();
    }

    setCompletedConditionProp(
        index: number,
        key: string,
        value: unknown,
    ): void {
        const list = this.schema.completedHtmlOnCondition as
            Array<Record<string, unknown>> | undefined;

        if (!list?.[index]) {
            return;
        }

        assignPlain(list[index], key, value);
        this.#markDirty(`cond:${index}:${key}`);
    }

    removeCompletedCondition(index: number): void {
        const list = this.schema.completedHtmlOnCondition as
            unknown[] | undefined;

        if (!list) {
            return;
        }

        list.splice(index, 1);

        if (list.length === 0) {
            delete this.schema.completedHtmlOnCondition;
        }

        this.#markDirty();
    }

    // -- survey-root lists (triggers, calculatedValues) -------------------------

    /** Append an item to a named array on the survey root. */
    addSurveyListItem(key: string, item: Record<string, unknown>): void {
        if (!Array.isArray(this.schema[key])) {
            this.schema[key] = [];
        }

        (this.schema[key] as Array<Record<string, unknown>>).push(item);
        this.#markDirty();
    }

    /** Set a plain property on one survey-root list item (empty value deletes it). */
    setSurveyListItemProp(
        key: string,
        index: number,
        prop: string,
        value: unknown,
    ): void {
        const list = this.schema[key] as
            Array<Record<string, unknown>> | undefined;

        if (!list?.[index]) {
            return;
        }

        assignPlain(list[index], prop, value);
        this.#markDirty(`slist:${key}:${index}:${prop}`);
    }

    removeSurveyListItem(key: string, index: number): void {
        const list = this.schema[key] as unknown[] | undefined;

        if (!list) {
            return;
        }

        list.splice(index, 1);

        if (list.length === 0) {
            delete this.schema[key];
        }

        this.#markDirty();
    }

    // -- theme (survey-core theme object under schema.theme) ---------------------

    /** Ensure `schema.theme` exists and return the tracked proxy. */
    #theme(): Record<string, unknown> {
        if (
            !this.schema.theme ||
            typeof this.schema.theme !== 'object' ||
            Array.isArray(this.schema.theme)
        ) {
            this.schema.theme = {};
        }

        return this.schema.theme as Record<string, unknown>;
    }

    /** Drop `schema.theme` when it has become empty, to keep exported JSON clean. */
    #pruneTheme(): void {
        const t = this.schema.theme as Record<string, unknown> | undefined;

        if (t && Object.keys(t).length === 0) {
            delete this.schema.theme;
        }
    }

    /** Set a top-level theme property (colorPalette, isPanelless, themeName). */
    setThemeProp(key: string, value: unknown): void {
        const theme = this.#theme();
        assignPlain(theme, key, value);
        this.#pruneTheme();
        this.#markDirty(`theme:${key}`);
    }

    /** Set a single CSS variable in the theme (empty value removes it). */
    setThemeVar(name: string, value: unknown): void {
        const theme = this.#theme();

        if (!theme.cssVariables || typeof theme.cssVariables !== 'object') {
            theme.cssVariables = {};
        }

        const vars = theme.cssVariables as Record<string, unknown>;
        assignPlain(vars, name, value);

        if (Object.keys(vars).length === 0) {
            delete theme.cssVariables;
        }

        this.#pruneTheme();
        this.#markDirty(`themevar:${name}`);
    }

    /** Read a theme CSS variable (or ''). */
    themeVar(name: string): string {
        const vars = (this.schema.theme as Record<string, unknown> | undefined)
            ?.cssVariables as Record<string, unknown> | undefined;
        const v = vars?.[name];

        return typeof v === 'string' ? v : '';
    }

    /** Read a top-level theme property (or ''). */
    themeProp(name: string): unknown {
        return (this.schema.theme as Record<string, unknown> | undefined)?.[
            name
        ];
    }

    /** Clear the whole theme back to survey-core defaults. */
    resetTheme(): void {
        delete this.schema.theme;
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

        if (
            this.selection.kind === 'page' &&
            this.selection.name === removed?.name
        ) {
            this.selection = { kind: 'none' };
        }

        this.#structuralChange();
    }

    // -- wholesale replacement (bumps rev so projections rebuild) ---------------

    replaceSchema(
        schema: SurveySchema,
        { markDirty = true }: { markDirty?: boolean } = {},
    ): void {
        this.schema = normalizeSchema(schema);
        this.selection = { kind: 'none' };
        this.rev++;

        if (markDirty) {
            this.#markDirty();
        } else if (!this.#restoring) {
            // A wholesale load (initial / revert / JSON apply) is a new baseline —
            // there is nothing meaningful to undo back to.
            this.#resetHistory();
        }
    }

    /**
     * Apply an AI-proposed schema. It lands as a single, discrete history entry
     * (never coalesced into a preceding keystroke), so one Undo reverts it.
     */
    applyProposal(schema: SurveySchema): void {
        this.replaceSchema(schema);
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
    const schema: SurveySchema =
        input && typeof input === 'object' ? clone(input) : { pages: [] };

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
export const paletteBlocks = registry.map((b) => ({
    id: b.id,
    label: b.label,
    icon: b.icon,
}));

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
    resolveGroup('Essentials', [
        'short_text',
        'long_text',
        'number',
        'date',
        'color',
    ]),
    resolveGroup('Choices', [
        'single_choice',
        'multiple_choice',
        'dropdown',
        'tagbox',
        'boolean',
        'button_group',
        'rating',
        'ranking',
        'image_picker',
    ]),
    resolveGroup('Grids', [
        'matrix',
        'matrix_dropdown',
        'matrix_dynamic',
        'multiple_text',
    ]),
    resolveGroup('Layout', ['panel', 'panel_dynamic']),
    resolveGroup('Content', ['statement', 'image', 'expression']),
    resolveGroup('Uploads', ['file', 'signature']),
];
