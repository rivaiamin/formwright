<script lang="ts">
  // Starter templates. Applying one replaces the whole form — a single, discrete
  // history entry, so a plain Undo brings the previous form straight back.
  import { TEMPLATES, type FormTemplate } from '../templates';
  import type { BuilderStore, SurveySchema } from '../store.svelte';

  interface Props {
    store: BuilderStore;
    onapplied?: () => void;
  }

  let { store, onapplied }: Props = $props();

  function apply(t: FormTemplate): void {
    store.replaceSchema(structuredClone(t.schema) as SurveySchema);
    onapplied?.();
  }

  function fieldCount(t: FormTemplate): number {
    return t.schema.pages.reduce((n, p) => n + (p.elements?.length ?? 0), 0);
  }
</script>

<section class="tpl" data-testid="templates-panel">
  <div class="tpl__head">
    <strong class="tpl__title">Start from a template</strong>
    <span class="tpl__warn">Applying replaces the current form — you can Undo.</span>
  </div>

  <div class="tpl__grid">
    {#each TEMPLATES as t (t.id)}
      <button type="button" class="tpl__card" data-testid={`template-${t.id}`} onclick={() => apply(t)}>
        <span class="tpl__label">{t.label}</span>
        <span class="tpl__desc">{t.description}</span>
        <span class="tpl__meta">{t.schema.pages.length} page(s) · {fieldCount(t)} field(s)</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .tpl {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.8rem;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in srgb, currentColor 3%, transparent);
  }
  .tpl__head {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .tpl__title {
    font-size: 0.9rem;
  }
  .tpl__warn {
    font-size: 0.72rem;
    opacity: 0.55;
  }
  .tpl__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.5rem;
  }
  .tpl__card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    text-align: start;
    padding: 0.6rem 0.7rem;
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    border-radius: 0.6rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .tpl__card:hover {
    border-color: #f59e0b;
    background: color-mix(in srgb, #f59e0b 8%, transparent);
  }
  .tpl__label {
    font-weight: 600;
    font-size: 0.88rem;
  }
  .tpl__desc {
    font-size: 0.75rem;
    opacity: 0.65;
    line-height: 1.35;
  }
  .tpl__meta {
    font-size: 0.68rem;
    opacity: 0.45;
    margin-top: 0.15rem;
  }
</style>
