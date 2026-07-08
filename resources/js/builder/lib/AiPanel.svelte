<script lang="ts">
    // ---------------------------------------------------------------------------
    // AiPanel.svelte — Phase 11. Describe a form in plain language; the host's
    // AiAssistant drafts SurveyJS JSON. The result is shown as a PROPOSAL — never
    // applied to the user's schema without an explicit Apply (and Apply is undoable).
    // ---------------------------------------------------------------------------
    import type { AiDraftResult } from '../main';
    import type { BuilderStore, SurveySchema } from '../store.svelte';

    interface Props {
        store: BuilderStore;
        onAiDraft?: (prompt: string) => Promise<AiDraftResult> | AiDraftResult;
    }

    let { store, onAiDraft }: Props = $props();

    let prompt = $state('');
    let busy = $state(false);
    let error = $state('');
    let proposal = $state<SurveySchema | null>(null);

    let summary = $derived.by(() => {
        if (!proposal) {
            return '';
        }

        const pages = Array.isArray(proposal.pages) ? proposal.pages : [];
        const fields = pages.reduce(
            (n, p) => n + (Array.isArray(p.elements) ? p.elements.length : 0),
            0,
        );

        return `${pages.length} page(s), ${fields} field(s)`;
    });

    async function draft(): Promise<void> {
        if (!prompt.trim() || !onAiDraft) {
            return;
        }

        busy = true;
        error = '';
        proposal = null;

        try {
            const result = await onAiDraft(prompt.trim());

            if (result?.ok && result.schema) {
                proposal = result.schema as SurveySchema;
            } else {
                error = result?.error ?? 'AI request failed.';
            }
        } catch (e) {
            error = (e as Error).message;
        } finally {
            busy = false;
        }
    }

    function apply(): void {
        if (proposal) {
            // Snapshot to a plain object — a $state proxy isn't structured-cloneable.
            store.applyProposal($state.snapshot(proposal) as SurveySchema);
            proposal = null;
            prompt = '';
        }
    }

    function discard(): void {
        proposal = null;
    }
</script>

<div class="ai" data-testid="ai-panel">
    <div class="ai__row">
        <span class="ai__badge">AI</span>
        <input
            class="ai__input"
            data-testid="ai-prompt"
            placeholder="Describe a form to draft — e.g. “a 3-question customer feedback survey”"
            bind:value={prompt}
            disabled={busy}
            onkeydown={(e) => e.key === 'Enter' && draft()}
        />
        <button
            type="button"
            class="ai__btn"
            data-testid="ai-draft"
            onclick={draft}
            disabled={busy || !prompt.trim()}
        >
            {busy ? 'Drafting…' : 'Draft with AI'}
        </button>
    </div>

    {#if error}
        <p class="ai__error">{error}</p>
    {/if}

    {#if proposal}
        <div class="ai__proposal" data-testid="ai-proposal">
            <span
                >Proposed form — {summary}. This will replace the current schema
                (you can undo).</span
            >
            <div class="ai__proposal-actions">
                <button type="button" class="ai__btn" onclick={discard}
                    >Discard</button
                >
                <button
                    type="button"
                    class="ai__btn ai__btn--primary"
                    data-testid="ai-apply"
                    onclick={apply}>Apply</button
                >
            </div>
        </div>
    {/if}
</div>

<style>
    .ai {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem;
        border: 1px solid color-mix(in srgb, #f59e0b 40%, transparent);
        border-radius: 0.6rem;
        background: color-mix(in srgb, #f59e0b 6%, transparent);
    }
    .ai__row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .ai__badge {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 0.15rem 0.4rem;
        border-radius: 0.35rem;
        background: #f59e0b;
        color: #1c1917;
    }
    .ai__input {
        flex: 1;
        min-width: 0;
        padding: 0.45rem 0.6rem;
        border-radius: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.85rem;
        font-family: inherit;
    }
    .ai__btn {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        padding: 0.4rem 0.8rem;
        border-radius: 0.45rem;
        cursor: pointer;
        font-size: 0.82rem;
        white-space: nowrap;
    }
    .ai__btn:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .ai__btn--primary {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #1c1917;
        font-weight: 600;
    }
    .ai__error {
        margin: 0;
        font-size: 0.8rem;
        padding: 0.35rem 0.5rem;
        border-radius: 0.4rem;
        background: color-mix(in srgb, #dc2626 18%, transparent);
    }
    .ai__proposal {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        font-size: 0.82rem;
        padding: 0.4rem 0.5rem;
        border-radius: 0.45rem;
        background: color-mix(in srgb, #16a34a 12%, transparent);
    }
    .ai__proposal-actions {
        display: flex;
        gap: 0.4rem;
    }
</style>
