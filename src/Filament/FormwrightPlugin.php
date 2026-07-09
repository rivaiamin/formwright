<?php

namespace Rivaiamin\Formwright\Filament;

use Filament\Contracts\Plugin;
use Filament\Panel;
use Rivaiamin\Formwright\Filament\Pages\DesignerPage;
use Rivaiamin\Formwright\Filament\Resources\FormSchemas\FormSchemaResource;

/**
 * Registers the Formwright form builder (Forms resource + visual Designer page)
 * with a Filament panel. Add `->plugin(FormwrightPlugin::make())` in your
 * PanelProvider.
 */
class FormwrightPlugin implements Plugin
{
    public function getId(): string
    {
        return 'formwright';
    }

    public function register(Panel $panel): void
    {
        $panel
            ->resources([
                FormSchemaResource::class,
            ])
            ->pages([
                DesignerPage::class,
            ]);
    }

    public function boot(Panel $panel): void
    {
        //
    }

    public static function make(): static
    {
        return app(static::class);
    }
}
