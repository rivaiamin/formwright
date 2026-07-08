<?php

namespace App\Support;

use App\Contracts\AiAssistant;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Default {@see AiAssistant} backed by Claude (Anthropic Messages API), called
 * through Laravel's HTTP client so no extra SDK dependency is required. The host
 * supplies the API key and model via config/formbuilder.php.
 *
 * Both methods return SurveyJS-compatible JSON that the caller treats as a
 * proposal (validated, then applied only on explicit confirmation).
 */
class ClaudeAiAssistant implements AiAssistant
{
    public function __construct(protected SchemaValidator $validator) {}

    private const SURVEY_CONTRACT = <<<'TXT'
    You generate SurveyJS-compatible survey JSON for a form builder. Output rules:
    - Return ONLY raw JSON. No prose, no markdown fences.
    - A survey is: { "title": {"default": "..."}, "locale": "default", "pages": [ { "name": "page1", "elements": [ ... ] } ] }.
    - Every user-facing string is a localized object like {"default": "Full name"}.
    - Each element has a unique "name" (snake_case) and a "type".
    - Use ONLY these element types:
      text (short answer; add "inputType":"number" for number, "inputType":"date" for date, "inputType":"email" for email),
      comment (long answer), radiogroup (single choice, needs "choices"), checkbox (multiple choice, needs "choices"),
      dropdown (needs "choices"), boolean (yes/no), rating (add "rateMax"), html (statement, needs localized "html"),
      image (needs "imageLink"), file, signaturepad.
    - choices are: [ { "value": "opt_1", "text": {"default": "Option 1"} } ].
    - Mark required questions with "isRequired": true when appropriate.
    TXT;

    public function draftForm(string $prompt, array $context = []): array
    {
        $schema = $this->requestJson(
            self::SURVEY_CONTRACT,
            "Draft a complete survey for this request:\n\n{$prompt}\n\nReturn only the survey JSON.",
        );

        // Never hand back a schema the builder can't safely load.
        return $this->validator->validate($schema);
    }

    public function rewriteField(array $element, string $prompt, array $context = []): array
    {
        $current = json_encode($element, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $result = $this->requestJson(
            self::SURVEY_CONTRACT."\n\nHere you return a SINGLE element object (not a full survey).",
            "Current element:\n{$current}\n\nRewrite it per this instruction: {$prompt}\n\nReturn only the element JSON.",
        );

        if (! isset($result['type'], $result['name'])) {
            throw new RuntimeException('AI returned an element without a type/name.');
        }

        return $result;
    }

    /**
     * Call Claude and parse a JSON object out of the response.
     *
     * @return array<string, mixed>
     */
    protected function requestJson(string $system, string $user): array
    {
        $config = config('formbuilder.ai');

        if (blank($config['api_key'] ?? null)) {
            throw new AiAssistantNotConfiguredException;
        }

        $response = Http::withHeaders([
            'x-api-key' => $config['api_key'],
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])
            ->timeout(120)
            ->post(rtrim($config['base_url'], '/').'/v1/messages', [
                'model' => $config['model'],
                'max_tokens' => $config['max_tokens'],
                'system' => $system,
                'messages' => [
                    ['role' => 'user', 'content' => $user],
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('AI request failed: '.$response->status().' '.$response->body());
        }

        $text = $response->collect('content')
            ->where('type', 'text')
            ->pluck('text')
            ->implode('');

        return $this->decode($text);
    }

    /**
     * @return array<string, mixed>
     */
    protected function decode(string $text): array
    {
        // Strip any accidental markdown fences and isolate the JSON object.
        $clean = trim(preg_replace('/^```(?:json)?|```$/m', '', $text));
        $start = strpos($clean, '{');
        $end = strrpos($clean, '}');
        if ($start !== false && $end !== false) {
            $clean = substr($clean, $start, $end - $start + 1);
        }

        $decoded = json_decode($clean, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('AI did not return valid JSON.');
        }

        return $decoded;
    }
}
