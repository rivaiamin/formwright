<script lang="ts">
  // ---------------------------------------------------------------------------
  // Preview.svelte — Phase 4. Renders the live schema with the MIT-licensed
  // survey-core + survey-js-ui. This is the ONLY SurveyJS code in the product;
  // survey-creator is never imported.
  //
  // Direction (RTL/LTR) is derived by survey-core from `survey.locale` — we do
  // not hand-manage `dir` per field; we only reflect the locale's direction on
  // the wrapper for layout + a testable hook.
  // ---------------------------------------------------------------------------
  import { Model, type Question } from 'survey-core';
  import 'survey-core/defaultV2.min.css';
  import 'survey-core/survey.i18n';
  import { renderSurvey } from 'survey-js-ui';

  import { isRtlLocale, type BuilderStore } from '../store.svelte';
  import { applyStoredTheme, registerCustomProperties } from '../survey-setup';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  let container = $state<HTMLDivElement>();
  let previewLocale = $state(store.editingLocale);
  let score = $state<{ earned: number; total: number; show: boolean }>({ earned: 0, total: 0, show: false });

  let dir = $derived(isRtlLocale(previewLocale) ? 'rtl' : 'ltr');

  /** A question counts toward the score once it has a meaningful correctAnswer. */
  function isScoredQuestion(q: Question): boolean {
    const ca = q.correctAnswer;
    if (ca === undefined || ca === null || ca === '') {
      return false;
    }
    return !(Array.isArray(ca) && ca.length === 0);
  }

  // Re-render whenever the schema (deep) or the chosen locale changes. Each run
  // builds a fresh Model and the cleanup disposes it, so instances never leak
  // across Livewire re-renders or tab switches.
  $effect(() => {
    const json = store.export(); // deep-tracks the schema
    const locale = previewLocale;
    const el = container;
    if (!el) {
      return;
    }

    registerCustomProperties();

    const model = new Model(json);
    model.locale = locale === 'default' ? '' : locale;
    applyStoredTheme(model, json);

    // Live quiz tally: sum points of scored questions the respondent got right,
    // using survey-core's own answer comparison (isAnswerCorrect) and our custom
    // `points` property (default 1).
    const recompute = (): void => {
      let earned = 0;
      let total = 0;
      let anyScored = false;
      for (const q of model.getAllQuestions()) {
        if (!isScoredQuestion(q)) {
          continue;
        }
        anyScored = true;
        const pts = typeof q.points === 'number' ? q.points : 1;
        total += pts;
        if (q.isAnswerCorrect()) {
          earned += pts;
        }
      }
      score = { earned, total, show: anyScored };
    };
    model.onValueChanged.add(recompute);

    // Render into a FRESH host each pass: survey-js-ui renders via preact, and
    // reusing a container it has already rendered into (after we cleared it)
    // leaves a stale vdom tree that renders empty. A new node per pass avoids it.
    const host = document.createElement('div');
    el.replaceChildren(host);
    renderSurvey(model, host);
    recompute();

    return () => {
      model.dispose();
    };
  });
</script>

<div class="preview">
  <div class="preview__bar">
    <label class="preview__loc">
      Preview locale
      <select bind:value={previewLocale}>
        {#each store.locales as loc (loc)}
          <option value={loc}>{loc}{isRtlLocale(loc) ? ' (RTL)' : ''}</option>
        {/each}
      </select>
    </label>
    <span class="preview__hint">Rendered by survey-core · direction auto-derived from locale</span>

    {#if score.show}
      <span class="preview__score" data-testid="preview-score">Score: {score.earned} / {score.total}</span>
    {/if}
  </div>

  <div class="preview__surface" {dir} data-preview-dir={dir}>
    <div bind:this={container} data-testid="survey-preview"></div>
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .preview__bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .preview__loc {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .preview__loc select {
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    color: inherit;
    font-size: 0.8rem;
  }
  .preview__hint {
    font-size: 0.75rem;
    opacity: 0.55;
  }
  .preview__score {
    margin-inline-start: auto;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 0.4rem;
    background: color-mix(in srgb, #16a34a 20%, transparent);
  }
  /* Give survey-core a light surface so its default theme reads correctly
     regardless of the Filament panel theme. */
  .preview__surface {
    background: #fff;
    color: #111;
    border-radius: 0.6rem;
    padding: 0.5rem;
    min-height: 40vh;
    overflow: auto;
  }
</style>
