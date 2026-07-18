<?php

namespace Rivaiamin\Formwright\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Rivaiamin\Formwright\Contracts\AccessPolicy;
use Rivaiamin\Formwright\Contracts\DataSourceResolver;
use Rivaiamin\Formwright\Contracts\RuntimeContext;
use Rivaiamin\Formwright\Contracts\SubmissionStore;
use Rivaiamin\Formwright\Contracts\UploadStore;
use Rivaiamin\Formwright\Models\FormSchema;
use Rivaiamin\Formwright\Support\SubmissionEvaluator;

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

        return view('formwright::public.form', [
            'schema' => $schema,
            'locale' => $locale,
            'submitUrl' => route('formbuilder.forms.submit', $schema->slug),
            'uploadUrl' => route('formbuilder.forms.upload', $schema->slug),
            'dataSourceUrl' => $this->dataSourceBaseUrl($schema),
        ]);
    }

    /**
     * Serve options for a model-backed choice field. Cascading (`filter`), search
     * (`q`) and pagination (`skip`/`take`) narrow the list; `values` instead
     * resolves display labels for already-selected values. Gated by `canView`,
     * throttled, and limited to allowlisted sources (unknown key → 404).
     */
    public function dataSource(Request $request, string $slug, string $key, DataSourceResolver $resolver): JsonResponse
    {
        $schema = $this->resolveSchema($slug);

        abort_unless($this->access->canView($schema, $this->context->user()), 403);

        $validated = $request->validate([
            'filter' => ['nullable', 'string', 'max:255'],
            'q' => ['nullable', 'string', 'max:255'],
            'skip' => ['nullable', 'integer', 'min:0'],
            'take' => ['nullable', 'integer', 'min:1', 'max:100'],
            'values' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            if (filled($validated['values'] ?? null)) {
                $values = array_values(array_filter(
                    array_map('trim', explode(',', $validated['values'])),
                    static fn (string $value): bool => $value !== '',
                ));

                return response()->json($resolver->display($key, $values));
            }

            $result = $resolver->options(
                $key,
                $validated['filter'] ?? null,
                $validated['q'] ?? null,
                (int) ($validated['skip'] ?? 0),
                (int) ($validated['take'] ?? 25),
            );
        } catch (InvalidArgumentException) {
            abort(404);
        }

        return response()->json($result);
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

    /**
     * The base URL the renderer appends a source key to (`.../data-sources/{key}`),
     * built from the route rather than string-concatenated so prefix changes carry.
     */
    protected function dataSourceBaseUrl(FormSchema $schema): string
    {
        // The placeholder is stripped so the JS can append the actual source key.
        $placeholder = '__FORMWRIGHT_KEY__';

        return str_replace(
            '/'.$placeholder,
            '',
            route('formbuilder.forms.data-source', ['slug' => $schema->slug, 'key' => $placeholder]),
        );
    }
}
