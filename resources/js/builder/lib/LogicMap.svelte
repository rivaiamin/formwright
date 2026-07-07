<script lang="ts">
  import type { BuilderStore } from '../store.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  // Re-read on structural changes; logic edits bump nothing, so also touch the
  // schema lightly by reading through the method each render.
  let rows = $derived.by(() => {
    store.rev;
    return store.logicDependencies();
  });
</script>

<div class="map" data-testid="logic-map">
  <p class="map__title">Dependency map</p>
  {#if rows.length === 0}
    <p class="map__empty">No conditional logic yet. Select a field and add a rule under “Logic”.</p>
  {:else}
    <ul class="map__list">
      {#each rows as row (row.name)}
        <li>
          <strong>{row.label}</strong>
          <span class="map__dep">depends on {row.dependsOn.join(', ')}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .map {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .map__title {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.6;
  }
  .map__empty {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.6;
    line-height: 1.5;
  }
  .map__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .map__list li {
    font-size: 0.82rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 0.45rem;
  }
  .map__dep {
    display: block;
    font-size: 0.74rem;
    opacity: 0.6;
    font-family: ui-monospace, monospace;
    margin-top: 0.15rem;
  }
</style>
