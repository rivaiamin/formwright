<?php

namespace Rivaiamin\Formwright;

use Filament\Support\Assets\Css;
use Filament\Support\Assets\Js;
use Filament\Support\Facades\FilamentAsset;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Rivaiamin\Formwright\Contracts\AccessPolicy;
use Rivaiamin\Formwright\Contracts\AiAssistant;
use Rivaiamin\Formwright\Contracts\RuntimeContext;
use Rivaiamin\Formwright\Contracts\SubmissionStore;
use Rivaiamin\Formwright\Contracts\UploadStore;
use Rivaiamin\Formwright\Contracts\UrlResolver;
use Rivaiamin\Formwright\Http\Controllers\PublicFormController;
use Rivaiamin\Formwright\Support\ClaudeAiAssistant;
use Rivaiamin\Formwright\Support\DefaultAccessPolicy;
use Rivaiamin\Formwright\Support\DefaultRuntimeContext;
use Rivaiamin\Formwright\Support\DefaultUploadStore;
use Rivaiamin\Formwright\Support\DefaultUrlResolver;
use Rivaiamin\Formwright\Support\EloquentSubmissionStore;
use Rivaiamin\Formwright\Support\NullAiAssistant;

class FormwrightServiceProvider extends ServiceProvider
{
    /**
     * Register the package's config defaults and extensibility contracts. Each
     * contract is bound to a sensible default a host app may override in its own
     * service provider.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/formbuilder.php', 'formbuilder');

        $this->app->bind(SubmissionStore::class, EloquentSubmissionStore::class);
        $this->app->bind(RuntimeContext::class, DefaultRuntimeContext::class);
        $this->app->bind(AccessPolicy::class, DefaultAccessPolicy::class);
        $this->app->bind(AiAssistant::class, function ($app) {
            $ai = config('formbuilder.ai');

            return ($ai['enabled'] ?? false) && filled($ai['api_key'] ?? null)
                ? $app->make(ClaudeAiAssistant::class)
                : $app->make(NullAiAssistant::class);
        });
        $this->app->bind(UrlResolver::class, DefaultUrlResolver::class);
        $this->app->bind(UploadStore::class, DefaultUploadStore::class);
    }

    /**
     * Bootstrap migrations, views, public routes, builder assets, and the
     * publishable resources a host app can vendor:publish.
     */
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'formwright');

        $this->registerPublicRoutes();
        $this->registerDesignerAssets();
        $this->registerPublishing();
    }

    /**
     * Register the public fill-out routes, config-driven so a host can change the
     * prefix/middleware or disable them entirely.
     */
    protected function registerPublicRoutes(): void
    {
        if (! config('formbuilder.routes.enabled', true)) {
            return;
        }

        Route::middleware(config('formbuilder.routes.middleware', ['web']))
            ->prefix(config('formbuilder.routes.prefix', 'forms'))
            ->group(function (): void {
                Route::get('/{slug}', [PublicFormController::class, 'show'])->name('formbuilder.forms.show');
                Route::post('/{slug}', [PublicFormController::class, 'submit'])->name('formbuilder.forms.submit');
                Route::post('/{slug}/uploads', [PublicFormController::class, 'upload'])
                    ->middleware('throttle:'.config('formbuilder.uploads.throttle', '30,1'))
                    ->name('formbuilder.forms.upload');
            });
    }

    /**
     * Register the compiled SurveyJS-compatible builder bundle with Filament's
     * asset manager. `php artisan filament:assets` publishes these into /public;
     * they are loaded on demand by the Designer page via `x-load-js`/`x-load-css`.
     */
    protected function registerDesignerAssets(): void
    {
        FilamentAsset::register([
            Js::make('formwright-designer', __DIR__.'/../resources/js/builder/dist/formwright-designer.js')
                ->loadedOnRequest(),
            Css::make('formwright-designer', __DIR__.'/../resources/js/builder/dist/formwright-designer.css')
                ->loadedOnRequest(),
        ]);
    }

    /**
     * Expose the config, database migrations, and the compiled public-form bundle
     * so a host application can publish and customise them.
     */
    protected function registerPublishing(): void
    {
        if (! $this->app->runningInConsole()) {
            return;
        }

        $this->publishes([
            __DIR__.'/../config/formbuilder.php' => config_path('formbuilder.php'),
        ], 'formwright-config');

        $this->publishes([
            __DIR__.'/../database/migrations' => database_path('migrations'),
        ], 'formwright-migrations');

        $this->publishes([
            __DIR__.'/../public' => public_path('vendor/formwright'),
        ], 'formwright-assets');
    }
}
