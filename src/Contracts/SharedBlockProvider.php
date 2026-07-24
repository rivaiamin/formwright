<?php

namespace Rivaiamin\Formwright\Contracts;

use Rivaiamin\Formwright\Support\NullSharedBlockProvider;

/**
 * Supplies the designer's "Question library" — a set of ready-to-insert SurveyJS
 * elements the author can drop onto a form. Unlike the localStorage "Saved blocks"
 * (per-browser), these come from the host: a shared, server-owned catalog such as a
 * cross-tenant question bank.
 *
 * Bound to {@see NullSharedBlockProvider} (empty — no library) by default. A host app
 * rebinds it to source blocks from its own model:
 *
 *     $this->app->bind(SharedBlockProvider::class, MyQuestionBankProvider::class);
 */
interface SharedBlockProvider
{
    /**
     * The insert-only library blocks, for the builder's palette.
     *
     * Each element is plain SurveyJS JSON (e.g. `['type' => 'text', 'name' => 'nisn',
     * 'title' => ['default' => 'NISN']]`); the builder de-dupes the name on insert.
     *
     * @return array<int, array{id: string, label: string, element: array<string, mixed>}>
     */
    public function blocks(): array;
}
