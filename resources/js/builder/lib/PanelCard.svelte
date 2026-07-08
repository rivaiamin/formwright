<script lang="ts">
    // A container element (panel / repeating group) rendered as a card that holds
    // its own drag zone. Children use the same dnd `type` as the page zone, so a
    // field can be dragged from the palette or from a page straight into a panel.
    //
    // Like the page board, the child list is a LOCAL drag projection rebuilt only
    // when `store.rev` bumps — never on a dnd commit, or the drag would fight the
    // schema it just wrote.
    import { untrack } from 'svelte';
    import { dndzone } from 'svelte-dnd-action';

    import type { SurveyElement } from '../../schema/type-registry';
    import {
        DND_FIELD_TYPE,
        FLIP_MS,
        fromWrappers,
        isTemplate,
        toWrappers,
    } from '../dnd';
    import type { FieldDndItem } from '../dnd';
    import { localizedValue } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';
    import ElementCard from './ElementCard.svelte';
    import Self from './PanelCard.svelte';

    interface Props {
        element: SurveyElement;
        store: BuilderStore;
        selected?: boolean;
        onselect?: () => void;
        onremove?: () => void;
        onduplicate?: () => void;
    }

    let {
        element,
        store,
        selected = false,
        onselect,
        onremove,
        onduplicate,
    }: Props = $props();

    let locale = $derived(store.editingLocale);
    let repeating = $derived(element.type === 'paneldynamic');
    let title = $derived(
        localizedValue(element.title as never, locale) || element.name,
    );
    let childKey = $derived(store.childKeyOf(element));

    function children(): SurveyElement[] {
        return (element[childKey] as SurveyElement[] | undefined) ?? [];
    }

    let items = $state<FieldDndItem[]>(toWrappers(children()));

    $effect(() => {
        store.rev; // track ONLY the structural revision
        untrack(() => {
            items = toWrappers(children());
        });
    });

    function onconsider(e: CustomEvent<{ items: FieldDndItem[] }>): void {
        items = e.detail.items;
    }

    function onfinalize(e: CustomEvent<{ items: FieldDndItem[] }>): void {
        const droppedTemplate = e.detail.items.some(isTemplate);
        const before = store.allNames();

        const elements = fromWrappers(e.detail.items, new Set(before));
        items = toWrappers(elements);
        store.setContainerElements(element.name, elements);

        if (droppedTemplate) {
            const created = elements.find((el) => !before.has(el.name));
            store.select(
                (created ?? elements[elements.length - 1])?.name ?? null,
            );
        }
    }

    function elementOf(item: FieldDndItem): SurveyElement | null {
        return isTemplate(item) ? null : item.element;
    }

    function stop(e: Event): void {
        e.stopPropagation();
    }
</script>

<div
    class="panelcard"
    class:panelcard--selected={selected}
    class:panelcard--repeat={repeating}
    data-element={element.name}
    data-container={childKey}
>
    <div
        class="panelcard__head"
        role="button"
        tabindex="0"
        onclick={onselect}
        onkeydown={(e) =>
            (e.key === 'Enter' || e.key === ' ') &&
            (e.preventDefault(), onselect?.())}
    >
        <span class="card__grip" aria-hidden="true">⠿</span>
        <span class="panelcard__badge"
            >{repeating ? 'Repeating group' : 'Panel'}</span
        >
        <span class="panelcard__title">{title}</span>
        <span class="panelcard__count">{children().length} field(s)</span>
        <div class="card__actions">
            {#if onduplicate}
                <button
                    type="button"
                    data-action="duplicate"
                    title="Duplicate"
                    aria-label="Duplicate panel"
                    onclick={(e) => (stop(e), onduplicate?.())}>⧉</button
                >
            {/if}
            {#if onremove}
                <button
                    type="button"
                    data-action="delete"
                    title="Delete"
                    aria-label="Delete panel"
                    onclick={(e) => (stop(e), onremove?.())}>🗑</button
                >
            {/if}
        </div>
    </div>

    <div
        class="panelcard__body"
        class:panelcard__body--empty={items.length === 0}
        data-panel-zone={element.name}
        use:dndzone={{
            items,
            type: DND_FIELD_TYPE,
            flipDurationMs: FLIP_MS,
            dropTargetStyle: {},
        }}
        {onconsider}
        {onfinalize}
    >
        {#each items as item (item.id)}
            {@const child = elementOf(item)}
            <div class="panelcard__item">
                {#if child && store.isContainer(child)}
                    <Self
                        element={child}
                        {store}
                        selected={store.selectedName === child.name}
                        onselect={() => store.select(child.name)}
                        onremove={() => store.removeElement(child.name)}
                        onduplicate={() => store.duplicateElement(child.name)}
                    />
                {:else if child}
                    <ElementCard
                        element={child}
                        {store}
                        selected={store.selectedName === child.name}
                        onselect={() => store.select(child.name)}
                        onremove={() => store.removeElement(child.name)}
                        onduplicate={() => store.duplicateElement(child.name)}
                    />
                {:else if isTemplate(item)}
                    <div class="ghost">{item.label}</div>
                {/if}
            </div>
        {/each}

        {#if items.length === 0}
            <p class="panelcard__empty">
                Drag fields here{repeating
                    ? ' — the respondent can add copies of them'
                    : ''}.
            </p>
        {/if}
    </div>

    {#if repeating}
        <div class="panelcard__foot">
            + {localizedValue(element.panelAddText as never, locale) ||
                'Add another'}
        </div>
    {/if}
</div>

<style>
    .panelcard {
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        border-radius: 0.7rem;
        overflow: hidden;
        background: color-mix(in srgb, currentColor 2%, transparent);
    }
    .panelcard--selected {
        border-color: #f59e0b;
        box-shadow: 0 0 0 1px #f59e0b;
    }
    .panelcard--repeat {
        border-style: dashed;
    }
    .panelcard__head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.7rem;
        background: color-mix(in srgb, currentColor 6%, transparent);
        cursor: pointer;
        text-align: start;
    }
    .card__grip {
        cursor: grab;
        opacity: 0.35;
    }
    .panelcard__badge {
        font-size: 0.66rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.6;
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        border-radius: 0.4rem;
        padding: 0.1rem 0.4rem;
        white-space: nowrap;
    }
    .panelcard__title {
        font-weight: 600;
        font-size: 0.9rem;
    }
    .panelcard__count {
        font-size: 0.72rem;
        opacity: 0.55;
    }
    .card__actions {
        margin-inline-start: auto;
        display: flex;
        gap: 0.2rem;
    }
    .card__actions button {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 0.9rem;
        padding: 0.15rem 0.35rem;
        border-radius: 0.35rem;
        line-height: 1;
    }
    .card__actions button:hover {
        opacity: 1;
        background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .panelcard__body {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem;
        min-height: 3rem;
    }
    .panelcard__body--empty {
        border: 1px dashed color-mix(in srgb, currentColor 20%, transparent);
        border-radius: 0.5rem;
        margin: 0.4rem;
    }
    .panelcard__empty {
        margin: 0;
        padding: 0.5rem;
        text-align: center;
        font-size: 0.78rem;
        opacity: 0.5;
    }
    .panelcard__foot {
        padding: 0.4rem 0.7rem 0.6rem;
        font-size: 0.8rem;
        color: #b45309;
        opacity: 0.85;
    }
    .ghost {
        padding: 0.6rem 0.7rem;
        border: 1px dashed #f59e0b;
        border-radius: 0.6rem;
        font-size: 0.85rem;
        opacity: 0.8;
    }
</style>
