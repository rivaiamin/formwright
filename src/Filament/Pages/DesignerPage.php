<?php

namespace App\Filament\Pages;

use App\Contracts\AiAssistant;
use App\Support\AiAssistantNotConfiguredException;
use App\Support\SchemaValidationException;
use App\Support\SchemaValidator;
use BackedEnum;
use Throwable;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Illuminate\Database\Eloquent\Model;
use Livewire\Attributes\Renderless;

/**
 * The visual form designer. A full-page Livewire component that mounts the
 * (framework-agnostic) SchemavaDesigner bundle and owns persistence: the JS is
 * stateless about the database and calls back into {@see saveSchema()} /
 * {@see loadSchema()} through `$wire`.
 */
class DesignerPage extends Page
{
    protected string $view = 'filament.pages.designer-page';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Form Designer';

    protected static ?string $title = 'Form Designer';

    /** The FormSchema record currently being edited. */
    public ?int $recordId = null;

    /** @var array<string, mixed> Canonical SurveyJS survey JSON handed to the builder. */
    public array $schema = [];

    /** @var array<int, string> */
    public array $availableLocales = [];

    public string $defaultLocale = 'default';

    public function mount(): void
    {
        $record = $this->resolveRecord();

        $this->recordId = $record->getKey();
        $this->schema = $record->json;
        $this->availableLocales = $record->available_locales ?: ['default'];
        $this->defaultLocale = $record->default_locale;
    }

    /**
     * Return the live schema for the builder. Called by the JS on (re)mount so a
     * Livewire re-render that wiped the DOM can rehydrate without a full reload.
     *
     * @return array<string, mixed>
     */
    #[Renderless]
    public function loadSchema(): array
    {
        return $this->resolveRecord()->json;
    }

    /**
     * Persist a schema coming from the builder. Validates first; a rejected
     * schema is never written. Returns a small result object the JS inspects.
     *
     * @param  array<string, mixed>  $json
     * @return array{ok: bool, errors?: array<int, string>}
     */
    #[Renderless]
    public function saveSchema(array $json): array
    {
        try {
            app(SchemaValidator::class)->validate($json);
        } catch (SchemaValidationException $e) {
            Notification::make()
                ->title('Schema not saved')
                ->body($e->errors[0] ?? 'The schema is invalid.')
                ->danger()
                ->send();

            return ['ok' => false, 'errors' => $e->errors];
        }

        $record = $this->resolveRecord();
        $record->json = $json;
        $record->scoring_enabled = $this->schemaHasScoring($json);
        $record->save();

        $this->schema = $json;

        Notification::make()
            ->title('Saved')
            ->success()
            ->send();

        return ['ok' => true];
    }

    /**
     * Draft a whole survey from a natural-language prompt. Returns a proposal
     * the builder previews before the user applies it — never auto-applied.
     *
     * @return array{ok: bool, schema?: array<string, mixed>, error?: string}
     */
    #[Renderless]
    public function aiDraft(string $prompt): array
    {
        try {
            $schema = app(AiAssistant::class)->draftForm($prompt);

            return ['ok' => true, 'schema' => $schema];
        } catch (AiAssistantNotConfiguredException) {
            return ['ok' => false, 'error' => 'The AI assistant is not configured.'];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Rewrite a single element from a prompt. Returns the proposed element.
     *
     * @param  array<string, mixed>  $element
     * @return array{ok: bool, element?: array<string, mixed>, error?: string}
     */
    #[Renderless]
    public function aiRewrite(array $element, string $prompt): array
    {
        try {
            $rewritten = app(AiAssistant::class)->rewriteField($element, $prompt);

            return ['ok' => true, 'element' => $rewritten];
        } catch (AiAssistantNotConfiguredException) {
            return ['ok' => false, 'error' => 'The AI assistant is not configured.'];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * A schema "has scoring" once any element defines a `correctAnswer`.
     *
     * @param  array<string, mixed>  $json
     */
    protected function schemaHasScoring(array $json): bool
    {
        foreach ($json as $key => $value) {
            if ($key === 'correctAnswer') {
                return true;
            }
            if (is_array($value) && $this->schemaHasScoring($value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get-or-create the schema being designed. For this milestone the page edits
     * a single default form; a later phase wires it to a record chosen from a
     * resource list.
     */
    protected function resolveRecord(): Model
    {
        /** @var class-string<Model> $model */
        $model = config('formbuilder.models.form_schema');

        if ($this->recordId !== null) {
            $record = $model::query()->find($this->recordId);

            if ($record !== null) {
                return $record;
            }
        }

        return $model::query()->first() ?? $model::query()->create([
            'name' => 'My first form',
            'json' => $model::blankSchema('My first form'),
            'default_locale' => config('formbuilder.default_locale', 'default'),
            'available_locales' => ['default'],
        ]);
    }
}
