<script lang="ts">
    import { untrack } from 'svelte';

    import {
        compileRule,
        invertRule,
        parseRule,
    } from '../../schema/logic-expression';
    import type {
        Clause,
        Operator,
        ScalarValue,
        VisualRule,
    } from '../../schema/logic-expression';
    import type { BuilderStore, LogicTarget } from '../store.svelte';

    interface Props {
        store: BuilderStore;
    }

    let { store }: Props = $props();

    /** Each action targets a SurveyJS property; Hide/Disable store the negated
     *  (De Morgan-inverted) expression so it stays a positive, round-trippable
     *  condition. */
    interface Action {
        value: 'show' | 'hide' | 'disable';
        label: string;
        target: LogicTarget;
        negate: boolean;
    }

    const ACTIONS: Action[] = [
        {
            value: 'show',
            label: 'Show this field when',
            target: 'visibleIf',
            negate: false,
        },
        {
            value: 'hide',
            label: 'Hide this field when',
            target: 'visibleIf',
            negate: true,
        },
        {
            value: 'disable',
            label: 'Disable this field when',
            target: 'enableIf',
            negate: true,
        },
    ];

    const OPERATORS: {
        value: Operator;
        label: string;
        noValue?: boolean;
        array?: boolean;
    }[] = [
        { value: '=', label: 'equals' },
        { value: '!=', label: 'not equals' },
        { value: '>', label: 'greater than' },
        { value: '<', label: 'less than' },
        { value: '>=', label: 'at least' },
        { value: '<=', label: 'at most' },
        { value: 'contains', label: 'contains' },
        { value: 'notcontains', label: 'does not contain' },
        { value: 'anyof', label: 'any of', array: true },
        { value: 'allof', label: 'all of', array: true },
        { value: 'empty', label: 'is empty', noValue: true },
        { value: 'notempty', label: 'is not empty', noValue: true },
    ];

    let action = $state<Action['value']>('show');
    let draft = $state<VisualRule>({ connector: 'and', clauses: [] });
    /** The stored expression couldn't be parsed into the flat visual model. */
    let forcedRaw = $state(false);
    /** User chose to hand-edit the expression. */
    let userRaw = $state(false);
    let rawText = $state('');

    let meta = $derived(ACTIONS.find((a) => a.value === action)!);
    let rawMode = $derived(forcedRaw || userRaw);
    let elName = $derived(store.selected?.name ?? null);
    let otherNames = $derived(
        elName ? store.elementNamesInOrder().filter((n) => n !== elName) : [],
    );

    /** Which element resync last auto-detected an action for (so switching the
     *  action on the SAME element doesn't get reverted). */
    let lastSelected: string | null = null;

    // Resync from the store when the selection / action / structural rev changes —
    // but NOT on our own per-keystroke writes (those are untracked), so editing
    // never fights the sync.
    $effect(() => {
        store.selectedName;
        action;
        store.rev;
        untrack(() => resync());
    });

    /** On (re)select, pick the action from whichever target is set (enableIf →
     *  Disable, else visibleIf → Show; Hide collapses to Show since both live in
     *  visibleIf), then decode the stored expression into the visual draft. */
    function resync(): void {
        const el = store.selected;

        // Auto-detect the action from the stored props ONLY when the selection
        // changes — not when the user switches the action on the same field.
        if (store.selectedName !== lastSelected) {
            lastSelected = store.selectedName;
            action = el?.enableIf != null ? 'disable' : 'show';
        }

        const current = ACTIONS.find((a) => a.value === action)!;
        const expr = (el?.[current.target] as string | undefined) ?? '';
        const parsed = parseRule(expr);

        userRaw = false;
        rawText = expr;

        if (expr !== '' && parsed === null) {
            // Hand-authored / advanced expression: preserve it, lock the visual editor.
            forcedRaw = true;
            draft = { connector: 'and', clauses: [] };
        } else {
            forcedRaw = false;
            // Stored expression is the negated form for Hide/Disable — invert back.
            draft = parsed
                ? current.negate
                    ? invertRule(parsed)
                    : parsed
                : { connector: 'and', clauses: [] };
        }
    }

    function coerce(raw: string): ScalarValue {
        if (raw === 'true') {
            return true;
        }

        if (raw === 'false') {
            return false;
        }

        if (raw !== '' && !Number.isNaN(Number(raw))) {
            return Number(raw);
        }

        return raw;
    }

    /** Compile the current visual draft (negating for Hide/Disable) and write it
     *  to this action's target, clearing the other logic target so switching
     *  actions moves the rule instead of leaving a stale one behind. */
    function commit(): void {
        if (!elName) {
            return;
        }

        const rule = meta.negate ? invertRule(draft) : draft;

        for (const t of ['visibleIf', 'enableIf'] as const) {
            if (t !== meta.target) {
                store.setProp(elName, t, '');
            }
        }

        store.setProp(elName, meta.target, compileRule(rule));
    }

    function setAction(next: Action['value']): void {
        action = next;
        commit();
    }

    function opMeta(op: Operator) {
        return OPERATORS.find((o) => o.value === op)!;
    }

    function addClause(): void {
        draft.clauses.push({
            question: otherNames[0] ?? '',
            operator: '=',
            value: '',
        });
        commit();
    }

    function removeClause(i: number): void {
        draft.clauses.splice(i, 1);
        commit();
    }

    function setConnector(c: 'and' | 'or'): void {
        draft.connector = c;
        commit();
    }

    function setQuestion(i: number, q: string): void {
        draft.clauses[i].question = q;
        commit();
    }

    function setOperator(i: number, op: Operator): void {
        const meta = opMeta(op);
        const c: Clause = { question: draft.clauses[i].question, operator: op };

        if (meta.array) {
            c.value = [];
        } else if (!meta.noValue) {
            c.value = '';
        }

        draft.clauses[i] = c;
        commit();
    }

    function setValue(i: number, raw: string): void {
        const meta = opMeta(draft.clauses[i].operator);

        if (meta.array) {
            draft.clauses[i].value = raw
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s !== '')
                .map((s) => coerce(s) as string | number);
        } else {
            draft.clauses[i].value = coerce(raw);
        }

        commit();
    }

    function valueText(c: Clause): string {
        if (Array.isArray(c.value)) {
            return c.value.join(', ');
        }

        return c.value == null ? '' : String(c.value);
    }

    // -- raw-expression escape hatch --------------------------------------------

    function editAsRaw(): void {
        rawText = compileRule(draft);
        userRaw = true;
    }

    function saveRaw(): void {
        if (elName) {
            store.setProp(elName, meta.target, rawText.trim());
        }
    }

    function backToVisual(): void {
        const parsed = parseRule(rawText);

        if (parsed) {
            draft = meta.negate ? invertRule(parsed) : parsed;
            userRaw = false;
            forcedRaw = false;
            commit();
        } else {
            // Not representable — offer to clear so the user can start fresh.
            if (elName) {
                store.setProp(elName, meta.target, '');
            }

            draft = { connector: 'and', clauses: [] };
            rawText = '';
            userRaw = false;
            forcedRaw = false;
        }
    }
