<?php

namespace Database\Factories;

use App\Models\FormSchema;
use App\Models\FormSchemaRevision;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FormSchemaRevision>
 */
class FormSchemaRevisionFactory extends Factory
{
    protected $model = FormSchemaRevision::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'form_schema_id' => FormSchema::factory(),
            'user_id' => null,
            'json' => FormSchema::blankSchema('Revision'),
        ];
    }
}
