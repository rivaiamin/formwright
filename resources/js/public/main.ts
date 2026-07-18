// =============================================================================
// public/main.ts — the standalone public form renderer.
//
// Renders a stored schema with the MIT survey-core + survey-js-ui and POSTs the
// responses on completion. Separate from the builder bundle so public pages
// don't ship the whole designer. Same renderer, same canonical JSON.
// =============================================================================

import { Model, Serializer } from 'survey-core';
import 'survey-core/defaultV2.min.css';
import 'survey-core/survey.i18n';
import { renderSurvey } from 'survey-js-ui';

import {
    applyStoredTheme,
    registerCustomProperties,
} from '../builder/survey-setup';
import { wireDataSources } from '../schema/survey-data-source';

interface MountOptions {
    schema: Record<string, unknown>;
    locale?: string;
    submitUrl: string;
    uploadUrl?: string;
    dataSourceUrl?: string;
    csrf?: string;
}

interface StoredUpload {
    name: string;
    url: string;
}

function setStatus(text: string): void {
    const node = document.querySelector<HTMLElement>(
        '[data-testid="submit-status"]',
    );

    if (node) {
        node.textContent = text;
        node.dataset.state = text.split(':')[0];
    }
}

// survey-core question types that upload binary content (file, signature).
const UPLOAD_QUESTION_TYPES = ['file', 'signaturepad'];

/**
 * Make file / signature questions upload their content instead of inlining it as
 * base64 in the survey data. survey-core only raises `onUploadFiles` when
 * `storeDataAsText` is false, so we flip that default before the Model is built
 * (covers questions added later inside dynamic panels too). Must run before
 * `new Model(...)`.
 */
function configureServerUploads(): void {
    UPLOAD_QUESTION_TYPES.forEach((type) => {
        const property = Serializer.findProperty(type, 'storeDataAsText');

        if (property) {
            property.defaultValue = false;
        }
    });
}

/**
 * Route file / image / signature uploads through the server instead of letting
 * survey-core inline them as base64 in the submission. Each file is POSTed as
 * multipart form-data to `uploadUrl`; the stored URL is handed back to
 * survey-core so `sender.data` holds URLs, not raw file bytes.
 */
function wireUploads(model: Model, uploadUrl: string, csrf?: string): void {
    // Belt-and-suspenders for questions already built from the schema, in case
    // the serializer default did not apply to a given type.
    model
        .getAllQuestions(false, false, true)
        .filter((question) =>
            UPLOAD_QUESTION_TYPES.includes(question.getType()),
        )
        .forEach((question) => {
            (
                question as unknown as { storeDataAsText: boolean }
            ).storeDataAsText = false;
        });

    model.onUploadFiles.add((_sender, options) => {
        const form = new FormData();
        options.files.forEach((file) => form.append('files[]', file));

        fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
            },
            body: form,
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`upload failed: ${res.status}`);
                }

                return (await res.json()) as StoredUpload[];
            })
            .then((stored) => {
                options.callback(
                    options.files.map((file, index) => ({
                        file,
                        content: stored[index]?.url,
                    })),
                );
            })
            .catch(() => {
                options.callback([], ['error']);
            });
    });
}

export function mount(el: HTMLElement, opts: MountOptions): void {
    registerCustomProperties();

    if (opts.uploadUrl) {
        configureServerUploads();
    }

    const model = new Model(opts.schema);

    if (opts.locale && opts.locale !== 'default') {
        model.locale = opts.locale;
    }

    applyStoredTheme(model, opts.schema);

    if (opts.dataSourceUrl) {
        wireDataSources(model, { baseUrl: opts.dataSourceUrl });
    }

    if (opts.uploadUrl) {
        wireUploads(model, opts.uploadUrl, opts.csrf);
    }

    model.onComplete.add(async (sender) => {
        try {
            const res = await fetch(opts.submitUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(opts.csrf ? { 'X-CSRF-TOKEN': opts.csrf } : {}),
                },
                body: JSON.stringify({
                    data: sender.data,
                    locale: opts.locale ?? 'default',
                }),
            });
            const body = (await res.json().catch(() => ({}))) as {
                id?: number;
            };
            setStatus(
                res.ok ? `submitted:${body.id ?? ''}` : `error:${res.status}`,
            );
        } catch {
            setStatus('error:network');
        }
    });

    renderSurvey(model, el);

    // Expose the live survey model on the mount node so host pages (and tests)
    // can drive it programmatically, e.g. el.survey.getQuestionByName(...).
    (el as HTMLElement & { survey?: Model }).survey = model;
}

declare global {
    interface Window {
        FormwrightForm?: { mount: typeof mount };
    }
}

if (typeof window !== 'undefined') {
    window.FormwrightForm = { mount };
}
