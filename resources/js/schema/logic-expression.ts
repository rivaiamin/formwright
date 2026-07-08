// =============================================================================
// logic-expression.ts  —  Phase 6
// Compile a flat visual rule -> a SurveyJS expression string, and best-effort
// parse a simple expression back into a visual rule.
//
// ASYMMETRY BY DESIGN:
//   compileRule()  is TOTAL   — every VisualRule yields a valid string.
//   parseRule()    is PARTIAL — returns null when the expression is richer than
//                  our flat single-connector model (mixed and/or, grouping,
//                  functions). null => the UI locks the field to raw mode so we
//                  never clobber a hand-authored expression.
//
// CAUTION: SurveyJS string-escaping has varied across survey-core versions.
// The quoting below is defensive (prefers a quote char the value lacks). Pin
// your survey-core version and verify a value containing a quote renders in the
// live Preview before trusting it in production.
// =============================================================================

export type Connector = 'and' | 'or';

export type Operator =
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'contains'
    | 'notcontains'
    | 'empty'
    | 'notempty'
    | 'anyof'
    | 'allof';

export type ScalarValue = string | number | boolean;
export type ClauseValue = ScalarValue | Array<string | number>;

export interface Clause {
    /** Referenced question name, WITHOUT braces. */
    question: string;
    operator: Operator;
    /** Omitted for 'empty' / 'notempty'. Array for 'anyof' / 'allof'. */
    value?: ClauseValue;
}

export interface VisualRule {
    /** ALL -> 'and', ANY -> 'or'. */
    connector: Connector;
    clauses: Clause[];
}

const NO_VALUE_OPS = new Set<Operator>(['empty', 'notempty']);
const ARRAY_OPS = new Set<Operator>(['anyof', 'allof']);

// -----------------------------------------------------------------------------
// COMPILE  (visual -> string)
// -----------------------------------------------------------------------------

/** Quote a scalar for a SurveyJS expression. Prefers the quote the value lacks. */
function quoteScalar(v: ScalarValue): string {
    if (typeof v === 'number') {
        return String(v);
    }

    if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
    }

    const s = v;

    if (!s.includes("'")) {
        return `'${s}'`;
    }

    if (!s.includes('"')) {
        return `"${s}"`;
    }

    // Contains both quote styles: single-quote and backslash-escape the singles.
    return `'${s.replace(/'/g, "\\'")}'`;
}

function quoteArray(arr: Array<string | number>): string {
    return `[${arr.map((x) => quoteScalar(x)).join(', ')}]`;
}

function compileClause(c: Clause): string {
    const ref = `{${c.question}}`;

    if (NO_VALUE_OPS.has(c.operator)) {
        return `${ref} ${c.operator}`;
    }

    if (ARRAY_OPS.has(c.operator)) {
        const arr = Array.isArray(c.value) ? c.value : [];

        return `${ref} ${c.operator} ${quoteArray(arr)}`;
    }

    return `${ref} ${c.operator} ${quoteScalar(c.value as ScalarValue)}`;
}

/** Total. Empty rule -> '' (caller should treat '' as "no condition"). */
export function compileRule(rule: VisualRule): string {
    const parts = rule.clauses.map(compileClause);

    if (parts.length === 0) {
        return '';
    }

    if (parts.length === 1) {
        return parts[0];
    }

    return parts.join(` ${rule.connector} `);
}

// -----------------------------------------------------------------------------
// PARSE  (string -> visual | null)
// -----------------------------------------------------------------------------

interface SplitResult {
    connector: Connector;
    parts: string[];
    ok: boolean;
}

/**
 * Split on TOP-LEVEL ` and ` / ` or ` only, respecting quotes and brackets so a
 * value like 'salt and pepper' or an array ['a','b'] is never split through.
 * Fails (ok:false) on mixed connectors or unbalanced brackets/parens.
 */
function splitTopLevel(expr: string): SplitResult {
    const parts: string[] = [];
    const seen = new Set<Connector>();
    let buf = '';
    let quote: string | null = null;
    let bracket = 0;
    let paren = 0;
    let i = 0;

    while (i < expr.length) {
        const ch = expr[i];

        if (quote) {
            buf += ch;

            if (ch === quote && expr[i - 1] !== '\\') {
                quote = null;
            }

            i++;
            continue;
        }

        if (ch === "'" || ch === '"') {
            quote = ch;
            buf += ch;
            i++;
            continue;
        }

        if (ch === '[') {
            bracket++;
            buf += ch;
            i++;
            continue;
        }

        if (ch === ']') {
            bracket--;
            buf += ch;
            i++;
            continue;
        }

        if (ch === '(') {
            paren++;
            buf += ch;
            i++;
            continue;
        }

        if (ch === ')') {
            paren--;
            buf += ch;
            i++;
            continue;
        }

        if (bracket === 0 && paren === 0) {
            const rest = expr.slice(i).toLowerCase();

            if (rest.startsWith(' and ')) {
                seen.add('and');
                parts.push(buf.trim());
                buf = '';
                i += 5;
                continue;
            }

            if (rest.startsWith(' or ')) {
                seen.add('or');
                parts.push(buf.trim());
                buf = '';
                i += 4;
                continue;
            }
        }

        buf += ch;
        i++;
    }

    parts.push(buf.trim());

    if (paren !== 0 || bracket !== 0 || quote !== null) {
        return { connector: 'and', parts: [], ok: false };
    }

    if (seen.size > 1) {
        // Mixed and/or — not representable in a flat model.
        return { connector: 'and', parts: [], ok: false };
    }

    const connector: Connector = seen.has('or') ? 'or' : 'and';

    return { connector, parts, ok: true };
}

