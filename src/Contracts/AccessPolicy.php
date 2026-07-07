<?php

namespace App\Contracts;

use App\Models\FormSchema;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Authorization for a schema: who may view it, edit it in the designer, and
 * submit a response. Bound to {@see \App\Support\DefaultAccessPolicy} (public
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
