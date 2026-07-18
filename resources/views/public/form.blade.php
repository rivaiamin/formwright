<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ data_get($schema->json, 'title.default', $schema->name) }}</title>
    <link rel="stylesheet" href="{{ asset('vendor/formwright/formwright-form.css') }}">
    <style>
        body { margin: 0; background: #f3f4f6; font-family: ui-sans-serif, system-ui, sans-serif; }
        .formwright-shell { max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem; }
        [data-testid="submit-status"] { text-align: center; color: #16a34a; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="formwright-shell">
        <div id="formwright-form"></div>
        <p data-testid="submit-status"></p>
    </div>

    <script>
        window.__FORMWRIGHT_FORM__ = {
            schema: @json($schema->json),
            locale: @json($locale),
            submitUrl: @json($submitUrl),
            uploadUrl: @json($uploadUrl),
            dataSourceUrl: @json($dataSourceUrl),
            csrf: document.querySelector('meta[name=csrf-token]').getAttribute('content'),
        };
    </script>
    <script src="{{ asset('vendor/formwright/formwright-form.js') }}"></script>
    <script>
        window.FormwrightForm.mount(document.getElementById('formwright-form'), window.__FORMWRIGHT_FORM__);
    </script>
</body>
</html>
