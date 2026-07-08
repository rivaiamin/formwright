<script lang="ts">
  // Small inline SVG icon set for the palette / cards. Original minimal glyphs
  // (stroke, currentColor) keyed by the icon names used in the type-registry.
  interface Props {
    name: string;
    size?: number;
  }

  let { name, size = 16 }: Props = $props();

  const PATHS: Record<string, string> = {
    'text-cursor': 'M4 9h16M4 15h9',
    'align-left': 'M4 7h16M4 12h16M4 17h10',
    hashtag: 'M9 4 7 20M17 4l-2 16M5 9h15M3 15h15',
    calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
    'circle-dot': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'check-square': 'M4 5h16v16H4zM8 12l3 3 5-6',
    'chevron-down': 'M6 9l6 6 6-6',
    'toggle-left': 'M8 7h8a5 5 0 0 1 0 10H8a5 5 0 0 1 0-10zM8 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    star: 'M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9 9z',
    quote: 'M5 5h14v10H10l-4 4v-4H5zM8 9h2M8 12h5',
    image: 'M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6M9 9a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 9 9z',
    upload: 'M12 15V4M8 8l4-4 4 4M5 15v4h14v-4',
    'pen-tool': 'M4 20s3-1 7-5l5-5-2-2-5 5c-4 4-5 7-5 7zM14 6l4 4',
    ranking: 'M9 6h11M9 12h11M9 18h11M4 5v4M4 5H3M4 9H3M5 9H3M4 13l-1 3h2l-1 2',
    tags: 'M3 12l7-7h6l2 2v6l-7 7zM15 8h.01',
    multitext: 'M4 6h16M4 12h16M4 18h10M4 6v12',
    matrix: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16',
    sigma: 'M18 5H7l6 7-6 7h11',
    'image-picker': 'M3 4h8v8H3zM13 4h8v8h-8zM3 14h8v6H3zM13 14h8v6h-8zM15.5 16.5h3',
    buttons: 'M3 8h7v8H3zM14 8h7v8h-7z',
    panel: 'M4 4h16v16H4zM4 9h16M7 13h10M7 16h6',
    'panel-repeat': 'M6 3h12v7H6zM6 14h12v7H6zM3 12h18M8 12l-2-2M16 12l2 2',
    'matrix-cells': 'M4 4h16v16H4zM4 10h16M4 15h16M12 4v16M14 12l1.5 1.5L18 11',
    'matrix-rows': 'M4 5h16v5H4zM4 12h16v5H4zM9 20h6M12 18v4',
  };

  let d = $derived(PATHS[name] ?? 'M5 5h14v14H5z');
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={d} />
</svg>
