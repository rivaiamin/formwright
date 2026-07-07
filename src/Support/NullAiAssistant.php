<?php

namespace App\Support;

use App\Contracts\AiAssistant;

/**
 * Default {@see AiAssistant}: a no-op that signals the feature is not configured.
 * Both methods throw {@see AiAssistantNotConfiguredException} so callers can
 * detect the absence and hide/disable AI affordances.
 */
class NullAiAssistant implements AiAssistant
{
    public function draftForm(string $prompt, array $context = []): array
    {
        throw new AiAssistantNotConfiguredException;
    }

    public function rewriteField(array $element, string $prompt, array $context = []): array
    {
        throw new AiAssistantNotConfiguredException;
    }
}
