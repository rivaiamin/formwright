<script lang="ts">
    // ---------------------------------------------------------------------------
    // App.svelte — the builder shell (Phase 3).
    //
    // Assembles palette + canvas + property panel over a single BuilderStore, with
    // a Visual/JSON toggle and Save. Everything is a projection of store.schema.
    // ---------------------------------------------------------------------------
    import type { SurveyElement } from '../schema/type-registry';
    import AiPanel from './lib/AiPanel.svelte';
    import Canvas from './lib/Canvas.svelte';
    import HistoryPanel from './lib/HistoryPanel.svelte';
    import JsonEditor from './lib/JsonEditor.svelte';
    import Palette from './lib/Palette.svelte';
    import Preview from './lib/Preview.svelte';
    import PropertyPanel from './lib/PropertyPanel.svelte';
    import TemplatesPanel from './lib/TemplatesPanel.svelte';
    import TranslationsGrid from './lib/TranslationsGrid.svelte';
    import { BlockLibrary } from './library.svelte';
    import type { SavedBlock } from './library.svelte';
    import type {
        AiDraftResult,
        RestoreResult,
        RevisionInfo,
        SaveResult,
    } from './main';
    import { BuilderStore, isRtlLocale } from './store.svelte';
    import type { SurveySchema } from './store.svelte';

    interface Props {
        schema: Record<string, unknown>;
        locales: string[];
        defaultLocale: string;
        dataSources?: { key: string; label: string }[];
        dataSourceUrl?: string;
        onSave?: (
            json: Record<string, unknown>,
        ) => SaveResult | Promise<SaveResult> | void;
        onDirty?: (dirty: boolean) => void;
        reload?: () => Promise<Record<string, unknown>>;
        onAiDraft?: (prompt: string) => Promise<AiDraftResult> | AiDraftResult;
        onRevisions?: () => Promise<RevisionInfo[]> | RevisionInfo[];
        onRestore?: (id: number) => Promise<RestoreResult> | RestoreResult;
    }

    let {
        schema,
        locales,
        defaultLocale,
        dataSources = [],
        dataSourceUrl = '',
        onSave,
        onDirty,
        reload,
        onAiDraft,
        onRevisions,
        onRestore,
    }: Props = $props();

    const store = new BuilderStore(schema as SurveySchema, {
        locales,
        editingLocale: defaultLocale,
        dataSources,
        dataSourceUrl,
        onDirty,
    });

    const library = new BlockLibrary();

    let tab = $state<'visual' | 'preview' | 'translations' | 'json'>('visual');
    let showAi = $state(false);
    let showTemplates = $state(false);
    let showHistory = $state(false);
    let saving = $state(false);
    let newLocale = $state('');
    let status = $state<{ kind: 'idle' | 'ok' | 'error'; text: string }>({
        kind: 'idle',
        text: '',
    });

    function addLocale(): void {
        store.addLocale(newLocale);
        newLocale = '';
    }

    /** New fields land on the page of the current selection, else the first page. */
    function targetPage(): number {
        return store.selectedName
            ? (store.findElement(store.selectedName)?.pageIndex ?? 0)
            : 0;
    }

    function addBlock(blockId: string): void {
        const selected = store.selected;

        // Clicking a palette block while a panel is selected drops it INSIDE the
        // panel — which is what the selection implies.
        if (selected && store.isContainer(selected)) {
            store.addBlockToContainer(blockId, selected.name);
        } else {
            store.addBlock(blockId, targetPage());
        }

        status = { kind: 'idle', text: '' };
    }

    /** Save a configured field into the library, labelled by its title or name. */
    function saveBlock(element: SurveyElement): void {
        const title = element.title as
            { default?: string } | string | undefined;
        const label =
            typeof title === 'string'
                ? title
                : (title?.default ?? element.name);
        // `element` is a $state proxy — structuredClone would throw DataCloneError.
        library.add($state.snapshot(element) as SurveyElement, label);
        // Deliberately avoids the word "Saved" — it would collide with the Save button
        // and the save-status banner for anything matching on visible text.
        status = { kind: 'ok', text: `Added “${label}” to the library` };
    }

    function insertSaved(block: SavedBlock): void {
        store.insertElement(block.element, targetPage());
        status = { kind: 'idle', text: '' };
    }

    async function save(): Promise<void> {
        saving = true;
        status = { kind: 'idle', text: '' };

        try {
            const result = (await onSave?.(
                store.export() as Record<string, unknown>,
            )) as SaveResult | undefined;

            if (result && result.ok === false) {
                status = {
                    kind: 'error',
                    text: `Rejected: ${result.errors?.join('; ') ?? 'invalid schema'}`,
                };
            } else {
                status = { kind: 'ok', text: 'Saved ✓' };
                store.markSaved();
            }
        } catch (e) {
            status = {
                kind: 'error',
                text: `Save failed: ${(e as Error).message}`,
            };
        } finally {
            saving = false;
        }
    }

    /** Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo — but never while the
     *  user is typing in a field, where the browser's own undo should win. */
    function onKeydown(e: KeyboardEvent): void {
        if (!(e.ctrlKey || e.metaKey)) {
            return;
        }

        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;

        if (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            t?.isContentEditable
        ) {
            return;
        }

        const key = e.key.toLowerCase();

        if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            store.undo();
        } else if ((key === 'z' && e.shiftKey) || key === 'y') {
            e.preventDefault();
            store.redo();
        }
    }

    async function revert(): Promise<void> {
        if (!reload) {
            return;
        }

        const fresh = await reload();
        store.replaceSchema(fresh as SurveySchema, { markDirty: false });
        store.markSaved();
        status = { kind: 'idle', text: 'Reloaded from database' };
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sv" data-testid="formwright-builder">
    <header class="sv-top">
        <div class="sv-brand">
            <strong>Formwright Designer</strong>
            <span class="sv-muted"
                >{store.schema.pages.length} page(s) · {locales.join(
                    ', ',
                )}</span
            >
        </div>

        <div class="sv-tabs" role="tablist">
            <button
                type="button"
                class="sv-tab"
                class:sv-tab--on={tab === 'visual'}
                onclick={() => (tab = 'visual')}
            >
                Build
            </button>
            <button
                type="button"
                class="sv-tab"
                class:sv-tab--on={tab === 'preview'}
                onclick={() => (tab = 'preview')}
            >
                Preview
            </button>
            <button
                type="button"
                class="sv-tab"
                class:sv-tab--on={tab === 'translations'}
                data-testid="tab-translations"
                onclick={() => (tab = 'translations')}
            >
                Translations
            </button>
            <button
                type="button"
                class="sv-tab"
                class:sv-tab--on={tab === 'json'}
                onclick={() => (tab = 'json')}
            >
                JSON
            </button>
        </div>

        <div class="sv-actions">
            <label
                class="sv-loc"
                title="The locale your text edits are written to"
            >
                <span class="sv-muted">Editing</span>
                <select
                    bind:value={store.editingLocale}
                    data-testid="editing-locale"
                >
                    {#each store.locales as loc (loc)}
                        <option value={loc}
                            >{loc}{isRtlLocale(loc) ? ' (RTL)' : ''}</option
                        >
                    {/each}
                </select>
            </label>
            <input
                class="sv-loc__add"
                placeholder="+ locale"
                aria-label="Add locale"
                bind:value={newLocale}
                onkeydown={(e) => e.key === 'Enter' && addLocale()}
            />
            {#if onRevisions && onRestore}
                <button
                    type="button"
                    class="sv-btn"
                    class:sv-btn--on={showHistory}
                    data-testid="history-toggle"
                    title="Saved version history"
                    onclick={() => {
                        tab = 'visual';
                        showHistory = !showHistory;
                    }}
                >
                    History
                </button>
            {/if}
            <button
                type="button"
                class="sv-btn"
                class:sv-btn--on={showTemplates}
                data-testid="templates-toggle"
                title="Start from a template"
                onclick={() => {
                    tab = 'visual';
                    showTemplates = !showTemplates;
                }}
            >
                Templates
            </button>
            <button
                type="button"
                class="sv-btn"
                data-testid="form-settings"
                title="Edit form-wide settings"
                onclick={() => {
                    tab = 'visual';
                    store.selectSurvey();
                }}
            >
                ⚙ Form
            </button>
            <button
                type="button"
                class="sv-btn sv-btn--icon"
                data-testid="undo"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                disabled={!store.canUndo}
                onclick={() => store.undo()}
            >
                ↶
            </button>
            <button
                type="button"
                class="sv-btn sv-btn--icon"
                data-testid="redo"
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
                disabled={!store.canRedo}
                onclick={() => store.redo()}
            >
                ↷
            </button>
            {#if reload}
                <button
                    type="button"
                    class="sv-btn"
                    onclick={revert}
                    disabled={saving}>Revert</button
                >
            {/if}
            <button
                type="button"
                class="sv-btn sv-btn--primary"
                onclick={save}
                disabled={saving}
            >
                {saving ? 'Saving…' : 'Save'}
            </button>
        </div>
    </header>

    {#if status.kind !== 'idle'}
        <p class="sv-status sv-status--{status.kind}">{status.text}</p>
    {/if}

    {#if onAiDraft && showAi && tab === 'visual'}
        <AiPanel {store} {onAiDraft} />
    {/if}

    {#if showTemplates && tab === 'visual'}
        <TemplatesPanel {store} onapplied={() => (showTemplates = false)} />
    {/if}

    {#if showHistory && tab === 'visual' && onRevisions && onRestore}
        <HistoryPanel
            {store}
            {onRevisions}
            {onRestore}
            onrestored={() => (showHistory = false)}
        />
    {/if}

    {#if tab === 'visual'}
        <div class="sv-grid">
            <Palette onadd={addBlock} {library} oninsertsaved={insertSaved} />
            <div class="sv-canvas">
                <Canvas {store} onsaveblock={saveBlock} />
            </div>
            <PropertyPanel {store} />
        </div>
    {:else if tab === 'preview'}
        <Preview {store} />
    {:else if tab === 'translations'}
        <TranslationsGrid {store} />
    {:else}
        <JsonEditor {store} />
    {/if}

    {#if onAiDraft && tab === 'visual'}
        <button
            type="button"
            class="sv-fab"
            class:sv-fab--on={showAi}
            data-testid="ai-fab"
            title="AI assistant"
            aria-label="Toggle AI assistant"
            onclick={() => (showAi = !showAi)}
        >
            ✦
        </button>
    {/if}
</div>

<style>
    .sv {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color: inherit;
    }
    .sv-top {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .sv-brand {
        display: flex;
        flex-direction: column;
    }
    .sv-muted {
        font-size: 0.75rem;
        opacity: 0.55;
    }
    .sv-tabs {
        display: flex;
        gap: 0.25rem;
        margin-inline: auto;
        background: color-mix(in srgb, currentColor 8%, transparent);
        padding: 0.2rem;
        border-radius: 0.6rem;
    }
    .sv-tab {
        border: none;
        background: transparent;
        color: inherit;
        padding: 0.35rem 0.9rem;
        border-radius: 0.45rem;
        cursor: pointer;
        font-size: 0.82rem;
    }
    .sv-tab--on {
        background: color-mix(in srgb, currentColor 12%, transparent);
        font-weight: 600;
    }
    .sv-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }
    .sv-loc {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8rem;
    }
    .sv-loc select,
    .sv-loc__add {
        padding: 0.35rem 0.5rem;
        border-radius: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.8rem;
    }
    .sv-loc__add {
        width: 5.5rem;
    }
    .sv-btn {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        padding: 0.4rem 0.9rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.85rem;
    }
    .sv-btn:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .sv-btn--icon {
        padding: 0.4rem 0.6rem;
        font-size: 1rem;
        line-height: 1;
    }
    .sv-btn--on {
        background: color-mix(in srgb, #f59e0b 18%, transparent);
        border-color: #f59e0b;
    }
    .sv-btn--primary {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #1c1917;
        font-weight: 600;
    }
    .sv-status {
        margin: 0;
        font-size: 0.85rem;
        padding: 0.4rem 0.6rem;
        border-radius: 0.5rem;
    }
    .sv-status--ok {
        background: color-mix(in srgb, #16a34a 18%, transparent);
    }
    .sv-status--error {
        background: color-mix(in srgb, #dc2626 18%, transparent);
    }
    .sv-grid {
        display: grid;
        grid-template-columns: 190px 1fr 260px;
        gap: 0.9rem;
        align-items: start;
    }
    .sv-canvas {
        min-height: 60vh;
    }
    @media (max-width: 900px) {
        .sv-grid {
            grid-template-columns: 1fr;
        }
    }
    .sv-fab {
        position: fixed;
        right: 1.5rem;
        bottom: 1.5rem;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        border: none;
        background: #f59e0b;
        color: #1c1917;
        font-size: 1.3rem;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
        z-index: 40;
    }
    .sv-fab--on {
        outline: 3px solid color-mix(in srgb, #f59e0b 45%, transparent);
    }
    .sv-fab:hover {
        filter: brightness(1.05);
    }
</style>
