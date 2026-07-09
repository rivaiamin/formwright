<?php

namespace Rivaiamin\Formwright\Contracts;

use Illuminate\Contracts\Auth\Authenticatable;
use Rivaiamin\Formwright\Models\FormSchema;
use Rivaiamin\Formwright\Support\DefaultAccessPolicy;

/**
 * Authorization for a schema: who may view it, edit it in the designer, and
 * submit a response. Bound to {@see DefaultAccessPolicy} (public
 * view/submit, authenticated edit). A host app rebinds it to enforce its own
 * rules (ownership, publication state, tenancy):
 *
 *     $this->app->bind(AccessPolicy::class, MyAccessPolicy::class);
 */
interface AccessPolicy
{
    public function canView(FormSchema $schema, ?Authenticatable $user): bool;

    public function canEdit(FormSchema $schema, ?Authenticatable $user): bool;

    public function canSubmit(FormSchema $schema, ?Authenticatable $user): bool;
}
