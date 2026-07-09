<?php

namespace Rivaiamin\Formwright\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User;
use Rivaiamin\Formwright\Database\Factories\FormSchemaRevisionFactory;

/**
 * A saved snapshot of a {@see FormSchema}'s JSON.
 *
 * Revisions deliberately carry no tenant column: they are reachable only through
 * their parent schema, which is already tenant-scoped.
 *
 * @property int $id
 * @property int $form_schema_id
 * @property int|null $user_id
 * @property array<string, mixed> $json
 */
class FormSchemaRevision extends Model
{
    /** @use HasFactory<FormSchemaRevisionFactory> */
    use HasFactory;

    protected $fillable = [
        'form_schema_id',
        'user_id',
        'json',
    ];

    protected static function newFactory(): FormSchemaRevisionFactory
    {
        return FormSchemaRevisionFactory::new();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'json' => 'array',
        ];
    }

    public function getTable(): string
    {
        return config('formbuilder.tables.form_schema_revisions', 'form_schema_revisions');
    }

    /**
     * @return BelongsTo<FormSchema, $this>
     */
    public function schema(): BelongsTo
    {
        /** @var class-string<FormSchema> $model */
        $model = config('formbuilder.models.form_schema', FormSchema::class);

        return $this->belongsTo($model, 'form_schema_id');
    }

    /**
     * The user who saved this revision, resolved against the app's configured
     * auth model so the package does not depend on the host's User class.
     *
     * @return BelongsTo<Model, $this>
     */
    public function author(): BelongsTo
    {
        /** @var class-string<Model> $model */
        $model = config('auth.providers.users.model', User::class);

        return $this->belongsTo($model, 'user_id');
    }

    /** How many fields the snapshot contains, for the history list. */
    public function fieldCount(): int
    {
        $count = 0;

        foreach ($this->json['pages'] ?? [] as $page) {
            $count += count($page['elements'] ?? []);
        }

        return $count;
    }
}
