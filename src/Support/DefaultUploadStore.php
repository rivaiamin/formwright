<?php

namespace App\Support;

use App\Contracts\UploadStore;
use App\Models\FormSchema;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Default {@see UploadStore}: writes uploads to the configured filesystem disk
 * under {prefix}/{tenant_id?}/{form-slug}/{uuid}-{filename} and returns the
 * disk URL. Set FORMBUILDER_DISK=gcs to store in Google Cloud Storage.
 */
class DefaultUploadStore implements UploadStore
{
    public function store(FormSchema $schema, UploadedFile $file): array
    {
        $disk = config('formbuilder.uploads.disk', 'public');

        $name = $this->sanitizeName($file->getClientOriginalName());
        $filename = Str::uuid()->toString().'-'.$name;

        $path = $file->storeAs($this->directory($schema), $filename, ['disk' => $disk]);

        return [
            'name' => $name,
            'url' => Storage::disk($disk)->url($path),
            'path' => $path,
        ];
    }

    /**
     * The folder an upload lands in. Nested by tenant (when the schema carries a
     * tenant_id) then form slug, under the configured prefix.
     */
    protected function directory(FormSchema $schema): string
    {
        $segments = array_filter([
            trim((string) config('formbuilder.uploads.path_prefix', 'formwright'), '/'),
            $schema->tenant_id !== null ? 'tenant-'.$schema->tenant_id : null,
            $schema->slug,
        ], fn (?string $segment): bool => $segment !== null && $segment !== '');

        return implode('/', $segments);
    }

    /**
     * Strip directory components and unsafe characters from the client filename.
     */
    protected function sanitizeName(string $original): string
    {
        $base = basename(str_replace('\\', '/', $original));
        $extension = pathinfo($base, PATHINFO_EXTENSION);
        $name = Str::slug(pathinfo($base, PATHINFO_FILENAME)) ?: 'file';

        return $extension !== '' ? $name.'.'.Str::lower($extension) : $name;
    }
}
