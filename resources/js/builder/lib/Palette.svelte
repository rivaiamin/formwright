<script lang="ts">
    import {
        dragHandle,
        dragHandleZone,
        SHADOW_PLACEHOLDER_ITEM_ID,
    } from 'svelte-dnd-action';

    import { DND_FIELD_TYPE, FLIP_MS } from '../dnd';
    import type { PaletteItem } from '../dnd';
    import type { BlockLibrary, SavedBlock } from '../library.svelte';
    import { PALETTE_GROUPS } from '../store.svelte';
    import type { PaletteBlock } from '../store.svelte';
    import Icon from './Icon.svelte';

    interface Props {
        /** Click-to-add (grip = drag, label = add). Also a deterministic test hook. */
        onadd?: (blockId: string) => void;
        /** The reusable-block library, if enabled. */
        library?: BlockLibrary;
        /** Server-provided shared question library (insert-only). */
        sharedBlocks?: SavedBlock[];
        oninsertsaved?: (block: SavedBlock) => void;
    }

    let { onadd, library, sharedBlocks = [], oninsertsaved }: Props = $props();

    // Question library can hold hundreds of entries — a flat list is unusable, so
    // it's a search box: type to filter, results capped so the DOM stays small.
    const LIBRARY_LIMIT = 20;
    let query = $state('');
    const libraryMatches = $derived.by(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            return [];
        }
        return sharedBlocks
            .filter((b) => b.label.toLowerCase().includes(q))
            .slice(0, LIBRARY_LIMIT);
    });

    function insertFirstMatch(): void {
        const first = libraryMatches[0];
        if (first) {
            oninsertsaved?.(first);
            query = '';
        }
    }

    function itemsFor(blocks: PaletteBlock[]): PaletteItem[] {
        return blocks.map((b) => ({
            id: `tpl:${b.id}`,
            isTemplate: true as const,
            blockId: b.id,
            label: b.label,
            icon: b.icon,
        }));
    }

    // One dnd zone per group; each is a drag SOURCE that copies templates into the
    // canvas. All share the 'field' type so items drop into any page zone.
    let groups = $state(
        PALETTE_GROUPS.map((g) => ({
            label: g.label,
            items: itemsFor(g.blocks),
        })),
    );

    function onconsider(
        index: number,
        e: CustomEvent<{ items: PaletteItem[] }>,
    ): void {
        groups[index].items = e.detail.items;
    }

    function onfinalize(index: number): void {
        // Restore the full template list — the palette is a source, never mutated.
        groups[index].items = itemsFor(PALETTE_GROUPS[index].blocks);
    }
</script>

