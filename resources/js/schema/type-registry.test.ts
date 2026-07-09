// =============================================================================
// type-registry.test.ts
// Covers the simple-Matrix cell-type conversion and the block discriminator
// that keeps a uniform matrixdropdown owned by the Matrix block (not the
// per-column "Matrix (cells)" block).
// Run: npx vitest run type-registry.test.ts
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
    convertMatrixCellType,
    matrixCellNeedsChoices,
    matrixCellTypeOf,
    resolveBlock,
} from './type-registry';
import type { SurveyElement } from './type-registry';

function simpleMatrix(): SurveyElement {
    return {
        type: 'matrix',
        name: 'grid',
        columns: [
            { value: 'col1', text: { default: 'Column 1' } },
            { value: 'col2', text: { default: 'Column 2' } },
        ],
        rows: [{ value: 'row1', text: { default: 'Row 1' } }],
    };
}

describe('matrixCellTypeOf', () => {
    it('reports radio for a native matrix', () => {
        expect(matrixCellTypeOf(simpleMatrix())).toBe('radio');
    });

    it('reports the matrix-level cellType for a uniform matrixdropdown', () => {
        const el: SurveyElement = {
            type: 'matrixdropdown',
            name: 'g',
            cellType: 'boolean',
        };
        expect(matrixCellTypeOf(el)).toBe('boolean');
    });
});

describe('convertMatrixCellType', () => {
    it('converts a radio matrix to a uniform checkbox matrixdropdown', () => {
        const el = simpleMatrix();
        convertMatrixCellType(el, 'boolean');

        expect(el.type).toBe('matrixdropdown');
        expect(el.cellType).toBe('boolean');
        // columns get remapped value/text -> name/title, no per-column cellType.
        expect(el.columns).toEqual([
            { name: 'col1', title: { default: 'Column 1' } },
            { name: 'col2', title: { default: 'Column 2' } },
        ]);
        // boolean cells need no shared choices.
        expect(el.choices).toBeUndefined();
        // rows are untouched (matrix and matrixdropdown both use value/text).
        expect(el.rows).toHaveLength(1);
    });

    it('seeds shared choices for choice-based cell types', () => {
        const el = simpleMatrix();
        convertMatrixCellType(el, 'dropdown');

        expect(el.type).toBe('matrixdropdown');
        expect(el.cellType).toBe('dropdown');
        expect(Array.isArray(el.choices)).toBe(true);
        expect(el.choices).toHaveLength(2);
    });

    it('keeps existing choices when switching between choice-based cell types', () => {
        const el = simpleMatrix();
        convertMatrixCellType(el, 'dropdown');
        (el.choices as unknown[]).push({ value: 'extra' });
        convertMatrixCellType(el, 'radio'); // choices dropped for radio
        convertMatrixCellType(el, 'dropdown'); // re-seeded fresh

        expect(el.choices).toHaveLength(2);
    });

    it('round-trips back to a native radio matrix', () => {
        const el = simpleMatrix();
        convertMatrixCellType(el, 'dropdown');
        convertMatrixCellType(el, 'radio');

        expect(el.type).toBe('matrix');
        expect(el.cellType).toBeUndefined();
        expect(el.choices).toBeUndefined();
        expect(el.columns).toEqual([
            { value: 'col1', text: { default: 'Column 1' } },
            { value: 'col2', text: { default: 'Column 2' } },
        ]);
    });

    it('strips stray per-column cellType so the matrix stays uniform', () => {
        const el: SurveyElement = {
            type: 'matrixdropdown',
            name: 'g',
            cellType: 'dropdown',
            columns: [
                { name: 'c1', title: { default: 'C1' }, cellType: 'text' },
            ],
        };
        convertMatrixCellType(el, 'rating');

        expect((el.columns as Record<string, unknown>[])[0]).toEqual({
            name: 'c1',
            title: { default: 'C1' },
        });
    });
});

describe('matrixCellNeedsChoices', () => {
    it('is true only for choice-based cell types', () => {
        expect(matrixCellNeedsChoices('dropdown')).toBe(true);
        expect(matrixCellNeedsChoices('radiogroup')).toBe(true);
        expect(matrixCellNeedsChoices('boolean')).toBe(false);
        expect(matrixCellNeedsChoices('text')).toBe(false);
        expect(matrixCellNeedsChoices('rating')).toBe(false);
    });
});

describe('block discrimination', () => {
    it('resolves a native matrix to the Matrix block', () => {
        expect(resolveBlock(simpleMatrix())?.id).toBe('matrix');
    });

    it('resolves a uniform matrixdropdown to the Matrix block', () => {
        const el = simpleMatrix();
        convertMatrixCellType(el, 'dropdown');
        expect(resolveBlock(el)?.id).toBe('matrix');
    });

    it('resolves a per-column matrixdropdown to the Matrix (cells) block', () => {
        const el: SurveyElement = {
            type: 'matrixdropdown',
            name: 'g',
            columns: [
                { name: 'c1', title: { default: 'C1' }, cellType: 'dropdown' },
            ],
        };
        expect(resolveBlock(el)?.id).toBe('matrix_dropdown');
    });
});
