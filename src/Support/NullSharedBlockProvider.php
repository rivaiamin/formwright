<?php

namespace Rivaiamin\Formwright\Support;

use Rivaiamin\Formwright\Contracts\SharedBlockProvider;

/**
 * Default {@see SharedBlockProvider}: no shared library. The designer simply omits the
 * "Question library" section until a host binds its own provider.
 */
class NullSharedBlockProvider implements SharedBlockProvider
{
    public function blocks(): array
    {
        return [];
    }
}
