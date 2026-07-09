<?php

namespace Rivaiamin\Formwright\Support;

use Illuminate\Contracts\Auth\Authenticatable;
use Rivaiamin\Formwright\Contracts\AccessPolicy;
use Rivaiamin\Formwright\Models\FormSchema;

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
