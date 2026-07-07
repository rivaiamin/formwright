<script lang="ts">
  import { resolveBlock, type PropertyDescriptor, type SurveyElement } from '../../schema/type-registry';
  import { localizedValue, type BuilderStore } from '../store.svelte';
  import LocalizedInput from './LocalizedInput.svelte';
  import LogicEditor from './LogicEditor.svelte';
  import LogicMap from './LogicMap.svelte';
  import PageSettings from './PageSettings.svelte';
  import ScoringEditor from './ScoringEditor.svelte';
  import SurveySettings from './SurveySettings.svelte';
  import ValidatorEditor from './ValidatorEditor.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  /** Keys rendered explicitly under BASICS (so they don't repeat in ADVANCED). */
  const BASIC_KEYS = ['title', 'html', 'imageLink', 'altText', 'description', 'isRequired'];

  /** Keys rendered explicitly under APPEARANCE (so they don't repeat in ADVANCED). */
  const APPEARANCE_KEYS = [
    'placeholder',
    'titleLocation',
    'descriptionLocation',
    'startWithNewLine',
    'width',
    'minWidth',
    'maxWidth',
    'defaultValueExpression',
  ];

  let el = $derived(store.selected);
  let block = $derived(el ? resolveBlock(el) : null);
  let locked = $derived(el != null && block == null);
  let showLogic = $state(false);
  let showScoring = $state(false);
  let showValidation = $state(false);
  let showAppearance = $state(false);
  let showAdvanced = $state(false);

  const TITLE_LOCATIONS = [
    { value: 'default', label: 'Default' },
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'hidden', label: 'Hidden' },
  ];

  /** Input types (as opposed to display-only html/image) carry an isRequired prop. */
  let isInput = $derived(has('isRequired'));
  /** SurveyJS types that render a placeholder. */
  let supportsPlaceholder = $derived(
    !!el && ['text', 'comment', 'dropdown', 'tagbox', 'multipletext'].includes(el.type),
  );
  let nameDesc = $derived(descByKey('name'));
  let advancedList = $derived(
    block
      ? block.properties.filter(
          (p) =>
            p.key !== 'choices' &&
            p.key !== 'name' &&
            !BASIC_KEYS.includes(p.key) &&
            !APPEARANCE_KEYS.includes(p.key),
        )
      : [],
  );

  /** Build an `onset` handler that writes a localized prop on an element. */
  function loc(element: SurveyElement, key: string) {
    return (value: string, locale: string) => store.setLocalizedProp(element.name, key, value, locale);
  }

  function descByKey(key: string): PropertyDescriptor | undefined {
    return block?.properties.find((p) => p.key === key);
  }

  function has(key: string): boolean {
    return descByKey(key) != null;
  }

  function stringValue(element: SurveyElement, d: PropertyDescriptor): string {
    const raw = element[d.key];
    if (d.appliesToLocale) {
      return localizedValue(raw as never, store.editingLocale);
    }
    return raw == null ? '' : String(raw);
  }

  function commit(element: SurveyElement, d: PropertyDescriptor, value: string | boolean): void {
    if (d.kind === 'name') {
      store.renameElement(element.name, String(value));
    } else if (d.kind === 'boolean') {
      store.setProp(element.name, d.key, value === true);
    } else if (d.kind === 'number') {
      store.setProp(element.name, d.key, value === '' ? '' : Number(value));
    } else if (d.appliesToLocale) {
      store.setLocalizedProp(element.name, d.key, String(value));
    } else {
      store.setProp(element.name, d.key, value);
    }
  }

  const choicesOf = (element: SurveyElement) =>
    (element.choices as Array<{ value: string; text?: unknown }> | undefined) ?? [];
</script>

