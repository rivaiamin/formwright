// =============================================================================
// type-registry.ts  —  Phase 3a
// Single source of truth for the visual builder's blocks.
// Palette, canvas, property panel, and import/export all read from here.
//
// RULE: adding a new supported field type = adding ONE entry to `registry`.
// RULE: if resolveBlock() returns null, the element is UNKNOWN → preserve &
//       lock it (never rewrite it). This is how we honor "never corrupt a
//       schema we don't fully understand".
// =============================================================================

// ---- Core schema types ------------------------------------------------------

/** SurveyJS strings are either a plain string or a localized map. */
export type LocalizedString = string | ({ default: string } & Record<string, string>);

/** A choice item in radiogroup/checkbox/dropdown. */
export interface Choice {
  value: string;
  text?: LocalizedString;
}

/**
 * A SurveyJS element. Modeled loosely on purpose: we type the props we edit
 * and let everything else ride along untouched so unknown props survive a
 * round-trip. This index signature is what makes preserve-and-lock possible.
 */
export interface SurveyElement {
  type: string;
  name: string;
  title?: LocalizedString;
  description?: LocalizedString;
  isRequired?: boolean;
  visibleIf?: string;
  enableIf?: string;
  requiredIf?: string;
  choices?: Choice[];
  inputType?: string;
  [key: string]: unknown; // preserve anything we don't model
}

// ---- Property panel descriptors --------------------------------------------

export type PropertyKind =
  | 'name'          // the unique identifier; panel must enforce uniqueness + rename refs
  | 'localizedText' // single-line, writes into the current editing locale
  | 'localizedHtml' // multi-line rich/plain body, localized
  | 'text'          // plain (non-localized) string
  | 'boolean'
  | 'number'
  | 'select'        // fixed option list
  | 'choices';      // the choices[] editor

export interface PropertyDescriptor {
  /** Dot-path on the element, e.g. 'title', 'rateMax', 'inputType'. */
  key: string;
  label: string;
  kind: PropertyKind;
  /** For kind === 'select'. */
  options?: { value: string; label: string }[];
  default?: unknown;
  /** Hide behind an "Advanced" disclosure in the panel. */
  advanced?: boolean;
  /**
   * If true, this control writes into the {default, <locale>} object for the
   * builder's *current editing locale* (Phase 5). Otherwise writes a raw value.
   */
  appliesToLocale?: boolean;
}

// ---- Block definition -------------------------------------------------------

export interface BlockDefinition {
  /** Palette identity. NOT necessarily the SurveyJS type (see number/date). */
  id: string;
  label: string;
  /** Icon key resolved by your icon component. */
  icon: string;
  /** The value written to element.type in the JSON. */
  surveyType: string;
  /** Build default JSON for a fresh instance. `name` is injected by the caller. */
  factory: (name: string) => SurveyElement;
  /** Drives the property panel, in display order. */
  properties: PropertyDescriptor[];
  /**
   * Recognize whether an arbitrary imported element maps to THIS block.
   * Must be specific enough that only one block matches a given element.
   */
  matches: (el: SurveyElement) => boolean;
}

// ---- Shared property helpers (keep the registry DRY) ------------------------

const NAME_PROP: PropertyDescriptor = {
  key: 'name',
  label: 'Field name (identifier)',
  kind: 'name',
};

/** Title + description + required — shared by most input types. */
function commonProps(): PropertyDescriptor[] {
  return [
    NAME_PROP,
    { key: 'title', label: 'Label', kind: 'localizedText', appliesToLocale: true },
    { key: 'description', label: 'Help text', kind: 'localizedText', appliesToLocale: true, advanced: true },
    { key: 'isRequired', label: 'Required', kind: 'boolean', default: false },
  ];
}

const choicesProp: PropertyDescriptor = { key: 'choices', label: 'Options', kind: 'choices' };

