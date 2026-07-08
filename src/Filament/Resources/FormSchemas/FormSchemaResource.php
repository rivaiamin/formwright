<?php

namespace App\Filament\Resources\FormSchemas;

use App\Filament\Pages\DesignerPage;
use App\Filament\Resources\FormSchemas\Pages\CreateFormSchema;
use App\Filament\Resources\FormSchemas\Pages\EditFormSchema;
use App\Filament\Resources\FormSchemas\Pages\ListFormSchemas;
use App\Models\FormSchema;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ReplicateAction;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class FormSchemaResource extends Resource
{
    protected static ?string $model = FormSchema::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $navigationLabel = 'Forms';

    protected static ?int $navigationSort = 1;

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('name')
            ->defaultSort('updated_at', 'desc')
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('fields')
                    ->label('Fields')
                    ->state(fn (FormSchema $record): int => static::countFields($record->json))
                    ->badge(),
                TextColumn::make('default_locale')
                    ->label('Locale')
                    ->badge(),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->since()
                    ->sortable(),
            ])
            ->recordActions([
                Action::make('design')
                    ->label('Design')
                    ->icon(Heroicon::PencilSquare)
                    ->url(fn (FormSchema $record): string => DesignerPage::getUrl(['record' => $record->getKey()])),
                ReplicateAction::make()
                    ->label('Duplicate')
                    ->icon(Heroicon::DocumentDuplicate)
                    ->excludeAttributes(['slug'])
                    ->beforeReplicaSaved(function (FormSchema $replica): void {
                        $replica->name = Str::limit($replica->name, 240, '').' (copy)';
                    })
                    ->successRedirectUrl(fn (FormSchema $replica): string => DesignerPage::getUrl(['record' => $replica->getKey()])),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    /**
     * Count the leaf question elements in a survey JSON, recursing into panels
     * and pages so the table reflects the real field total.
     *
     * @param  array<string, mixed>  $json
     */
    protected static function countFields(array $json): int
    {
        $count = 0;

        foreach (($json['pages'] ?? []) as $page) {
            $count += static::countElements($page['elements'] ?? []);
        }

        return $count;
    }

    /**
     * @param  array<int, array<string, mixed>>  $elements
     */
    protected static function countElements(array $elements): int
    {
        $count = 0;

        foreach ($elements as $element) {
            if (isset($element['elements']) && is_array($element['elements'])) {
                $count += static::countElements($element['elements']);

                continue;
            }

            $count++;
        }

        return $count;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListFormSchemas::route('/'),
            'create' => CreateFormSchema::route('/create'),
            'edit' => EditFormSchema::route('/{record}/edit'),
        ];
    }
}
