<script lang="ts">
  // Visual theme picker → a survey-core theme object stored under schema.theme
  // and applied by every renderer (see survey-setup.applyStoredTheme). We write
  // a small, well-known subset of the theme: colour palette, accent, corner
  // radius, density, font and panel-less mode — enough to rebrand a form.
  import type { BuilderStore } from '../store.svelte';

  interface Props {
    store: BuilderStore;
  }

  let { store }: Props = $props();

  const DEFAULT_ACCENT = '#19b394';

  const PRESETS: { label: string; color: string; palette?: 'dark' }[] = [
    { label: 'Teal', color: '#19b394' },
    { label: 'Blue', color: '#2563eb' },
    { label: 'Violet', color: '#7c3aed' },
    { label: 'Amber', color: '#f59e0b' },
    { label: 'Rose', color: '#e11d48' },
    { label: 'Midnight', color: '#38bdf8', palette: 'dark' },
  ];

  let accent = $derived(store.themeVar('--sjs-primary-backcolor') || DEFAULT_ACCENT);
  let palette = $derived(store.themeProp('colorPalette') === 'dark' ? 'dark' : 'light');
  let panelless = $derived(store.themeProp('isPanelless') === true);
  let radius = $derived(store.themeVar('--sjs-corner-radius') || 'default');
  let baseUnit = $derived(store.themeVar('--sjs-base-unit') || 'default');
  let fontFamily = $derived(store.themeVar('--sjs-font-family') || 'default');

  /** Set the accent colour plus its hover/foreground companions. */
  function setAccent(color: string): void {
    store.setThemeVar('--sjs-primary-backcolor', color);
    store.setThemeVar('--sjs-primary-backcolor-dark', color);
    store.setThemeVar('--sjs-primary-forecolor', '#ffffff');
  }

  function applyPreset(p: { color: string; palette?: 'dark' }): void {
    setAccent(p.color);
    store.setThemeProp('colorPalette', p.palette === 'dark' ? 'dark' : '');
  }

  /** A select whose "default" option removes the variable entirely. */
  function pickVar(name: string, value: string): void {
    store.setThemeVar(name, value === 'default' ? '' : value);
  }
</script>

<div class="theme">
  <div class="theme__presets">
    {#each PRESETS as p (p.label)}
      <button
        type="button"
        class="theme__swatch"
        style={`background:${p.color}`}
        title={p.label}
        aria-label={`Apply ${p.label} theme`}
        data-testid={`theme-preset-${p.label.toLowerCase()}`}
        onclick={() => applyPreset(p)}
      ></button>
    {/each}
  </div>

  <div class="theme__grid">
    <div class="field">
      <span class="field__label">Mode</span>
      <div class="theme__seg">
        <button type="button" class:on={palette === 'light'} onclick={() => store.setThemeProp('colorPalette', '')}>Light</button>
        <button type="button" data-testid="theme-dark" class:on={palette === 'dark'} onclick={() => store.setThemeProp('colorPalette', 'dark')}>Dark</button>
      </div>
    </div>

    <div class="field">
      <label class="field__label" for="theme-accent">Accent colour</label>
      <input id="theme-accent" type="color" data-testid="theme-accent" value={accent} oninput={(e) => setAccent(e.currentTarget.value)} />
    </div>

    <div class="field">
      <label class="field__label" for="theme-radius">Corners</label>
      <select id="theme-radius" value={radius} onchange={(e) => pickVar('--sjs-corner-radius', e.currentTarget.value)}>
        <option value="default">Default</option>
        <option value="0px">Sharp</option>
        <option value="8px">Rounded</option>
        <option value="20px">Pill</option>
      </select>
    </div>

    <div class="field">
      <label class="field__label" for="theme-density">Density</label>
      <select id="theme-density" value={baseUnit} onchange={(e) => pickVar('--sjs-base-unit', e.currentTarget.value)}>
        <option value="default">Comfortable</option>
        <option value="6px">Compact</option>
        <option value="10px">Spacious</option>
      </select>
    </div>

    <div class="field">
      <label class="field__label" for="theme-font">Font</label>
      <select id="theme-font" value={fontFamily} onchange={(e) => pickVar('--sjs-font-family', e.currentTarget.value)}>
        <option value="default">System</option>
        <option value="Georgia, 'Times New Roman', serif">Serif</option>
        <option value="ui-monospace, 'Courier New', monospace">Monospace</option>
      </select>
    </div>
  </div>

  <label class="field__check">
    <input type="checkbox" data-testid="theme-panelless" checked={panelless} onchange={(e) => store.setThemeProp('isPanelless', e.currentTarget.checked ? true : '')} />
    Panel-less (no card around questions)
  </label>

  <button type="button" class="theme__reset" data-testid="theme-reset" onclick={() => store.resetTheme()}>Reset to default theme</button>
</div>

<style>
  .theme {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .theme__presets {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .theme__swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, currentColor 20%, transparent);
    cursor: pointer;
    padding: 0;
  }
  .theme__swatch:hover {
    transform: scale(1.08);
  }
  .theme__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field__label {
    font-size: 0.75rem;
    opacity: 0.75;
  }
  .field__check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
  }
  .theme__seg {
    display: flex;
    gap: 0.25rem;
  }
  .theme__seg button {
    flex: 1;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.35rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .theme__seg button.on {
    background: #f59e0b;
    border-color: #f59e0b;
    color: #1c1917;
    font-weight: 600;
  }
  .theme :global(select) {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border-radius: 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    color: inherit;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .theme :global(input[type='color']) {
    width: 100%;
    height: 2.1rem;
    padding: 0.15rem;
    border-radius: 0.45rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
    cursor: pointer;
  }
  .theme__reset {
    align-self: start;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: transparent;
    color: inherit;
    border-radius: 0.4rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
  }
</style>
