<script lang="ts">
    import type { BuilderStore, SurveySchema } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    function serialize(): string {
        return JSON.stringify(store.export(), null, 2);
    }

    let draft = $state(serialize());
    let jsonDirty = $state(false);
    let error = $state('');

    // Reflect canvas/property edits into the JSON view — but only while the user
    // isn't mid-edit here, so the two directions never fight (JSON stays canonical
    // once "Apply" runs). Tracks the structural revision, not every keystroke.
    $effect(() => {
        store.rev;

        if (!jsonDirty) {
            draft = serialize();
        }
    });

    function apply(): void {
        let parsed: unknown;

        try {
            parsed = JSON.parse(draft);
        } catch (e) {
            error = `Invalid JSON: ${(e as Error).message}`;

            return;
        }

        if (
            parsed == null ||
            typeof parsed !== 'object' ||
            !Array.isArray((parsed as SurveySchema).pages)
        ) {
            error = 'Schema must be an object with a "pages" array.';

            return;
        }

        error = '';
        jsonDirty = false;
        store.replaceSchema(parsed as SurveySchema);
    }

    function revert(): void {
        draft = serialize();
        jsonDirty = false;
        error = '';
    }
</script>

<div class="json">
    <div class="json__bar">
        <span class="json__hint"
            >The schema is canonical. Edits here drive the visual builder on
            Apply.</span
        >
        <div class="json__actions">
            <button
                type="button"
                class="json__btn"
                onclick={revert}
                disabled={!jsonDirty}>Revert</button
            >
            <button
                type="button"
                class="json__btn json__btn--primary"
                onclick={apply}
                disabled={!jsonDirty}
            >
                Apply to builder
            </button>
        </div>
    </div>

    {#if error}
        <p class="json__error">{error}</p>
    {/if}

    <textarea
        class="json__area"
        spellcheck="false"
        bind:value={draft}
        oninput={() => {
            jsonDirty = true;
            error = '';
        }}
    ></textarea>
</div>

<style>
    .json {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .json__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
    .json__hint {
        font-size: 0.78rem;
        opacity: 0.6;
    }
    .json__actions {
        display: flex;
        gap: 0.5rem;
    }
    .json__btn {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        padding: 0.35rem 0.8rem;
        border-radius: 0.45rem;
        cursor: pointer;
        font-size: 0.8rem;
    }
    .json__btn:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .json__btn--primary:not(:disabled) {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #1c1917;
        font-weight: 600;
    }
    .json__error {
        margin: 0;
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
        border-radius: 0.45rem;
        background: color-mix(in srgb, #dc2626 18%, transparent);
    }
    .json__area {
        width: 100%;
        min-height: 58vh;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.82rem;
        line-height: 1.5;
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
    }
</style>
