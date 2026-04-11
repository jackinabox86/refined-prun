## Summary

<!-- Brief description of the changes -->

## Standards Checklist

- [ ] No upward imports across layers (features -> core -> infrastructure -> utils)
- [ ] No explicit imports of auto-imported symbols (ref, computed, $, $$, C, subscribe, etc.)
- [ ] CSS rules scoped to commands where applicable
- [ ] Numbers use formatters from `@src/utils/format`
- [ ] No `title=` attributes (use `data-tooltip`)
- [ ] No `onApiMessage` in features (use `computed` from stores)
- [ ] Feature has single responsibility, no cross-feature deps
- [ ] CSS class names describe WHERE, not WHAT
- [ ] Uses `C.Component.className` not hardcoded hashed classes
- [ ] CHANGELOG.md not modified
