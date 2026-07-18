<?php

namespace Rivaiamin\Formwright\Contracts;

use Rivaiamin\Formwright\Support\ConfigDataSourceResolver;

/**
 * Resolves a form field's options from a host-defined data source (an Eloquent
 * model exposed via `config('formbuilder.data_sources')`). This is what powers
 * model-backed dropdowns and cascading (dependent) dropdowns: a field names a
 * source key, an optional filter value narrows it, and lazy-load supports large
 * tables.
 *
 * Bound to {@see ConfigDataSourceResolver}. A host app may rebind it to source
 * options from somewhere else (a service, a warehouse, a Filament resource):
 *
 *     $this->app->bind(DataSourceResolver::class, MyDataSourceResolver::class);
 */
interface DataSourceResolver
{
    /**
     * A page of options for a source, optionally filtered (cascade) and searched.
     *
     * @param  string  $key  The configured source key.
     * @param  string|null  $filter  The parent field's value, for cascading.
     * @param  string|null  $search  A free-text search term (server-side filter).
     * @return array{items: array<int, array{value: mixed, text: string}>, total: int}
     */
    public function options(string $key, ?string $filter, ?string $search, int $skip, int $take): array;

    /**
     * Resolve display labels for values already selected on the field (needed so
     * a lazy-loaded field can show text for a pre-filled value).
     *
     * @param  array<int, mixed>  $values
     * @return array<int, array{value: mixed, text: string}>
     */
    public function display(string $key, array $values): array;

    /**
     * The configured sources, for the builder's picker.
     *
     * @return array<int, array{key: string, label: string}>
     */
    public function catalog(): array;
}
