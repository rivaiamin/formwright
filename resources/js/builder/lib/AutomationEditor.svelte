<script lang="ts">
    // Survey-level automation: calculated values (named expressions) and triggers
    // (run an action when an expression becomes true). Both are native SurveyJS
    // survey-root arrays processed by survey-core at runtime — no renderer wiring.
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    const TRIGGER_TYPES: { value: string; label: string }[] = [
        { value: 'complete', label: 'Complete the form' },
        { value: 'setvalue', label: 'Set a field value' },
        { value: 'copyvalue', label: 'Copy a field value' },
        { value: 'runexpression', label: 'Run an expression' },
        { value: 'skip', label: 'Skip to a field' },
    ];

    let calc = $derived(
        (store.schema.calculatedValues as
            Array<Record<string, unknown>> | undefined) ?? [],
    );
    let triggers = $derived(
        (store.schema.triggers as Array<Record<string, unknown>> | undefined) ??
            [],
    );
    let fieldNames = $derived(store.elementNamesInOrder());

    function str(v: unknown): string {
        return typeof v === 'string' ? v : v == null ? '' : String(v);
    }

    function addCalc(): void {
        store.addSurveyListItem('calculatedValues', {
            name: `value${calc.length + 1}`,
            expression: '',
        });
    }

    function addTrigger(): void {
        store.addSurveyListItem('triggers', {
            type: 'complete',
            expression: '',
        });
    }
</script>

<div class="auto">
    <!-- CALCULATED VALUES -->
    <div class="auto__head">
        <span class="field__label">Calculated values</span>
        <button
            type="button"
            class="auto__add"
            data-testid="calc-add"
            onclick={addCalc}>+ Add</button
        >
    </div>
    <p class="panel__help">
        Named expressions you can reuse in logic, triggers and piped text (<code
            >{'{value1}'}</code
        >).
    </p>
    {#each calc as row, i (i)}
        <div class="auto__row">
            <input
                type="text"
                class="auto__chip"
                placeholder="name"
                aria-label="Calculated value name"
                value={str(row.name)}
                oninput={(e) =>
                    store.setSurveyListItemProp(
                        'calculatedValues',
                        i,
                        'name',
                        e.currentTarget.value,
                    )}
            />
            <input
                type="text"
                class="auto__expr"
                placeholder="Expression, e.g. {'{price}'} * {'{qty}'}"
                value={str(row.expression)}
                oninput={(e) =>
                    store.setSurveyListItemProp(
                        'calculatedValues',
                        i,
                        'expression',
                        e.currentTarget.value,
                    )}
            />
            <label class="auto__inc" title="Include in the submitted results">
                <input
                    type="checkbox"
                    checked={row.includeIntoResult === true}
                    onchange={(e) =>
                        store.setSurveyListItemProp(
                            'calculatedValues',
                            i,
                            'includeIntoResult',
                            e.currentTarget.checked ? true : '',
                        )}
                />
                save
            </label>
            <button
                type="button"
                class="auto__del"
                aria-label="Remove calculated value"
                onclick={() =>
                    store.removeSurveyListItem('calculatedValues', i)}>×</button
            >
        </div>
    {/each}

    <!-- TRIGGERS -->
    <div class="auto__head auto__head--spaced">
        <span class="field__label">Triggers</span>
        <button
            type="button"
            class="auto__add"
            data-testid="trigger-add"
            onclick={addTrigger}>+ Add</button
        >
    </div>
    <p class="panel__help">
        Run an action as soon as its condition becomes true.
    </p>
    {#each triggers as t, i (i)}
        <div class="auto__trigger" data-trigger={str(t.type)}>
            <div class="auto__trow">
                <select
                    class="auto__ttype"
                    data-testid="trigger-type"
                    value={str(t.type) || 'complete'}
                    onchange={(e) =>
                        store.setSurveyListItemProp(
                            'triggers',
                            i,
                            'type',
                            e.currentTarget.value,
                        )}
                >
                    {#each TRIGGER_TYPES as tt (tt.value)}
                        <option value={tt.value}>{tt.label}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    class="auto__del"
                    aria-label="Remove trigger"
                    onclick={() => store.removeSurveyListItem('triggers', i)}
                    >×</button
                >
            </div>

            <label class="auto__lbl" for={`trigger-when-${i}`}>Run when</label>
            <input
                id={`trigger-when-${i}`}
                type="text"
                placeholder="Expression, e.g. {'{age}'} < 18"
                value={str(t.expression)}
                oninput={(e) =>
                    store.setSurveyListItemProp(
                        'triggers',
                        i,
                        'expression',
                        e.currentTarget.value,
                    )}
            />

            {#if t.type === 'setvalue'}
                {@render fieldSelect(i, 'setToName', 'Set this field')}
                <input
                    type="text"
                    placeholder="To this value"
                    value={str(t.setValue)}
                    oninput={(e) =>
                        store.setSurveyListItemProp(
                            'triggers',
                            i,
                            'setValue',
                            e.currentTarget.value,
                        )}
                />
            {:else if t.type === 'copyvalue'}
                {@render fieldSelect(i, 'setToName', 'Set this field')}
                {@render fieldSelect(i, 'fromName', 'From this field')}
            {:else if t.type === 'runexpression'}
                <input
                    type="text"
                    placeholder="Expression to run"
                    value={str(t.runExpression)}
                    oninput={(e) =>
                        store.setSurveyListItemProp(
                            'triggers',
                            i,
                            'runExpression',
                            e.currentTarget.value,
                        )}
                />
                {@render fieldSelect(
                    i,
                    'setToName',
                    'Store result in (optional)',
                )}
            {:else if t.type === 'skip'}
                {@render fieldSelect(i, 'gotoName', 'Skip to field')}
            {/if}
        </div>
    {/each}
</div>

{#snippet fieldSelect(i: number, key: string, label: string)}
    <label class="auto__lbl" for={`trigger-${key}-${i}`}>{label}</label>
    <select
        id={`trigger-${key}-${i}`}
        value={str((triggers[i] as Record<string, unknown>)[key])}
        onchange={(e) =>
            store.setSurveyListItemProp(
                'triggers',
                i,
                key,
                e.currentTarget.value,
            )}
    >
        <option value="">—</option>
        {#each fieldNames as n (n)}
            <option value={n}>{n}</option>
        {/each}
    </select>
{/snippet}

<style>
    .auto {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .auto__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .auto__head--spaced {
        margin-top: 0.6rem;
        padding-top: 0.5rem;
        border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    }
    .field__label {
        font-size: 0.75rem;
        opacity: 0.75;
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
    .auto__add {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.4rem;
        padding: 0.1rem 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
    }
    .auto__row {
        display: flex;
        gap: 0.3rem;
        align-items: center;
    }
    .auto__chip {
        flex: 0 0 5rem;
        font-family: ui-monospace, monospace;
        font-size: 0.72rem !important;
    }
    .auto__expr {
        flex: 1;
        min-width: 0;
    }
    .auto__inc {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        font-size: 0.68rem;
        opacity: 0.7;
        white-space: nowrap;
    }
    .auto__trigger {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 0.5rem;
    }
    .auto__trow {
        display: flex;
        gap: 0.3rem;
        align-items: center;
    }
    .auto__ttype {
        flex: 1;
    }
    .auto__lbl {
        font-size: 0.68rem;
        opacity: 0.6;
        margin-top: 0.1rem;
    }
    .auto__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 1rem;
    }
    .auto__del:hover {
        opacity: 1;
        color: #dc2626;
    }
    .auto :global(input[type='text']),
    .auto select {
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
