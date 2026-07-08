// =============================================================================
// dnd.ts — shared drag-and-drop glue for svelte-dnd-action.
//
// The canvas and palette drag SURVEY ELEMENTS, but svelte-dnd-action requires
// every draggable item to carry a unique `id`. We never inject `id` into the
// SurveyJS element (that would pollute the exported schema), so we wrap elements
// in a transient `{ id, element }` object for the duration of a drag, and unwrap
// back to clean elements on drop.
// =============================================================================

import { SHADOW_PLACEHOLDER_ITEM_ID } from 'svelte-dnd-action';

import { createElement } from '../schema/type-registry';
import type { SurveyElement } from '../schema/type-registry';

export const DND_FIELD_TYPE = 'field';
export const DND_PAGE_TYPE = 'page';
export const FLIP_MS = 150;

/** A palette template being dragged (becomes a real element on drop). */
export interface PaletteItem {
    id: string;
    isTemplate: true;
    blockId: string;
    label: string;
    icon: string;
}

/** A real element wrapped for dragging. */
export interface ElementWrapper {
    id: string;
    element: SurveyElement;
}

/** Anything that can appear in a field dndzone mid-drag. */
export type FieldDndItem = ElementWrapper | PaletteItem;

export function isTemplate(item: FieldDndItem): item is PaletteItem {
    return (item as PaletteItem).isTemplate === true;
}

export function isShadow(item: { id: string }): boolean {
    return item.id === SHADOW_PLACEHOLDER_ITEM_ID;
}

/** Wrap a page's elements for a dndzone. */
export function toWrappers(elements: SurveyElement[]): ElementWrapper[] {
    return elements.map((element) => ({ id: element.name, element }));
}

/**
 * Convert a dndzone's items back into clean SurveyJS elements. Palette templates
 * become freshly-created elements with a name unique against `existingNames`
 * (which is mutated as we go so multiple drops in one gesture stay unique).
 */
export function fromWrappers(
    items: FieldDndItem[],
    existingNames: Set<string>,
): SurveyElement[] {
    const out: SurveyElement[] = [];

    for (const item of items) {
        if (isShadow(item)) {
            continue;
        }

        if (isTemplate(item)) {
            const el = createElement(item.blockId, existingNames);
            existingNames.add(el.name);
            out.push(el);
        } else {
            out.push(item.element);
        }
    }

    return out;
}
