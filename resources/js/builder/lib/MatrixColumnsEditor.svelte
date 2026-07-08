<script lang="ts">
    // Columns of a matrixdropdown / matrixdynamic. Unlike a simple matrix's
    // ItemValue columns, these are typed cells: each column has a `name`, a
    // localized `title`, and a `cellType` that decides what the cell renders.
    import type { SurveyElement } from '../../schema/type-registry';
    import { localizedValue } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
        element: SurveyElement;
    }

    let { store, element }: Props = $props();

    const CELL_TYPES = [
        { value: 'dropdown', label: 'Dropdown' },
        { value: 'text', label: 'Short answer' },
        { value: 'comment', label: 'Long answer' },
        { value: 'radiogroup', label: 'Single choice' },
        { value: 'checkbox', label: 'Multiple choice' },
        { value: 'boolean', label: 'Yes / No' },
        { value: 'rating', label: 'Rating' },
    ];

    type Column = { name?: unknown; title?: unknown; cellType?: unknown };

    let columns = $derived((element.columns as Column[] | undefined) ?? []);

    function add(): void {
        const n = columns.length + 1;
        store.addListItem(element.name, 'columns', {
            name: `column${n}`,
            title: { default: `Column ${n}` },
            cellType: element.type === 'matrixdynamic' ? 'text' : 'dropdown',
        });
    }

    function str(v: unknown, fallback = ''): string {
        return typeof v === 'string' ? v : fallback;
    }
</script>

<div class="mcol">
    {#each columns as column, i (i)}
        <div class="mcol__row" data-column={str(column.name)}>
            <div class="mcol__top">
                <input
                    type="text"
                    class="mcol__title"
                    placeholder="Column title"
                    aria-label="Column title"
                    value={localizedValue(
                        column.title as never,
                        store.editingLocale,
                    )}
                    oninput={(e) =>
                        store.setListItemLocalized(
                            element.name,
                            'columns',
                            i,
                            'title',
                            e.currentTarget.value,
                        )}
                />
                <button
                    type="button"
                    class="mcol__del"
                    aria-label="Remove column"
                    onclick={() =>
                        store.removeListItem(element.name, 'columns', i)}
                    >×</button
                >
            </div>
            <div class="mcol__meta">
                <input
                    type="text"
                    class="mcol__chip"
                    title="Column name"
                    aria-label="Column name"
                    value={str(column.name)}
                    oninput={(e) =>
                        store.setListItemProp(
                            element.name,
                            'columns',
                            i,
                            'name',
                            e.currentTarget.value,
                        )}
                />
                <select
                    class="mcol__type"
                    aria-label="Cell type"
                    value={str(column.cellType, 'dropdown')}
                    onchange={(e) =>
                        store.setListItemProp(
                            element.name,
                            'columns',
                            i,
                            'cellType',
                            e.currentTarget.value,
                        )}
                >
                    {#each CELL_TYPES as t (t.value)}
                        <option value={t.value}>{t.label}</option>
                    {/each}
                </select>
            </div>
        </div>
    {/each}

    <button
        type="button"
        class="mcol__add"
        data-testid="matrix-column-add"
        onclick={add}>+ Column</button
    >
</div>

<style>
    .mcol {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .mcol__row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.4rem;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 0.5rem;
    }
    .mcol__top {
        display: flex;
        gap: 0.3rem;
        align-items: center;
    }
    .mcol__title {
        flex: 1;
        min-width: 0;
    }
    .mcol__meta {
        display: flex;
        gap: 0.3rem;
    }
    .mcol__chip {
        flex: 0 0 6rem;
        font-family: ui-monospace, monospace;
        font-size: 0.72rem !important;
        opacity: 0.75;
    }
    .mcol__type {
        flex: 1;
    }
    .mcol__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 1rem;
    }
    .mcol__del:hover {
        opacity: 1;
        color: #dc2626;
    }
    .mcol__add {
        align-self: start;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.4rem;
        padding: 0.2rem 0.6rem;
        font-size: 0.78rem;
        cursor: pointer;
    }
    .mcol :global(input[type='text']),
    .mcol select {
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
