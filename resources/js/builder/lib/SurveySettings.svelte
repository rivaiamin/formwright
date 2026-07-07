<script lang="ts">
  // Form (survey) attributes — a projection of the survey ROOT, edited the same
  // way fields are. Every control maps to a native SurveyJS survey property, so
  // Preview and the public form pick them up with no extra wiring.
  import type { BuilderStore } from '../store.svelte';
  import LocalizedInput from './LocalizedInput.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  const schema = $derived(store.schema);

  /** A select whose default value is stored as "absent" to keep the JSON clean. */
  function pick(key: string, value: string, fallback: string): void {
    store.setSurveyProp(key, value === fallback ? '' : value);
  }

  function val(key: string, fallback: string): string {
    const v = schema[key];
    return v == null ? fallback : String(v);
  }

  const setLoc = (key: string) => (value: string, locale: string) =>
    store.setSurveyLocalizedProp(key, value, locale);

  let progressOn = $derived(val('showProgressBar', 'off') !== 'off');
</script>

<aside class="panel" aria-label="Form settings">
  <div class="panel__bar">
    <span class="panel__heading">Form settings</span>
    <button class="panel__close" aria-label="Deselect" onclick={() => store.select(null)}>×</button>
  </div>

  <!-- GENERAL -->
  <p class="panel__section">General</p>
  <LocalizedInput {store} target={schema} propKey="title" label="Form title" onset={setLoc('title')} />
  <LocalizedInput
    {store}
    target={schema}
    propKey="description"
    label="Description"
    multiline
    onset={setLoc('description')}
  />

  <!-- PRESENTATION -->
  <p class="panel__section">Presentation</p>
  <div class="field">
    <label class="field__label" for="survey-progress">Progress bar</label>
    <select
      id="survey-progress"
      data-testid="survey-progress"
      value={val('showProgressBar', 'off')}
      onchange={(e) => pick('showProgressBar', e.currentTarget.value, 'off')}
    >
      <option value="off">Off</option>
      <option value="top">Top</option>
      <option value="bottom">Bottom</option>
      <option value="both">Top &amp; bottom</option>
    </select>
  </div>

  {#if progressOn}
    <div class="field">
      <label class="field__label" for="survey-progresstype">Progress measured by</label>
      <select
        id="survey-progresstype"
        value={val('progressBarType', 'pages')}
        onchange={(e) => pick('progressBarType', e.currentTarget.value, 'pages')}
      >
        <option value="pages">Pages</option>
        <option value="questions">Questions</option>
        <option value="requiredQuestions">Required questions</option>
        <option value="correctQuestions">Correct answers (quiz)</option>
      </select>
    </div>
  {/if}

  <div class="field">
    <label class="field__label" for="survey-qnum">Question numbers</label>
    <select
      id="survey-qnum"
      value={val('showQuestionNumbers', 'on')}
      onchange={(e) => pick('showQuestionNumbers', e.currentTarget.value, 'on')}
    >
      <option value="on">Show, continuous</option>
      <option value="onPage">Restart each page</option>
      <option value="off">Hide</option>
    </select>
  </div>

  <div class="field">
    <label class="field__label" for="survey-pagemode">Questions per page</label>
    <select
      id="survey-pagemode"
      value={val('questionsOnPageMode', 'standard')}
      onchange={(e) => pick('questionsOnPageMode', e.currentTarget.value, 'standard')}
    >
      <option value="standard">Use pages as designed</option>
      <option value="singlePage">All on one page</option>
      <option value="questionPerPage">One question per page</option>
    </select>
  </div>

  <div class="field">
    <label class="field__label" for="survey-preview">Preview before submit</label>
    <select
      id="survey-preview"
      value={val('showPreviewBeforeComplete', 'noPreview')}
      onchange={(e) => pick('showPreviewBeforeComplete', e.currentTarget.value, 'noPreview')}
    >
      <option value="noPreview">No preview</option>
      <option value="showAllQuestions">Preview all questions</option>
      <option value="showAnsweredQuestions">Preview answered only</option>
    </select>
  </div>

  <!-- NAVIGATION -->
  <p class="panel__section">Navigation buttons</p>
  <LocalizedInput {store} target={schema} propKey="pagePrevText" label="Previous button" onset={setLoc('pagePrevText')} />
  <LocalizedInput {store} target={schema} propKey="pageNextText" label="Next button" onset={setLoc('pageNextText')} />
  <LocalizedInput {store} target={schema} propKey="completeText" label="Submit button" onset={setLoc('completeText')} />

  <!-- COMPLETION -->
  <p class="panel__section">After submitting</p>
  <LocalizedInput
    {store}
    target={schema}
    propKey="completedHtml"
    label="Thank-you page (HTML)"
    multiline
    onset={setLoc('completedHtml')}
  />
  <p class="panel__help">Shown after the form is submitted. Plain text or HTML.</p>
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
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field__label {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .field select {
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
