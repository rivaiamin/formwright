// =============================================================================
// survey-data-source.ts — model-backed & cascading choices at render time.
//
// A field authored with "A Laravel model" carries a `dataSource` (a config key)
// and optionally a `dataFilterQuestion` (another field whose answer filters it).
// Nothing about this is proprietary: the options are fetched from the host's own
// data-source endpoint. Shared by both renderers (Preview + public) so they
// behave identically.
//
// dropdown/tagbox use survey-core lazy loading (paged, searchable); other choice
// types load their full list eagerly. Either way, changing the parent field
// clears + reloads the dependent field (the cascade).
// =============================================================================

import type { Model, Question } from 'survey-core';

interface DataSourceContext {
    /** Base URL a source key is appended to: `${baseUrl}/${key}`. */
    baseUrl: string;
}

interface OptionItem {
    value: unknown;
    text: string;
}

interface OptionPage {
    items: OptionItem[];
    total: number;
}

/** A question's `dataSource` key, or undefined if it is not model-backed. */
function sourceKey(question: Question): string | undefined {
    const key = (question as { dataSource?: unknown }).dataSource;

    return typeof key === 'string' && key !== '' ? key : undefined;
}

/** The name of the question filtering this one (cascade parent), if any. */
function filterQuestionName(question: Question): string | undefined {
    const name = (question as { dataFilterQuestion?: unknown })
        .dataFilterQuestion;

    return typeof name === 'string' && name !== '' ? name : undefined;
}

/** Build the endpoint URL for a source, with query params, against the origin. */
function endpoint(
    baseUrl: string,
    key: string,
    params: Record<string, unknown>,
): string {
    const url = new URL(
        `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(key)}`,
        window.location.origin,
    );

    for (const [name, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
            url.searchParams.set(name, String(value));
        }
    }

    return url.toString();
}

/** Fetch a page of options (or, with `values`, a set of display labels). */
async function fetchOptions(
    baseUrl: string,
    key: string,
    params: Record<string, unknown>,
): Promise<OptionPage> {
    const res = await fetch(endpoint(baseUrl, key, params), {
        headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
        throw new Error(`data source "${key}": ${res.status}`);
    }

    const body = await res.json();

    // The options endpoint returns { items, total }; the display endpoint (values=)
    // returns a bare array.
    if (Array.isArray(body)) {
        return { items: body as OptionItem[], total: body.length };
    }

    const items = (body.items ?? []) as OptionItem[];

    return {
        items,
        total: typeof body.total === 'number' ? body.total : items.length,
    };
}

/**
 * Wire model-backed and cascading choices onto a live survey-core Model. A no-op
 * when no endpoint is configured. Must run before the survey is rendered.
 */
export function wireDataSources(model: Model, ctx: DataSourceContext): void {
    const baseUrl = ctx.baseUrl;

    if (!baseUrl) {
        return;
    }

    /** The current value of a question's cascade parent, or null. */
    const parentValue = (question: Question): string | null => {
        const parentName = filterQuestionName(question);

        if (!parentName) {
            return null;
        }

        const parent = model.getQuestionByName(parentName);
        const value = parent ? parent.value : undefined;

        return value === undefined || value === null || value === ''
            ? null
            : String(value);
    };

    // Lazy load (dropdown / tagbox): survey-core asks for a page as the list opens
    // or its search filter changes.
    model.onChoicesLazyLoad.add((_sender, options: any) => {
        const key = sourceKey(options.question);

        if (!key) {
            return;
        }

        fetchOptions(baseUrl, key, {
            filter: parentValue(options.question),
            q: options.filter,
            skip: options.skip,
            take: options.take,
        })
            .then((page) => options.setItems(page.items, page.total))
            .catch(() => options.setItems([], 0));
    });

    // Resolve labels for values already selected on a lazy field (so a pre-filled
    // value shows its text, not the raw id).
    model.onGetChoiceDisplayValue.add((_sender, options: any) => {
        const key = sourceKey(options.question);

        if (!key) {
            return;
        }

        const values: unknown[] = options.values ?? [];

        if (values.length === 0) {
            options.setItems([]);

            return;
        }

        fetchOptions(baseUrl, key, { values: values.join(',') })
            .then((page) => {
                const byValue = new Map(
                    page.items.map((item) => [String(item.value), item.text]),
                );

                options.setItems(
                    values.map(
                        (value) => byValue.get(String(value)) ?? String(value),
                    ),
                );
            })
            .catch(() =>
                options.setItems(values.map((value) => String(value))),
            );
    });

    // Eager load (radiogroup / checkbox / …): fetch the full list up front and
    // whenever the cascade parent changes.
    const loadEager = (question: Question): void => {
        const key = sourceKey(question);

        if (!key) {
            return;
        }

        fetchOptions(baseUrl, key, { filter: parentValue(question), take: 100 })
            .then((page) => {
                (question as unknown as { choices: OptionItem[] }).choices =
                    page.items;
            })
            .catch(() => {
                /* leave the field empty on failure rather than throwing */
            });
    };

    const modelBackedQuestions = (): Question[] =>
        model
            .getAllQuestions(false, false, true)
            .filter((question) => sourceKey(question) !== undefined);

    for (const question of modelBackedQuestions()) {
        if (
            !(question as { choicesLazyLoadEnabled?: boolean })
                .choicesLazyLoadEnabled
        ) {
            loadEager(question);
        }
    }

    // Cascade: when a parent answer changes, reset every dependent field so it
    // reloads against the new value.
    model.onValueChanged.add((_sender, options: any) => {
        for (const question of modelBackedQuestions()) {
            if (filterQuestionName(question) !== options.name) {
                continue;
            }

            question.clearValue();

            if (
                (question as { choicesLazyLoadEnabled?: boolean })
                    .choicesLazyLoadEnabled
            ) {
                // Drop any cached page so the next open re-fetches with the new filter.
                const list = (question as { dropdownListModel?: any })
                    .dropdownListModel;
                list?.resetFilterString?.();
                list?.updateItems?.();
            } else {
                loadEager(question);
            }
        }
    });
}
