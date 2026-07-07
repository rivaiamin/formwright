<?php

namespace App\Support;

use App\Contracts\AccessPolicy;
use App\Models\FormSchema;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Default {@see AccessPolicy}: forms are publicly viewable and submittable, and
 * any authenticated user may edit. Hosts rebind this to enforce ownership,
 * publication state, tenancy, etc.
 */
class DefaultAccessPolicy implements AccessPolicy
{
    public function canView(FormSchema $schema, ?Authenticatable $user): bool
    {
        return true;
    }

    public function canEdit(FormSchema $schema, ?Authenticatable $user): bool
    {
        return $user !== null;
    }

    public function canSubmit(FormSchema $schema, ?Authenticatable $user): bool
    {
        return true;
    }
}
