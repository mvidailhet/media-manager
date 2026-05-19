# AGENTS.md instructions for media-manager

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `mvidailhet/media-manager`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses the single-context layout: root `CONTEXT.md` plus root `docs/adr/` when present. See `docs/agents/domain.md`.


## Generic code conventions VERY IMPORTANT. YOU MUST RESPECT THESE RULES

**Goal:** code readable by someone who is not a developer.

### Naming
- Name things after what they are in the domain, not after their technical role. `EnemyWave` not `DataArray`.
- Extract intermediate values into named variables, even when inline is possible. Clarity over brevity.
- No magic numbers or strings — name every constant.


### Functions
- One function, one responsibility. If a function does two things, split it into two functions with explicit names.
- Keep functions short. If a function needs a mental map to follow, it is too long.

### Classes
- One class, one responsibility. If you need to describe a class with "and", it should be two classes.
- Prefer composition over inheritance. Inherit only when the "is-a" relationship is genuinely true and stable.
- A class should depend on abstractions (interfaces) at system boundaries — e.g. when the implementation could be swapped or mocked. Elsewhere, depend directly on concrete classes and keep it simple.
- Keep constructors simple: assign dependencies, nothing else. Side effects belong in explicit methods.

### Structure
- Avoid repetition. Extract repeated logic into a named utility function — at class level or app level depending on scope.
- One concept per file: a class, an interface, or a group of closely related pure functions.
- IMPORTANT: keep a single source of truth for every domain value. If a value already exists elsewhere in the project, reuse that definition instead of copying it into a new local constant or map.

### Frontend component splitting
- Do not define child React components in the same file as their parent component.
- When a component owns child components, make the parent a folder-owned component:
  - `ComponentName/ComponentName.tsx` contains the parent component.
  - `ComponentName/components/ChildName.tsx` contains child components used only by that parent.
  - `ComponentName/index.ts` may re-export the parent when that preserves clean imports.
- Do not keep `ComponentName.tsx` as a sibling of `ComponentName/components/`. Move the parent file into the `ComponentName/` folder before adding child components.
- Exception: app, route, and module entry components may stay directly in their owning folder when that folder already names the app or domain boundary.
  - Prefer `src/modules/catalog/Catalog.tsx` over `src/modules/catalog/CatalogModule/CatalogModule.tsx`.
  - Put child components owned by that entry component in the owning folder's `components/` directory.
  - Put feature-owned child components under the smallest feature folder that owns them, such as `src/modules/catalog/VideosPanel/components/`.
- Keep parent components focused on composition, state ownership, and data flow. Move visually or behaviorally distinct UI regions into named child components.
- Before creating a new frontend feature or refactoring frontend UI, describe the intended component split: parent component, child components, and each component's responsibility.
- Prefer splitting when a JSX region has its own heading, controls, conditional state, repeated rendering, or domain name.
- Scope components to the smallest folder hierarchy that owns all their usages. A component used by only one parent stays next to that parent. When it becomes used by sibling components, move it up to the nearest shared parent's `components/` folder.
- Name child components for their local responsibility, not by repeating their ancestry. Folder hierarchy already provides context, so avoid prefixes like `ScanRoot` or `ScanRootCard` inside `ScanRootCard/components/` unless the name would otherwise be ambiguous.

### Comments
- If code needs a comment to explain what it does, rename or restructure until it doesn't.
- Only add a comment to explain *why* something is done when the reason is not obvious from the code itself.


## Dev workflow

### TDD and tests
Use TDD. Follow RED-GREEN-REFACTOR.

IMPORTANT : Prefer tests that lock behavior, intent, and invariants, not tweakable implementation details.
- Test ranges, ordering, presence, visibility, and relationships when possible.
- Avoid pinning exact visual tuning numbers unless they are part of the contract.
- For balance and rendering tweaks, prefer broad guards like "visible enough", "smaller than body", or "pulses within a safe range".
- Keep tests resilient so small tuning changes do not require test rewrites.
