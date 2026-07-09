<?php

namespace Rivaiamin\Formwright\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Rivaiamin\Formwright\Models\FormSchema;
use Rivaiamin\Formwright\Models\FormSchemaRevision;

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
