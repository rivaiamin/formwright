<?php

namespace App\Models;

use Database\Factories\FormSchemaRevisionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
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
