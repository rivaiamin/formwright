<script lang="ts">
  import { untrack } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';

  import type { SurveyElement } from '../../schema/type-registry';
  import {
    DND_FIELD_TYPE,
    DND_PAGE_TYPE,
    FLIP_MS,
    fromWrappers,
    isTemplate,
    toWrappers,
    type ElementWrapper,
    type FieldDndItem,
  } from '../dnd';
  import type { BuilderStore, SurveyPage } from '../store.svelte';
  import { localizedValue } from '../store.svelte';
  import ElementCard from './ElementCard.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  /** Local drag projection of the schema. Rebuilt only when `store.rev` bumps
   *  (wholesale / structural change), never on a dnd commit — this is what keeps
   *  the visual<->JSON sync from looping. */
  interface PageView {
    id: string;
    page: SurveyPage;
    items: FieldDndItem[];
  }

  let board = $state<PageView[]>(buildBoard());

  function buildBoard(): PageView[] {
    return store.schema.pages.map((page) => ({
      id: page.name,
      page,
      items: toWrappers(page.elements),
    }));
  }

  $effect(() => {
    store.rev; // track ONLY the structural revision
    untrack(() => {
      board = buildBoard();
    });
  });

  // -- field dnd (within a page, across pages, and palette drops) -------------

  function onFieldConsider(pv: PageView, e: CustomEvent<{ items: FieldDndItem[] }>): void {
    pv.items = e.detail.items;
  }

  function onFieldFinalize(pv: PageView, e: CustomEvent<{ items: FieldDndItem[] }>): void {
    const pageIndex = board.indexOf(pv);
    const droppedTemplate = e.detail.items.some(isTemplate);
    const before = store.allNames();

    // Convert any palette templates into real elements, unwrap the rest.
    const elements = fromWrappers(e.detail.items, new Set(before));
    pv.items = toWrappers(elements);
    store.setPageElements(pageIndex, elements);

    if (droppedTemplate) {
      // Select the element that was just created by this drop.
      const created = elements.find((el) => !before.has(el.name));
      store.select((created ?? elements[elements.length - 1])?.name ?? null);
    }
  }

  // -- page reorder -----------------------------------------------------------

  function onPageConsider(e: CustomEvent<{ items: PageView[] }>): void {
    board = e.detail.items;
  }

  function onPageFinalize(e: CustomEvent<{ items: PageView[] }>): void {
    board = e.detail.items;
    store.setPages(board.map((pv) => pv.page));
  }

  function elementOf(item: FieldDndItem): SurveyElement | null {
    return isTemplate(item) ? null : item.element;
  }
</script>

<div
  class="board"
  use:dndzone={{ items: board, type: DND_PAGE_TYPE, flipDurationMs: FLIP_MS, dropTargetStyle: {} }}
  onconsider={onPageConsider}
  onfinalize={onPageFinalize}
>
  {#each board as pv (pv.id)}
    <section
      class="page"
      class:page--on={store.selection.kind === 'page' && store.selection.name === pv.page.name}
      data-page={pv.page.name}
    >
      <header class="page__head">
        <span class="page__grip" aria-hidden="true">⠿</span>
        <button
          type="button"
          class="page__name"
          title="Page settings"
          data-testid="page-select"
          onclick={() => store.selectPage(pv.page.name)}
        >
          {localizedValue(pv.page.title, store.editingLocale) || pv.page.name}
        </button>
        <span class="page__count">{pv.page.elements.length} field(s)</span>
        {#if board.indexOf(pv) === 0 && store.schema.firstPageIsStarted}
          <span class="page__badge" title="Shown as a welcome screen with a Start button">Start page</span>
        {/if}
        <button
          type="button"
          class="page__cog"
          title="Page settings"
          aria-label="Page settings"
          onclick={() => store.selectPage(pv.page.name)}
        >
          ⚙
        </button>
        {#if board.length > 1}
          <button
            type="button"
            class="page__del"
            title="Delete page"
            onclick={() => store.removePage(board.indexOf(pv))}
          >
            Remove page
          </button>
        {/if}
      </header>

      <div
        class="page__fields"
        class:page__fields--empty={pv.items.length === 0}
        use:dndzone={{ items: pv.items, type: DND_FIELD_TYPE, flipDurationMs: FLIP_MS, dropTargetStyle: {} }}
        onconsider={(e) => onFieldConsider(pv, e)}
        onfinalize={(e) => onFieldFinalize(pv, e)}
      >
        {#each pv.items as item (item.id)}
          {@const el = elementOf(item)}
          <div class="board__item">
            {#if el}
              <ElementCard
                element={el}
                {store}
                selected={store.selectedName === el.name}
                onselect={() => store.select(el.name)}
                onremove={() => store.removeElement(el.name)}
                onduplicate={() => store.duplicateElement(el.name)}
              />
            {:else if isTemplate(item)}
              <div class="ghost">{item.label}</div>
            {/if}
          </div>
        {/each}

        {#if pv.items.length === 0}
          <p class="page__empty">Drag a field here, or click one in the palette.</p>
        {/if}
      </div>
    </section>
  {/each}
</div>

<button type="button" class="addpage" onclick={() => store.addPage()}>+ Add page</button>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .page {
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 0.7rem;
    overflow: hidden;
  }
  .page--on {
    border-color: #f59e0b;
    box-shadow: 0 0 0 1px #f59e0b;
  }
  .page__head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    background: color-mix(in srgb, currentColor 6%, transparent);
    cursor: grab;
  }
  .page__grip {
    opacity: 0.4;
  }
  .page__name {
    font-weight: 600;
    font-size: 0.9rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: start;
  }
  .page__name:hover {
    text-decoration: underline;
  }
  .page__count {
    font-size: 0.72rem;
    opacity: 0.55;
  }
  .page__badge {
    font-size: 0.66rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #b45309;
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    border-radius: 0.35rem;
    padding: 0.1rem 0.4rem;
  }
  .page__cog {
    margin-inline-start: auto;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 0.9rem;
    opacity: 0.55;
    cursor: pointer;
    line-height: 1;
  }
  .page__cog:hover {
    opacity: 1;
  }
  .page__del {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 0.75rem;
    opacity: 0.6;
    cursor: pointer;
  }
  .page__del:hover {
    opacity: 1;
    color: #dc2626;
  }
  .page__fields {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    min-height: 3.2rem;
  }
  .page__fields--empty {
    border: 1px dashed color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 0.5rem;
    margin: 0.4rem;
  }
  .page__empty {
    margin: 0;
    padding: 0.6rem;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.5;
  }
  .ghost {
    padding: 0.6rem 0.7rem;
    border: 1px dashed #f59e0b;
    border-radius: 0.6rem;
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .addpage {
    margin-top: 0.6rem;
    border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    padding: 0.5rem 0.9rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.82rem;
    width: 100%;
  }
</style>
