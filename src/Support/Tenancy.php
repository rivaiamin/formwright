<?php

namespace App\Support;

use App\Contracts\RuntimeContext;
use Closure;

/**
 * Central place the tenant scope asks "is tenancy on, and what is the current
 * tenant?" — evaluated at query time (not boot time) so config toggles and test
 * overrides take effect immediately.
 *
 * By default the current tenant comes from the {@see RuntimeContext} (the
 * Filament panel tenant). A host or a test may override resolution:
 *
 *     Tenancy::resolveUsing(fn () => $currentTenantId);
 */
class Tenancy
{
    protected static ?Closure $resolver = null;

    public static function enabled(): bool
    {
        return (bool) config('formbuilder.tenancy.enabled', false);
    }

    public static function column(): string
    {
        return config('formbuilder.tenancy.column', 'tenant_id');
    }

    public static function resolveUsing(Closure $resolver): void
    {
        static::$resolver = $resolver;
    }

    public static function forgetResolver(): void
    {
        static::$resolver = null;
    }

    /**
     * The current tenant identifier, or null when there is none.
     */
    public static function currentId(): mixed
    {
        if (static::$resolver !== null) {
            return (static::$resolver)();
        }

        return app(RuntimeContext::class)->tenant()?->getKey();
    }
}
