<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create(config('formbuilder.tables.form_submissions', 'form_submissions'), function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_schema_id')
                ->constrained(config('formbuilder.tables.form_schemas', 'form_schemas'))
                ->cascadeOnDelete();
            $table->string('locale')->default('default');
            $table->json('data');
            $table->unsignedInteger('score')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(config('formbuilder.tables.form_submissions', 'form_submissions'));
    }
};
