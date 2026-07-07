<script lang="ts">
  import { resolveBlock, type Choice, type SurveyElement } from '../../schema/type-registry';
  import { localizedValue, type BuilderStore } from '../store.svelte';

  interface Props {
    element: SurveyElement;
    store: BuilderStore;
    selected?: boolean;
    onselect?: () => void;
    onremove?: () => void;
    onduplicate?: () => void;
  }

  let { element, store, selected = false, onselect, onremove, onduplicate }: Props = $props();

  let locale = $derived(store.editingLocale);
  let block = $derived(resolveBlock(element));
  let locked = $derived(block === null);
  let title = $derived(localizedValue(element.title as never, locale) || element.name);

  function choices(): Choice[] {
    return (element.choices as Choice[] | undefined) ?? [];
  }

  type ItemValue = { value: string; text?: unknown };
  function rows(): ItemValue[] {
    return (element.rows as ItemValue[] | undefined) ?? [];
  }
  function columns(): ItemValue[] {
    return (element.columns as ItemValue[] | undefined) ?? [];
  }
  function items(): Array<{ name: string; title?: unknown }> {
    return (element.items as Array<{ name: string; title?: unknown }> | undefined) ?? [];
  }

  function stop(e: Event): void {
    e.stopPropagation();
  }
</script>

