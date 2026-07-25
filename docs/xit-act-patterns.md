# XIT & ACT Patterns

XIT panels, custom XIT commands, and the ACT action-package runner. Split out of
`docs/feature-patterns.md` — see that file for general feature registration/DOM/CSS
patterns not specific to XIT/ACT.

## XIT Filter Bars

XIT panels with filter toggles use `C.ComExOrdersPanel.filter` as the container and `RadioItem` with `horizontal` prop for each toggle. Labels must be ALL CAPS:

```html
<div :class="C.ComExOrdersPanel.filter">
  <RadioItem v-model="showFoo" horizontal>FOO</RadioItem>
  <RadioItem v-model="showBar" horizontal>BAR</RadioItem>
</div>
```

`RadioItem` is a boolean toggle, not a true radio group — the above pattern gives independent (AND-able) toggles. For an **exclusive** single-select filter (choosing one option clears any other), bind each option against one shared ref instead of `v-model`:

```html
<div :class="C.ComExOrdersPanel.filter">
  <RadioItem
    v-for="option in filterOptions"
    :key="option.code"
    :model-value="selected === option.code"
    horizontal
    @update:model-value="v => (selected = v ? option.code : undefined)">
    {{ option.label }}
  </RadioItem>
</div>
```

Each option's `active` state is a computed read of the same `selected` ref, so setting one option re-evaluates the others to `false` automatically — no manual "clear the others" step needed. Clicking the active option again clears `selected` (shows everything).

---

## Adding an XIT Command

XIT commands are custom in-game panels opened via the `XIT` buffer. Register in a `.ts` file:

```ts
xit.add({
  command: ['CMD', 'CMDALIAS'],  // one or more
  name: 'Panel Title',            // or (params) => string for dynamic title
  description: 'What it does.',
  mandatoryParameters: 'PARAM1',  // optional
  optionalParameters: 'PARAM2',   // optional
  component: params => MyVue,     // Vue component factory; params is string[]
  bufferSize: [600, 400],         // optional default window size [w, h]
  contextItems: params => [{ cmd: 'XIT OTHER', label: 'Link' }],  // optional
});
```

`xit.get(command)` (`src/features/XIT/xit-registry.ts`) looks up a command's descriptor,
including `.component(parameters)` — the raw Vue component, with no DOM/window
machinery involved. Useful whenever code needs to tell whether a command string is one
of our own XIT commands (with a component we could render directly) versus a native
APEX screen we don't own (not in this registry at all, e.g. `SHPI`) and can only ever
exist as the game's own 2D UI.

The file is auto-imported via `import.meta.glob` in `src/features/index.ts` — no manual registration needed.

The command should be short. Refer to `docs/game/commands.csv` for an example of game commands. Alias is usually added for backwards compatibility or if the community REALLY wants it.

### One-Click Preconfigured Action Packages

To give users a single button that runs a specific ACT action package without opening the ACT editor (e.g. `BURNACT`, `REFUELACT`), pair two files next to the relevant action:

```ts
// <NAME>ACT.ts
import '@src/features/XIT/ACT/actions/refuel/refuel'; // ensure the action type is registered

xit.add({
  command: 'REFUELACT',
  name: 'REFUEL ALL EXCHANGES',
  description: 'Executes a refuel action package for all ships docked at exchanges.',
  component: () => RefuelActWindow,
});
```

```vue
<!-- <Name>ActWindow.vue -->
<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';

const pkg: UserData.ActionPackageData = {
  global: { name: 'Refuel All Exchanges' },
  groups: [],
  actions: [{ type: 'Refuel', name: 'Refuel', origin: allExchangesValue, buyMissingFuel: true }],
};
</script>

<template>
  <ExecuteActionPackage :pkg="pkg" />
</template>
```

The `pkg` is a plain hardcoded object, not persisted user data — `ExecuteActionPackage` runs it exactly like a saved package (CONFIGURE only appears if an action still needs runtime input; PREVIEW/EXECUTE always available). Trigger it from anywhere with `showBuffer('XIT REFUELACT')` (see `PlanetHeader.vue`'s `XIT BURNACT` button for a row-level example, or `FLT.vue`'s Fuel-column header button for another).

**Never embed `ExecuteActionPackage` inside a long-lived planner tile.** It splits its
host buffer at **mount** (`ActionRunner` → `TileAllocator`), so a `v-if` reveal remounts
the host and wipes non-persisted planner state before the run starts (this broke
DISPATCH's first embedded-run design and wiped GOVBURNACT's slot picks). Stage the built
package in a module-level ref and open a dedicated XIT command that renders
`ExecuteActionPackage` (`DISPATCH/staged.ts` + `DISPATCHACT.ts`; GOVBURN's `staged.ts` +
`GOVBURNEXEC.ts`). To reuse the planner window rather than strand it, change that tile's
command in place — `dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, null))`
then `(tile.id, 'XIT <CMD>')`; the null-then-command two-step is required, with
`showBuffer` as the fallback if the first dispatch fails (`GovBurnActWindow.vue`).
Hooks: `beforeExecute` (logs land at the top of the run log) and `afterExecute`.

