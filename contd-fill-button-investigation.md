# CONTD Fill Button Investigation

## Goal
Add small "all" buttons to the left of the **Amount** and **Price per unit** inputs
in the first commodity section of the CONTD `{id}` template overlay. Clicking fills
the same field in all other commodity sections.

---

## How the buffer works (confirmed from debug logs)

- CONTD is opened by selecting a contract, which opens `CONTD {id}`.
- The commodity sections live inside a **select template overlay** within that buffer.
- Each commodity section is a `C.TemplateSelection.group` element.
- `tiles.observe('CONTD', ...)` correctly catches these tiles.

### DOM structure of a commodity section (from `group.innerHTML` log)

```
div.TemplateSelection__group
  div.FormComponent__containerActive___OchN7Ew  forms__active___wn9KQTZ  forms__form-component___yTgP_Qa
    label.FormComponent__label___dn5rq4s  [for="trades[0].amount"]
      span  "Amount"
    div.FormComponent__in...   ← input wrapper (class truncated in log)
      ...
        input
  div.FormComponent__containerActive___...   ← "Commodity" field
  div.FormComponent__containerActive___...   ← "Price per unit" field
  div.FormComponent__containerCommand___...  ← "CMD" field
```

### Labels confirmed in first group (from log)
- `"Amount"`
- `"Commodity"`
- `"Price per unit"`
- `"CMD"`

---

## What works

| Thing | Status |
|---|---|
| `tiles.observe('CONTD', ...)` fires | ✅ |
| `C.TemplateSelection.group` found | ✅ |
| First-group guard (`groups[0] === group`) | ✅ |
| `subscribe($$(group, 'label'), ...)` fires for all labels | ✅ |
| Label text matching `'amount'` / `'price per unit'` | ✅ |
| `label.nextElementSibling` → the input wrapper div | ✅ |
| `fillAllGroups` click logic (copies values across sections) | ✅ |

---

## What does NOT work

| Thing | Why |
|---|---|
| `_$(container, C.FormComponent.input)` | Returns `undefined`. The CONTD overlay uses a different CSS hash for `FormComponent__input` (class duplication bug noted in `input-math.ts`). |
| `subscribe($$(group, C.FormComponent.containerActive), ...)` | Would not fire — wrong approach. Subscribing to `'label'` tags is the fix. |

---

## Layout facts (confirmed)

- `containerActive` is **flex-row** (`forms__active` class).
- The input wrapper (`label.nextElementSibling`) has **`flex-grow: 1`**, so it expands
  to fill all remaining space after the label. This means `margin-left: auto` on a
  sibling before it has **zero free space to absorb** — it has no effect.
- Placing the button **inside** the input wrapper caused it to appear **above** the
  input (not to its left), meaning the input wrapper does **not** use `flex-direction: row`
  natively.
- Forcing `flex-direction: row` on the input wrapper and adding `flex: 1` to the input
  content div restores the input's right-alignment but the button is still left-aligned
  within the wrapper.

---

## Attempts so far

1. Subscribed to `C.FormComponent.containerActive` → never fired
2. Subscribed to `'label'` → works
3. `_$(container, C.FormComponent.input)` for input wrapper → NOT FOUND
4. `label.nextElementSibling` for input wrapper → works
5. Placed button inside wrapper before `DynamicInput.dynamic` / `firstElementChild` → button appeared **above** input
6. Placed button before `inputWrapper` as flex sibling → button appeared **left-aligned** in the gap between label and input wrapper
7. Added `margin-left: auto` to button (sibling approach) → no effect (`flex-grow:1` on wrapper leaves no free space)
8. Forced wrapper to `flex-direction: row`, prepended button inside → both button AND input went **left-aligned**
9. Added `flex: 1` to input content after button → input went back to right, button stayed **left**

---

## Open problem

The button needs to be visually **immediately to the left of the input box** (right side
of the row) while the input box itself stays right-aligned. None of the structural
approaches tried so far achieve this without also breaking the input's alignment.