</script>

<div class="logic">
    <label class="logic__row">
        <span class="logic__lbl">Action</span>
        <select
            value={action}
            data-testid="logic-target"
            onchange={(e) =>
                setAction(e.currentTarget.value as Action['value'])}
        >
            {#each ACTIONS as a (a.value)}
                <option value={a.value}>{a.label}</option>
            {/each}
        </select>
    </label>

    {#if rawMode}
        <p class="logic__note">
            {#if forcedRaw}
                This expression is too advanced for the visual editor. It is
                preserved exactly as written.
            {:else}
                Editing as a raw SurveyJS expression. The visual editor is
                paused to avoid clobbering it.
            {/if}
        </p>
        <textarea
            class="logic__raw"
            rows="3"
            spellcheck="false"
            data-testid="logic-raw"
            bind:value={rawText}
            oninput={saveRaw}
        ></textarea>
        <button type="button" class="logic__link" onclick={backToVisual}>
            {forcedRaw ? 'Replace with a visual rule' : 'Back to visual editor'}
        </button>
    {:else}
        {#if draft.clauses.length > 1}
            <div class="logic__match">
                Match
                <button
                    type="button"
                    class:on={draft.connector === 'and'}
                    onclick={() => setConnector('and')}>ALL</button
                >
                <button
                    type="button"
                    class:on={draft.connector === 'or'}
                    onclick={() => setConnector('or')}>ANY</button
                >
                of:
            </div>
        {/if}

        {#each draft.clauses as clause, i (i)}
            <div class="logic__clause">
                <select
                    class="logic__q"
                    value={clause.question}
                    onchange={(e) => setQuestion(i, e.currentTarget.value)}
                >
                    {#each otherNames as n (n)}
                        <option value={n}>{n}</option>
                    {/each}
                </select>
                <select
                    class="logic__op"
                    value={clause.operator}
                    onchange={(e) =>
                        setOperator(i, e.currentTarget.value as Operator)}
                >
                    {#each OPERATORS as o (o.value)}
                        <option value={o.value}>{o.label}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    class="logic__del"
                    title="Remove"
                    onclick={() => removeClause(i)}>×</button
                >
                {#if !opMeta(clause.operator).noValue}
                    <input
                        class="logic__val"
                        placeholder={opMeta(clause.operator).array
                            ? 'a, b, c'
                            : 'value'}
                        value={valueText(clause)}
                        oninput={(e) => setValue(i, e.currentTarget.value)}
                    />
                {/if}
            </div>
        {/each}

        <div class="logic__actions">
            <button
                type="button"
                class="logic__add"
                data-testid="logic-add-condition"
                onclick={addClause}
                disabled={otherNames.length === 0}
            >
                + Add condition
            </button>
            {#if draft.clauses.length > 0}
                <button type="button" class="logic__link" onclick={editAsRaw}
                    >Edit as text</button
                >
            {/if}
        </div>

        {#if otherNames.length === 0}
            <p class="logic__note">
                Add another field first to reference it in a condition.
            </p>
        {/if}
    {/if}
</div>

<style>
    .logic {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
    }
    .logic__row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .logic__lbl {
        font-size: 0.75rem;
        opacity: 0.75;
    }
    .logic select,
    .logic__val,
    .logic__raw {
        padding: 0.35rem 0.45rem;
        border-radius: 0.4rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font-size: 0.8rem;
        font-family: inherit;
    }
    .logic select {
        min-width: 0;
    }
    .logic__raw {
        width: 100%;
        font-family: ui-monospace, monospace;
    }
    .logic__match {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.78rem;
    }
    .logic__match button {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        border-radius: 0.35rem;
        padding: 0.1rem 0.4rem;
        cursor: pointer;
        font-size: 0.72rem;
    }
    .logic__match button.on {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #1c1917;
        font-weight: 600;
    }
    .logic__clause {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        grid-template-areas:
            'question operator remove'
            'value value value';
        gap: 0.3rem;
        align-items: center;
        padding-block: 0.15rem;
    }
    .logic__q {
        grid-area: question;
    }
    .logic__op {
        grid-area: operator;
    }
    .logic__del {
        grid-area: remove;
    }
    .logic__val {
        grid-area: value;
        width: 100%;
        min-width: 0;
    }
    .logic__del {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.5;
        font-size: 1rem;
    }
    .logic__del:hover {
        opacity: 1;
        color: #dc2626;
    }
    .logic__actions {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
    }
    .logic__add {
        border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 0.78rem;
        padding: 0.3rem 0.6rem;
        border-radius: 0.4rem;
    }
    .logic__add:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .logic__link {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 0.75rem;
        opacity: 0.75;
        text-decoration: underline;
    }
    .logic__note {
        font-size: 0.76rem;
        opacity: 0.65;
        line-height: 1.4;
        margin: 0;
    }
</style>
