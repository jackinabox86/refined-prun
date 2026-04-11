#!/usr/bin/env bash
set -euo pipefail

# Get PR diff (truncate to ~80K chars to stay within token limits)
DIFF=$(gh pr diff "$PR_NUMBER" | head -c 80000)

if [ -z "$DIFF" ]; then
  echo "No diff found, skipping review."
  exit 0
fi

# Read the three docs standards files
ARCHITECTURE=$(cat docs/architecture.md)
CONTRIBUTING=$(cat docs/contributing.md)
FEATURE_PATTERNS=$(cat docs/feature-patterns.md)

# Build the system prompt with the concrete review rules
SYSTEM_PROMPT=$(cat <<'SYSPROMPT'
You are a code reviewer for the Refined PrUn browser extension. Review the PR diff against the project's documentation standards provided below.

Check for these specific violations:

1. NO UPWARD IMPORTS across architectural layers. The dependency order is: features -> core -> infrastructure -> utils. A file in "infrastructure" must never import from "features" or "core".
2. NO EXPLICIT IMPORTS of auto-imported symbols. These are auto-imported and must NOT have explicit import statements: Vue composables (ref, computed, reactive, watch, toRef, shallowReactive), DOM helpers ($, $$, _$, _$$), and globals (C, subscribe, tiles, features, xit, config, createFragmentApp, applyCssRule).
3. CORRECT DOM HELPER usage: $ = async single element (returns Promise), $$ = async iterable (pair with subscribe()), _$ = sync single (returns Element|undefined), _$$ = sync snapshot (returns Element[]).
4. CSS RULES SCOPED to commands when targeting specific buffers. Bad: applyCssRule(selector, style). Good: applyCssRule('INV', selector, style).
5. NO TEXT-BASED entity identification. Use IDs from API stores, not display text (breaks with localization).
6. NUMBERS must use formatters from @src/utils/format (fixed0, fixed01, fixed02, fixed1, fixed2, percent0, percent1, percent2). No raw toFixed() or toString() on numbers displayed in UI.
7. NO title= ATTRIBUTES. Use data-tooltip instead for instant tooltips.
8. NO onApiMessage IN FEATURES. onApiMessage is only for infrastructure/prun-api. Features must use computed() to derive from stores.
9. ONE RESPONSIBILITY per feature. No cross-feature dependencies.
10. CSS CLASS NAMES describe WHERE they apply (e.g., .sortControls), not WHAT they do (e.g., .flexRow).
11. Use C.Component.className instead of hardcoded hashed CSS class strings.
12. STYLE: early returns to reduce nesting, single-param lambdas use x, no unnecessary type annotations, comments on separate lines starting with capital letter.
13. Do NOT modify CHANGELOG.md in PRs.

Instructions:
- Only flag genuine violations of the rules above. Do not flag style preferences beyond what the docs specify.
- Be concise. For each violation, state the rule number, the file and approximate location, and what is wrong.
- If the PR follows all standards, say so briefly.
- Focus only on changed lines (+ lines in the diff), not removed lines.
SYSPROMPT
)

# Build user message with docs context and the diff
USER_MSG=$(cat <<USERMSG
## Project Standards

### architecture.md
$ARCHITECTURE

### contributing.md
$CONTRIBUTING

### feature-patterns.md
$FEATURE_PATTERNS

## PR Diff to Review
\`\`\`diff
$DIFF
\`\`\`

Review this diff against the standards above. List any violations found, or confirm the PR is clean.
USERMSG
)

# Call GitHub Models API
# Use jq to safely encode strings as JSON
PAYLOAD=$(jq -n \
  --arg system "$SYSTEM_PROMPT" \
  --arg user "$USER_MSG" \
  '{
    model: "openai/gpt-4o",
    messages: [
      { role: "system", content: $system },
      { role: "user", content: $user }
    ],
    temperature: 0.1
  }')

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "https://models.github.ai/inference/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "GitHub Models API returned HTTP $HTTP_CODE"
  echo "$BODY"
  echo ""
  echo "If you see a 403/401, ensure GitHub Models is enabled in your repo settings (Settings > Copilot > GitHub Models)."
  exit 1
fi

# Extract the review content
REVIEW=$(echo "$BODY" | jq -r '.choices[0].message.content // "No review content returned."')

# Post as a PR comment
COMMENT_BODY=$(cat <<COMMENT
## Automated Standards Review

$REVIEW

---
*Reviewed against \`docs/architecture.md\`, \`docs/contributing.md\`, \`docs/feature-patterns.md\`*
COMMENT
)

gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY"
echo "Review posted to PR #$PR_NUMBER"
