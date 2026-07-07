// =============================================================================
// logic-expression.test.ts  —  Phase 6
// Run: npx vitest run logic-expression.test.ts
// These target the edges that silently break: quoting, quote-aware splitting,
// value-less operators, arrays, and the "not representable -> null" contract.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { compileRule, parseRule, type VisualRule } from './logic-expression';

describe('compileRule', () => {
  it('compiles a single string clause', () => {
    const rule: VisualRule = { connector: 'and', clauses: [
      { question: 'plan', operator: '=', value: 'pro' },
    ] };
    expect(compileRule(rule)).toBe("{plan} = 'pro'");
  });

  it('joins ALL clauses with and', () => {
    const rule: VisualRule = { connector: 'and', clauses: [
      { question: 'age', operator: '>', value: 18 },
      { question: 'country', operator: '=', value: 'US' },
    ] };
    expect(compileRule(rule)).toBe("{age} > 18 and {country} = 'US'");
  });

  it('joins ANY clauses with or', () => {
    const rule: VisualRule = { connector: 'or', clauses: [
      { question: 'a', operator: '=', value: 1 },
      { question: 'b', operator: '=', value: 2 },
    ] };
    expect(compileRule(rule)).toBe('{a} = 1 or {b} = 2');
  });

  it('emits value-less operators for empty/notempty', () => {
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'name', operator: 'notempty' },
    ] })).toBe('{name} notempty');
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'name', operator: 'empty' },
    ] })).toBe('{name} empty');
  });

  it('leaves numbers and booleans unquoted', () => {
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'score', operator: '>=', value: 42 },
    ] })).toBe('{score} >= 42');
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'agreed', operator: '=', value: true },
    ] })).toBe('{agreed} = true');
  });

  it('picks a quote char the value does not contain', () => {
    // Value has a single quote -> falls back to double quotes, no escaping.
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'q', operator: '=', value: "O'Brien" },
    ] })).toBe('{q} = "O\'Brien"');
  });

  it('escapes when the value contains both quote styles', () => {
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'q', operator: '=', value: `it's a "test"` },
    ] })).toBe(`{q} = 'it\\'s a "test"'`);
  });

  it('compiles anyof/allof as array literals', () => {
    expect(compileRule({ connector: 'and', clauses: [
      { question: 'tags', operator: 'anyof', value: ['a', 'b'] },
    ] })).toBe("{tags} anyof ['a', 'b']");
  });
});

describe('parseRule', () => {
  it('parses a single string clause', () => {
    expect(parseRule("{plan} = 'pro'")).toEqual({
      connector: 'and',
      clauses: [{ question: 'plan', operator: '=', value: 'pro' }],
    });
  });

  it('parses ALL and ANY', () => {
    expect(parseRule("{age} > 18 and {country} = 'US'")).toEqual({
      connector: 'and',
      clauses: [
        { question: 'age', operator: '>', value: 18 },
        { question: 'country', operator: '=', value: 'US' },
      ],
    });
    expect(parseRule('{a} = 1 or {b} = 2')).toEqual({
      connector: 'or',
      clauses: [
        { question: 'a', operator: '=', value: 1 },
        { question: 'b', operator: '=', value: 2 },
      ],
    });
  });

  it('does NOT split on the word "and" inside a quoted value', () => {
    const rule = parseRule("{snack} = 'peanut butter and jelly'");
    expect(rule).toEqual({
      connector: 'and',
      clauses: [{ question: 'snack', operator: '=', value: 'peanut butter and jelly' }],
    });
  });

  it('parses multi-char operators before single-char ones', () => {
    expect(parseRule('{x} >= 3')?.clauses[0].operator).toBe('>=');
    expect(parseRule('{x} != 3')?.clauses[0].operator).toBe('!=');
  });

  it('parses value-less operators', () => {
    expect(parseRule('{name} notempty')).toEqual({
      connector: 'and',
      clauses: [{ question: 'name', operator: 'notempty' }],
    });
  });

  it('parses array literals for anyof/allof (no split on inner commas in strings)', () => {
    expect(parseRule("{tags} anyof ['a, b', 'c']")).toEqual({
      connector: 'and',
      clauses: [{ question: 'tags', operator: 'anyof', value: ['a, b', 'c'] }],
    });
  });

  // --- the "not representable -> null" contract (locks UI to raw mode) ---

  it('returns null for mixed and/or', () => {
    expect(parseRule("{a} = 1 and {b} = 2 or {c} = 3")).toBeNull();
  });

  it('returns null for grouped/parenthesized expressions', () => {
    expect(parseRule("({a} = 1 or {b} = 2) and {c} = 3")).toBeNull();
  });

  it('returns null for function calls', () => {
    expect(parseRule("iif({a} = 1, true, false)")).toBeNull();
  });

  it('returns null for an empty or blank expression', () => {
    expect(parseRule('')).toBeNull();
    expect(parseRule('   ')).toBeNull();
  });
});

describe('round-trip (compile then parse)', () => {
  const rules: VisualRule[] = [
    { connector: 'and', clauses: [{ question: 'plan', operator: '=', value: 'pro' }] },
    { connector: 'or', clauses: [
      { question: 'age', operator: '>=', value: 18 },
      { question: 'guardian', operator: 'notempty' },
    ] },
    { connector: 'and', clauses: [{ question: 'tags', operator: 'anyof', value: ['x', 'y'] }] },
  ];

  it('recovers the original rule for representable inputs', () => {
    for (const rule of rules) {
      const expr = compileRule(rule);
      expect(parseRule(expr)).toEqual(rule);
    }
  });
});
