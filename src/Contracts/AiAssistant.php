<?php

namespace App\Contracts;

/**
 * Optional AI assistance: draft a whole form from a natural-language brief, or
 * rewrite a single field. Bound by default to {@see \App\Support\NullAiAssistant},
 * which throws {@see \App\Support\AiAssistantNotConfiguredException} — the feature
 * is opt-in. A host app supplies its own (and its own provider/key):
 *
 *     $this->app->bind(AiAssistant::class, OpenAiAssistant::class);
 *
 * Both methods return SurveyJS-compatible JSON (a full survey, or one element).
 * Callers should treat the result as a *proposal* and confirm before applying.
 */
interface AiAssistant
{
    /**
     * Draft a full survey from a description.
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed> SurveyJS survey JSON
     */
    public function draftForm(string $prompt, array $context = []): array;

    /**
     * Rewrite/produce a single element from a prompt.
     *
     * @param  array<string, mixed>  $element  the current element (may be empty)
     * @param  array<string, mixed>  $context
     * @return array<string, mixed> a SurveyJS element
     */
    public function rewriteField(array $element, string $prompt, array $context = []): array;
}
