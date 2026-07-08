// =============================================================================
// library.svelte.ts — the reusable "question library".
//
// Saved blocks are whole SurveyJS elements kept in localStorage, so an author
// can reuse a configured question (choices, logic, validators and all) across
// forms without re-building it. Deliberately client-side: it is an authoring
// convenience, not part of the canonical schema.
// =============================================================================

import type { SurveyElement } from '../schema/type-registry';

const STORAGE_KEY = 'formwright.library';

export interface SavedBlock {
  id: string;
  label: string;
  element: SurveyElement;
}

export class BlockLibrary {
  blocks = $state<SavedBlock[]>([]);

  constructor() {
    this.#load();
  }

  #load(): void {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.blocks = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.blocks = []; // corrupt/unavailable storage must never break the builder
    }
  }

  #persist(): void {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.blocks));
    } catch {
      /* storage full or blocked — the in-memory list still works this session */
    }
  }

  /** Save a copy of an element under a display label. */
  add(element: SurveyElement, label: string): void {
    const block: SavedBlock = {
      id: `${Date.now()}-${this.blocks.length}`,
      label: label.trim() || element.name,
      // Snapshot first: structuredClone throws DataCloneError on a $state proxy.
      element: structuredClone($state.snapshot(element)) as SurveyElement,
    };
    this.blocks = [...this.blocks, block];
    this.#persist();
  }

  remove(id: string): void {
    this.blocks = this.blocks.filter((b) => b.id !== id);
    this.#persist();
  }
}
