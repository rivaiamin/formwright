<script lang="ts">
  // Page attributes — a projection of the selected page. Titles/descriptions are
  // localized; visibility and order map to native SurveyJS page properties.
  import type { BuilderStore } from '../store.svelte';
  import LocalizedInput from './LocalizedInput.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  let showAdvanced = $state(false);

  const selected = $derived(store.selectedPage);
  const page = $derived(selected?.page ?? null);

  const setLoc = (key: string) => (value: string, locale: string) => {
    if (page) {
      store.setPageLocalizedProp(page.name, key, value, locale);
    }
  };
</script>

<aside class="panel" aria-label="Page settings">
  <div class="panel__bar">
    <span class="panel__heading">Page settings</span>
    <button class="panel__close" aria-label="Deselect" onclick={() => store.select(null)}>×</button>
  </div>

  {#if !page}
    <p class="panel__help">This page no longer exists.</p>
  {:else}
    <!-- BASICS -->
    <p class="panel__section">Basics</p>
    <LocalizedInput {store} target={page} propKey="title" label="Page title" onset={setLoc('title')} />
    <LocalizedInput
      {store}
      target={page}
      propKey="description"
      label="Description"
      multiline
      onset={setLoc('description')}
    />

    <!-- VISIBILITY -->
    <p class="panel__section">Visibility</p>
    <label class="field__check">
      <input
        type="checkbox"
        data-testid="page-hidden"
        checked={page.visible === false}
        onchange={(e) => store.setPageProp(page.name, 'visible', e.currentTarget.checked ? false : '')}
      />
      Hidden page
    </label>
    <p class="panel__help">The page is skipped but its fields stay in the schema.</p>

    <div class="field">
      <label class="field__label" for="page-visibleif">Show this page only if…</label>
      <textarea
        id="page-visibleif"
        data-testid="page-visibleif"
        rows="2"
        placeholder="{'{age}'} >= 18"
        value={typeof page.visibleIf === 'string' ? page.visibleIf : ''}
        oninput={(e) => store.setPageProp(page.name, 'visibleIf', e.currentTarget.value)}
      ></textarea>
      <p class="panel__help">A SurveyJS expression referencing other fields, e.g. <code>{'{role}'} = 'admin'</code>.</p>
    </div>

    <!-- ORDER -->
    <p class="panel__section">Question order</p>
    <div class="field">
      <label class="field__label" for="page-order">Order</label>
      <select
        id="page-order"
        value={typeof page.questionsOrder === 'string' ? page.questionsOrder : 'default'}
        onchange={(e) => store.setPageProp(page.name, 'questionsOrder', e.currentTarget.value === 'default' ? '' : e.currentTarget.value)}
      >
        <option value="default">As designed</option>
        <option value="random">Randomize</option>
      </select>
    </div>

    <!-- ADVANCED -->
    <button
      type="button"
      class="panel__disc"
      data-testid="page-advanced-toggle"
      onclick={() => (showAdvanced = !showAdvanced)}
    >
      {showAdvanced ? '▾' : '▸'} Advanced
    </button>
    {#if showAdvanced}
      <div class="field">
        <label class="field__label" for="page-name">Page name</label>
        <input
          id="page-name"
          type="text"
          value={page.name}
          onchange={(e) => store.renamePage(page.name, e.currentTarget.value)}
        />
      </div>
      <p class="panel__warn">Warning: renaming a page can break logic that references it.</p>
    {/if}
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .panel__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .panel__heading {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .panel__close {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    opacity: 0.5;
    padding: 0.1rem 0.3rem;
  }
  .panel__close:hover {
    opacity: 1;
  }
  .panel__section {
    margin: 0.5rem 0 0.1rem;
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    opacity: 0.45;
    border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    padding-top: 0.6rem;
  }
  .panel__help {
    margin: -0.1rem 0 0.2rem;
    font-size: 0.72rem;
    opacity: 0.55;
    line-height: 1.35;
  }
  .panel__help code {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
  }
  .panel__warn {
    margin: -0.1rem 0 0.2rem;
    font-size: 0.72rem;
    line-height: 1.35;
    padding: 0.35rem 0.5rem;
    border-radius: 0.4rem;
    color: #b45309;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
  }
  .panel__disc {
    text-align: start;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
    padding: 0.5rem 0 0.1rem;
    border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field__label {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .field__check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
  }
  .field :global(input[type='text']),
  .field select,
  .field textarea {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border-radius: 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    color: inherit;
    font-size: 0.85rem;
    font-family: inherit;
  }
</style>
