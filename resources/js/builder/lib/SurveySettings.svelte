<script lang="ts">
  // Form (survey) attributes — a projection of the survey ROOT, edited the same
  // way fields are. Every control maps to a native SurveyJS survey property, so
  // Preview and the public form pick them up with no extra wiring.
  import { localizedValue, type BuilderStore } from '../store.svelte';
  import LocalizedInput from './LocalizedInput.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  const schema = $derived(store.schema);

  let showBehavior = $state(false);

  /** A select whose default value is stored as "absent" to keep the JSON clean. */
  function pick(key: string, value: string, fallback: string): void {
    store.setSurveyProp(key, value === fallback ? '' : value);
  }

  function val(key: string, fallback: string): string {
    const v = schema[key];
    return v == null ? fallback : String(v);
  }

  /** A checkbox whose default is stored as "absent". */
  function boolVal(key: string, def: boolean): boolean {
    const v = schema[key];
    return v == null ? def : v === true;
  }

  function setBool(key: string, checked: boolean, def: boolean): void {
    store.setSurveyProp(key, checked === def ? '' : checked);
  }

  const setLoc = (key: string) => (value: string, locale: string) =>
    store.setSurveyLocalizedProp(key, value, locale);

  let progressOn = $derived(val('showProgressBar', 'off') !== 'off');
  let conditions = $derived((schema.completedHtmlOnCondition as Array<Record<string, unknown>> | undefined) ?? []);
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

  <!-- HEADER & BRANDING -->
  <p class="panel__section">Header &amp; branding</p>
  <label class="field__check">
    <input type="checkbox" checked={boolVal('showTitle', true)} onchange={(e) => setBool('showTitle', e.currentTarget.checked, true)} />
    Show form title
  </label>
  <label class="field__check">
    <input type="checkbox" checked={boolVal('showPageTitles', true)} onchange={(e) => setBool('showPageTitles', e.currentTarget.checked, true)} />
    Show page titles
  </label>
  <div class="field">
    <label class="field__label" for="survey-logo">Logo URL</label>
    <input
      id="survey-logo"
      type="text"
      data-testid="survey-logo"
      placeholder="https://…/logo.png"
      value={typeof schema.logo === 'string' ? schema.logo : ''}
      oninput={(e) => store.setSurveyProp('logo', e.currentTarget.value)}
    />
  </div>
  {#if typeof schema.logo === 'string' && schema.logo !== ''}
    <div class="grid2">
      <div class="field">
        <label class="field__label" for="survey-logopos">Logo position</label>
        <select id="survey-logopos" value={val('logoPosition', 'left')} onchange={(e) => pick('logoPosition', e.currentTarget.value, 'left')}>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="survey-logofit">Logo fit</label>
        <select id="survey-logofit" value={val('logoFit', 'contain')} onchange={(e) => pick('logoFit', e.currentTarget.value, 'contain')}>
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
          <option value="fill">Fill</option>
          <option value="none">None</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="survey-logow">Logo width</label>
        <input id="survey-logow" type="text" placeholder="e.g. 200px" value={val('logoWidth', '')} oninput={(e) => store.setSurveyProp('logoWidth', e.currentTarget.value)} />
      </div>
      <div class="field">
        <label class="field__label" for="survey-logoh">Logo height</label>
        <input id="survey-logoh" type="text" placeholder="e.g. 60px" value={val('logoHeight', '')} oninput={(e) => store.setSurveyProp('logoHeight', e.currentTarget.value)} />
      </div>
    </div>
  {/if}

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
  <div class="field">
    <label class="field__label" for="survey-navshow">Show navigation</label>
    <select
      id="survey-navshow"
      value={val('showNavigationButtons', 'bottom')}
      onchange={(e) => pick('showNavigationButtons', e.currentTarget.value, 'bottom')}
    >
      <option value="bottom">Bottom</option>
      <option value="top">Top</option>
      <option value="both">Top &amp; bottom</option>
      <option value="none">Hidden</option>
    </select>
  </div>
  <label class="field__check">
    <input type="checkbox" checked={boolVal('showPrevButton', true)} onchange={(e) => setBool('showPrevButton', e.currentTarget.checked, true)} />
    Show “Previous” button
  </label>
  <label class="field__check">
    <input type="checkbox" data-testid="survey-autonext" checked={boolVal('goNextPageAutomatic', false)} onchange={(e) => setBool('goNextPageAutomatic', e.currentTarget.checked, false)} />
    Advance to next page automatically
  </label>
  <LocalizedInput {store} target={schema} propKey="pagePrevText" label="Previous button" onset={setLoc('pagePrevText')} />
  <LocalizedInput {store} target={schema} propKey="pageNextText" label="Next button" onset={setLoc('pageNextText')} />
  <LocalizedInput {store} target={schema} propKey="completeText" label="Submit button" onset={setLoc('completeText')} />

  <!-- COMPLETION -->
  <p class="panel__section">After submitting</p>
  <label class="field__check">
    <input type="checkbox" checked={boolVal('showCompletedPage', true)} onchange={(e) => setBool('showCompletedPage', e.currentTarget.checked, true)} />
    Show completion page
  </label>
  <LocalizedInput
    {store}
    target={schema}
    propKey="completedHtml"
    label="Thank-you page (HTML)"
    multiline
    onset={setLoc('completedHtml')}
  />
  <div class="field">
    <label class="field__label" for="survey-redirect">Redirect URL after submit</label>
    <input
      id="survey-redirect"
      type="text"
      data-testid="survey-redirect"
      placeholder="https://…"
      value={typeof schema.navigateToUrl === 'string' ? schema.navigateToUrl : ''}
      oninput={(e) => store.setSurveyProp('navigateToUrl', e.currentTarget.value)}
    />
  </div>

  <div class="cond">
    <div class="cond__head">
      <span class="field__label">Conditional thank-you pages</span>
      <button type="button" class="cond__add" data-testid="cond-add" onclick={() => store.addCompletedCondition()}>+ Add</button>
    </div>
    <p class="panel__help">Show different HTML depending on the answers, e.g. <code>{'{score}'} &gt; 8</code>.</p>
    {#each conditions as cond, i (i)}
      <div class="cond__row">
        <input
          type="text"
          class="cond__expr"
          placeholder="Expression, e.g. {'{score}'} > 8"
          value={typeof cond.expression === 'string' ? cond.expression : ''}
          oninput={(e) => store.setCompletedConditionProp(i, 'expression', e.currentTarget.value)}
        />
        <textarea
          rows="2"
          class="cond__html"
          placeholder="HTML shown when the expression is true"
          value={typeof cond.html === 'string' ? cond.html : localizedValue(cond.html as never, 'default')}
          oninput={(e) => store.setCompletedConditionProp(i, 'html', e.currentTarget.value)}
        ></textarea>
        <button type="button" class="cond__del" aria-label="Remove condition" onclick={() => store.removeCompletedCondition(i)}>×</button>
      </div>
    {/each}
  </div>

  <!-- VALIDATION & BEHAVIOR -->
  <button type="button" class="panel__disc" data-testid="behavior-toggle" onclick={() => (showBehavior = !showBehavior)}>
    {showBehavior ? '▾' : '▸'} Validation &amp; behavior
  </button>
  {#if showBehavior}
    <div class="field">
      <label class="field__label" for="survey-checkerrors">Check errors</label>
      <select
        id="survey-checkerrors"
        data-testid="survey-checkerrors"
        value={val('checkErrorsMode', 'onNextPage')}
        onchange={(e) => pick('checkErrorsMode', e.currentTarget.value, 'onNextPage')}
      >
        <option value="onNextPage">When leaving a page</option>
        <option value="onValueChanged">As the user types</option>
        <option value="onComplete">Only on submit</option>
      </select>
    </div>
    <div class="field">
      <label class="field__label" for="survey-errorloc">Error message location</label>
      <select
        id="survey-errorloc"
        value={val('questionErrorLocation', 'top')}
        onchange={(e) => pick('questionErrorLocation', e.currentTarget.value, 'top')}
      >
        <option value="top">Above the field</option>
        <option value="bottom">Below the field</option>
      </select>
    </div>
    <div class="field">
      <label class="field__label" for="survey-clearinvisible">Clear hidden answers</label>
      <select
        id="survey-clearinvisible"
        value={val('clearInvisibleValues', 'onComplete')}
        onchange={(e) => pick('clearInvisibleValues', e.currentTarget.value, 'onComplete')}
      >
        <option value="onComplete">On submit</option>
        <option value="onHidden">As soon as hidden</option>
        <option value="onHiddenContainer">When page/panel hidden</option>
        <option value="none">Keep them</option>
      </select>
    </div>
    <label class="field__check">
      <input type="checkbox" checked={boolVal('focusOnFirstError', true)} onchange={(e) => setBool('focusOnFirstError', e.currentTarget.checked, true)} />
      Focus the first field with an error
    </label>
    <label class="field__check">
      <input type="checkbox" checked={boolVal('focusFirstQuestionAutomatic', false)} onchange={(e) => setBool('focusFirstQuestionAutomatic', e.currentTarget.checked, false)} />
      Focus the first field on each page
    </label>
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
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .field :global(input[type='text']),
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
  .cond {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .cond__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .cond__add {
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .cond__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.35rem;
    align-items: start;
    padding: 0.4rem;
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 0.5rem;
  }
  .cond__expr {
    grid-column: 1 / 2;
  }
  .cond__html {
    grid-column: 1 / 2;
  }
  .cond__del {
    grid-column: 2 / 3;
    grid-row: 1 / 3;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.5;
    font-size: 1rem;
  }
  .cond__del:hover {
    opacity: 1;
    color: #dc2626;
  }
  .cond :global(input[type='text']),
  .cond textarea {
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
