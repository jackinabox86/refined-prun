# Left Sidebar & Screen Connection Map

Index of the base-game left-sidebar shortcuts and the screen graph behind them. Per-area details live in `docs/game/screens-*.md`. All command/parameter definitions: `docs/game/commands.csv`.

## Sidebar → Command Mapping

The base-game left sidebar has 12 fixed shortcut buttons. The button label is not always the command it opens:

| Button | Opens | Screen | Details |
|---|---|---|---|
| BS | `BS` | Bases list | `screens-bases.md` |
| CONT | `CONTS` | Contracts list | `screens-contracts.md` |
| COM | `COM` | Communications | `screens-comms.md` |
| CORP | `CORP` | Your Corporation | `screens-company.md` |
| CXL | `CXL` | Commodity Exchanges list | `screens-trade.md` |
| FIN | `FIN` | Financial Overview | `screens-company.md` |
| FLT | `FLT` | Fleet | `screens-fleet.md` |
| INV | `INV` | Inventories list | `screens-inventory.md` |
| MAP | `MU` | Universe Map | below |
| PROD | `PROD` | Production lines | `screens-production.md` |
| LEAD | `LEAD` | Leaderboards | `screens-company.md` |
| CMDS | `CMDS` | Commands list | below |

Above the shortcuts sit three UI toggles (not buffer shortcuts): SCRNS (screen selector), SDBR (right sidebar), BFRS (buffer list).

## Screen Graph Conventions

- **Context-command bar**: every tile header lists related commands as clickable links with labels (e.g. `CONTD: Contract Drafts`). This is the primary lateral navigation between related screens and the fastest way to learn a screen's neighbors.
- **List → detail**: list screens open detail screens via a lowercase per-row action button (`view`, `open`, `view base`) or via entity-name links. Detail buffers carry the entity id in the command (e.g. `CONT Y8JC07P`, `INV 02230494`).
- **Id forms**: some commands take natural ids (planet `QJ-684b`, ship transponder `AVI-05Y2T`, CX ticker `GIN.AI1`); base-scoped screens opened from buttons use internal hex ids (`WF 2e2bada6`, `PRODQ 7b3ef35d`). The csv's "Base"/"Production Line" params accept either where documented.
- **Buffer reuse**: opening a buffer that is already open (same command + params) re-focuses the existing window instead of creating a new one.
- **Pagination**: long lists end with a "Click to load more" row.

## Connection Map

```
BS ─view base→ BS <planet> ─buttons→ HQ | BBL | BBC | WF | EXP | PROD <base> | INV <store>
   ctx: HQ BRA ARC                 ctx: PLI, INV <planet>, HQ, BRA <planet>, ARC
CONTS ─view→ CONT <id>             ctx: CONTD
CXL ─name link→ CX <MIC> ─row buttons→ CXP | CXPC | CXOB | CXPO   (each ctx-links all others + MAT)
   ctx: CXOS                       links: LM, WAR of the station
FLT ─row buttons→ SFC (view) | SHPI (cargo) | SHPF (fuel);  name link → SHP
INV ─open→ INV <store-id>          ctx: WAR <planet>, UPCK <store-id>
PROD ─Queue/Order→ PRODQ | PRODCO <line>;  PROD <base> per base   ctx: BS
FIN  ctx→ FINBS | FINIS | FINLA
COM  ctx→ COMC | COMF;  channels open COMP/COMG/COMU
CORP ctx→ COMG CORP-<id> | CORPFIN | CORPIVS | CORPP | CORPNP
HQ   ctx→ CO <own code>
```

## MU — Universe Map

3D star map. Mouse: left pan, right rotate, wheel zoom. Collapsible NAV panel with filter groups:
- **Resources**, **Population** (per tier: PIO SET TEC ENG SCI), **Factions**
- **Highlights**: Base, Fleet, Inventory, Local Market, Commodity Exchange, Shipyard

Related: `MS <system>` (star system map). `MU` takes an optional Mode parameter.

## CMDS — Commands

Plain searchable table: Command, Description, Mandatory parameters, Optional parameters. Same content as `docs/game/commands.csv` (that file's source).

## Server-Action Buttons (never click in tests)

Screens are safe to open and browse; these buttons inside them talk to the server:
- Bases: permit `add`/`rmv` (BS), `build` (BBC), `repair`/`demolish` (BBL), `act`/`rmv` experts (EXP), `assign`/`Relocate` (HQ)
- Contracts: `fulfill`, `request termination` (CONT), **`Create New` (CONTD — creates a real draft)**
- Trade: `buy`/`sell` (CXPO)
- Fleet: `unload`, `fly` submit (FLT), `abort` (SFC), `repair` (SHP)
- Production: order `cancel` (PRODQ), order creation (PRODCO)
- Other: `Leave` (CORP), `new group`/`new private` (COM)

---

**Note**: No Refined PrUn features included. All screens described are base-game APEX only.
