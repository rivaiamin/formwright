<?php

namespace App\Contracts;

use App\Models\FormSchema;
use Illuminate\Http\UploadedFile;

/**
 * Stores a file uploaded from a public form (file / image / signature fields)
 * onto a filesystem disk and returns the stored location. Bound to a default
 * disk-backed implementation in the service provider; a host app may rebind it
 * to change the folder layout (e.g. to key uploads by a real tenant name) or to
 * push to an entirely different store without touching the package.
 */
interface UploadStore
{
    /**
     * Persist an uploaded file for a schema and return its stored reference.
     *
     * @return array{name: string, url: string, path: string}
     */
    public function store(FormSchema $schema, UploadedFile $file): array;
}
