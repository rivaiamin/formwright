<?php

namespace App\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

/**
 * The ambient "who/where" a form operation runs in: the current user, tenant,
 * and locale. Bound to {@see \App\Support\DefaultRuntimeContext}. A host app may
 * rebind it in a service provider to source these from somewhere else:
 *
 *     $this->app->bind(RuntimeContext::class, MyRuntimeContext::class);
 */
interface RuntimeContext
{
    public function user(): ?Authenticatable;

    public function tenant(): ?Model;

    public function locale(): string;
}
