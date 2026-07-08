<script lang="ts">
    // A localized string field: edits the current editing locale inline, plus a
    // { } popover to edit the string across every available locale at once. Stores
    // SurveyJS `{ default, <locale> }` objects (default is always kept).
    //
    // It reads from any target object (element, page, or the survey root) and
    // writes through the `onset` callback, so the same control serves every scope.
    import { localizedValue } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
        /** The object that holds the localized prop (element, page, or survey). */
        target: Record<string, unknown>;
        propKey: string;
        label: string;
        multiline?: boolean;
        /** Persist a value into a locale. */
        onset: (value: string, locale: string) => void;
    }

    let {
        store,
        target,
        propKey,
        label,
        multiline = false,
        onset,
    }: Props = $props();

    let open = $state(false);

    /** Raw value for a locale — NO fallback to default (so empty stays empty). */
    function raw(locale: string): string {
        const v = target[propKey];

        if (v == null) {
            return '';
        }

        if (typeof v === 'string') {
            return locale === 'default' ? v : '';
        }

        return ((v as Record<string, string>)[locale] as string) ?? '';
    }

    let current = $derived(
        localizedValue(target[propKey] as never, store.editingLocale),
    );

    function set(value: string, locale: string): void {
        onset(value, locale);
    }
</script>

<div class="loc">
    <div class="loc__labelrow">
        <label class="loc__label" for={`prop-${propKey}`}>{label}</label>
        {#if store.locales.length > 1}
            <button
                type="button"
                class="loc__toggle"
                class:loc__toggle--on={open}
                data-testid={`loc-toggle-${propKey}`}
                title="Edit translations"
                aria-label={`Edit ${label} translations`}
                onclick={() => (open = !open)}
            >
                {'{ }'}
            </button>
        {/if}
    </div>

    {#if multiline}
        <textarea
            id={`prop-${propKey}`}
            rows="3"
            value={current}
            oninput={(e) => set(e.currentTarget.value, store.editingLocale)}
        ></textarea>
    {:else}
        <input
            id={`prop-${propKey}`}
            type="text"
            value={current}
            oninput={(e) => set(e.currentTarget.value, store.editingLocale)}
        />
    {/if}

    {#if open}
        <div class="loc__pop" data-testid={`loc-pop-${propKey}`}>
            {#each store.locales as loc (loc)}
                <div class="loc__row">
                    <span class="loc__code">{loc}</span>
                    <input
                        type="text"
                        data-testid={`loc-${propKey}-${loc}`}
                        value={raw(loc)}
                        oninput={(e) => set(e.currentTarget.value, loc)}
                    />
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .loc {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .loc__labelrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .loc__label {
        font-size: 0.75rem;
        opacity: 0.75;
    }
    .loc__toggle {
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.35rem;
        padding: 0 0.35rem;
        font-size: 0.72rem;
        font-family: ui-monospace, monospace;
        cursor: pointer;
        opacity: 0.7;
    }
    .loc__toggle--on {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #1c1917;
        opacity: 1;
    }
    .loc :global(input[type='text']),
    .loc textarea {
        width: 100%;
        padding: 0.4rem 0.5rem;
        border-radius: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.85rem;
        font-family: inherit;
    }
    .loc__pop {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem;
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
        border-radius: 0.5rem;
        background: color-mix(in srgb, currentColor 3%, transparent);
    }
    .loc__row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .loc__code {
        flex: 0 0 2.2rem;
        font-size: 0.72rem;
        font-family: ui-monospace, monospace;
        opacity: 0.6;
        text-transform: uppercase;
    }
</style>
