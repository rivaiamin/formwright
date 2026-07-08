<script lang="ts">
    // Saved version history. Revisions are written server-side on every distinct
    // Save; restoring only loads the old JSON back into the builder as a normal
    // (undoable) replacement — nothing is written until the author saves again.
    import type { RestoreResult, RevisionInfo } from '../main';
    import type { BuilderStore, SurveySchema } from '../store.svelte';

    interface Props {
        store: BuilderStore;
        onRevisions: () => Promise<RevisionInfo[]> | RevisionInfo[];
        onRestore: (id: number) => Promise<RestoreResult> | RestoreResult;
        onrestored?: () => void;
    }

    let { store, onRevisions, onRestore, onrestored }: Props = $props();

    let rows = $state<RevisionInfo[]>([]);
    let loading = $state(true);
    let error = $state('');

    async function load(): Promise<void> {
        loading = true;
        error = '';

        try {
            rows = (await onRevisions()) ?? [];
        } catch (e) {
            error = (e as Error).message;
        } finally {
            loading = false;
        }
    }

    async function restore(id: number): Promise<void> {
        error = '';

        try {
            const result = await onRestore(id);

            if (!result?.ok || !result.schema) {
                error = result?.error ?? 'Could not restore that version.';

                return;
            }

            store.replaceSchema(result.schema as SurveySchema);
            onrestored?.();
        } catch (e) {
            error = (e as Error).message;
        }
    }

    // Load once when the panel opens.
    $effect(() => {
        void load();
    });
</script>

<section class="hist" data-testid="history-panel">
    <div class="hist__head">
        <strong class="hist__title">Version history</strong>
        <span class="hist__hint"
            >Restoring loads the version into the builder — Save to keep it,
            Undo to back out.</span
        >
    </div>

    {#if error}
        <p class="hist__error">{error}</p>
    {/if}

    {#if loading}
        <p class="hist__empty">Loading…</p>
    {:else if rows.length === 0}
        <p class="hist__empty" data-testid="history-empty">
            No saved versions yet. Save the form to create one.
        </p>
    {:else}
        <ul class="hist__list">
            {#each rows as row (row.id)}
                <li class="hist__row" data-revision={row.id}>
                    <span class="hist__when">{row.savedAt}</span>
                    <span class="hist__meta">{row.fields} field(s)</span>
                    {#if row.current}
                        <span class="hist__badge">Current</span>
                    {/if}
                    <button
                        type="button"
                        class="hist__restore"
                        data-testid={`restore-${row.id}`}
                        disabled={row.current}
                        onclick={() => restore(row.id)}
                    >
                        Restore
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
    .hist {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.8rem;
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        border-radius: 0.7rem;
        background: color-mix(in srgb, currentColor 3%, transparent);
    }
    .hist__head {
        display: flex;
        align-items: baseline;
        gap: 0.8rem;
        flex-wrap: wrap;
    }
    .hist__title {
        font-size: 0.9rem;
    }
    .hist__hint {
        font-size: 0.72rem;
        opacity: 0.55;
    }
    .hist__empty {
        margin: 0;
        font-size: 0.82rem;
        opacity: 0.6;
    }
    .hist__error {
        margin: 0;
        font-size: 0.82rem;
        padding: 0.4rem 0.6rem;
        border-radius: 0.4rem;
        background: color-mix(in srgb, #dc2626 15%, transparent);
    }
    .hist__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    .hist__row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.4rem 0.55rem;
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 0.5rem;
        font-size: 0.85rem;
    }
    .hist__when {
        flex: 1;
    }
    .hist__meta {
        font-size: 0.75rem;
        opacity: 0.55;
    }
    .hist__badge {
        font-size: 0.66rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #b45309;
        background: color-mix(in srgb, #f59e0b 16%, transparent);
        border-radius: 0.35rem;
        padding: 0.1rem 0.4rem;
    }
    .hist__restore {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.4rem;
        padding: 0.2rem 0.6rem;
        font-size: 0.78rem;
        cursor: pointer;
    }
    .hist__restore:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
