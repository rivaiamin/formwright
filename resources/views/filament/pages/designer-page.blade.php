<x-filament-panels::page>
    {{--
        The builder is a self-contained bundle that manages its own DOM. We wrap
        it in `wire:ignore` so Livewire re-renders never wipe the mount node, and
        boot it once the `window.FormwrightDesigner` global is available. The JS is
        stateless about persistence: `onSave` calls back into this Livewire
        component via `$wire`.
    --}}
    <div
        wire:ignore
        x-data="{
            booted: false,
            boot() {
                if (this.booted) {
                    return;
                }

                if (! window.FormwrightDesigner) {
                    setTimeout(() => this.boot(), 30);
                    return;
                }

                this.booted = true;

                window.FormwrightDesigner.mount(this.$refs.root, {
                    schema: @js($schema),
                    locales: @js($availableLocales),
                    defaultLocale: @js($defaultLocale),
                    onSave: (json) => this.$wire.saveSchema(json),
                    onDirty: (dirty) => this.$dispatch('formwright-dirty', { dirty }),
                    reload: () => this.$wire.loadSchema(),
                    onAiDraft: (prompt) => this.$wire.aiDraft(prompt),
                });
            },
        }"
        x-init="boot()"
        x-load-css="[@js(\Filament\Support\Facades\FilamentAsset::getStyleHref('formwright-designer'))]"
        x-load-js="[@js(\Filament\Support\Facades\FilamentAsset::getScriptSrc('formwright-designer'))]"
    >
        <div x-ref="root" id="formwright-designer" class="min-h-[70vh]"></div>
    </div>
</x-filament-panels::page>
