<?php

namespace Rivaiamin\Formwright\Support;

use Rivaiamin\Formwright\Contracts\UrlResolver;
use Rivaiamin\Formwright\Models\FormSchema;

/**
 * Default {@see UrlResolver}: the configured public route + Laravel's asset().
 */
class DefaultUrlResolver implements UrlResolver
{
    public function publicFormUrl(FormSchema $schema, ?string $locale = null): string
    {
        return route(
            'formbuilder.forms.show',
            array_filter(['slug' => $schema->slug, 'locale' => $locale]),
        );
    }

    public function assetUrl(string $path): string
    {
        return asset($path);
    }
}
