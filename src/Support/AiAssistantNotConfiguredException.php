<?php

namespace Rivaiamin\Formwright\Support;

use RuntimeException;

class AiAssistantNotConfiguredException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct(
            'No AI assistant is configured. Bind Rivaiamin\Formwright\Contracts\AiAssistant to an implementation to enable AI features.'
        );
    }
}
