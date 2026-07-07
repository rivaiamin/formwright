<?php

namespace App\Support;

use RuntimeException;

class SchemaValidationException extends RuntimeException
{
    /**
     * @param  array<int, string>  $errors
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Invalid SurveyJS schema: '.implode('; ', $errors));
    }
}
