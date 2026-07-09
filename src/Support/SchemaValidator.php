<?php

namespace Rivaiamin\Formwright\Support;

/**
 * Server-side gate for incoming SurveyJS survey JSON.
 *
 * This is intentionally structural, NOT exhaustive: it proves the document is a
 * well-formed survey (pages exist, every element has a type + a unique name)
 * without asserting anything about element types it doesn't recognise. That
 * restraint is deliberate — the builder's promise is that it never corrupts a
 * schema it doesn't fully understand, so the validator must not reject unknown
 * (advanced) element types either.
 */
class SchemaValidator
{
    /**
     * Element keys whose value is itself a list of nested elements. Names inside
     * these must also be unique, so we recurse to collect them.
     *
     * @var array<int, string>
     */
    private const NESTED_ELEMENT_KEYS = ['elements', 'templateElements'];

    /**
     * @param  mixed  $schema
     * @return array<string, mixed> The validated schema, unchanged.
     *
     * @throws SchemaValidationException
     */
    public function validate($schema): array
    {
        $errors = [];

        if (! is_array($schema)) {
            throw new SchemaValidationException(['Schema must be a JSON object.']);
        }

        if (! isset($schema['pages']) || ! is_array($schema['pages']) || ! array_is_list($schema['pages'])) {
            throw new SchemaValidationException(['Schema must contain a "pages" array.']);
        }

        if ($schema['pages'] === []) {
            $errors[] = 'Schema must contain at least one page.';
        }

        /** @var array<string, int> $seenNames name => count */
        $seenNames = [];

        foreach ($schema['pages'] as $pageIndex => $page) {
            $label = 'page #'.($pageIndex + 1);

            if (! is_array($page)) {
                $errors[] = "{$label} must be an object.";

                continue;
            }

            $elements = $page['elements'] ?? [];

            if (! is_array($elements) || ($elements !== [] && ! array_is_list($elements))) {
                $errors[] = "{$label} \"elements\" must be an array.";

                continue;
            }

            $this->validateElements($elements, $label, $seenNames, $errors);
        }

        foreach ($seenNames as $name => $count) {
            if ($count > 1) {
                $errors[] = "Duplicate element name \"{$name}\" ({$count} occurrences); names must be unique.";
            }
        }

        if ($errors !== []) {
            throw new SchemaValidationException(array_values($errors));
        }

        return $schema;
    }

    /**
     * Returns true when the schema validates, without throwing.
     *
     * @param  mixed  $schema
     */
    public function passes($schema): bool
    {
        try {
            $this->validate($schema);

            return true;
        } catch (SchemaValidationException) {
            return false;
        }
    }

    /**
     * @param  array<int, mixed>  $elements
     * @param  array<string, int>  $seenNames
     * @param  array<int, string>  $errors
     */
    private function validateElements(array $elements, string $label, array &$seenNames, array &$errors): void
    {
        foreach ($elements as $i => $element) {
            $where = "{$label}, element #".($i + 1);

            if (! is_array($element)) {
                $errors[] = "{$where} must be an object.";

                continue;
            }

            $type = $element['type'] ?? null;

            if (! is_string($type) || trim($type) === '') {
                $errors[] = "{$where} is missing a non-empty \"type\".";
            }

            $name = $element['name'] ?? null;

            if (! is_string($name) || trim($name) === '') {
                $errors[] = "{$where} is missing a non-empty \"name\".";
            } else {
                $seenNames[$name] = ($seenNames[$name] ?? 0) + 1;
            }

            foreach (self::NESTED_ELEMENT_KEYS as $key) {
                $nested = $element[$key] ?? null;

                if (is_array($nested) && array_is_list($nested)) {
                    $this->validateElements($nested, $where, $seenNames, $errors);
                }
            }
        }
    }
}
