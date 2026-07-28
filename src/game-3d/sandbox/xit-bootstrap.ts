// Registers every XIT command (xit.add(...) side effects) so console-roster.ts's
// xit.get(command) calls resolve, same as @src/features/index.ts's eager glob of this
// same directory — but XIT-only, deliberately skipping basic/advanced features (which
// assume a live 2D page DOM) since none of the console roster's commands live there.
//
// Kept in its own module rather than inlined in main.ts: Vite's import.meta.glob(...,
// {eager:true}) transform hoists its generated imports to the top of whichever file it's
// written in, regardless of where the call appears in that file's source — inlining it in
// main.ts silently ran every XIT module (many of which call dayjs.duration() etc. at
// module scope, e.g. ELEC.vue) before main.ts's own '@src/utils/dayjs' setup import,
// even though that import appears earlier in main.ts's source. Splitting into a separate
// module sidesteps the quirk: cross-file import order still follows declaration order, so
// main.ts importing dayjs setup before importing this file guarantees the extend() calls
// land first, regardless of any hoisting inside this file.
import.meta.glob('../../features/XIT/**/*.{ts,tsx}', { eager: true });

export {};
