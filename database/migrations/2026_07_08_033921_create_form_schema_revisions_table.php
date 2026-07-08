<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A point-in-time snapshot of a form's JSON, written on every successful save so
 * an author can review and restore an earlier version.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create(config('formbuilder.tables.form_schema_revisions', 'form_schema_revisions'), function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_schema_id')
                ->constrained(config('formbuilder.tables.form_schemas', 'form_schemas'))
                ->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->json('json');
            $table->timestamps();

            $table->index(['form_schema_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(config('formbuilder.tables.form_schema_revisions', 'form_schema_revisions'));
    }
};
