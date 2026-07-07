<?php

namespace App\Contracts;

use App\Models\FormSchema;

/**
 * Builds the URLs the package needs, so a host can host forms under its own
 * domain/path scheme. Bound to {@see \App\Support\DefaultUrlResolver} (named
 * route + asset()). Rebind to customise:
 *
 *     $this->app->bind(UrlResolver::class, MyUrlResolver::class);
 */
interface UrlResolver
{
    /**
     * The public fill-out URL for a schema, optionally for a given locale.
     */
    public function publicFormUrl(FormSchema $schema, ?string $locale = null): string;

    /**
     * Resolve a bundled asset path to a URL.
     */
    public function assetUrl(string $path): string;
}
