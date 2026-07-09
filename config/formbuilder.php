<?php

use Rivaiamin\Formwright\Models\FormSchema;
use Rivaiamin\Formwright\Models\FormSchemaRevision;
use Rivaiamin\Formwright\Models\FormSubmission;

return [

    /*
    |--------------------------------------------------------------------------
    | Eloquent Models
    |--------------------------------------------------------------------------
    |
    | The model classes the package uses. Override these to swap in your own
    | implementations (e.g. to add a tenant relationship) without touching the
    | package internals.
    |
    */

    'models' => [
        'form_schema' => FormSchema::class,
        'form_schema_revision' => FormSchemaRevision::class,
        'form_submission' => FormSubmission::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Table Names
    |--------------------------------------------------------------------------
    */

    'tables' => [
        'form_schemas' => 'form_schemas',
        'form_schema_revisions' => 'form_schema_revisions',
        'form_submissions' => 'form_submissions',
    ],

    /*
    |--------------------------------------------------------------------------
    | Public Fill-out Routes
    |--------------------------------------------------------------------------
    |
    | The public route where end users open and submit a form by slug. Set
    | `enabled` to false to register no public routes (e.g. if the host app
    | renders forms itself).
    |
    */

    'routes' => [
        'enabled' => true,
        'prefix' => 'forms',
        'middleware' => ['web'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Multi-Tenancy
    |--------------------------------------------------------------------------
    |
    | When enabled, FormSchema and FormSubmission are automatically scoped to the
    | current tenant (queries are filtered and new records are stamped). The
    | current tenant is resolved from the RuntimeContext (the Filament panel
    | tenant by default), or from a closure registered via
    | Tenancy::resolveUsing(). `column` is the tenant foreign key on both tables.
    |
    */

    'tenancy' => [
        'enabled' => env('FORMBUILDER_TENANCY', false),
        'column' => 'tenant_id',
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Assistant (optional, opt-in)
    |--------------------------------------------------------------------------
    |
    | When enabled with an API key, the AiAssistant contract is bound to a
    | Claude-backed implementation that can draft a form from a prompt or
    | rewrite a field. Disabled by default — the contract then resolves to the
    | NullAiAssistant, which reports the feature as not configured.
    |
    */

    'ai' => [
        'enabled' => env('FORMBUILDER_AI', false),
        'provider' => 'anthropic',
        'api_key' => env('ANTHROPIC_API_KEY'),
        'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
        'model' => env('FORMBUILDER_AI_MODEL', 'claude-opus-4-8'),
        'max_tokens' => 8000,
    ],

    /*
    |--------------------------------------------------------------------------
    | Uploads
    |--------------------------------------------------------------------------
    |
    | How uploaded assets (file / image / signature fields) are stored on the
    | public fill-out form. `disk` is any filesystem disk (set FORMBUILDER_DISK=gcs
    | to use the Google Cloud Storage disk defined in config/filesystems.php).
    | `path_prefix` is the top-level folder; the default UploadStore then nests
    | uploads under {prefix}/{tenant_id?}/{form-slug}/. `max_size_kb` caps each
    | file server-side; `accepted_mimes` (null = allow any) is an optional MIME
    | allowlist enforced on upload. Rate-limit the public upload endpoint via
    | `throttle`.
    |
    */

    'uploads' => [
        'disk' => env('FORMBUILDER_DISK', 'public'),
        'path_prefix' => env('FORMBUILDER_UPLOAD_PREFIX', 'formwright'),
        'max_size_kb' => (int) env('FORMBUILDER_UPLOAD_MAX_KB', 10240),
        'accepted_mimes' => null,
        'throttle' => env('FORMBUILDER_UPLOAD_THROTTLE', '30,1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Localization
    |--------------------------------------------------------------------------
    |
    | The locale a freshly-created schema defaults to, and the RTL locales the
    | renderer should flip direction for. Direction is otherwise derived by
    | survey-core's own locale registry.
    |
    */

    'default_locale' => 'default',

    'rtl_locales' => ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'dv'],

    /*
    |--------------------------------------------------------------------------
    | Renderer (survey-core, MIT)
    |--------------------------------------------------------------------------
    |
    | The pinned survey-core version shipped with the builder bundle. Kept here
    | so hosts can audit / align it. The ONLY SurveyJS packages permitted are
    | survey-core and survey-js-ui (both MIT). survey-creator is forbidden.
    |
    */

    'survey_core_version' => '1.12.63',

];
