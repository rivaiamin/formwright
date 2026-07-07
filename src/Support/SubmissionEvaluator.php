<?php

namespace App\Support;

/**
 * Server-side reasoning over a submission against its schema: which required
 * fields are missing, and (for quizzes) what score the answers earn. Kept
 * separate from persistence so it can be unit-tested in isolation.
 */
class SubmissionEvaluator
{
    /**
     * Validate a submission's required fields.
     *
     * Only *unconditionally* required fields are enforced — a field gated by
     * `visibleIf`/`enableIf` may legitimately be absent, and evaluating those
     * expressions server-side is out of scope here.
     *
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $data
     * @return array<string, string> field name => error message (empty if valid)
     */
    public function validateRequired(array $schema, array $data): array
    {
        $errors = [];

        foreach ($this->elements($schema) as $el) {
            $name = $el['name'] ?? null;
            if (! is_string($name)) {
                continue;
            }

            $unconditionallyRequired = ($el['isRequired'] ?? false) === true
                && ! isset($el['visibleIf'])
                && ! isset($el['enableIf']);

            if ($unconditionallyRequired && $this->isEmpty($data[$name] ?? null)) {
                $errors[$name] = "The field \"{$name}\" is required.";
            }
        }

        return $errors;
    }

    /**
     * Score a submission, or null when the schema has no scored questions.
     *
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $data
     */
    public function score(array $schema, array $data): ?int
    {
        $scored = false;
        $total = 0;

        foreach ($this->elements($schema) as $el) {
            if (! array_key_exists('correctAnswer', $el)) {
                continue;
            }
            $scored = true;

            $name = $el['name'] ?? null;
            if (! is_string($name)) {
                continue;
            }

            $points = is_numeric($el['points'] ?? null) ? (int) $el['points'] : 1;

            if ($this->matches($data[$name] ?? null, $el['correctAnswer'])) {
                $total += $points;
            }
        }

        return $scored ? $total : null;
    }

    /**
     * Flatten a survey's top-level page elements.
     *
     * @param  array<string, mixed>  $schema
     * @return array<int, array<string, mixed>>
     */
    protected function elements(array $schema): array
    {
        $out = [];
        foreach ($schema['pages'] ?? [] as $page) {
            foreach ($page['elements'] ?? [] as $el) {
                if (is_array($el)) {
                    $out[] = $el;
                }
            }
        }

        return $out;
    }

    protected function isEmpty(mixed $value): bool
    {
        return $value === null || $value === '' || $value === [];
    }

    protected function matches(mixed $answer, mixed $correct): bool
    {
        if (is_array($correct) || is_array($answer)) {
            $a = is_array($answer) ? $answer : [$answer];
            $b = is_array($correct) ? $correct : [$correct];
            sort($a);
            sort($b);

            return $a === $b;
        }

        return $answer == $correct;
    }
}
