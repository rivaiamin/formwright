<?php

namespace App\Http\Controllers;

use App\Contracts\AccessPolicy;
use App\Contracts\RuntimeContext;
use App\Contracts\SubmissionStore;
use App\Contracts\UploadStore;
use App\Models\FormSchema;
use App\Support\SubmissionEvaluator;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class PublicFormController extends Controller
{
    public function __construct(
        protected SubmissionEvaluator $evaluator,
        protected AccessPolicy $access,
        protected RuntimeContext $context,
    ) {}

    /**
     * Render a public form by slug. `?locale=` selects the rendered language.
     */
    public function show(Request $request, string $slug): View
    {
        $schema = $this->resolveSchema($slug);

        abort_unless($this->access->canView($schema, $this->context->user()), 403);

        $locale = (string) $request->query('locale', $schema->default_locale);

        return view('public.form', [
            'schema' => $schema,
            'locale' => $locale,
            'submitUrl' => route('formbuilder.forms.submit', $schema->slug),
            'uploadUrl' => route('formbuilder.forms.upload', $schema->slug),
        ]);
    }

    /**
     * Accept a submission, validate required fields, score it, and store it.
     */
    public function submit(Request $request, string $slug, SubmissionStore $store): JsonResponse
    {
        $schema = $this->resolveSchema($slug);

        abort_unless($this->access->canSubmit($schema, $this->context->user()), 403);

        $payload = $request->validate([
            'data' => ['required', 'array'],
            'locale' => ['nullable', 'string'],
        ]);

        $data = $payload['data'];
        $locale = $payload['locale'] ?? $schema->default_locale;

        $errors = $this->evaluator->validateRequired($schema->json, $data);
        if ($errors !== []) {
            return response()->json(['ok' => false, 'errors' => $errors], 422);
        }

        $score = $this->evaluator->score($schema->json, $data);
        $submission = $store->store($schema, $data, $locale, $score);

        return response()->json([
            'ok' => true,
            'id' => $submission->getKey(),
            'score' => $submission->score,
        ], 201);
    }

    /**
     * Accept file uploads (file / image / signature fields) during fill-out,
     * store them on the configured disk, and return their stored URLs. survey-core
     * calls this via `onUploadFiles` before the submission itself is sent.
     */
    public function upload(Request $request, string $slug, UploadStore $store): JsonResponse
    {
        $schema = $this->resolveSchema($slug);

        abort_unless($this->access->canSubmit($schema, $this->context->user()), 403);

        $maxKb = (int) config('formbuilder.uploads.max_size_kb', 10240);
        $mimes = config('formbuilder.uploads.accepted_mimes');

        $fileRules = ['file', "max:{$maxKb}"];
        if (is_array($mimes) && $mimes !== []) {
            $fileRules[] = 'mimetypes:'.implode(',', $mimes);
        }

        $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => $fileRules,
        ]);

        $stored = array_map(
            fn (UploadedFile $file): array => $store->store($schema, $file),
            $request->file('files'),
        );

        return response()->json($stored);
    }

    protected function resolveSchema(string $slug): FormSchema
    {
        /** @var class-string<FormSchema> $model */
        $model = config('formbuilder.models.form_schema', FormSchema::class);

        return $model::query()->where('slug', $slug)->firstOrFail();
    }
}
