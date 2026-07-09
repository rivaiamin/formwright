<?php

namespace Rivaiamin\Formwright\Filament\Resources\FormSchemas\Pages;

use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;
use Rivaiamin\Formwright\Filament\Resources\FormSchemas\FormSchemaResource;

class EditFormSchema extends EditRecord
{
    protected static string $resource = FormSchemaResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
