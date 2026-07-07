<?php

namespace App\Http\Controllers;

use App\Contracts\AccessPolicy;
use App\Contracts\RuntimeContext;
use App\Contracts\SubmissionStore;
use App\Models\FormSchema;
use App\Support\SubmissionEvaluator;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    protected function resolveSchema(string $slug): FormSchema
    {
        /** @var class-string<FormSchema> $model */
        $model = config('formbuilder.models.form_schema', FormSchema::class);

        return $model::query()->where('slug', $slug)->firstOrFail();
    }
}
