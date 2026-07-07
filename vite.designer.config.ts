import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// -----------------------------------------------------------------------------
// Standalone build for the Formwright designer bundle.
//
// This is deliberately SEPARATE from the host app's vite.config.ts: the designer
// is a self-mounting IIFE (window.FormwrightDesigner.mount) dropped onto a Filament
// Blade page, not an Inertia entrypoint. Output lands in resources/dist and is
// published to /public by `php artisan filament:assets`.
//
// Build:  npm run build:designer
// -----------------------------------------------------------------------------
export default defineConfig({
    plugins: [svelte()],
    // The designer is a library build, not a site — don't copy the app's web
    // root (public/) into the output. Without this, Vite's default publicDir
    // mirrors all of public/ into dist.
    publicDir: false,
    build: {
        outDir: 'resources/js/builder/dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
            entry: fileURLToPath(new URL('./resources/js/builder/main.ts', import.meta.url)),
            name: 'FormwrightDesigner',
            formats: ['iife'],
            fileName: () => 'formwright-designer.js',
            cssFileName: 'formwright-designer',
        },
        rollupOptions: {
            output: {
                assetFileNames: 'formwright-designer.[ext]',
            },
        },
    },
});
