<?php

namespace App\Support;

use App\Contracts\SubmissionStore;
use App\Models\FormSchema;
use App\Models\FormSubmission;
use Illuminate\Support\Collection;

/**
 * Default {@see SubmissionStore}: writes submissions to the configured Eloquent
 * model / table.
 */
class EloquentSubmissionStore implements SubmissionStore
{
    /**
     * @return class-string<FormSubmission>
     */
    protected function model(): string
    {
        return config('formbuilder.models.form_submission', FormSubmission::class);
    }

    public function store(FormSchema $schema, array $data, string $locale = 'default', ?int $score = null): FormSubmission
    {
        $model = $this->model();

        return $model::query()->create([
            'form_schema_id' => $schema->getKey(),
            'locale' => $locale,
            'data' => $data,
            'score' => $score,
        ]);
    }

    public function forSchema(FormSchema $schema): Collection
    {
        return $this->model()::query()
            ->where('form_schema_id', $schema->getKey())
            ->latest('id')
            ->get();
    }
}
