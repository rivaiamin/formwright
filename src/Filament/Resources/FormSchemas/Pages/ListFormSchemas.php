<?php

namespace Rivaiamin\Formwright\Filament\Resources\FormSchemas\Pages;

use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;
use Rivaiamin\Formwright\Filament\Resources\FormSchemas\FormSchemaResource;

class ListFormSchemas extends ListRecords
{
    protected static string $resource = FormSchemaResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
