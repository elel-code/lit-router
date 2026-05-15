# Changelog

## 1.1.0 (2026-05-16)

### Added

- Hash routing via `new Router({ mode: "hash" })`, including generated
  `/#/base/path` links, hash URL resolution, click interception, guard
  redirects, and `popstate` / `hashchange` navigation handling.

## 1.0.3 (2026-05-08)

### Added

- `examples/demo/` — interactive demo app with navigation bar, status panel,
  guarded lab route, and dynamic module loading.
- English user guide (`docs/guide.md`).

### Changed

- Demo files moved from `src/` to `examples/demo/` to keep the library source
  directory focused.
- `deno.json` fmt tasks now auto-discover files instead of using an explicit
  file list.
- Removed `experimentalDecorators` from `tsconfig.json`.
- Cleaned up stale build artifacts in `lib/`.

## 1.0.2

### Added

- Slot multi-outlet support. One URL can match multiple child routes targeting
  different named slots in the parent component. Includes full guard, lazy load,
  leave guard, and focus integration. See
  [docs/slot-outlets-design.md](./docs/slot-outlets-design.md).
- `RouteContext.slot` and `RouteContext.branch` — components can now identify
  which slot they were projected into.
- `RouterChangeDetail.slotBranches`, `slotParams`, and `slots` for introspecting
  side-slot matches.
- `RouteLoadingDetail.loadingSlots` for tracking which slots are loading.
- `RouterChangeDetail.toJSON()` for serialization-friendly debugging.
- `batchRouteUpdates()` for atomic multi-step route tree mutations with rollback
  support.
- `router.routes` getter/setter for frozen snapshot access and full tree
  replacement.
- `beforeLeave` guards run for side-slot branches before the main branch, sorted
  by slot name.
- `isSameDetail` extended to compare side-slot branches.
- `data-transition-direction` on `<router-view>` host for CSS direction-aware
  transitions.

### Changed

- `renderedBranches` refactored to `Map<string, HTMLElement[]>` for per-slot
  element tracking.
- `mountBranch` / `mountRouteBranch` unified main-chain and side-chain mount
  logic.
- `validateChildOutlet` extended to all used slots.
- Side-slot focus strategy: focus only moves when the user was already in the
  old side slot.

### Fixed

- Focus no longer stolen from main content when only side slots change.

## 1.0.1

### Added

- Route guards (`guard` and `beforeLeave`) with async support, redirects, and
  `AbortSignal` cancellation.
- Lazy loading (`load`) with deduplication and `AbortSignal` support.
- `route-loading-start` / `route-loading-end` events.
- `route-error` and `route-not-found` events.
- `RouterView` 404 and error fallback views with light DOM slot overrides.
- `router.resolveUrl()` and `router.resolveNamed()` for read-only resolution.
- `router.link()` and `router.linkAttributes()` for named-route reverse routing.
- `router.configure()` for updating multiple options at once.
- `router.push()` and `router.replace()` with `RouteLocation` input.
- `router.start()` / `router.stop()` lifecycle.
- `ScrollManager` with per-history-entry scroll restoration and bounded LRU
  cache.
- `data-route-focus` auto-focus after navigation.
- `<router-view>` `child-slot` and `no-view-transition` attributes.
- `RouteContext` explicit contract replacing legacy `routeDetail`/`routeParams`.

### Changed

- Migrated to current Lit decorator field syntax (`accessor` keyword).

## 1.0.0

### Added

- Route tree declared in TypeScript with `RouteDefinition[]`.
- `URLPattern`-based route matching with specificity ordering.
- Named `<slot>`-based nested route rendering.
- `Navigation API` integration with `popstate` fallback.
- `View Transitions API` support in `<router-view>`.
- `basePath` support for sub-path deployments.
- Same-origin `<a>` click interception (HTML and SVG).
- History entry direction tracking with bounded bookkeeping.
- `route-change` and `route-tree-change` events.
- `RouterView` custom element with `router` property binding.
