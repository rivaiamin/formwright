// =============================================================================
// survey-setup.ts — one-time survey-core configuration.
//
// `points` is not a native survey-core property, so we register it (per the
// guide) via Serializer.addProperty. `correctAnswer` IS native. Registering
// keeps the custom property first-class: it serializes cleanly and is readable
// as `question.points` on a Model. Must run before any Model is constructed.
// =============================================================================

import { Serializer } from 'survey-core';

let registered = false;

export function registerCustomProperties(): void {
    if (registered) {
        return;
    }

    registered = true;

    Serializer.addProperty('question', {
        name: 'points:number',
        default: 1,
        category: 'general',
        visible: false,
    });

    // Model-backed choice sources. Non-native properties that name a host data
    // source and (optionally) the question whose answer filters it — resolved at
    // render time via the data-source endpoint. Registered so they round-trip
    // through `new Model(json)` and are readable as `question.dataSource`.
    Serializer.addProperty('question', {
        name: 'dataSource:string',
        category: 'choices',
        visible: false,
    });
    Serializer.addProperty('question', {
        name: 'dataFilterQuestion:string',
        category: 'choices',
        visible: false,
    });
}

/**
 * Apply a schema-embedded theme, if any. We store the survey-core theme object
 * under a `theme` key in our canonical JSON (survey-core does not read it from
 * the model automatically), then apply it to the live Model in every renderer —
 * so Preview and the public form look identical.
 */
export function applyStoredTheme(
    model: { applyTheme: (theme: unknown) => void },
    schema: Record<string, unknown>,
): void {
    const theme = schema.theme;

    if (
        theme &&
        typeof theme === 'object' &&
        !Array.isArray(theme) &&
        Object.keys(theme as object).length > 0
    ) {
        model.applyTheme(theme as never);
    }
}