{#if store.selection.kind === 'survey'}
  <SurveySettings {store} />
{:else if store.selection.kind === 'page'}
  <PageSettings {store} />
{:else}
<aside class="panel" aria-label="Field properties">
  {#if !el}
    <p class="panel__hint">Select a field to edit its properties, or edit the whole form.</p>
    <button type="button" class="panel__form" data-testid="open-form-settings" onclick={() => store.selectSurvey()}>
      ⚙ Form settings
    </button>
    <LogicMap {store} />
  {:else if locked}
    <div class="panel__bar">
      <span class="panel__heading">Settings</span>
      <button class="panel__close" aria-label="Deselect" onclick={() => store.select(null)}>×</button>
    </div>
    <p class="panel__locked">
      <strong>{el.type}</strong> has no visual editor. It is preserved exactly and can be edited in the
      <em>JSON</em> tab. The builder will never rewrite it.
    </p>
  {:else}
    <div class="panel__bar">
      <span class="panel__heading">Settings</span>
      <button class="panel__close" aria-label="Deselect" onclick={() => store.select(null)}>×</button>
    </div>

    <!-- BASICS -->
    <p class="panel__section">Basics</p>
    {#if has('title')}
      <LocalizedInput {store} target={el} propKey="title" label="Label" onset={loc(el, 'title')} />
    {/if}
    {#if has('html')}
      <LocalizedInput {store} target={el} propKey="html" label="Content" multiline onset={loc(el, 'html')} />
    {/if}
    {#if has('imageLink')}{@render control(el, descByKey('imageLink')!)}{/if}
    {#if has('altText')}
      <LocalizedInput {store} target={el} propKey="altText" label="Alt text" onset={loc(el, 'altText')} />
    {/if}
    {#if has('description')}
      <LocalizedInput {store} target={el} propKey="description" label="Description" onset={loc(el, 'description')} />
    {/if}

    {#if isInput}
      <div class="field">
        <label class="field__label" for="prop-defaultValue">Default value</label>
        <input
          id="prop-defaultValue"
          type="text"
          data-testid="default-value"
          value={el.defaultValue == null ? '' : String(el.defaultValue)}
          oninput={(e) => store.setProp(el.name, 'defaultValue', e.currentTarget.value)}
        />
      </div>
    {/if}

    {#if has('isRequired')}{@render control(el, descByKey('isRequired')!)}{/if}

    {#if isInput}
      <label class="field__check">
        <input
          type="checkbox"
          data-testid="hidden-toggle"
          checked={el.visible === false}
          onchange={(e) => store.setProp(el.name, 'visible', e.currentTarget.checked ? false : '')}
        />
        Hidden field
      </label>
      <p class="panel__help">The field is not shown to the user but stays in the results.</p>

      <label class="field__check">
        <input
          type="checkbox"
          data-testid="readonly-toggle"
          checked={el.readOnly === true}
          onchange={(e) => store.setProp(el.name, 'readOnly', e.currentTarget.checked ? true : '')}
        />
        Read-only (disabled)
      </label>
      <p class="panel__help">The field is shown but cannot be edited.</p>
    {/if}

    <!-- OPTIONS -->
    {#if has('choices')}
      <p class="panel__section">Options</p>
      {@render control(el, descByKey('choices')!)}
    {/if}

    <!-- VALIDATION -->
    {#if isInput}
      <button type="button" class="panel__disc" data-testid="validation-toggle" onclick={() => (showValidation = !showValidation)}>
        {showValidation ? '▾' : '▸'} Validation
      </button>
      {#if showValidation}
        <ValidatorEditor {store} />
      {/if}
    {/if}

    <!-- LOGIC -->
    <button type="button" class="panel__disc" data-testid="logic-toggle" onclick={() => (showLogic = !showLogic)}>
      {showLogic ? '▾' : '▸'} Logic
    </button>
    {#if showLogic}
      <LogicEditor {store} />
    {/if}

    <!-- QUIZ -->
    <button type="button" class="panel__disc" data-testid="scoring-toggle" onclick={() => (showScoring = !showScoring)}>
      {showScoring ? '▾' : '▸'} Quiz
    </button>
    {#if showScoring}
      <ScoringEditor {store} />
    {/if}

    <!-- APPEARANCE -->
    {#if isInput}
      <button type="button" class="panel__disc" data-testid="appearance-toggle" onclick={() => (showAppearance = !showAppearance)}>
        {showAppearance ? '▾' : '▸'} Appearance &amp; layout
      </button>
      {#if showAppearance}
        {#if supportsPlaceholder}
          <LocalizedInput
            {store}
            target={el}
            propKey="placeholder"
            label="Placeholder"
            onset={loc(el, 'placeholder')}
          />
        {/if}
        <div class="field">
          <label class="field__label" for="prop-titleLocation">Title position</label>
          <select
            id="prop-titleLocation"
            data-testid="title-location"
            value={typeof el.titleLocation === 'string' ? el.titleLocation : 'default'}
            onchange={(e) => store.setProp(el.name, 'titleLocation', e.currentTarget.value === 'default' ? '' : e.currentTarget.value)}
          >
            {#each TITLE_LOCATIONS as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <label class="field__check">
          <input
            type="checkbox"
            data-testid="inline-toggle"
            checked={el.startWithNewLine === false}
            onchange={(e) => store.setProp(el.name, 'startWithNewLine', e.currentTarget.checked ? false : '')}
          />
          Display inline with previous field
        </label>
        <p class="panel__help">Two fields side by side when both are inline and a width is set.</p>
        <div class="field">
          <label class="field__label" for="prop-width">Width</label>
          <input
            id="prop-width"
            type="text"
            data-testid="field-width"
            placeholder="e.g. 50% or 200px"
            value={typeof el.width === 'string' ? el.width : ''}
            oninput={(e) => store.setProp(el.name, 'width', e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label class="field__label" for="prop-defaultValueExpression">Default value expression</label>
          <input
            id="prop-defaultValueExpression"
            type="text"
            placeholder="e.g. {'{firstName}'} + ' ' + {'{lastName}'}"
            value={typeof el.defaultValueExpression === 'string' ? el.defaultValueExpression : ''}
            oninput={(e) => store.setProp(el.name, 'defaultValueExpression', e.currentTarget.value)}
          />
        </div>
      {/if}
    {/if}

    <!-- ADVANCED -->
    <button type="button" class="panel__disc" data-testid="advanced-toggle" onclick={() => (showAdvanced = !showAdvanced)}>
      {showAdvanced ? '▾' : '▸'} Advanced
    </button>
    {#if showAdvanced}
      {#if nameDesc}
        {@render control(el, nameDesc)}
        <p class="panel__warn">Warning: renaming may break previously stored results.</p>
      {/if}
      {#if isInput}
        <LocalizedInput
          {store}
          target={el}
          propKey="requiredErrorText"
          label="Required-field message"
          onset={loc(el, 'requiredErrorText')}
        />
      {/if}
      {#each advancedList as d (d.key)}
        {@render control(el, d)}
      {/each}
    {/if}
  {/if}
</aside>
{/if}

{#snippet control(element: SurveyElement, d: PropertyDescriptor)}
  <div class="field">
    {#if d.kind === 'boolean'}
      <label class="field__check">
        <input
          type="checkbox"
          checked={element[d.key] === true}
          onchange={(e) => commit(element, d, e.currentTarget.checked)}
        />
        {d.label}
      </label>
    {:else if d.kind === 'choices'}
      <span class="field__label">{d.label}</span>
      <div class="choices">
        {#each choicesOf(element) as choice, i (i)}
          <div class="choices__row">
            <input
              type="text"
              class="choices__txt"
              placeholder="Label"
              value={localizedValue(choice.text as never, store.editingLocale)}
              oninput={(e) => store.updateChoice(element.name, i, { text: e.currentTarget.value })}
            />
            <input
              type="text"
              class="choices__chip"
              title="Value"
              aria-label="Choice value"
              value={choice.value}
              oninput={(e) => store.updateChoice(element.name, i, { value: e.currentTarget.value })}
            />
            <button type="button" class="choices__del" onclick={() => store.removeChoice(element.name, i)}>×</button>
          </div>
        {/each}
        <input
          type="text"
          class="choices__addinput"
          data-testid="choice-add"
          placeholder="Add a choice and press Enter"
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              store.addChoiceFromText(element.name, e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          onpaste={(e) => {
            const text = e.clipboardData?.getData('text') ?? '';
            if (text.includes('\n')) {
              e.preventDefault();
              store.addChoicesFromLines(element.name, text.split(/\r?\n/));
              e.currentTarget.value = '';
            }
          }}
        />
        <p class="choices__hint">Paste multiple lines to add several choices at once.</p>
        <label class="field__check">
          <input
            type="checkbox"
            data-testid="other-toggle"
            checked={element.showOtherItem === true}
            onchange={(e) => store.setProp(element.name, 'showOtherItem', e.currentTarget.checked ? true : '')}
          />
          Add an “Other” option
        </label>
      </div>
    {:else}
      <label class="field__label" for={`prop-${d.key}`}>{d.label}</label>
      {#if d.kind === 'select'}
        <select
          id={`prop-${d.key}`}
          value={stringValue(element, d)}
          onchange={(e) => commit(element, d, e.currentTarget.value)}
        >
          <option value="">—</option>
          {#each d.options ?? [] as opt (opt.value)}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      {:else if d.kind === 'localizedHtml'}
        <textarea
          id={`prop-${d.key}`}
          rows="4"
          value={stringValue(element, d)}
          oninput={(e) => commit(element, d, e.currentTarget.value)}
        ></textarea>
      {:else if d.kind === 'number'}
        <input
          id={`prop-${d.key}`}
          type="number"
          value={stringValue(element, d)}
          oninput={(e) => commit(element, d, e.currentTarget.value)}
        />
      {:else}
        <!-- name, text, localizedText -->
        <input
          id={`prop-${d.key}`}
          type="text"
          value={stringValue(element, d)}
          onchange={d.kind === 'name' ? (e) => commit(element, d, e.currentTarget.value) : undefined}
          oninput={d.kind === 'name' ? undefined : (e) => commit(element, d, e.currentTarget.value)}
        />
      {/if}
    {/if}
  </div>
{/snippet}

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
  .panel__hint,
  .panel__locked {
    font-size: 0.82rem;
    opacity: 0.7;
    line-height: 1.5;
  }
  .panel__form {
    align-self: start;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    padding: 0.4rem 0.7rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.82rem;
  }
  .panel__form:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .panel__locked {
    padding: 0.6rem;
    border: 1px dashed color-mix(in srgb, #b45309 60%, transparent);
    border-radius: 0.5rem;
  }
  .panel__help {
    margin: -0.1rem 0 0.2rem;
    font-size: 0.72rem;
    opacity: 0.55;
    line-height: 1.35;
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
  .field :global(input[type='number']),
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
  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .choices__row {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .choices__txt {
    flex: 1;
    min-width: 0;
  }
  .choices__chip {
    flex: 0 0 5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.72rem !important;
    opacity: 0.75;
  }
  .choices__addinput {
    margin-top: 0.15rem;
  }
  .choices__hint {
    margin: 0.1rem 0 0.2rem;
    font-size: 0.72rem;
    opacity: 0.55;
  }
  .choices__del {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.5;
    font-size: 1rem;
  }
  .choices__del:hover {
    opacity: 1;
    color: #dc2626;
  }
</style>
