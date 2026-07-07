<?php

namespace App\Support;

use App\Contracts\RuntimeContext;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Default {@see RuntimeContext}: the authenticated user, the active Filament
 * tenant (when tenancy is in use), and the application locale.
 */
class DefaultRuntimeContext implements RuntimeContext
{
    public function user(): ?Authenticatable
    {
        return Auth::user();
    }

    public function tenant(): ?Model
    {
        if (! class_exists(\Filament\Facades\Filament::class)) {
            return null;
        }

        try {
            $tenant = \Filament\Facades\Filament::getTenant();
        } catch (\Throwable) {
            return null;
        }

        return $tenant instanceof Model ? $tenant : null;
    }

    public function locale(): string
    {
        return app()->getLocale();
    }
}
