<?php

namespace Rivaiamin\Formwright\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Rivaiamin\Formwright\Models\FormSchema;
use Rivaiamin\Formwright\Models\FormSubmission;

/**
 * @extends Factory<FormSubmission>
 */
class FormSubmissionFactory extends Factory
{
    protected $model = FormSubmission::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'form_schema_id' => FormSchema::factory(),
            'locale' => 'default',
            'data' => ['full_name' => fake()->name()],
            'score' => null,
        ];
    }
}
