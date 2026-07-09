<?php

namespace Rivaiamin\Formwright\Filament\Resources\FormSchemas\Pages;

use Filament\Resources\Pages\CreateRecord;
use Rivaiamin\Formwright\Filament\Pages\DesignerPage;
use Rivaiamin\Formwright\Filament\Resources\FormSchemas\FormSchemaResource;
use Rivaiamin\Formwright\Models\FormSchema;

class CreateFormSchema extends CreateRecord
{
    protected static string $resource = FormSchemaResource::class;

    /**
     * The create form only collects a name; seed a valid blank survey and the
     * locale defaults so the record is immediately editable in the designer.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $name = $data['name'] ?? 'Untitled form';

        $data['json'] = FormSchema::blankSchema($name);
        $data['default_locale'] = config('formbuilder.default_locale', 'default');
        $data['available_locales'] = ['default'];

        return $data;
    }

    protected function getRedirectUrl(): string
    {
        return DesignerPage::getUrl(['record' => $this->getRecord()->getKey()]);
    }
}