<div
  class="card"
  class:card--selected={selected}
  class:card--locked={locked}
  data-element={element.name}
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onselect?.())}
>
  <span class="card__grip" aria-hidden="true">⠿</span>

  <div class="card__body">
    <div class="card__head">
      <span class="card__badge" class:card__badge--locked={locked}>
        {locked ? `Advanced · ${element.type}` : block?.label}
      </span>
      {#if !locked}
        <div class="card__actions">
          {#if onduplicate}
            <button type="button" data-action="duplicate" title="Duplicate" aria-label="Duplicate field" onclick={(e) => (stop(e), onduplicate?.())}>⧉</button>
          {/if}
          {#if onremove}
            <button type="button" data-action="delete" title="Delete" aria-label="Delete field" onclick={(e) => (stop(e), onremove?.())}>🗑</button>
          {/if}
        </div>
      {/if}
    </div>

    {#if locked}
      <p class="card__locked">Advanced type — edit in the JSON tab. Preserved exactly.</p>
    {:else if block?.id === 'statement'}
      <div class="card__statement">{localizedValue(element.html as never, locale) || 'Statement text…'}</div>
    {:else if block?.id === 'image'}
      {#if element.imageLink}
        <img class="card__image" src={String(element.imageLink)} alt={title} />
      {:else}
        <div class="prev-box prev-box--muted">No image URL</div>
      {/if}
    {:else}
      <div class="card__title">
        {title}
        {#if element.isRequired}<span class="card__req" title="Required">*</span>{/if}
      </div>

      <!-- live, non-interactive preview of the control -->
      {#if block?.id === 'short_text' || block?.id === 'number' || block?.id === 'date'}
        <div class="prev-input">{block?.id === 'date' ? 'dd / mm / yyyy' : localizedValue(element.placeholder as never, locale) || ''}</div>
      {:else if block?.id === 'long_text'}
        <div class="prev-input prev-input--area"></div>
      {:else if block?.id === 'single_choice' || block?.id === 'multiple_choice'}
        <div class="prev-choices">
          {#each choices() as choice, i (i)}
            <label class="prev-choice">
              <span class="prev-mark" class:prev-mark--radio={block?.id === 'single_choice'}></span>
              {localizedValue(choice.text as never, locale) || choice.value}
            </label>
          {/each}
          <button type="button" class="prev-add" onclick={(e) => (stop(e), store.addChoice(element.name))}>+ Add choice</button>
        </div>
      {:else if block?.id === 'dropdown' || block?.id === 'tagbox'}
        <div class="prev-input prev-input--select">
          {#if block?.id === 'tagbox' && choices().length}
            <span class="prev-tag">{localizedValue(choices()[0].text as never, locale) || choices()[0].value} ×</span>
          {:else}
            {choices().length ? localizedValue(choices()[0].text as never, locale) || choices()[0].value : 'Select…'}
          {/if}
          <span aria-hidden="true">▾</span>
        </div>
      {:else if block?.id === 'ranking'}
        <div class="prev-choices">
          {#each choices() as choice, i (i)}
            <div class="prev-rank">
              <span class="prev-rank__grip" aria-hidden="true">⠿</span>
              <span class="prev-rank__n">{i + 1}</span>
              {localizedValue(choice.text as never, locale) || choice.value}
            </div>
          {/each}
          <button type="button" class="prev-add" onclick={(e) => (stop(e), store.addChoice(element.name))}>+ Add choice</button>
        </div>
      {:else if block?.id === 'expression'}
        <div class="prev-input prev-input--expr">
          <span aria-hidden="true">=</span>
          {typeof element.expression === 'string' && element.expression ? element.expression : 'computed value'}
        </div>
      {:else if block?.id === 'multiple_text'}
        <div class="prev-mt">
          {#each items() as item, i (i)}
            <div class="prev-mt__row">
              <span class="prev-mt__label">{localizedValue(item.title as never, locale) || item.name}</span>
              <span class="prev-input prev-mt__field"></span>
            </div>
          {/each}
        </div>
      {:else if block?.id === 'matrix'}
        <div class="prev-matrix" style={`grid-template-columns: minmax(3rem,1fr) repeat(${Math.max(columns().length, 1)}, auto);`}>
          <span></span>
          {#each columns() as col (col.value)}
            <span class="prev-matrix__col">{localizedValue(col.text as never, locale) || col.value}</span>
          {/each}
          {#each rows() as row (row.value)}
            <span class="prev-matrix__row">{localizedValue(row.text as never, locale) || row.value}</span>
            {#each columns() as col (col.value)}
              <span class="prev-mark prev-mark--radio prev-matrix__cell"></span>
            {/each}
          {/each}
        </div>
      {:else if block?.id === 'boolean'}
        <div class="prev-bool">
          <span class="prev-pill">{localizedValue(element.labelTrue as never, locale) || 'Yes'}</span>
          <span class="prev-pill">{localizedValue(element.labelFalse as never, locale) || 'No'}</span>
        </div>
      {:else if block?.id === 'rating'}
        <div class="prev-stars" aria-hidden="true">
          {#each Array(typeof element.rateMax === 'number' ? element.rateMax : 5) as _, i (i)}
            <span class="prev-star">★</span>
          {/each}
        </div>
      {:else if block?.id === 'file'}
        <div class="prev-box">Choose a file…</div>
      {:else if block?.id === 'signature'}
        <div class="prev-box prev-box--tall">Sign here</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .card {
    display: flex;
    gap: 0.6rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in srgb, currentColor 2%, transparent);
    cursor: pointer;
    text-align: start;
  }
  .card--selected {
    border-color: #f59e0b;
    box-shadow: 0 0 0 1px #f59e0b;
  }
  .card--locked {
    border-style: dashed;
    opacity: 0.9;
  }
  .card__grip {
    cursor: grab;
    opacity: 0.35;
    padding-top: 0.15rem;
  }
  .card__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .card__badge {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    border-radius: 0.4rem;
    padding: 0.1rem 0.4rem;
  }
  .card__badge--locked {
    color: #b45309;
    opacity: 0.95;
  }
  .card__actions {
    display: flex;
    gap: 0.2rem;
  }
  .card__actions button {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.5;
    font-size: 0.9rem;
    padding: 0.15rem 0.35rem;
    border-radius: 0.35rem;
    line-height: 1;
  }
  .card__actions button:hover {
    opacity: 1;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .card__title {
    font-size: 1rem;
    font-weight: 600;
  }
  .card__req {
    color: #dc2626;
    margin-inline-start: 0.15rem;
  }
  .card__locked {
    margin: 0;
    font-size: 0.82rem;
    opacity: 0.7;
  }
  .card__statement {
    font-size: 0.95rem;
    opacity: 0.85;
  }
  .card__image {
    max-width: 100%;
    max-height: 160px;
    border-radius: 0.4rem;
  }
  /* control previews — non-interactive */
  .prev-input {
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 0.45rem;
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
    opacity: 0.7;
    background: color-mix(in srgb, currentColor 3%, transparent);
    pointer-events: none;
  }
  .prev-input--area {
    min-height: 3.2rem;
  }
  .prev-input--select {
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
  }
  .prev-choices {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .prev-choice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .prev-mark {
    width: 0.9rem;
    height: 0.9rem;
    border: 1.5px solid color-mix(in srgb, currentColor 40%, transparent);
    border-radius: 0.25rem;
    flex: none;
  }
  .prev-mark--radio {
    border-radius: 50%;
  }
  .prev-add {
    align-self: start;
    border: none;
    background: transparent;
    color: #b45309;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.15rem 0;
  }
  .prev-bool {
    display: flex;
    gap: 0.4rem;
  }
  .prev-pill {
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 999px;
    padding: 0.25rem 0.8rem;
    font-size: 0.82rem;
    opacity: 0.8;
  }
  .prev-stars {
    display: flex;
    gap: 0.15rem;
    color: #f59e0b;
    font-size: 1.25rem;
  }
  .prev-box {
    border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 0.45rem;
    padding: 0.6rem;
    text-align: center;
    font-size: 0.82rem;
    opacity: 0.6;
  }
  .prev-box--tall {
    padding: 1.4rem 0.6rem;
  }
  .prev-box--muted {
    opacity: 0.45;
  }
  .prev-tag {
    border: 1px solid color-mix(in srgb, #f59e0b 45%, transparent);
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    border-radius: 0.35rem;
    padding: 0.05rem 0.4rem;
    font-size: 0.78rem;
  }
  .prev-rank {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 0.4rem;
    padding: 0.3rem 0.5rem;
  }
  .prev-rank__grip {
    opacity: 0.4;
  }
  .prev-rank__n {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    opacity: 0.6;
  }
  .prev-input--expr {
    display: flex;
    gap: 0.4rem;
    font-family: ui-monospace, monospace;
  }
  .prev-mt {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .prev-mt__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .prev-mt__label {
    flex: 0 0 6rem;
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .prev-mt__field {
    flex: 1;
  }
  .prev-matrix {
    display: grid;
    gap: 0.3rem 0.6rem;
    align-items: center;
    font-size: 0.82rem;
  }
  .prev-matrix__col {
    text-align: center;
    opacity: 0.7;
    font-size: 0.76rem;
  }
  .prev-matrix__row {
    opacity: 0.8;
  }
  .prev-matrix__cell {
    justify-self: center;
    margin: 0;
  }
</style>
