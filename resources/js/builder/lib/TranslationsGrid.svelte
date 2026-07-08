<script lang="ts">
    // Every translatable string in the form × every locale, in one grid, so a
    // translator works in one place instead of hunting through field popovers.
    // Rows come from a generic walk of the schema (see store.translationEntries).
    import { isRtlLocale } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    let entries = $derived(store.translationEntries());
    /** Locales other than `default` — the columns a translator actually fills. */
    let targets = $derived(store.locales.filter((l) => l !== 'default'));

    /** How many strings have a value in each target locale. */
    let coverage = $derived(
        targets.map((locale) => ({
            locale,
            done: entries.filter(
                (e) => store.localizedAtPath(e.path, locale) !== '',
            ).length,
        })),
    );

    function rowKey(path: (string | number)[]): string {
        return path.join('.');
    }
</script>

<div class="tr">
    <div class="tr__bar">
        <span class="tr__count" data-testid="translations-count"
            >{entries.length} translatable string(s)</span
        >
        {#each coverage as c (c.locale)}
            <span class="tr__cov" data-testid={`coverage-${c.locale}`}>
                {c.locale}: {c.done}/{entries.length}
            </span>
        {/each}
    </div>

    {#if targets.length === 0}
        <p class="tr__hint">
            Only the default language is set up. Add a locale in the toolbar
            (e.g. <code>fr</code>) to start translating.
        </p>
    {/if}

    {#if entries.length === 0}
        <p class="tr__hint">
            Nothing to translate yet — add some fields first.
        </p>
    {:else}
        <div class="tr__scroll">
            <table class="tr__table" data-testid="translations-table">
                <thead>
                    <tr>
                        <th class="tr__where">Where</th>
                        <th>default</th>
                        {#each targets as locale (locale)}
                            <th
                                >{locale}{isRtlLocale(locale)
                                    ? ' (RTL)'
                                    : ''}</th
                            >
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each entries as entry (rowKey(entry.path))}
                        <tr data-row={rowKey(entry.path)}>
                            <td class="tr__where">
                                <span class="tr__ctx">{entry.context}</span>
                                <span class="tr__label">{entry.label}</span>
                            </td>
                            <td>
                                <input
                                    type="text"
                                    data-testid={`tr-${rowKey(entry.path)}-default`}
                                    value={store.localizedAtPath(
                                        entry.path,
                                        'default',
                                    )}
                                    oninput={(e) =>
                                        store.setLocalizedAtPath(
                                            entry.path,
                                            e.currentTarget.value,
                                            'default',
                                        )}
                                />
                            </td>
                            {#each targets as locale (locale)}
                                <td>
                                    <input
                                        type="text"
                                        dir={isRtlLocale(locale)
                                            ? 'rtl'
                                            : 'ltr'}
                                        class:tr__missing={store.localizedAtPath(
                                            entry.path,
                                            locale,
                                        ) === ''}
                                        data-testid={`tr-${rowKey(entry.path)}-${locale}`}
                                        value={store.localizedAtPath(
                                            entry.path,
                                            locale,
                                        )}
                                        oninput={(e) =>
                                            store.setLocalizedAtPath(
                                                entry.path,
                                                e.currentTarget.value,
                                                locale,
                                            )}
                                    />
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .tr {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }
    .tr__bar {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        flex-wrap: wrap;
    }
    .tr__count {
        font-size: 0.8rem;
        opacity: 0.6;
    }
    .tr__cov {
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 0.35rem;
        background: color-mix(in srgb, currentColor 8%, transparent);
        font-family: ui-monospace, monospace;
    }
    .tr__hint {
        font-size: 0.85rem;
        opacity: 0.7;
        line-height: 1.5;
    }
    .tr__hint code {
        font-family: ui-monospace, monospace;
    }
    .tr__scroll {
        overflow-x: auto;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 0.6rem;
    }
    .tr__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }
    .tr__table th {
        text-align: start;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        opacity: 0.5;
        padding: 0.5rem 0.6rem;
        border-bottom: 1px solid
            color-mix(in srgb, currentColor 12%, transparent);
        white-space: nowrap;
    }
    .tr__table td {
        padding: 0.3rem 0.4rem;
        border-bottom: 1px solid
            color-mix(in srgb, currentColor 7%, transparent);
        vertical-align: middle;
    }
    .tr__where {
        min-width: 11rem;
    }
    .tr__ctx {
        display: block;
        font-family: ui-monospace, monospace;
        font-size: 0.72rem;
        opacity: 0.85;
    }
    .tr__label {
        display: block;
        font-size: 0.7rem;
        opacity: 0.5;
    }
    .tr__table :global(input[type='text']) {
        width: 100%;
        min-width: 9rem;
        padding: 0.35rem 0.45rem;
        border-radius: 0.4rem;
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        background: color-mix(in srgb, currentColor 3%, transparent);
        color: inherit;
        font-size: 0.82rem;
        font-family: inherit;
    }
    .tr__missing {
        border-color: color-mix(in srgb, #f59e0b 55%, transparent) !important;
        background: color-mix(in srgb, #f59e0b 8%, transparent) !important;
    }
</style>
