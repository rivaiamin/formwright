// =============================================================================
// main.ts — the builder bundle's public entry point.
//
// Compiled by Vite (lib/IIFE) to a single self-executing file that exposes
// `window.FormwrightDesigner.mount(el, opts)`. The Filament page calls this; the
// bundle knows nothing about Laravel or persistence — it just calls the
// `onSave` / `reload` callbacks handed in from the Blade view (which bridge to
// Livewire via `$wire`).
// =============================================================================

import { mount as svelteMount, unmount } from 'svelte';

import App from './App.svelte';

/** Result of an onSave call, mirroring the Livewire `saveSchema` return shape. */
export interface SaveResult {
    ok: boolean;
    errors?: string[];
}

/** One entry of the saved version history, from the Livewire `revisions` call. */
export interface RevisionInfo {
    id: number;
    savedAt: string;
    fields: number;
    current: boolean;
}

/** Result of a restore, mirroring the Livewire `restoreRevision` return shape. */
export interface RestoreResult {
    ok: boolean;
    schema?: Record<string, unknown>;
    error?: string;
}

/** Result of an AI draft request, mirroring the Livewire `aiDraft` return shape. */
export interface AiDraftResult {
    ok: boolean;
    schema?: Record<string, unknown>;
    error?: string;
}

export interface MountOptions {
    /** Initial SurveyJS survey JSON. */
    schema: Record<string, unknown>;
    /** Locales available for authoring. */
    locales?: string[];
    defaultLocale?: string;
    /** Persist a schema. Returns the Livewire result (or a promise of it). */
    onSave?: (
        json: Record<string, unknown>,
    ) => SaveResult | Promise<SaveResult> | void;
    /** Notify the host that unsaved changes exist. */
    onDirty?: (dirty: boolean) => void;
    /** Re-fetch the persisted schema (used after a Livewire re-render). */
    reload?: () => Promise<Record<string, unknown>>;
    /** Draft a survey from a prompt (bridges to the host's AiAssistant). */
    onAiDraft?: (prompt: string) => Promise<AiDraftResult> | AiDraftResult;
    /** List the saved revisions of this form, newest first. */
    onRevisions?: () => Promise<RevisionInfo[]> | RevisionInfo[];
    /** Fetch one revision's JSON (does not write anything). */
    onRestore?: (id: number) => Promise<RestoreResult> | RestoreResult;
}

type SvelteApp = ReturnType<typeof svelteMount>;

/** One live Svelte instance per mount node, so we can tear down on re-mount. */
const instances = new WeakMap<Element, SvelteApp>();

/**
 * Mount (or re-mount) the designer onto `el`. Guards against double-mounts —
 * Livewire can re-run the boot script — by unmounting any prior instance first.
 */
export function mount(el: Element, opts: MountOptions): SvelteApp {
    destroy(el);

    const app = svelteMount(App, {
        target: el as HTMLElement,
        props: {
            schema: opts.schema ?? {},
            locales: opts.locales ?? ['default'],
            defaultLocale: opts.defaultLocale ?? 'default',
            onSave: opts.onSave,
            onDirty: opts.onDirty,
            reload: opts.reload,
            onAiDraft: opts.onAiDraft,
            onRevisions: opts.onRevisions,
            onRestore: opts.onRestore,
        },
    });

    instances.set(el, app);

    return app;
}

/** Tear down the instance mounted on `el`, if any. */
export function destroy(el: Element): void {
    const existing = instances.get(el);

    if (existing) {
        unmount(existing);
        instances.delete(el);
    }
}

declare global {
    interface Window {
        FormwrightDesigner?: { mount: typeof mount; destroy: typeof destroy };
    }
}

if (typeof window !== 'undefined') {
    window.FormwrightDesigner = { mount, destroy };
}
