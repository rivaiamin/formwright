<?php

namespace Rivaiamin\Formwright\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Rivaiamin\Formwright\Support\DefaultRuntimeContext;

/**
 * The ambient "who/where" a form operation runs in: the current user, tenant,
 * and locale. Bound to {@see DefaultRuntimeContext}. A host app may
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
