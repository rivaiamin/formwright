import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// -----------------------------------------------------------------------------
// Standalone build for the PUBLIC form renderer (window.FormwrightForm.mount).
//
// Output lands in the package's own `public/` dir and is COMMITTED, so a third
// party who `composer require`s the package gets a ready-to-serve bundle and
// publishes it to their web root with:
//   php artisan vendor:publish --tag=formwright-assets
// (the host app's `npm run build:public` re-runs that publish automatically).
// Keep `publicDir: false` (see vite.designer.config).
//
// Build:  npm run build:public
// -----------------------------------------------------------------------------
export default defineConfig({
    plugins: [svelte()],
    publicDir: false,
    build: {
        // Package-relative so the committed bundle lands inside the package
        // regardless of the cwd the build is invoked from.
        outDir: fileURLToPath(new URL('./public', import.meta.url)),
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
            entry: fileURLToPath(new URL('./resources/js/public/main.ts', import.meta.url)),
            name: 'FormwrightForm',
            formats: ['iife'],
            fileName: () => 'formwright-form.js',
            cssFileName: 'formwright-form',
        },
    },
});