// Longer operators first so '>=' beats '>' in the alternation.
const CLAUSE_RE =
    /^\{([A-Za-z0-9_\-.]+)\}\s+(notcontains|contains|notempty|empty|anyof|allof|>=|<=|!=|>|<|=)\s*(.*)$/i;

function stripQuotes(s: string): string | null {
    const t = s.trim();

    if (
        t.length >= 2 &&
        ((t[0] === "'" && t.at(-1) === "'") ||
            (t[0] === '"' && t.at(-1) === '"'))
    ) {
        return t.slice(1, -1).replace(/\\(['"])/g, '$1');
    }

    return null;
}

/** Quote-aware comma split for array literals. */
function splitArrayItems(inner: string): string[] {
    const items: string[] = [];
    let buf = '';
    let quote: string | null = null;

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];

        if (quote) {
            buf += ch;

            if (ch === quote && inner[i - 1] !== '\\') {
                quote = null;
            }

            continue;
        }

        if (ch === "'" || ch === '"') {
            quote = ch;
            buf += ch;
            continue;
        }

        if (ch === ',') {
            items.push(buf.trim());
            buf = '';
            continue;
        }

        buf += ch;
    }

    if (buf.trim()) {
        items.push(buf.trim());
    }

    return items;
}

function parseScalar(raw: string): ScalarValue {
    const unq = stripQuotes(raw);

    if (unq !== null) {
        return unq;
    }

    const t = raw.trim();

    if (t === 'true') {
        return true;
    }

    if (t === 'false') {
        return false;
    }

    if (t !== '' && !Number.isNaN(Number(t))) {
        return Number(t);
    }

    return t; // bare word: treat as string
}

function parseArray(raw: string): Array<string | number> | null {
    const t = raw.trim();

    if (!t.startsWith('[') || !t.endsWith(']')) {
        return null;
    }

    const inner = t.slice(1, -1).trim();

    if (inner === '') {
        return [];
    }

    return splitArrayItems(inner).map((item) => {
        const v = parseScalar(item);

        return typeof v === 'boolean' ? String(v) : v;
    });
}

function parseClause(raw: string): Clause | null {
    const m = CLAUSE_RE.exec(raw.trim());

    if (!m) {
        return null;
    }

    const question = m[1];
    const operator = m[2].toLowerCase() as Operator;
    const valuePart = m[3].trim();

    if (NO_VALUE_OPS.has(operator)) {
        if (valuePart !== '') {
            return null;
        } // empty/notempty must carry no value

        return { question, operator };
    }

    if (ARRAY_OPS.has(operator)) {
        const arr = parseArray(valuePart);

        if (arr === null) {
            return null;
        }

        return { question, operator, value: arr };
    }

    if (valuePart === '') {
        return null;
    }

    return { question, operator, value: parseScalar(valuePart) };
}

/**
 * Best-effort parse. Returns null when the expression cannot be faithfully
 * represented as a flat single-connector rule — the signal to lock the UI to
 * raw-expression mode.
 */
export function parseRule(expr: string): VisualRule | null {
    const trimmed = (expr ?? '').trim();

    if (trimmed === '') {
        return null;
    }

    const split = splitTopLevel(trimmed);

    if (!split.ok) {
        return null;
    }

    const clauses: Clause[] = [];

    for (const part of split.parts) {
        const clause = parseClause(part);

        if (clause === null) {
            return null;
        } // any unparseable clause => not representable

        clauses.push(clause);
    }

    return { connector: split.connector, clauses };
}

// -----------------------------------------------------------------------------
// INVERT  (for Hide / Disable actions)
// -----------------------------------------------------------------------------

/** Operator negation for De Morgan inversion. anyof/allof have no clean
 *  negation, so they are left unchanged. */
const NEGATE_OP: Record<Operator, Operator> = {
    '=': '!=',
    '!=': '=',
    '>': '<=',
    '<': '>=',
    '>=': '<',
    '<=': '>',
    contains: 'notcontains',
    notcontains: 'contains',
    empty: 'notempty',
    notempty: 'empty',
    anyof: 'anyof',
    allof: 'allof',
};

/**
 * Logical negation of a flat rule (De Morgan): flip the connector and negate
 * each clause. `invert(invert(r))` === `r`, so Hide/Disable round-trip cleanly
 * for the invertible operators. Used to compile "Hide when …" to a positive
 * `visibleIf` (visible when the condition does NOT hold) and "Disable when …"
 * to a positive `enableIf`.
 */
export function invertRule(rule: VisualRule): VisualRule {
    return {
        connector: rule.connector === 'and' ? 'or' : 'and',
        clauses: rule.clauses.map((c) => ({
            ...c,
            operator: NEGATE_OP[c.operator],
        })),
    };
}

// -----------------------------------------------------------------------------
// REFERENCES  (for the logic map)
// -----------------------------------------------------------------------------

/**
 * Extract the question names an expression references, i.e. every `{name}`
 * placeholder, de-duplicated and order-preserved. Used to build the dependency
 * ("logic map") view without needing to fully parse the expression.
 */
export function extractReferences(expr: string | undefined): string[] {
    if (!expr) {
        return [];
    }

    const out: string[] = [];
    const seen = new Set<string>();
    const re = /\{([A-Za-z0-9_\-.]+)\}/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(expr)) !== null) {
        // Strip SurveyJS row/panel suffixes like {q.total} -> q for a coarse map.
        const name = m[1];

        if (!seen.has(name)) {
            seen.add(name);
            out.push(name);
        }
    }

    return out;
}
