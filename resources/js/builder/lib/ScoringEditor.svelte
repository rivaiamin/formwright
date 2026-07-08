<script lang="ts">
    import { resolveBlock } from '../../schema/type-registry';
    import type {
        LocalizedString,
        SurveyElement,
    } from '../../schema/type-registry';
    import { localizedValue } from '../store.svelte';
    import type { BuilderStore } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    /** Palette ids that can carry a correct answer. */
    const SCORABLE = new Set([
        'short_text',
        'long_text',
        'number',
        'date',
        'single_choice',
        'multiple_choice',
        'dropdown',
        'boolean',
        'rating',
    ]);

    let el = $derived(store.selected);
    let block = $derived(el ? resolveBlock(el) : null);
    let scorable = $derived(block != null && SCORABLE.has(block.id));
    let scored = $derived(el != null && store.isScored(el));

    function choices(
        element: SurveyElement,
    ): { value: string; label: string }[] {
        const list =
            (element.choices as
                Array<{ value: string; text?: LocalizedString }> | undefined) ??
            [];

        return list.map((c) => ({
            value: c.value,
            label: localizedValue(c.text, store.editingLocale) || c.value,
        }));
    }

    function correctString(element: SurveyElement): string {
        const v = element.correctAnswer;

        return v == null ? '' : String(v);
    }

    function correctArray(element: SurveyElement): string[] {
        return Array.isArray(element.correctAnswer)
            ? (element.correctAnswer as string[])
            : [];
    }

    function ratingMax(element: SurveyElement): number {
        return typeof element.rateMax === 'number' ? element.rateMax : 5;
    }
</script>

{#if scorable && el}
    {@const id = block!.id}
    <label class="score__toggle">
        <input
            type="checkbox"
            checked={scored}
            data-testid="scored-toggle"
            onchange={(e) => store.setScored(el.name, e.currentTarget.checked)}
        />
        This question is scored
    </label>

    {#if scored}
        <div class="score__field">
            <span class="score__lbl">Correct answer</span>

            {#if id === 'single_choice' || id === 'dropdown'}
                <select
                    data-testid="correct-answer"
                    value={correctString(el)}
                    onchange={(e) =>
                        store.setCorrectAnswer(el.name, e.currentTarget.value)}
                >
                    <option value="">— choose —</option>
                    {#each choices(el) as c (c.value)}
                        <option value={c.value}>{c.label}</option>
                    {/each}
                </select>
            {:else if id === 'multiple_choice'}
                <div class="score__checks">
                    {#each choices(el) as c (c.value)}
                        <label>
                            <input
                                type="checkbox"
                                checked={correctArray(el).includes(c.value)}
                                onchange={(e) =>
                                    store.toggleCorrectChoice(
                                        el.name,
                                        c.value,
                                        e.currentTarget.checked,
                                    )}
                            />
                            {c.label}
                        </label>
                    {/each}
                </div>
            {:else if id === 'boolean'}
                <select
                    data-testid="correct-answer"
                    value={correctString(el)}
                    onchange={(e) =>
                        store.setCorrectAnswer(
                            el.name,
                            e.currentTarget.value === 'true',
                        )}
                >
                    <option value="">— choose —</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            {:else if id === 'rating'}
                <input
                    type="number"
                    min="1"
                    max={ratingMax(el)}
                    data-testid="correct-answer"
                    value={correctString(el)}
                    oninput={(e) =>
                        store.setCorrectAnswer(
                            el.name,
                            e.currentTarget.value === ''
                                ? ''
                                : Number(e.currentTarget.value),
                        )}
                />
            {:else if id === 'number'}
                <input
                    type="number"
                    data-testid="correct-answer"
                    value={correctString(el)}
                    oninput={(e) =>
                        store.setCorrectAnswer(
                            el.name,
                            e.currentTarget.value === ''
                                ? ''
                                : Number(e.currentTarget.value),
                        )}
                />
            {:else}
                <!-- short_text, long_text, date -->
                <input
                    type={id === 'date' ? 'date' : 'text'}
                    data-testid="correct-answer"
                    value={correctString(el)}
                    oninput={(e) =>
                        store.setCorrectAnswer(el.name, e.currentTarget.value)}
                />
            {/if}
        </div>

        <label class="score__field">
            <span class="score__lbl">Points</span>
            <input
                type="number"
                min="0"
                step="1"
                data-testid="points"
                value={typeof el.points === 'number' ? el.points : 1}
                oninput={(e) =>
                    store.setPoints(el.name, Number(e.currentTarget.value))}
            />
        </label>
    {/if}
{:else if el}
    <p class="score__na">This field type can’t be scored.</p>
{/if}

<style>
    .score__toggle {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.85rem;
    }
    .score__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-top: 0.5rem;
    }
    .score__lbl {
        font-size: 0.75rem;
        opacity: 0.75;
    }
    .score__field :global(input),
    .score__field select {
        width: 100%;
        padding: 0.4rem 0.5rem;
        border-radius: 0.45rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.85rem;
        font-family: inherit;
    }
    .score__checks {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.83rem;
    }
    .score__checks label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .score__na {
        font-size: 0.78rem;
        opacity: 0.6;
        margin: 0;
    }
</style>
