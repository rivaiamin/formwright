<script lang="ts">
  // The imagepicker's choices: each option is an image URL plus an optional
  // label. Same `choices[]` array as the other choice types, but every item
  // carries an `imageLink`, which the plain choices editor has no field for.
  import { localizedValue, type BuilderStore } from '../store.svelte';
  import type { SurveyElement } from '../../schema/type-registry';

  interface Props {
    store: BuilderStore;
    element: SurveyElement;
  }

  let { store, element }: Props = $props();

  type ImageChoice = { value: string; text?: unknown; imageLink?: unknown };

  let choices = $derived((element.choices as ImageChoice[] | undefined) ?? []);

  function link(choice: ImageChoice): string {
    return typeof choice.imageLink === 'string' ? choice.imageLink : '';
  }
</script>

<div class="imgc">
  {#each choices as choice, i (i)}
    <div class="imgc__row" data-image-choice={choice.value}>
      {#if link(choice)}
        <img class="imgc__thumb" src={link(choice)} alt={choice.value} />
      {:else}
        <span class="imgc__thumb imgc__thumb--empty" aria-hidden="true">🖼</span>
      {/if}

      <div class="imgc__fields">
        <input
          type="text"
          class="imgc__url"
          placeholder="Image URL"
          aria-label="Image URL"
          value={link(choice)}
          oninput={(e) => store.setChoiceProp(element.name, i, 'imageLink', e.currentTarget.value)}
        />
        <div class="imgc__meta">
          <input
            type="text"
            class="imgc__txt"
            placeholder="Label"
            aria-label="Choice label"
            value={localizedValue(choice.text as never, store.editingLocale)}
            oninput={(e) => store.updateChoice(element.name, i, { text: e.currentTarget.value })}
          />
          <input
            type="text"
            class="imgc__chip"
            title="Value"
            aria-label="Choice value"
            value={choice.value}
            oninput={(e) => store.updateChoice(element.name, i, { value: e.currentTarget.value })}
          />
        </div>
      </div>

      <button type="button" class="imgc__del" aria-label="Remove image choice" onclick={() => store.removeChoice(element.name, i)}>×</button>
    </div>
  {/each}

  <button type="button" class="imgc__add" data-testid="image-choice-add" onclick={() => store.addChoice(element.name)}>
    + Add image
  </button>
</div>

<style>
  .imgc {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .imgc__row {
    display: flex;
    gap: 0.45rem;
    align-items: flex-start;
    padding: 0.4rem;
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 0.5rem;
  }
  .imgc__thumb {
    flex: 0 0 2.6rem;
    width: 2.6rem;
    height: 2.6rem;
    object-fit: cover;
    border-radius: 0.35rem;
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .imgc__thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    opacity: 0.4;
  }
  .imgc__fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .imgc__meta {
    display: flex;
    gap: 0.3rem;
  }
  .imgc__txt {
    flex: 1;
    min-width: 0;
  }
  .imgc__chip {
    flex: 0 0 4.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.72rem !important;
    opacity: 0.75;
  }
  .imgc__del {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.5;
    font-size: 1rem;
  }
  .imgc__del:hover {
    opacity: 1;
    color: #dc2626;
  }
  .imgc__add {
    align-self: start;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .imgc :global(input[type='text']) {
    width: 100%;
    padding: 0.35rem 0.45rem;
    border-radius: 0.4rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    color: inherit;
    font-size: 0.8rem;
    font-family: inherit;
  }
</style>
