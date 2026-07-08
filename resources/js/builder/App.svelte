<script lang="ts">
  // ---------------------------------------------------------------------------
  // App.svelte — the builder shell (Phase 3).
  //
  // Assembles palette + canvas + property panel over a single BuilderStore, with
  // a Visual/JSON toggle and Save. Everything is a projection of store.schema.
  // ---------------------------------------------------------------------------
  import AiPanel from './lib/AiPanel.svelte';
  import Canvas from './lib/Canvas.svelte';
  import JsonEditor from './lib/JsonEditor.svelte';
  import Palette from './lib/Palette.svelte';
  import Preview from './lib/Preview.svelte';
  import PropertyPanel from './lib/PropertyPanel.svelte';
  import type { AiDraftResult, SaveResult } from './main';
  import { BuilderStore, isRtlLocale, type SurveySchema } from './store.svelte';

  interface Props {
    schema: Record<string, unknown>;
    locales: string[];
    defaultLocale: string;
    onSave?: (json: Record<string, unknown>) => SaveResult | Promise<SaveResult> | void;
    onDirty?: (dirty: boolean) => void;
    reload?: () => Promise<Record<string, unknown>>;
    onAiDraft?: (prompt: string) => Promise<AiDraftResult> | AiDraftResult;
  }

  let { schema, locales, defaultLocale, onSave, onDirty, reload, onAiDraft }: Props = $props();

  const store = new BuilderStore(schema as SurveySchema, {
    locales,
    editingLocale: defaultLocale,
    onDirty,
  });

  let tab = $state<'visual' | 'preview' | 'json'>('visual');
  let showAi = $state(false);
  let saving = $state(false);
  let newLocale = $state('');
  let status = $state<{ kind: 'idle' | 'ok' | 'error'; text: string }>({ kind: 'idle', text: '' });

  function addLocale(): void {
    store.addLocale(newLocale);
    newLocale = '';
  }

  /** New fields land on the page of the current selection, else the first page. */
  function targetPage(): number {
    return store.selectedName ? (store.findElement(store.selectedName)?.pageIndex ?? 0) : 0;
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

  async function save(): Promise<void> {
    saving = true;
    status = { kind: 'idle', text: '' };
    try {
      const result = (await onSave?.(store.export() as Record<string, unknown>)) as SaveResult | undefined;
      if (result && result.ok === false) {
        status = { kind: 'error', text: `Rejected: ${result.errors?.join('; ') ?? 'invalid schema'}` };
      } else {
        status = { kind: 'ok', text: 'Saved ✓' };
        store.markSaved();
      }
    } catch (e) {
      status = { kind: 'error', text: `Save failed: ${(e as Error).message}` };
    } finally {
      saving = false;
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

<div class="sv" data-testid="formwright-builder">
  <header class="sv-top">
    <div class="sv-brand">
      <strong>Formwright Designer</strong>
      <span class="sv-muted">{store.schema.pages.length} page(s) · {locales.join(', ')}</span>
    </div>

    <div class="sv-tabs" role="tablist">
      <button type="button" class="sv-tab" class:sv-tab--on={tab === 'visual'} onclick={() => (tab = 'visual')}>
        Build
      </button>
      <button type="button" class="sv-tab" class:sv-tab--on={tab === 'preview'} onclick={() => (tab = 'preview')}>
        Preview
      </button>
      <button type="button" class="sv-tab" class:sv-tab--on={tab === 'json'} onclick={() => (tab = 'json')}>
        JSON
      </button>
    </div>

    <div class="sv-actions">
      <label class="sv-loc" title="The locale your text edits are written to">
        <span class="sv-muted">Editing</span>
        <select bind:value={store.editingLocale} data-testid="editing-locale">
          {#each store.locales as loc (loc)}
            <option value={loc}>{loc}{isRtlLocale(loc) ? ' (RTL)' : ''}</option>
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
      {#if store.undoAvailable}
        <button type="button" class="sv-btn" data-testid="ai-undo" onclick={() => store.undo()}>Undo AI</button>
      {/if}
      {#if reload}
        <button type="button" class="sv-btn" onclick={revert} disabled={saving}>Revert</button>
      {/if}
      <button type="button" class="sv-btn sv-btn--primary" onclick={save} disabled={saving}>
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

  {#if tab === 'visual'}
    <div class="sv-grid">
      <Palette onadd={addBlock} />
      <div class="sv-canvas"><Canvas {store} /></div>
      <PropertyPanel {store} />
    </div>
  {:else if tab === 'preview'}
    <Preview {store} />
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
