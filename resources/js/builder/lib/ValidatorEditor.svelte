<script lang="ts">
    // Per-field validation rules → the native SurveyJS `validators[]` array. Each
    // rule type exposes only its relevant inputs; the message is optional.
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    const VALIDATOR_TYPES: { value: string; label: string }[] = [
        { value: 'numeric', label: 'Number range' },
        { value: 'text', label: 'Text length' },
        { value: 'email', label: 'Email address' },
        { value: 'regex', label: 'Pattern (regex)' },
        { value: 'expression', label: 'Expression' },
        { value: 'answercount', label: 'Answer count' },
    ];

    let el = $derived(store.selected);
    let validators = $derived(
        (el?.validators as Array<Record<string, unknown>> | undefined) ?? [],
    );

    let addType = $state('numeric');

    function add(): void {
        if (el) {
            store.addValidator(el.name, addType);
        }
    }

    function num(v: unknown): string {
        return v == null ? '' : String(v);
    }

    function str(v: unknown): string {
        return typeof v === 'string' ? v : '';
    }

    function setNum(i: number, key: string, raw: string): void {
        if (el) {
            store.setValidatorProp(
                el.name,
                i,
                key,
                raw === '' ? '' : Number(raw),
            );
        }
    }

    function setStr(i: number, key: string, raw: string): void {
        if (el) {
            store.setValidatorProp(el.name, i, key, raw);
        }
    }

    function labelFor(type: unknown): string {
        return (
            VALIDATOR_TYPES.find((t) => t.value === type)?.label ?? String(type)
        );
    }
</script>

<div class="val">
    {#each validators as v, i (i)}
        <div class="val__row" data-validator={String(v.type)}>
            <div class="val__top">
                <span class="val__type">{labelFor(v.type)}</span>
                <button
                    type="button"
                    class="val__del"
                    aria-label="Remove rule"
                    onclick={() => el && store.removeValidator(el.name, i)}
                    >×</button
                >
            </div>

            {#if v.type === 'numeric'}
                <div class="val__grid">
                    <input
                        type="number"
                        placeholder="Min"
                        value={num(v.minValue)}
                        oninput={(e) =>
                            setNum(i, 'minValue', e.currentTarget.value)}
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={num(v.maxValue)}
                        oninput={(e) =>
                            setNum(i, 'maxValue', e.currentTarget.value)}
                    />
                </div>
            {:else if v.type === 'text'}
                <div class="val__grid">
                    <input
                        type="number"
                        placeholder="Min length"
                        value={num(v.minLength)}
                        oninput={(e) =>
                            setNum(i, 'minLength', e.currentTarget.value)}
                    />
                    <input
                        type="number"
                        placeholder="Max length"
                        value={num(v.maxLength)}
                        oninput={(e) =>
                            setNum(i, 'maxLength', e.currentTarget.value)}
                    />
                </div>
            {:else if v.type === 'answercount'}
                <div class="val__grid">
                    <input
                        type="number"
                        placeholder="Min answers"
                        value={num(v.minCount)}
                        oninput={(e) =>
                            setNum(i, 'minCount', e.currentTarget.value)}
                    />
                    <input
                        type="number"
                        placeholder="Max answers"
                        value={num(v.maxCount)}
                        oninput={(e) =>
                            setNum(i, 'maxCount', e.currentTarget.value)}
                    />
                </div>
            {:else if v.type === 'regex'}
                <input
                    type="text"
                    class="val__mono"
                    placeholder="Regular expression"
                    value={str(v.regex)}
                    oninput={(e) => setStr(i, 'regex', e.currentTarget.value)}
                />
            {:else if v.type === 'expression'}
                <input
                    type="text"
                    class="val__mono"
                    placeholder="Expression, e.g. {'{age}'} > 0"
                    value={str(v.expression)}
                    oninput={(e) =>
                        setStr(i, 'expression', e.currentTarget.value)}
                />
            {/if}

            <input
                type="text"
                placeholder="Error message (optional)"
                value={str(v.text)}
                oninput={(e) => setStr(i, 'text', e.currentTarget.value)}
            />
        </div>
    {/each}

    <div class="val__add">
        <select data-testid="validator-type" bind:value={addType}>
            {#each VALIDATOR_TYPES as t (t.value)}
                <option value={t.value}>{t.label}</option>
            {/each}
        </select>
        <button
            type="button"
            class="val__addbtn"
            data-testid="validator-add"
            onclick={add}>+ Add rule</button
        >
    </div>
</div>

<style>
    .val {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .val__row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 0.5rem;
    }
    .val__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .val__type {
        font-size: 0.78rem;
        font-weight: 600;
    }
    .val__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 1rem;
    }
    .val__del:hover {
        opacity: 1;
        color: #dc2626;
    }
    .val__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.35rem;
    }
    .val__mono {
        font-family: ui-monospace, monospace;
        font-size: 0.78rem !important;
    }
    .val__add {
        display: flex;
        gap: 0.35rem;
    }
    .val__addbtn {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.45rem;
        padding: 0.35rem 0.6rem;
        font-size: 0.8rem;
        cursor: pointer;
        white-space: nowrap;
    }
    .val :global(input[type='text']),
    .val :global(input[type='number']),
    .val select {
        width: 100%;
        padding: 0.35rem 0.45rem;
        border-radius: 0.4rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.8rem;
        font-family: inherit;
    }
    .val__add select {
        flex: 1;
    }
</style>
