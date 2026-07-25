# CSS Patterns

CSS module conventions and recipes for matching the game's own look. Split out of
`docs/feature-patterns.md`.

Each feature needing CSS gets a `.module.css` alongside the `.ts`. `applyCssRule` and `C` are auto-imported.

```ts
import $style from './my-feature.module.css';

function init() {
  applyCssRule(`.${C.Frame.logo}`, $style.logo);                              // global
  applyCssRule('PROD', `.${C.OrderTile.overlay}`, $style.disablePointerEvents); // scoped to command
  applyCssRule(['PROD', 'PRODQ'], `.${C.OrderTile.overlay}`, $style.x);        // scoped to multiple
}
```

`applyCssRule` must be called during feature `init()`.

For hover/focus/etc., use CSS Nesting inside the module — one `applyCssRule` call handles both base and nested rules:

```css
.logo {
  cursor: pointer;

  &:hover {
    background-color: rgba(128, 128, 128, 0.5);
  }
}
```

### Class Names

Name classes after where they're applied, not what they do. Fall back to "what it does" only when "where" makes no sense.

```css
/* Bad */
.padLeftRight { }
.flexRow { }

/* Good */
.sortControls { }
.storeInfoColumn { }
```

### Scoping

If a feature targets specific commands, always use scoped CSS rules. Otherwise, styles leak to other commands that share the same DOM structure.

```ts
// Bad: leaks to SHPI and other store views
applyCssRule(`.${C.StoreView.row}`, $style.storeInfo);

// Good: only affects INV
applyCssRule('INV', `.${C.StoreView.row}`, $style.storeInfo);
```

For more specific selectors (descendant combinators, `:nth-child`, etc.), tighten them further to improve performance.

### Import Naming

When importing CSS modules into feature `.ts` files, use `$style` for consistency with Vue's `$style` object.

```ts
import $style from './my-feature.module.css';
```

### Reuse

Use `css.hidden` from `@src/utils/css-utils.module.css` instead of creating your own hidden class.

### Matching Native Input Styling

When adding a new `<input>`/`<textarea>` into the game UI, don't hand-code colors to match
the theme — apply the game's own input class from `C` directly, the same way you'd reuse
any other `C.Component.class`. For a textarea, `C.TextareaInput.textarea` gives the exact
dark background, monospace font, and amber focus-underline used by the game's own inputs
(e.g. the contract draft preamble box), and stays correct automatically if the game
re-themes:

```tsx
<textarea class={[C.TextareaInput.textarea, $style.textarea]} ... />
```

Layer your own module class alongside it for structural overrides only (width, resize,
min-height) — let the `C` class own the colors/border/font.

Two verified quirks when pairing such an input with sibling elements:

- `C.TextareaInput.textarea` sets colors and the focus underline but leaves the font at
  the browser default (13.3333px monospace). A sibling element meant to read like the
  textarea's placeholder (e.g. an empty-state hint on an alternate pane) must set
  `font: 13.3333px monospace` explicitly — panel text is otherwise Droid Sans.
- A bare `<textarea>` is inline-block: it sits on the text baseline and leaves a few px
  of descender gap below it. Give it `display: block` when its footprint must match a
  block-level sibling pane, or the panes' total heights differ even with identical rects.

For a `<select>` there is no class on the element itself — the game styles selects
through an ancestor: `.${C.forms.input} select` provides the standard look (17px
height, dark background, amber bottom border, amber focus underline). When using the
shared `SelectInput` outside a game form (e.g. in a table cell), wrap it in a div
carrying `C.forms.input`:

```html
<div :class="[C.forms.input, $style.selectWrap]">
  <SelectInput v-model="value" :options="options" />
</div>
```

### Matching the Game's Scrollbar

An overflowing element added to the game UI gets the wide native browser scrollbar
(arrow buttons included), which looks foreign in a buffer. The game's narrow gray
scrollbar (chat, command suggestions, production lines) is plain CSS — mirror its own
rules verbatim:

```css
.textarea {
  scrollbar-width: thin;
  scrollbar-color: rgb(51, 51, 51) transparent;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgb(51, 51, 51);
    border-radius: 5px;
  }
}
```

There is no game class to reuse for this: the game's main `ScrollView` machinery never
restyles the scrollbar — it hides the native one by pushing it outside a clipped parent
(`margin-right: -15px`) — so copy the values.

### Beating the Game's `td:first-child` Border Reset

The game's base table CSS includes `table tbody td:first-child { border-left-style: none }`. A feature's own `.myFirstColumnCell { border-left: ... }` rule loses to it: both selectors have one class/pseudo-class-level selector, and CSS specificity compares that count before type-selector count, so the game rule's three type selectors (`table`, `tbody`, `td`) become the tiebreaker and it wins regardless of source order. This silently drops a border-left declared on a table's first column (found live: DISPATCH's Assign-column divider rendered nowhere despite a correct, present-in-build rule).

Beat it with a compound selector using two local classes instead of one — e.g. the cell's own class plus its row's class:

```css
/* Loses to the game's td:first-child reset */
.cell {
  border-left: 1px solid gold;
}

/* Wins: two class selectors outrank the game rule's one pseudo-class */
.row .cell {
  border-left: 1px solid gold;
}
```

Matching the exact header row **height** of another panel also needs more than matching font-size: the game's unstyled `<th>` carries native padding (roughly `5px 8px 2px`). A feature that sets `thead th { padding: 0 4px }` collapses its header to about half that height even with identical font-size — to match another panel's header, don't override `th` padding at all and let it inherit the native value.

Body cells: the game's `td` computed padding is `2px 8px` (verified live). To left-align
text outside a table with the table's first-column cell text (e.g. a summary line under
the table in the same container), give it `padding-left: 8px`.

### `:has` Selector

Use `:has` to implement conditional styling in pure CSS, avoiding unnecessary JS.

```js
/* Highlights the parent when a descendant has the error class */
applyCssRule(`.${C.InputsOutputsView.input}:has(.${C.InputsOutputsView.amountMissing})`, $style.input);
```
