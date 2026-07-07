<?php

namespace App\Contracts;

use App\Models\FormSchema;
use App\Models\FormSubmission;
use Illuminate\Support\Collection;

/**
 * Persists and retrieves form submissions. Bound to a default Eloquent
 * implementation in the service provider; a host app may rebind it (e.g. to
 * write to an external store or a data warehouse) without touching the package.
 */
interface SubmissionStore
{
    /**
     * Persist a response to a schema.
     *
     * @param  array<string, mixed>  $data
     */
    public function store(FormSchema $schema, array $data, string $locale = 'default', ?int $score = null): FormSubmission;

    /**
     * All submissions for a schema, newest first.
     *
     * @return Collection<int, FormSubmission>
     */
    public function forSchema(FormSchema $schema): Collection;
}
