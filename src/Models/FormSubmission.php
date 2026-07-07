<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single response to a {@see FormSchema}.
 *
 * @property int $id
 * @property int $form_schema_id
 * @property string $locale
 * @property array<string, mixed> $data
 * @property int|null $score
 */
class FormSubmission extends Model
{
    /** @use HasFactory<\Database\Factories\FormSubmissionFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'form_schema_id',
        'locale',
        'data',
        'score',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'score' => 'integer',
        ];
    }

    public function getTable(): string
    {
        return config('formbuilder.tables.form_submissions', 'form_submissions');
    }

    /**
     * @return BelongsTo<FormSchema, $this>
     */
    public function schema(): BelongsTo
    {
        return $this->belongsTo(config('formbuilder.models.form_schema', FormSchema::class), 'form_schema_id');
    }
}
