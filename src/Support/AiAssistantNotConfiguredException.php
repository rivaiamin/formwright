<?php

namespace App\Support;

use RuntimeException;

class AiAssistantNotConfiguredException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct(
            'No AI assistant is configured. Bind App\Contracts\AiAssistant to an implementation to enable AI features.'
        );
    }
}
