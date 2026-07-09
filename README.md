# Formwright

A SurveyJS‑compatible **visual form builder for [Filament](https://filamentphp.com) v5**, built entirely on the MIT‑licensed [`survey-core`](https://surveyjs.io/) runtime — no proprietary `survey-creator` dependency.

Design forms in a drag‑and‑drop designer, render them on public pages, and collect scored submissions. Everything the designer produces is plain SurveyJS JSON, so any field or property Formwright doesn't have a visual editor for is still preserved byte‑for‑byte and rendered by the runtime.

- **21 field types** with per‑type visual editors, multi‑column layouts, and validation
- **Conditional logic**, **quiz scoring**, **triggers & calculated values**
- **Theme editor**, **i18n + RTL**, **translations grid**
- **Templates**, **saved‑block library**, **undo/redo**, **version history**
- **Public fill‑out** with server‑side validation, scoring, and **file/signature uploads** (local disk or Google Cloud Storage)
- **Multi‑tenancy**, an optional **AI assistant** (draft a form or rewrite a field), and a fully **swappable** set of contracts

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [The designer](#the-designer)
- [Features](#features)
- [Public forms & submissions](#public-forms--submissions)
- [File uploads (local & GCS)](#file-uploads-local--gcs)
- [Multi‑tenancy](#multi-tenancy)
- [AI assistant](#ai-assistant)
- [Extensibility (contracts)](#extensibility-contracts)
- [Data model](#data-model)
- [Assets & frontend build](#assets--frontend-build)
- [Licensing note](#licensing-note)
- [License](#license)

---

## Requirements

| Dependency | Version |
| --- | --- |
| PHP | `^8.3` |
| Laravel | `^11 · ^12 · ^13` |
| Filament | `^5.0` |
| `survey-core` / `survey-js-ui` (bundled, MIT) | `1.12.63` |

Google Cloud Storage uploads additionally require [`spatie/laravel-google-cloud-storage`](https://github.com/spatie/laravel-google-cloud-storage) (a `suggest`, not a hard dependency).

---

## Installation

Formwright is distributed from its Git repository. Add it as a VCS repository and require it:

```jsonc
// composer.json
"repositories": [
    { "type": "vcs", "url": "https://github.com/rivaiamin/formwright" }
]
```

```bash
composer require rivaiamin/formwright:^0.1   # or dev-main before the first tag
```

The service provider (`Rivaiamin\Formwright\FormwrightServiceProvider`) is auto‑discovered.

### 1. Register the Filament plugin

Add the plugin to your panel provider:

```php
use Rivaiamin\Formwright\Filament\FormwrightPlugin;

public function panel(Panel $panel): Panel
{
    return $panel
        // ...
        ->plugin(FormwrightPlugin::make());
}
```

This registers the **Forms** resource (list / create / duplicate / delete) and the full‑page **Form Designer**.

### 2. Run the migrations

The package ships three tables (`form_schemas`, `form_submissions`, `form_schema_revisions`); they are auto‑loaded, so a plain migrate is enough:

```bash
php artisan migrate
```

Prefer to own the migration files? Publish them first:

```bash
php artisan vendor:publish --tag=formwright-migrations
```

### 3. Publish the config (optional)

```bash
php artisan vendor:publish --tag=formwright-config
```

### 4. Publish the assets

Both bundles are shipped pre‑compiled — **no Node/npm toolchain required**.

```bash
php artisan filament:assets                          # the admin designer bundle
php artisan vendor:publish --tag=formwright-assets   # the public form renderer → public/vendor/formwright
```

Re‑run these after upgrading the package. See [Assets & frontend build](#assets--frontend-build) for details.

---

## Getting started

### Create a form in the UI

Open the Filament panel → **Forms** → **New form**, give it a name, then click **Design** to open the visual builder. Save, and the form is immediately live at its public URL.

### …or create one programmatically

```php
use Rivaiamin\Formwright\Models\FormSchema;

$form = FormSchema::create([
    'name'             => 'Contact us',
    'json'             => FormSchema::blankSchema('Contact us'),
    'default_locale'   => 'default',
    'available_locales'=> ['default'],
]);

// A unique slug is generated automatically:
$publicUrl = route('formbuilder.forms.show', $form->slug);
```

`json` is canonical SurveyJS survey JSON. `FormSchema::blankSchema()` returns a valid empty single‑page survey to start from.

---

## Configuration

`config/formbuilder.php` (publish with `--tag=formwright-config`). Every value has a sensible default; you only override what you need.

| Key | Description | Default |
| --- | --- | --- |
| `models.*` | Swap in your own `FormSchema` / `FormSubmission` / `FormSchemaRevision` models (e.g. to add relationships). | package models |
| `tables.*` | Table names. | `form_schemas`, … |
| `routes.enabled` | Register the public fill‑out routes. Set `false` if your app renders forms itself. | `true` |
| `routes.prefix` | URL prefix for public routes. | `forms` |
| `routes.middleware` | Middleware for public routes. | `['web']` |
| `tenancy.enabled` | Scope schemas & submissions to the current tenant. | `env('FORMBUILDER_TENANCY', false)` |
| `tenancy.column` | Tenant foreign key on both tables. | `tenant_id` |
| `ai.enabled` | Enable the Claude‑backed AI assistant. | `env('FORMBUILDER_AI', false)` |
| `ai.api_key` | Anthropic API key. | `env('ANTHROPIC_API_KEY')` |
| `ai.model` | Model id. | `claude-opus-4-8` |
| `uploads.disk` | Filesystem disk for uploaded files. Set to `gcs` for Google Cloud Storage. | `env('FORMBUILDER_DISK', 'public')` |
| `uploads.path_prefix` | Top‑level folder for uploads. | `formwright` |
| `uploads.max_size_kb` | Per‑file size cap (server‑side). | `10240` |
| `uploads.accepted_mimes` | Optional MIME allow‑list (`null` = any). | `null` |
| `uploads.throttle` | Rate limit for the public upload endpoint. | `30,1` |
| `default_locale` | Locale a freshly created schema defaults to. | `default` |
| `rtl_locales` | Locales rendered right‑to‑left. | `ar he fa ur ps sd dv` |
| `survey_core_version` | The pinned, audited runtime version. | `1.12.63` |

---

## The designer

The designer is a three‑pane visual builder (palette · canvas · settings) plus a raw **JSON** tab:

- **Palette** — grouped, drag‑to‑canvas or click‑to‑add blocks, with a **saved‑blocks library** (★ a field to reuse it).
- **Canvas** — WYSIWYG cards with live per‑type previews, drag‑to‑reorder (keyboard‑accessible), duplicate/delete, and nested drop zones for panels.
- **Settings** — per‑field, per‑page and per‑form settings grouped into Basics · Options · Logic · Quiz · Appearance · Advanced.
- **Toolbar** — undo/redo (`Ctrl/Cmd+Z`), templates, translations, history, and an AI assistant.

Everything round‑trips through the JSON tab. Unknown element types or properties are locked and preserved untouched.

---

## Features

### Field types (21)

Text (short/long), number, date, single/multiple choice, dropdown, **tagbox**, yes/no, **rating**, **ranking**, **multiple text**, **matrix** (single‑select), **matrix dropdown/dynamic** (typed cells), **panel** & **panel dynamic** (nested canvas), **image**, **image picker**, **file upload**, **signature**, **button group**, **expression** (computed display), colour, and a **statement/HTML** block.

### Field properties

Title, description, default value, `required`, hidden (`visible`), read‑only, placeholder, `titleLocation`/`descriptionLocation`, side‑by‑side layout (`startWithNewLine` + `width`, `minWidth`/`maxWidth`), `defaultValueExpression`, choice value‑chips + paste + "Other", and per‑field localization.

### Validation

A validation repeater per field: `numeric` (min/max), `text` (length), `email`, `regex` (pattern + message), `expression`, `answercount`. Plus form‑level behaviour: `checkErrorsMode`, `questionErrorLocation`, `clearInvisibleValues`, focus behaviour.

### Logic

Show / Hide / Disable via `visibleIf` / `enableIf` (De Morgan‑compiled, round‑trippable), required‑if, a raw‑expression escape hatch, and a dependency map.

### Quiz & scoring

Per‑field `points` + `correctAnswer`, a live preview tally, and **server‑side scoring** on submit.

### Triggers & calculated values

`triggers[]` (`complete`, `setvalue`, `copyvalue`, `runexpression`, `skip`) and named `calculatedValues[]` for text piping and logic — turning static forms into interactive flows.

### Form‑level

Branding/logo, progress bar, question numbering, questions‑per‑page mode, preview‑before‑submit, welcome/start page, table of contents, completion & redirect (`navigateToUrl`, per‑outcome thank‑you HTML), and navigation‑button control.

### Theming

A visual theme editor (presets + accent colour, light/dark palette, corner radius, density, panel‑less mode, font, background colours) written to `schema.theme` and applied identically in preview and on the public form.

### Localization

Editing‑locale switcher, per‑field `{ }` localization popovers, automatic RTL, and a **Translations** grid — every localized string × every locale in one view with per‑locale coverage counts and missing‑cell highlighting.

### Workflow

Undo/redo with keyed coalescing, starter **templates**, a saved‑blocks **library**, form **duplication**, and **version history** (a snapshot per distinct save, restore into the builder as an undoable step).

---

## Public forms & submissions

When `routes.enabled` is `true`, the package registers:

| Method | URI | Name |
| --- | --- | --- |
| `GET` | `forms/{slug}` | `formbuilder.forms.show` |
| `POST` | `forms/{slug}` | `formbuilder.forms.submit` |
| `POST` | `forms/{slug}/uploads` | `formbuilder.forms.upload` |

`GET` renders the form with the runtime; on completion the renderer POSTs the responses as JSON. The server validates required fields, computes the quiz score, and persists a `FormSubmission`. `?locale=` selects the rendered language.

Read submissions through the `SubmissionStore` contract:

```php
use Rivaiamin\Formwright\Contracts\SubmissionStore;

$submissions = app(SubmissionStore::class)->forSchema($form); // newest first
```

---

## File uploads (local & GCS)

`file`, `signature`, and image‑picker uploads are streamed to the configured disk during fill‑out and stored as **URLs** in the submission (never inline base64). Files land under `{path_prefix}/{tenant_id?}/{form-slug}/`.

Local disk (default) needs nothing. For **Google Cloud Storage**:

```bash
composer require spatie/laravel-google-cloud-storage
```

```dotenv
FORMBUILDER_DISK=gcs
GOOGLE_CLOUD_PROJECT_ID=your-project
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket
GOOGLE_CLOUD_KEY_FILE=/absolute/path/to/service-account.json
# optional
GOOGLE_CLOUD_STORAGE_PATH_PREFIX=
GOOGLE_CLOUD_STORAGE_VISIBILITY=public
```

Need a different layout (e.g. real tenant names instead of ids)? Rebind the [`UploadStore`](#extensibility-contracts) contract.

---

## Multi‑tenancy

Off by default. Enable it and both `FormSchema` and `FormSubmission` are automatically scoped to the current tenant (queries filtered, new records stamped):

```dotenv
FORMBUILDER_TENANCY=true
```

The current tenant is resolved from the `RuntimeContext` contract (the active Filament tenant by default), or from a closure you register:

```php
use Rivaiamin\Formwright\Support\Tenancy;

Tenancy::resolveUsing(fn () => auth()->user()?->current_team_id);
```

The `tenant_id` column is nullable and indexed on both tables.

---

## AI assistant

Optional and opt‑in. With it enabled and an API key set, the designer can **draft a whole form** from a natural‑language prompt or **rewrite a single field** — always previewed before it's applied, never auto‑saved.

```dotenv
FORMBUILDER_AI=true
ANTHROPIC_API_KEY=sk-ant-...
FORMBUILDER_AI_MODEL=claude-opus-4-8
```

Without a key it degrades gracefully (the feature reports itself as not configured). Bring your own provider by binding the `AiAssistant` contract.

---

## Extensibility (contracts)

Every integration point is an interface bound to a sensible default in the service provider. Rebind any of them in your own provider to customise behaviour without touching the package:

| Contract | Responsibility | Default |
| --- | --- | --- |
| `SubmissionStore` | Persist & retrieve submissions | Eloquent |
| `UploadStore` | Store an uploaded file, return its URL | disk‑backed |
| `AccessPolicy` | `canView` / `canEdit` / `canSubmit` | public view/submit, auth edit |
| `RuntimeContext` | Current user, tenant, locale | Auth + Filament tenant |
| `UrlResolver` | Public form & asset URLs | named route + `asset()` |
| `AiAssistant` | Draft / rewrite via an LLM | Claude, else a null impl |

```php
// A service provider
use Rivaiamin\Formwright\Contracts\UploadStore;

public function register(): void
{
    $this->app->bind(UploadStore::class, MyUploadStore::class);
}
```

You can also swap the Eloquent models entirely via `config('formbuilder.models')`.

---

## Data model

| Model | Table | Notes |
| --- | --- | --- |
| `FormSchema` | `form_schemas` | `name`, unique `slug`, `json` (survey JSON), locales, `scoring_enabled`. `revisions()` hasMany. |
| `FormSubmission` | `form_submissions` | `form_schema_id`, `locale`, `data` (responses), `score`. `schema()` belongsTo. |
| `FormSchemaRevision` | `form_schema_revisions` | Point‑in‑time `json` snapshots, `author()` (your app's auth model). |

All model classes, table names, and the tenant column are configurable.

---

## Assets & frontend build

Formwright ships **two** self‑mounting bundles, both **pre‑compiled and committed** to the package — a consuming app never needs Node, npm, or a build step:

- **Designer bundle** (`resources/js/builder/dist`) — registered with Filament's asset manager; `php artisan filament:assets` copies it to your web root. Loaded on demand on the Designer page.
- **Public‑form renderer** (`public/formwright-form.{js,css}`) — `php artisan vendor:publish --tag=formwright-assets` copies it to `public/vendor/formwright/`, where the public form Blade view loads it via `asset()`.

Both are IIFE bundles (`window.FormwrightDesigner` / `window.FormwrightForm`) that mount into a container.

**Building from source** (only if you fork/modify the Svelte source) uses the bundled Vite configs:

```bash
npm run build:designer   # → resources/js/builder/dist, then run php artisan filament:assets
npm run build:public     # → public/, then republish with --tag=formwright-assets
```

---

## Licensing note

The **only** SurveyJS packages this library uses are `survey-core` and `survey-js-ui`, both **MIT**. The proprietary `survey-creator` is never installed, imported, or bundled — the entire visual editor is Formwright's own Svelte code. Any property or type without a visual editor survives a JSON round‑trip untouched (preserve‑and‑lock).

## License

MIT © Riva'i Amin
