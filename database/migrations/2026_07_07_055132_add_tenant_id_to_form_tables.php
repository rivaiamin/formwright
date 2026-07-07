<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The tables to add the tenant column to, and the column name — both
     * config-driven so a host can match its own conventions.
     *
     * @return array<int, string>
     */
    protected function tables(): array
    {
        return [
            config('formbuilder.tables.form_schemas', 'form_schemas'),
            config('formbuilder.tables.form_submissions', 'form_submissions'),
        ];
    }

    protected function column(): string
    {
        return config('formbuilder.tenancy.column', 'tenant_id');
    }

    public function up(): void
    {
        $column = $this->column();

        foreach ($this->tables() as $table) {
            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->unsignedBigInteger($column)->nullable()->index()->after('id');
            });
        }
    }

    public function down(): void
    {
        $column = $this->column();

        foreach ($this->tables() as $table) {
            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->dropColumn($column);
            });
        }
    }
};