<aside class="palette" aria-label="Field types">
    <p class="palette__hint">Click to add or drag onto the form</p>

    {#each groups as group, gi (group.label)}
        <details class="palette__acc" open>
            <summary class="palette__group">{group.label}</summary>
        <div
            class="palette__list"
            use:dragHandleZone={{
                items: group.items,
                type: DND_FIELD_TYPE,
                flipDurationMs: FLIP_MS,
                dropFromOthersDisabled: true,
                dropTargetStyle: {},
            }}
            onconsider={(e) => onconsider(gi, e)}
            onfinalize={() => onfinalize(gi)}
        >
            {#each group.items as item (item.id)}
                <div class="palette__row">
                    {#if item.id !== SHADOW_PLACEHOLDER_ITEM_ID}
                        <span
                            class="palette__grip"
                            use:dragHandle
                            aria-label={`Drag ${item.label}`}>⠿</span
                        >
                        <button
                            type="button"
                            class="palette__chip"
                            data-block-id={item.blockId}
                            onclick={() => onadd?.(item.blockId)}
                            title={`Add ${item.label}`}
                        >
                            <span class="palette__icon" aria-hidden="true"
                                ><Icon name={item.icon} /></span
                            >
                            {item.label}
                        </button>
                    {/if}
                </div>
            {/each}
        </div>
        </details>
    {/each}

    {#if sharedBlocks.length > 0}
        <div class="palette__library">
        <p class="palette__group">Question library</p>
        <input
            class="palette__search"
            type="search"
            placeholder="Cari pertanyaan…"
            aria-label="Search question library"
            data-testid="shared-blocks-search"
            bind:value={query}
            onkeydown={(e) => e.key === 'Enter' && insertFirstMatch()}
        />
        {#if query.trim()}
            <div class="palette__list" data-testid="shared-blocks">
                {#each libraryMatches as block (block.id)}
                    <div class="palette__row">
                        <button
                            type="button"
                            class="palette__chip"
                            data-shared-block={block.id}
                            title={`Insert ${block.label}`}
                            onclick={() => {
                                oninsertsaved?.(block);
                                query = '';
                            }}
                        >
                            <span class="palette__icon" aria-hidden="true"
                                >◆</span
                            >
                            {block.label}
                        </button>
                    </div>
                {/each}
                {#if libraryMatches.length === 0}
                    <p class="palette__empty">Tidak ada yang cocok</p>
                {:else if libraryMatches.length === LIBRARY_LIMIT}
                    <p class="palette__empty">
                        Menampilkan {LIBRARY_LIMIT} teratas — persempit pencarian
                    </p>
                {/if}
            </div>
        {/if}
        </div>
    {/if}

    {#if library && library.blocks.length > 0}
        <p class="palette__group">Saved blocks</p>
        <div class="palette__list" data-testid="saved-blocks">
            {#each library.blocks as block (block.id)}
                <div class="palette__row">
                    <button
                        type="button"
                        class="palette__chip"
                        data-saved-block={block.id}
                        title={`Insert ${block.label}`}
                        onclick={() => oninsertsaved?.(block)}
                    >
                        <span class="palette__icon" aria-hidden="true">★</span>
                        {block.label}
                    </button>
                    <button
                        type="button"
                        class="palette__del"
                        aria-label={`Remove ${block.label} from library`}
                        onclick={() => library.remove(block.id)}
                    >
                        ×
                    </button>
                </div>
            {/each}
        </div>
    {/if}
</aside>

<style>
    .palette {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        /* Pin the palette so the question-library search stays reachable while the
           canvas scrolls; scroll the palette itself when its content overflows. */
        position: sticky;
        top: 0.5rem;
        align-self: start;
        max-height: calc(100vh - 1rem);
        overflow-y: auto;
    }
    .palette__hint {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        opacity: 0.55;
        order: -2;
    }
    /* The question library is the most-used section — float it to the top of the
       sticky column so it needs no scrolling, without moving it in the DOM. */
    .palette__library {
        order: -1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.35rem;
    }
    .palette__acc {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    .palette__acc > summary.palette__group {
        cursor: pointer;
        list-style: revert;
    }
    .palette__group {
        margin: 0.6rem 0 0.15rem;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        opacity: 0.45;
    }
    .palette__list {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-height: 1rem;
    }
    .palette__row {
        display: flex;
        align-items: stretch;
        gap: 0.2rem;
    }
    .palette__grip {
        display: flex;
        align-items: center;
        padding: 0 0.15rem;
        cursor: grab;
        opacity: 0.35;
        user-select: none;
    }
    .palette__grip:hover {
        opacity: 0.75;
    }
    .palette__chip {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 0.6rem;
        text-align: start;
        color: inherit;
        font-family: inherit;
        padding: 0.5rem 0.65rem;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 0.55rem;
        font-size: 0.85rem;
        cursor: pointer;
        background: color-mix(in srgb, currentColor 3%, transparent);
    }
    .palette__chip:hover {
        border-color: #f59e0b;
        background: color-mix(in srgb, #f59e0b 8%, transparent);
    }
    .palette__icon {
        display: flex;
        color: #b45309;
        opacity: 0.9;
    }
    .palette__search {
        width: 100%;
        box-sizing: border-box;
        padding: 0.4rem 0.55rem;
        border-radius: 0.5rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.8rem;
    }
    .palette__search:focus {
        outline: none;
        border-color: #f59e0b;
    }
    .palette__empty {
        margin: 0.15rem 0.1rem;
        font-size: 0.72rem;
        opacity: 0.55;
    }
    .palette__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.4;
        font-size: 0.95rem;
        padding: 0 0.25rem;
    }
    .palette__del:hover {
        opacity: 1;
        color: #dc2626;
    }
</style>
