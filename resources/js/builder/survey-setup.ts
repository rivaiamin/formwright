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
}
