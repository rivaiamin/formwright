<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\FormSchemaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A stored SurveyJS-compatible form definition.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property array<string, mixed> $json
 * @property string $default_locale
 * @property array<int, string>|null $available_locales
 * @property bool $scoring_enabled
 */
class FormSchema extends Model
{
    /** @use HasFactory<FormSchemaFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'json',
        'default_locale',
        'available_locales',
        'scoring_enabled',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'json' => 'array',
            'available_locales' => 'array',
            'scoring_enabled' => 'boolean',
        ];
    }

    public function getTable(): string
    {
        return config('formbuilder.tables.form_schemas', 'form_schemas');
    }

    protected static function booted(): void
    {
        static::creating(function (FormSchema $schema): void {
            if (blank($schema->slug)) {
                $schema->slug = static::uniqueSlug($schema->name ?: 'form');
            }
        });
    }

    /**
     * Point-in-time snapshots of this form's JSON, newest first.
     *
     * @return HasMany<FormSchemaRevision, $this>
     */
    public function revisions(): HasMany
    {
        /** @var class-string<FormSchemaRevision> $model */
        $model = config('formbuilder.models.form_schema_revision', FormSchemaRevision::class);

        return $this->hasMany($model, 'form_schema_id')->latest('id');
    }

    /**
     * An empty but valid single-page SurveyJS survey.
     *
     * @return array<string, mixed>
     */
    public static function blankSchema(string $title = 'Untitled form'): array
    {
        return [
            'title' => ['default' => $title],
            'locale' => 'default',
            'pages' => [
                ['name' => 'page1', 'elements' => []],
            ],
        ];
    }

    protected static function uniqueSlug(string $from): string
    {
        $base = Str::slug($from) ?: 'form';
        $slug = $base;
        $i = 1;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-".(++$i);
        }

        return $slug;
    }
}
