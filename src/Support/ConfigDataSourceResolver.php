<?php

namespace Rivaiamin\Formwright\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use InvalidArgumentException;
use Rivaiamin\Formwright\Contracts\DataSourceResolver;
use Rivaiamin\Formwright\Contracts\RuntimeContext;

/**
 * Default {@see DataSourceResolver}: resolves options from Eloquent models
 * declared in `config('formbuilder.data_sources')`. Only allowlisted keys are
 * reachable; the client supplies a filter value, a search term and pagination,
 * never a model class or column name — those are host-controlled config.
 */
class ConfigDataSourceResolver implements DataSourceResolver
{
    public function __construct(protected RuntimeContext $context) {}

    public function options(string $key, ?string $filter, ?string $search, int $skip, int $take): array
    {
        $config = $this->sourceConfig($key);
        $query = $this->baseQuery($config);

        if (filled($config['filter_column'] ?? null) && filled($filter)) {
            $query->where($config['filter_column'], $filter);
        }

        if (filled($search)) {
            /** @var array<int, string> $columns */
            $columns = $config['search_columns'] ?? [$config['text']];

            $query->where(function (Builder $inner) use ($columns, $search): void {
                foreach ($columns as $column) {
                    $inner->orWhere($column, 'like', '%'.$search.'%');
                }
            });
        }

        $total = (clone $query)->count();

        $take = max(1, min($take, (int) ($config['limit'] ?? 50)));

        $rows = $query
            ->skip(max(0, $skip))
            ->take($take)
            ->get([$config['value'], $config['text']]);

        return [
            'items' => $this->toItems($rows, $config),
            'total' => $total,
        ];
    }

    public function display(string $key, array $values): array
    {
        if ($values === []) {
            return [];
        }

        $config = $this->sourceConfig($key);

        $rows = $this->baseQuery($config)
            ->whereIn($config['value'], $values)
            ->get([$config['value'], $config['text']]);

        return $this->toItems($rows, $config);
    }

    public function catalog(): array
    {
        $out = [];

        foreach ((array) config('formbuilder.data_sources', []) as $key => $source) {
            $out[] = [
                'key' => (string) $key,
                'label' => (string) ($source['label'] ?? $key),
            ];
        }

        return $out;
    }

    /**
     * Map result rows to `{value, text}` option items.
     *
     * @param  Collection<int, Model>  $rows
     * @param  array<string, mixed>  $config
     * @return array<int, array{value: mixed, text: string}>
     */
    protected function toItems($rows, array $config): array
    {
        return $rows->map(fn (Model $row): array => [
            'value' => $row->getAttribute($config['value']),
            'text' => (string) $row->getAttribute($config['text']),
        ])->all();
    }

    /**
     * The config block for a source, or throw for an unknown/allowlisted-out key.
     *
     * @return array<string, mixed>
     */
    protected function sourceConfig(string $key): array
    {
        $sources = (array) config('formbuilder.data_sources', []);

        if (! array_key_exists($key, $sources) || ! is_array($sources[$key])) {
            throw new InvalidArgumentException("Unknown data source [{$key}].");
        }

        return $sources[$key];
    }

    /**
     * A fresh Eloquent query for the source's model, with the optional host
     * `scope` applied (a place for tenancy or published-only filtering).
     *
     * @param  array<string, mixed>  $config
     * @return Builder<Model>
     */
    protected function baseQuery(array $config): Builder
    {
        /** @var class-string<Model> $model */
        $model = $config['model'];

        $query = $model::query();

        $scope = $config['scope'] ?? null;

        if (is_callable($scope)) {
            $scoped = $scope($query, $this->context);

            if ($scoped instanceof Builder) {
                $query = $scoped;
            }
        }

        return $query;
    }
}