/** The shared options offered inside a matrixdropdown's select-style cells. */
const cellChoicesProp: PropertyDescriptor = { key: 'choices', label: 'Cell options', kind: 'choices' };

// ---- The registry -----------------------------------------------------------
// Order is defensive (specific → general); matches() are specific enough that
// order is not strictly required, but keep number/date before plain text anyway.

export const registry: BlockDefinition[] = [
  // 1. Number (text + inputType:number) — MUST precede plain text
  {
    id: 'number',
    label: 'Number',
    icon: 'hashtag',
    surveyType: 'text',
    factory: (name) => ({ type: 'text', name, inputType: 'number' }),
    properties: [
      ...commonProps(),
      { key: 'min', label: 'Minimum', kind: 'number', advanced: true },
      { key: 'max', label: 'Maximum', kind: 'number', advanced: true },
      { key: 'step', label: 'Step', kind: 'number', advanced: true },
    ],
    matches: (el) => el.type === 'text' && el.inputType === 'number',
  },

  // 2. Date (text + inputType:date) — MUST precede plain text
  {
    id: 'date',
    label: 'Date',
    icon: 'calendar',
    surveyType: 'text',
    factory: (name) => ({ type: 'text', name, inputType: 'date' }),
    properties: [
      ...commonProps(),
      { key: 'min', label: 'Earliest date', kind: 'text', advanced: true },
      { key: 'max', label: 'Latest date', kind: 'text', advanced: true },
    ],
    matches: (el) => el.type === 'text' && el.inputType === 'date',
  },

  // 3. Color (text + inputType:color) — native swatch; MUST precede plain text.
  // survey-core has no `color` question type, but `text` with inputType:color
  // renders a native <input type="color">, so this round-trips and renders.
  {
    id: 'color',
    label: 'Color',
    icon: 'droplet',
    surveyType: 'text',
    factory: (name) => ({ type: 'text', name, inputType: 'color' }),
    properties: [
      ...commonProps(),
    ],
    matches: (el) => el.type === 'text' && el.inputType === 'color',
  },

  // 4. Short answer (plain text) — excludes any inputType so it won't swallow #/date
  {
    id: 'short_text',
    label: 'Short answer',
    icon: 'text-cursor',
    surveyType: 'text',
    factory: (name) => ({ type: 'text', name }),
    properties: [
      ...commonProps(),
      { key: 'placeholder', label: 'Placeholder', kind: 'localizedText', appliesToLocale: true, advanced: true },
      { key: 'maxLength', label: 'Max length', kind: 'number', advanced: true },
    ],
    matches: (el) => el.type === 'text' && !el.inputType,
  },

  // 4. Long answer
  {
    id: 'long_text',
    label: 'Long answer',
    icon: 'align-left',
    surveyType: 'comment',
    factory: (name) => ({ type: 'comment', name }),
    properties: [
      ...commonProps(),
      { key: 'rows', label: 'Rows', kind: 'number', default: 4, advanced: true },
      { key: 'maxLength', label: 'Max length', kind: 'number', advanced: true },
    ],
    matches: (el) => el.type === 'comment',
  },

  // 5. Single choice
  {
    id: 'single_choice',
    label: 'Single choice',
    icon: 'circle-dot',
    surveyType: 'radiogroup',
    factory: (name) => ({ type: 'radiogroup', name, choices: [] }),
    properties: [...commonProps(), choicesProp],
    matches: (el) => el.type === 'radiogroup',
  },

  // 6. Multiple choice
  {
    id: 'multiple_choice',
    label: 'Multiple choice',
    icon: 'check-square',
    surveyType: 'checkbox',
    factory: (name) => ({ type: 'checkbox', name, choices: [] }),
    properties: [...commonProps(), choicesProp],
    matches: (el) => el.type === 'checkbox',
  },

  // 7. Dropdown
  {
    id: 'dropdown',
    label: 'Dropdown',
    icon: 'chevron-down',
    surveyType: 'dropdown',
    factory: (name) => ({ type: 'dropdown', name, choices: [] }),
    properties: [
      ...commonProps(),
      choicesProp,
      { key: 'placeholder', label: 'Placeholder', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'dropdown',
  },

  // 8. Yes / No
  {
    id: 'boolean',
    label: 'Yes / No',
    icon: 'toggle-left',
    surveyType: 'boolean',
    factory: (name) => ({ type: 'boolean', name }),
    properties: [
      ...commonProps(),
      { key: 'labelTrue', label: '"Yes" label', kind: 'localizedText', appliesToLocale: true, advanced: true },
      { key: 'labelFalse', label: '"No" label', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'boolean',
  },

  // 9. Rating
  {
    id: 'rating',
    label: 'Rating',
    icon: 'star',
    surveyType: 'rating',
    factory: (name) => ({ type: 'rating', name, rateMax: 5 }),
    properties: [
      ...commonProps(),
      { key: 'rateMax', label: 'Max rating', kind: 'number', default: 5 },
      {
        key: 'rateType', label: 'Style', kind: 'select', advanced: true,
        options: [
          { value: 'labels', label: 'Numbers' },
          { value: 'stars', label: 'Stars' },
          { value: 'smileys', label: 'Smileys' },
        ],
      },
    ],
    matches: (el) => el.type === 'rating',
  },

  // 10. Statement (display-only HTML) — no title/required
  {
    id: 'statement',
    label: 'Statement',
    icon: 'quote',
    surveyType: 'html',
    factory: (name) => ({ type: 'html', name, html: { default: '' } }),
    properties: [
      NAME_PROP,
      { key: 'html', label: 'Content', kind: 'localizedHtml', appliesToLocale: true },
    ],
    matches: (el) => el.type === 'html',
  },

  // 11. Image (display-only)
  {
    id: 'image',
    label: 'Image',
    icon: 'image',
    surveyType: 'image',
    factory: (name) => ({ type: 'image', name, imageLink: '' }),
    properties: [
      NAME_PROP,
      { key: 'imageLink', label: 'Image URL', kind: 'text' },
      { key: 'altText', label: 'Alt text', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'image',
  },

  // 12. File upload
  {
    id: 'file',
    label: 'File upload',
    icon: 'upload',
    surveyType: 'file',
    factory: (name) => ({ type: 'file', name }),
    properties: [
      ...commonProps(),
      { key: 'acceptedTypes', label: 'Accepted types', kind: 'text', advanced: true },
      { key: 'maxSize', label: 'Max size (bytes)', kind: 'number', advanced: true },
      { key: 'allowMultiple', label: 'Allow multiple files', kind: 'boolean', advanced: true },
    ],
    matches: (el) => el.type === 'file',
  },

  // 13. Signature
  {
    id: 'signature',
    label: 'Signature',
    icon: 'pen-tool',
    surveyType: 'signaturepad',
    factory: (name) => ({ type: 'signaturepad', name }),
    properties: [
      ...commonProps(),
      { key: 'penColor', label: 'Pen color', kind: 'text', advanced: true },
    ],
    matches: (el) => el.type === 'signaturepad',
  },

  // 14. Ranking (ordered choices)
  {
    id: 'ranking',
    label: 'Ranking',
    icon: 'ranking',
    surveyType: 'ranking',
    factory: (name) => ({ type: 'ranking', name, choices: [] }),
    properties: [...commonProps(), choicesProp],
    matches: (el) => el.type === 'ranking',
  },

  // 15. Tag box (multi-select dropdown)
  {
    id: 'tagbox',
    label: 'Multi-select',
    icon: 'tags',
    surveyType: 'tagbox',
    factory: (name) => ({ type: 'tagbox', name, choices: [] }),
    properties: [
      ...commonProps(),
      choicesProp,
      { key: 'placeholder', label: 'Placeholder', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'tagbox',
  },

  // 16. Multiple text (a group of labelled single-line inputs)
  {
    id: 'multiple_text',
    label: 'Multiple text',
    icon: 'multitext',
    surveyType: 'multipletext',
    factory: (name) => ({
      type: 'multipletext',
      name,
      items: [{ name: 'item1', title: { default: 'Item 1' } }],
    }),
    properties: [...commonProps()],
    matches: (el) => el.type === 'multipletext',
  },

  // 17. Matrix (single-select grid: rows × columns)
  {
    id: 'matrix',
    label: 'Matrix',
    icon: 'matrix',
    surveyType: 'matrix',
    factory: (name) => ({
      type: 'matrix',
      name,
      columns: [
        { value: 'col1', text: { default: 'Column 1' } },
        { value: 'col2', text: { default: 'Column 2' } },
      ],
      rows: [
        { value: 'row1', text: { default: 'Row 1' } },
        { value: 'row2', text: { default: 'Row 2' } },
      ],
    }),
    properties: [...commonProps()],
    matches: (el) => el.type === 'matrix',
  },

  // 18. Panel — a titled group of fields (children live in `elements`)
  {
    id: 'panel',
    label: 'Panel (group)',
    icon: 'panel',
    surveyType: 'panel',
    factory: (name) => ({ type: 'panel', name, elements: [] }),
    properties: [
      NAME_PROP,
      { key: 'title', label: 'Title', kind: 'localizedText', appliesToLocale: true },
      { key: 'description', label: 'Description', kind: 'localizedText', appliesToLocale: true, advanced: true },
      {
        key: 'state', label: 'Collapsible', kind: 'select', advanced: true,
        options: [
          { value: 'default', label: 'Not collapsible' },
          { value: 'expanded', label: 'Collapsible, open' },
          { value: 'collapsed', label: 'Collapsible, closed' },
        ],
      },
    ],
    matches: (el) => el.type === 'panel',
  },

  // 19. Repeating group — the respondent adds copies of `templateElements`
  {
    id: 'panel_dynamic',
    label: 'Repeating group',
    icon: 'panel-repeat',
    surveyType: 'paneldynamic',
    factory: (name) => ({ type: 'paneldynamic', name, templateElements: [], panelCount: 1 }),
    properties: [
      ...commonProps(),
      { key: 'panelCount', label: 'Initial copies', kind: 'number', default: 1 },
      { key: 'minPanelCount', label: 'Minimum copies', kind: 'number', advanced: true },
      { key: 'maxPanelCount', label: 'Maximum copies', kind: 'number', advanced: true },
      { key: 'panelAddText', label: '“Add” button', kind: 'localizedText', appliesToLocale: true, advanced: true },
      { key: 'templateTitle', label: 'Copy title', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'paneldynamic',
  },

  // 20. Button group (single choice rendered as buttons)
  {
    id: 'button_group',
    label: 'Button group',
    icon: 'buttons',
    surveyType: 'buttongroup',
    factory: (name) => ({ type: 'buttongroup', name, choices: [] }),
    properties: [...commonProps(), choicesProp],
    matches: (el) => el.type === 'buttongroup',
  },

  // 19. Matrix (dropdown) — rows x typed columns, one answer per cell
  {
    id: 'matrix_dropdown',
    label: 'Matrix (cells)',
    icon: 'matrix-cells',
    surveyType: 'matrixdropdown',
    factory: (name) => ({
      type: 'matrixdropdown',
      name,
      columns: [{ name: 'column1', title: { default: 'Column 1' }, cellType: 'dropdown' }],
      rows: [
        { value: 'row1', text: { default: 'Row 1' } },
        { value: 'row2', text: { default: 'Row 2' } },
      ],
      choices: [
        { value: 'one', text: { default: 'One' } },
        { value: 'two', text: { default: 'Two' } },
      ],
    }),
    properties: [...commonProps(), cellChoicesProp],
    matches: (el) => el.type === 'matrixdropdown',
  },

  // 20. Matrix (dynamic) — typed columns, the respondent adds rows
  {
    id: 'matrix_dynamic',
    label: 'Matrix (add rows)',
    icon: 'matrix-rows',
    surveyType: 'matrixdynamic',
    factory: (name) => ({
      type: 'matrixdynamic',
      name,
      columns: [{ name: 'column1', title: { default: 'Column 1' }, cellType: 'text' }],
      rowCount: 2,
    }),
    properties: [
      ...commonProps(),
      { key: 'rowCount', label: 'Initial rows', kind: 'number', default: 2 },
      { key: 'minRowCount', label: 'Minimum rows', kind: 'number', advanced: true },
      { key: 'maxRowCount', label: 'Maximum rows', kind: 'number', advanced: true },
      { key: 'addRowText', label: '“Add row” button', kind: 'localizedText', appliesToLocale: true, advanced: true },
    ],
    matches: (el) => el.type === 'matrixdynamic',
  },

  // 21. Image picker (choose one/many images)
  {
    id: 'image_picker',
    label: 'Image choice',
    icon: 'image-picker',
    surveyType: 'imagepicker',
    factory: (name) => ({
      type: 'imagepicker',
      name,
      choices: [{ value: 'option_1', imageLink: '' }],
    }),
    properties: [
      ...commonProps(),
      { key: 'multiSelect', label: 'Allow multiple', kind: 'boolean', advanced: true },
      { key: 'showLabel', label: 'Show labels under images', kind: 'boolean', advanced: true },
      { key: 'imageWidth', label: 'Image width', kind: 'text', advanced: true },
      { key: 'imageHeight', label: 'Image height', kind: 'text', advanced: true },
    ],
    matches: (el) => el.type === 'imagepicker',
  },

  // 19. Expression (read-only computed display)
  {
    id: 'expression',
    label: 'Expression',
    icon: 'sigma',
    surveyType: 'expression',
    factory: (name) => ({ type: 'expression', name, expression: '' }),
    properties: [
      NAME_PROP,
      { key: 'title', label: 'Label', kind: 'localizedText', appliesToLocale: true },
      { key: 'expression', label: 'Expression', kind: 'text' },
      {
        key: 'displayStyle', label: 'Display as', kind: 'select', advanced: true,
        options: [
          { value: 'none', label: 'Plain' },
          { value: 'decimal', label: 'Decimal' },
          { value: 'currency', label: 'Currency' },
          { value: 'percent', label: 'Percent' },
          { value: 'date', label: 'Date' },
        ],
      },
    ],
    matches: (el) => el.type === 'expression',
  },
];

// ---- Import / lookup helpers ------------------------------------------------

/** Fast lookup by palette id (e.g. when the user drags a block). */
const byId = new Map(registry.map((b) => [b.id, b]));
export function blockById(id: string): BlockDefinition | undefined {
  return byId.get(id);
}

/**
 * Resolve an imported element to its block.
 * Returns null for unknown/advanced types → caller must PRESERVE AND LOCK it.
 */
export function resolveBlock(el: SurveyElement): BlockDefinition | null {
  return registry.find((b) => b.matches(el)) ?? null;
}

/** True when an element has no visual editor and must be shown as a locked card. */
export function isAdvancedType(el: SurveyElement): boolean {
  return resolveBlock(el) === null;
}

/**
 * Create a fresh element for a palette block, guaranteeing a unique name
 * against the set of names already in the schema.
 */
export function createElement(blockId: string, existingNames: Set<string>): SurveyElement {
  const block = byId.get(blockId);
  if (!block) throw new Error(`Unknown block: ${blockId}`);
  let i = 1;
  let name = `${block.id}_${i}`;
  while (existingNames.has(name)) name = `${block.id}_${++i}`;
  return block.factory(name);
}
