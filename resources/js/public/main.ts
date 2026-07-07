// =============================================================================
// public/main.ts — the standalone public form renderer.
//
// Renders a stored schema with the MIT survey-core + survey-js-ui and POSTs the
// responses on completion. Separate from the builder bundle so public pages
// don't ship the whole designer. Same renderer, same canonical JSON.
// =============================================================================

import { Model } from 'survey-core';
import 'survey-core/defaultV2.min.css';
import 'survey-core/survey.i18n';
import { renderSurvey } from 'survey-js-ui';

import { applyStoredTheme, registerCustomProperties } from '../builder/survey-setup';

interface MountOptions {
  schema: Record<string, unknown>;
  locale?: string;
  submitUrl: string;
  csrf?: string;
}

function setStatus(text: string): void {
  const node = document.querySelector<HTMLElement>('[data-testid="submit-status"]');
  if (node) {
    node.textContent = text;
    node.dataset.state = text.split(':')[0];
  }
}

export function mount(el: HTMLElement, opts: MountOptions): void {
  registerCustomProperties();

  const model = new Model(opts.schema);
  if (opts.locale && opts.locale !== 'default') {
    model.locale = opts.locale;
  }
  applyStoredTheme(model, opts.schema);

  model.onComplete.add(async (sender) => {
    try {
      const res = await fetch(opts.submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(opts.csrf ? { 'X-CSRF-TOKEN': opts.csrf } : {}),
        },
        body: JSON.stringify({ data: sender.data, locale: opts.locale ?? 'default' }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: number };
      setStatus(res.ok ? `submitted:${body.id ?? ''}` : `error:${res.status}`);
    } catch {
      setStatus('error:network');
    }
  });

  renderSurvey(model, el);
}

declare global {
  interface Window {
    FormwrightForm?: { mount: typeof mount };
  }
}

if (typeof window !== 'undefined') {
  window.FormwrightForm = { mount };
}
