<script lang="ts">
    // A generic editor for a field's named sub-item array — matrix `rows` /
    // `columns` (ItemValue: value + localized text) and multipletext `items`
    // (name + localized title). Primary key is plain; the label is localized.
    import type { SurveyElement } from '../../schema/type-registry';
    import { localizedValue } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
        element: SurveyElement;
        /** The array property on the element, e.g. 'rows', 'columns', 'items'. */
        listKey: string;
        /** Plain identifier key on each item, e.g. 'value' or 'name'. */
        primaryKey: string;
        /** Localized label key on each item, e.g. 'text' or 'title'. */
        labelKey: string;
        /** Singular noun for defaults + the add button, e.g. 'Row'. */
        noun: string;
    }

    let { store, element, listKey, primaryKey, labelKey, noun }: Props =
        $props();

    let list = $derived(
        (element[listKey] as Array<Record<string, unknown>> | undefined) ?? [],
    );

    function add(): void {
        const n = list.length + 1;
        store.addListItem(element.name, listKey, {
            [primaryKey]: `${noun.toLowerCase()}${n}`,
            [labelKey]: { default: `${noun} ${n}` },
        });
    }

    function primary(item: Record<string, unknown>): string {
        return typeof item[primaryKey] === 'string'
            ? (item[primaryKey] as string)
            : '';
    }
</script>

<div class="il" data-list={listKey}>
    {#each list as item, i (i)}
        <div class="il__row">
            <input
                type="text"
                class="il__label"
                placeholder="Label"
                value={localizedValue(
                    item[labelKey] as never,
                    store.editingLocale,
                )}
                oninput={(e) =>
                    store.setListItemLocalized(
                        element.name,
                        listKey,
                        i,
                        labelKey,
                        e.currentTarget.value,
                    )}
            />
            <input
                type="text"
                class="il__chip"
                title="Value"
                aria-label="{noun} value"
                value={primary(item)}
                oninput={(e) =>
                    store.setListItemProp(
                        element.name,
                        listKey,
                        i,
                        primaryKey,
                        e.currentTarget.value,
                    )}
            />
            <button
                type="button"
                class="il__del"
                aria-label="Remove {noun}"
                onclick={() => store.removeListItem(element.name, listKey, i)}
                >×</button
            >
        </div>
    {/each}
    <button
        type="button"
        class="il__add"
        data-testid="list-add-{listKey}"
        onclick={add}>+ {noun}</button
    >
</div>

<style>
    .il {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .il__row {
        display: flex;
        gap: 0.35rem;
        align-items: center;
    }
    .il__label {
        flex: 1;
        min-width: 0;
    }
    .il__chip {
        flex: 0 0 5rem;
        font-family: ui-monospace, monospace;
        font-size: 0.72rem !important;
        opacity: 0.75;
    }
    .il__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 1rem;
    }
    .il__del:hover {
        opacity: 1;
        color: #dc2626;
    }
    .il__add {
        align-self: start;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.4rem;
        padding: 0.2rem 0.6rem;
        font-size: 0.78rem;
        cursor: pointer;
    }
    .il :global(input[type='text']) {
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
