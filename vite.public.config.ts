import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// -----------------------------------------------------------------------------
// Standalone build for the PUBLIC form renderer (window.FormwrightForm.mount).
//
// Output goes straight into public/vendor/formwright so a plain Blade view can
// reference it with asset(). Keep `publicDir: false` (see vite.designer.config).
//
// Build:  npm run build:public
// -----------------------------------------------------------------------------
export default defineConfig({
    plugins: [svelte()],
    publicDir: false,
    build: {
        outDir: 'public/vendor/formwright',
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
