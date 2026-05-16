# lit-router Guide

## What It Is

`@elelcode/lit-router` is a client-side router for modern browsers and Web
Components / Lit. It leans on native platform capabilities instead of
reimplementing them:

- `URLPattern`
- `Navigation API`
- `View Transitions API`
- Named `<slot>`
- Custom Elements / Lit

If your application targets modern browsers as a single-document SPA, this
router is a more direct fit than framework-era alternatives.

The route tree can be updated at runtime—insert, remove, or replace branches
without tearing down the router. This suits permission-driven shells, feature
flags, and plugin-style page assembly.

Further reading:

- English API reference: [api.md](./api.md)
- Chinese API reference: [api.zh-CN.md](./api.zh-CN.md)
- Chinese guide: [guide.zh-CN.md](./guide.zh-CN.md)

## Install

```bash
deno add jsr:@elelcode/lit-router
```

Import:

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## Minimal Setup

```ts
const router = new Router({
  routes: [
    { path: "", component: "home-page" },
    {
      path: "settings",
      component: "settings-layout",
      children: [
        { path: "", component: "settings-home" },
        { path: "profile", component: "settings-profile" },
      ],
    },
  ],
});

document.querySelector("router-view")!.router = router;
```

```html
<router-view></router-view>
```

## Playground Examples

The repository includes two runnable examples:

### `examples/minimal/` — Compressed Playground

Not a hello-world stub, but a realistic playground covering:

- Lazy loading with `route-loading-start` / `route-loading-end`
- `beforeLeave` blocking
- Runtime `insertRoutes()` / `removeRoute()`
- `guard` redirects
- `route-error` / `route-not-found` fallback slots
- `RouteContext` delivery
- `router-view[data-transition-direction]`

Key files:

- [examples/minimal/main.ts](../examples/minimal/main.ts)
- [examples/minimal/example-pages.ts](../examples/minimal/example-pages.ts)
- [examples/minimal/lazy-drafts.ts](../examples/minimal/lazy-drafts.ts)

### `examples/demo/` — Interactive Demo

A full interactive demo app with navigation bar, status panel, guarded lab
route, and dynamic module loading.

Key files:

- [examples/demo/app-root.ts](../examples/demo/app-root.ts)
- [examples/demo/demo-pages.ts](../examples/demo/demo-pages.ts)
- [examples/demo/lazy-drafts-panel.ts](../examples/demo/lazy-drafts-panel.ts)

Run it with:

```bash
deno serve --port 8000 index.html
```

## Core Concepts

### 1. Route trees are declared in TypeScript

Routes are not scattered across HTML markers. A single `routes` array drives
everything.

Common fields:

- `id`: stable tree-management identifier for runtime insertion/removal
- `name`: stable route name for `router.link()` and named navigation
- `path`: route segment. `""` for index, `"*"` for catch-all
- `component`: custom element tag name or factory function
- `children`: nested route tree
- `title`: document title template with `:param` expansion
- `props`: extra properties assigned to the rendered element
- `guard`: route enter guard
- `beforeLeave`: leave guard triggered before the branch segment unloads
- `load`: first-entry async loader for code splitting

Matching is compiled with specificity ordering: static segments > params >
catch-all. You won't get `/me` intercepted by `/:id` just because you declared
`/:id` first.

### 2. Nested routes render through named slots

When a parent route declares `children`, it must provide a matching `<slot>`:

```html
<slot name="route-child"></slot>
```

The default slot name is `route-child`. Override it with
`<router-view child-slot="...">`.

### 3. Route context uses an explicit contract

The recommended component contract is:

```ts
import type { RouteContext } from "@elelcode/lit-router";

@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

Where:

- `routeContext.detail`: the full `RouterChangeDetail`
- `routeContext.params`: current path parameters
- `routeContext.slot`: the slot this component was projected into
- `routeContext.branch`: the route branch for this slot

If you prefer imperative updates, implement:

```ts
setRouteContext(context: RouteContext): void
```

Components must expose either `routeContext` or `setRouteContext()`. The legacy
`routeDetail` / `routeParams` fields are no longer injected.

## Guards and Redirects

Guards may return synchronously or asynchronously:

- `true` / `undefined`: allow navigation
- `false`: block navigation
- `string` / `URL`: redirect
- `{ to, replace }`: redirect with replace semantics

Example:

```ts
{
  path: "lab",
  component: "lab-page",
  guard: () => {
    if (sessionStorage.getItem("lab-open") === "1") {
      return true;
    }
    return { to: "/", replace: true };
  },
}
```

`beforeLeave` has the same return semantics but only applies to the suffix being
unloaded. Shared parent routes are not re-checked when sibling child routes
switch.

## Lazy Loading

Offload non-homepage routes:

```ts
{
  path: "settings",
  component: "settings-page",
  load: () => import("./pages/settings-page.ts"),
}
```

Each route only loads once on first entry.

For global progress indicators, listen to:

- `route-loading-start`
- `route-loading-end`

`event.detail.pending` tells you how many route loads are still in flight.

## Navigation

### Programmatic

```ts
router.push("/settings/profile");
router.replace("/settings");
router.push({ name: "settings-profile" });
const href = router.link({
  name: "user-detail",
  params: { id: "123" },
  query: { tab: "activity" },
});
```

Reverse routing supports:

- Literal segments
- `:param`
- `:param(<pattern>)`
- `*`
- Optional `?` segments like `:lang?/docs`

`+` and `*` parameter modifiers are rejected during reverse routing with an
explicit error.

### Anchor Clicks

The router intercepts same-origin `<a>` clicks inside the configured `basePath`:

- HTML and SVG `<a>` elements
- No `target="_blank"` or `download` attribute
- Not `preventDefault()`'d by application code

Links outside `basePath` fall back to native browser navigation.

### Hash Mode

Use `mode: "hash"` when your static host cannot rewrite every route URL to the
app shell:

```ts
const router = new Router({
  mode: "hash",
  basePath: "/app",
  routes,
});
```

Generated links look like `/#/app/settings/profile`. The router matches the
path, query, and fragment inside `#`, including the configured `basePath`.

