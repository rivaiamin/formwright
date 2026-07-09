<?php

namespace Rivaiamin\Formwright\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Rivaiamin\Formwright\Support\Tenancy;

/**
 * Automatically scopes a model to the current tenant when tenancy is enabled:
 * SELECTs are filtered by the tenant column, and new records are stamped with
 * the current tenant id. Both checks are made at runtime, so the model does not
 * need re-booting when tenancy is toggled (important for tests and config).
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query): void {
            if (! Tenancy::enabled()) {
                return;
            }

            $id = Tenancy::currentId();
            if ($id !== null) {
                $query->where($query->getModel()->qualifyColumn(Tenancy::column()), $id);
            }
        });

        static::creating(function (Model $model): void {
            if (! Tenancy::enabled()) {
                return;
            }

            $column = Tenancy::column();
            if ($model->getAttribute($column) === null) {
                $id = Tenancy::currentId();
                if ($id !== null) {
                    $model->setAttribute($column, $id);
                }
            }
        });
    }
}