**A host `v-if`/`v-else` gating `ExecuteActionPackage` must not depend on data the run
itself mutates.** `XIT AGENT`'s `ExecuteStoredPackage.vue` used to resolve its `pkg` via
a `computed` over `agentReadyPackages`, gated by `v-if="!entry"`. The run's own
`AGENT_DONE` step posts a completion marker to the agent channel, which drops the
message from `agentReadyPackages` (by design, to hide it from AGENT next time) —
flipping the `v-if` and unmounting `ExecuteActionPackage`, and its runner, before later
chained steps (e.g. `OPEN_SFC`) could execute. Resolve such an `entry` once as a plain
non-reactive snapshot at setup instead of a live `computed`, so a step's own side effect
can't unmount the component that's running it.

**Automated posts to the agent channel must stay hidden.** `agent-channel.ts` exposes
both a hidden path (`postAgentMessage` — `showBuffer` with `autoClose`) and a visible one
(`openAgentChannel`/`openAgentChannelWithDraft`). Use the hidden path for anything an ACT
step posts on the user's behalf (`POST_AGENT`, `AGENT_DONE`'s completion marker) —
reserve the visible path for flows where the player is meant to review/send the message
themselves (e.g. the AGENT panel's manual "dismiss" button).

**Agent-channel ids are only unique against fetched history.** The channel store handles
only `CHANNEL_MESSAGE_LIST` (the server sends full history once per connection), so posts
made by another device mid-session never reach the store, and
`generateAgentMessageId`/`generateAgentChainIds` treat only posted-and-visible ids as
used. Two packages staged before either posts, or two devices in one day, can therefore
pick the same day-letter id — a known, accepted limitation (single-member channel, 5-day
window). Related preview cost: chain-id allocation runs inside MTRA's `generateSteps`, so
PREVIEWing a package with 2+ agent stops triggers the once-per-session COMG fetch.

**`waitActionFeedback` aborts the step on failure.** On an error overlay it logs, stops
the machine, and throws an `ExecutionStopped` sentinel that the step machine's catch
swallows — an `execute()` body never runs past a failed game action. Code after the
await (e.g. a `watchWhile` for a storage update that will now never come) can rely on
this; don't wrap `waitActionFeedback` in a step-local try/catch or the hang comes back.

### Reminder Pauses in ACT Steps

When a step needs the player to do something manually in a companion buffer before the
run continues (repair buildings in BRA, submit the flight in SFC, adjust a transfer
amount in MTRA), call `waitAct(status, { actDelayMs: 2000 })`. The step machine grays
the ACT button for the delay while SKIP/CANCEL stay live, then re-arms ACT — see
`OPEN_BRA.ts` / `OPEN_SFC.ts` / `MTRA_TRANSFER.ts`'s `playerReview` mode (which reads
the player-adjusted input value after the pause instead of rewriting it).
Don't add a bare `sleep()` for this; the delay belongs in `waitAct` so skipping/canceling
during the pause is handled.

### ACT Step Behaviors Worth Knowing

- **Per-open click gate lives in `requestTile`.** A step that opens a buffer via
  `ctx.requestTile(cmd)` already makes the player click ACT for that open — don't add
  another `waitAct` around it.
- **Steps can self-skip without a click.** Calling `ctx.skip()` and returning before any
  `waitAct` consumes the step silently (logs a SKIP line). Used by `OPEN_POPID` to walk a
  fixed 14-building step list while only present buildings cost a click — a static step
  list plus self-skipping steps is simpler than generating steps dynamically from data
  that only arrives mid-run.
- **MTRA into a ship store auto-emits `OPEN_SFC`** (destination `sfcDestination ??` the
  material group's `planet`) unless `noSfc` is set — a buy→load→launch package needs no
  explicit launch step; the player still clicks the actual takeoff in SFC.
- **`CX Buy` with `useCXInv: true` nets out warehouse stock**, so a PREVIEW showing
  `Buy 900` against `Transfer 1,000` of the same ticker is correct (100 already in the
  warehouse), not a quantity bug.

### Action-Specific Sentinel Values

`configurableValue` and `groupTargetPrefix` (`shared-types.ts`) are sentinels shared across every ACT action/material-group type. If an action needs an extra dropdown option unique to itself (e.g. Refuel's "All Exchanges" origin, alongside "Configure on Execution" and specific storages), define that sentinel in the action's own `utils.ts`/`config.ts` instead of adding it to `shared-types.ts`.