Common URL shapes:

| Configuration                      | History URL     | Hash URL                    |
| ---------------------------------- | --------------- | --------------------------- |
| `basePath: "/"` root               | `/`             | `/#`                        |
| `basePath: "/"` route              | `/settings`     | `/#/settings`               |
| `basePath: "/app"` root            | `/app`          | `/#/app`                    |
| `basePath: "/app"` route           | `/app/settings` | `/#/app/settings`           |
| WebView entry + `basePath: "/app"` | n/a             | `/index.html#/app/settings` |

For Wails, Tauri, and other WebView shells, starting from `/index.html` is fine.
Hash mode matches the configured base route without rewriting the first URL,
then keeps generated links on `/index.html` so only the hash changes.

Hash mode uses the Navigation API. Plain fragments like `#section` and hash
paths outside the configured `basePath` are not intercepted.

For replace-style navigation:

```html
<a href="/settings" data-router-replace>Back To Settings</a>
```

## Runtime Route Tree Updates

Insert or remove route branches when auth state, permissions, or plugins change:

```ts
router.insertRoutes([
  { path: "admin", name: "admin", component: "admin-page" },
]);

router.insertRoutes([
  {
    id: "settings-security-plugin",
    path: "security",
    component: "settings-security-page",
  },
], {
  parentId: "settings-shell",
});

router.removeRoute({ id: "settings-security-plugin" });
```

Use `name` for navigation and reverse routing. Use `id` for tree-management
branches that don't need a public navigation name. Parent routes without a
public name can use `id` only.

If you need to stage multiple changes, batch them:

```ts
router.batchRouteUpdates(() => {
  router.insertRoutes([
    { path: "alpha", name: "alpha", component: "alpha-page" },
  ]);
  router.insertRoutes([
    { path: "beta", name: "beta", component: "beta-page" },
  ]);
});
```

If the batch callback throws, the router rolls back the entire batch. The
callback must stay synchronous—finish async work first, then enter the batch.

After insertion or removal, the router immediately re-matches the current URL:

- If the URL still matches, the branch re-commits.
- If the current URL no longer matches, `route-not-found` fires.
- Named route and ID indices are updated atomically.

For a full tree swap, use `setRoutes()` or `router.routes = [...]`. To update
multiple options at once, use `configure({ routes, basePath, beforeRoute })`.

## RouterView

`<router-view>` is the DOM outlet for a router instance.

Key entry points:

- `.router = router`
- `child-slot="..."`
- `no-view-transition`

When no route matches or navigation fails, `<router-view>` renders built-in
fallback views instead of leaving the viewport blank. Override them with light
DOM slots:

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

After a route transition, `<router-view>`:

1. Mounts the route branch
2. Restores scroll position (per history entry, not just per URL)
3. Handles focus: prefers `[data-route-focus]`, then falls back to the viewport
4. Dispatches `route-change`

The host element reflects navigation direction via:

- `data-transition-direction="forward"`
- `data-transition-direction="backward"`
- `data-transition-direction="none"`

Use this for direction-aware View Transition CSS.

## Events

Listen on the `Router` instance:

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.localPathname);
});
```

Available events:

- `route-change`: URL/current state committed. Fires earlier on `Router` (state
  committed), later on `<router-view>` (DOM mounted).
- `route-tree-change`: route definitions changed at runtime.
- `route-error`: guard, load, or commit failure.
- `route-loading-start` / `route-loading-end`: async route loading lifecycle.
- `route-not-found`: no matching route for the current URL.

See [api.md](./api.md) for full event detail types.

## Production Constraints

- Modern browsers only. `URLPattern` is required.
- Single-document SPA only. No SSR.
- Only one started `Router` per document.
- Requires the Navigation API for same-document navigations.
- History entry direction tracking and scroll cache are bounded.
- `load()` promise values are not injected into component context.

## Development Recommendations

- Use `load` for non-homepage routes by default.
- New components should use the `routeContext` contract.
- Parent route components should explicitly provide child `<slot>` elements.
- Handle `route-error` and `route-not-found` at the shell level.
- Keep the Lit dependency on the current 3.x range used by the package.
- If a hash anchor lives inside a shadow tree, expose the same `id` on the host
  element for O(1) lookup.

## Further Reading

- [English API reference](./api.md) — full type signatures and method docs
- [中文 API 参考](./api.zh-CN.md) — Chinese API reference
- [中文指南](./guide.zh-CN.md) — Chinese guide
- [Slot outlets design](./slot-outlets-design.md) — multi-outlet architecture
- [Changelog](../CHANGELOG.md) — version history
