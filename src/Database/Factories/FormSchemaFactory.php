<?php

namespace Database\Factories;

use App\Models\FormSchema;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<FormSchema>
 */
class FormSchemaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'json' => FormSchema::blankSchema(Str::title($name)),
            'default_locale' => 'default',
            'available_locales' => ['default'],
            'scoring_enabled' => false,
        ];
    }

    /**
     * A schema carrying a couple of real questions.
     */
    public function withQuestions(): static
    {
        return $this->state(fn (array $attributes): array => [
            'json' => [
                'title' => ['default' => $attributes['name'] ?? 'Survey'],
                'locale' => 'default',
                'pages' => [[
                    'name' => 'page1',
                    'elements' => [
                        ['type' => 'text', 'name' => 'full_name', 'title' => ['default' => 'Full name'], 'isRequired' => true],
                        ['type' => 'rating', 'name' => 'satisfaction', 'title' => ['default' => 'How satisfied are you?'], 'rateMax' => 5],
                    ],
                ]],
            ],
        ]);
    }
}
