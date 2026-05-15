# @elelcode/lit-router

A modern router for Web Components and Lit, built around native browser
capabilities such as `URLPattern`, the `Navigation API`, and the
`View Transitions API`.

Docs:

- English guide: [docs/guide.md](./docs/guide.md)
- Chinese guide: [docs/guide.zh-CN.md](./docs/guide.zh-CN.md)
- English API reference: [docs/api.md](./docs/api.md)
- 中文 API 参考: [docs/api.zh-CN.md](./docs/api.zh-CN.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Highlights

- Route trees are declared in TypeScript, not scattered across HTML markers.
- Route trees can be updated at runtime by inserting, deleting, or replacing
  branches.
- Nested routes are rendered through native named slots.
- Guard redirects, leave guards, lazy loading, and route commits are race-safe.
- RouterView exposes direction-aware commits, fallback slots, and loading
  lifecycle events without adding wrapper components.
- Same-origin link interception is limited to the configured `basePath`.
- Route components receive an explicit `RouteContext` contract.

## Install

```bash
deno add jsr:@elelcode/lit-router
```

Local development uses the Deno toolchain:

```bash
deno task fmt:check
deno task lint
deno task check
deno task test
```

## Docs

- Overview and quick start: this page
- [English guide](./docs/guide.md)
- [中文指南](./docs/guide.zh-CN.md)
- [English API reference](./docs/api.md)
- [中文 API 参考](./docs/api.zh-CN.md)
- [Slot outlets design](./docs/slot-outlets-design.md)
- [Changelog](./CHANGELOG.md)

## Quick Start

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";

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

## Route Definitions

Each route is a `RouteDefinition`:

```ts
const routes = [
  {
    path: "users/:id",
    title: "User :id",
    component: "user-page",
    meta: { requiresAuth: true },
    props: { pageSize: 20 },
    guard: ({ leaf, params }) =>
      leaf?.meta?.requiresAuth && params.id === "me" ? "/profile" : true,
    load: () => import("./pages/user-page.ts"),
  },
];
```

Supported fields:

- `id`: optional stable tree-management identifier used for runtime route-tree
  updates.
- `name`: optional stable route name used by `router.link()` and named
  navigation.
- `path`: route path segment. Use `""` for index routes and `"*"` for catch-all.
- `slot`: parent slot name used by this route. Defaults to `"route-child"`;
  `"404"` and `"error"` are reserved fallback slot names.
- `title`: optional document title template. `:param` placeholders are expanded.
- `viewTransitionName`: optional CSS `view-transition-name` used by
  `<router-view>` for this route when it is the leaf route.
- `component`: custom element tag name or a factory function.
- `children`: nested route tree rendered through a named slot.
- `meta`: route metadata for guards, events, and route context. It is not
  assigned to the rendered DOM element.
- `props`: extra properties assigned to the rendered element with a shallow
  `Object.assign`.
- `guard`: async or sync route guard. Return `false` to block, or a string / URL
  / redirect object to redirect.
- `beforeLeave`: async or sync leave guard for the branch being unloaded. Return
  `false` to stay on the current page, or a redirect to reroute instead.
- `load`: async loader used for first-entry code splitting. It receives
  `{ signal }`, so fetches or imports can be cancelled when navigation becomes
  stale.

Route matching is compiled with specificity ordering, so static segments win
over params, and params win over catch-all routes even if the declarations are
not listed in that order.

## Runtime Route Tree Updates

Insert or delete route branches when auth, feature flags, or plugin modules
change:

```ts
router.insertRoutes([
  { path: "admin", name: "admin", component: "admin-page" },
]);

router.insertRoutes([
  { id: "settings-audit-plugin", path: "audit", component: "audit-page" },
], {
  parentId: "settings-shell",
});

router.removeRoute({ id: "settings-audit-plugin" });
```

Inserted child routes still require the parent route component to expose the
configured child slot.

Use `name` for navigation and reverse routing. Use `id` when you need to manage
route-tree branches that do not need a public navigation name.

If you need to stage multiple changes, batch them into a single refresh:

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

If the batch callback throws, the router rolls back that batch instead of
leaving a partially applied route tree.

The batch callback must stay synchronous. If you need async work, finish it
first and then enter `batchRouteUpdates()`.

If you need to swap the whole tree at once, you can still replace it directly:

```ts
router.setRoutes([
  { path: "", component: "home-page" },
  { path: "admin", component: "admin-page" },
]);
```

`router.configure({ routes })` remains available when you need to update
multiple router options together.

## Route Context Contract

Route components should use the explicit `RouteContext` contract:

```ts
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RouteContext } from "@elelcode/lit-router";

@customElement("user-page")
class UserPage extends LitElement {
  @property({ attribute: false })
  accessor routeContext: RouteContext | undefined;

  render() {
    return html`
      <h1>User ${this.routeContext?.params.id}</h1>
    `;
  }
}
```

If you prefer imperative updates, the component may implement:

```ts
setRouteContext(context: RouteContext): void
```

Components must expose either `routeContext` or `setRouteContext()`. The router
no longer injects legacy `routeDetail` / `routeParams` fields.

`routeContext.slot` identifies the slot this component was projected into, and
`routeContext.branch` contains the branch for that slot.

## Nested Routes

If a route declares `children`, the parent component must provide a slot for the
child branch:

```html
<slot name="route-child"></slot>
```

Or set a custom slot name on `<router-view child-slot="content">`.

Sibling child routes can target additional parent slots with `slot`:

```ts
{
  path: "settings",
  component: "settings-layout",
  children: [
    { path: "profile", component: "settings-profile" },
    { path: "profile", slot: "sidebar", component: "profile-sidebar" },
  ],
}
```

`RouterChangeDetail.slotBranches` exposes matched non-main slot branches.

## Navigation

Programmatic navigation:

```ts
router.push("/settings/profile");
router.replace("/settings");
router.push({ name: "user-detail", params: { id: "123" } });
const href = router.link({
  name: "user-detail",
  params: { id: "123" },
  query: { tab: "activity" },
});
const attrs = router.linkAttributes(
  { name: "user-detail", params: { id: "123" } },
  { replace: true },
);
const match = router.resolveUrl("/users/123");
const namedMatch = router.resolveNamed("user-detail", {
  params: { id: "123" },
});
```

Use hash routing when the deployment host cannot rewrite all application URLs to
the app shell:

```ts
const router = new Router({
  mode: "hash",
  basePath: "/app",
  routes,
});

router.link({ name: "user-detail", params: { id: "123" } });
// "/#/app/users/123"
```

In hash mode, route matching, guards, query parsing, and `RouteContext` use the
path inside `#`. `basePath` stays part of the route path, so switching between
history and hash modes moves `/app/users/123` between the browser pathname and
the hash payload without changing the route tree.

When a WebView starts at an entry document such as `/index.html`, hash mode
normalizes the first URL with `replaceState`, for example `/index.html#/app`,
and keeps later links on the same document path.

Named reverse routing supports literal segments, `:param`, `:param(<pattern>)`,
`*`, and optional `?` tokens such as `:lang?/docs`. Route tokens with `+` or `*`
modifiers are still rejected during `router.link()` generation.

Anchor navigation:

- Same-origin links inside the configured `basePath` are intercepted.
- In hash mode, router links use `#/path` and plain fragments such as `#section`
  are left to the browser.
- Same-origin links outside `basePath` fall back to the browser.
- Both HTML and SVG `<a>` elements are supported.
- Add `data-router-replace` to an anchor to use replace-style navigation.
- Use `router.linkAttributes(location, { replace: true })` when creating
  replace-style links from JavaScript.

Leave guards run only for the suffix being unloaded. Shared parent routes are
not re-checked when sibling child routes switch.

## RouterView

`<router-view>` supports:

- `.router`: attach a `Router` instance directly.
- `child-slot`: customize the slot used for nested children.
- `no-view-transition`: disable page-level view transitions for that outlet.

Fallback views:

- If navigation resolves to `route-not-found`, `<router-view>` renders a default
  404 fallback instead of leaving the viewport blank.
- If navigation throws `route-error`, `<router-view>` renders a default error
  fallback.
- You can override both with light DOM slots:

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

Focus handling:

- After navigation, the view tries to focus `[data-route-focus]`.
- If none is found, it focuses the route viewport itself.
- The `router-view` `route-change` event fires only after that outlet finishes
  DOM commit, scroll restore, and focus management.
- The host element exposes `data-transition-direction="forward|backward|none"`
  so CSS can distinguish push, pop, and replace-style transitions.

Scroll and hash behavior:

- Scroll restoration is tracked per history entry, not just by URL.
- Hash targets are resolved with `document.getElementById()`.
- If an anchor lives inside a component shadow tree, expose that `id` on the
  host element in light DOM so hash scrolling stays O(1).

Recommended pattern:

```html
<h1 data-route-focus tabindex="-1">User Detail</h1>
```

## Events

Listen on either the `Router` instance or `<router-view>`:

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.pathname);
});
```

Available events:

- `route-change`: successful route transition. On `Router`, it fires after the
  URL/current state is committed. `event.detail.direction` reports
  `forward|backward|none`. On `<router-view>`, it fires later, after the
  rendered branch has mounted.
- `route-tree-change`: route definitions changed at runtime. Use this for menus,
  plugin registries, or permission-driven shells. `event.detail.routeCount` is
  cheap to read; `event.detail.routes` is a frozen read-only snapshot.
- `route-error`: guard, load, or commit failure.
- `route-loading-start` / `route-loading-end`: async route loading entered or
  finished. `event.detail.pending` is the current in-flight loading count.
- `route-not-found`: no matching route for the current URL.

## Examples

### `examples/minimal/` — Feature Playground

A compact playground covering the full feature set.

- index routes
- nested slot-based rendering
- lazy route loading with `route-loading-start` / `route-loading-end`
- guarded redirects and `beforeLeave`
- runtime `insertRoutes()` / `removeRoute()`
- explicit route context delivery
- route error / 404 fallback slots
- direction-aware `router-view[data-transition-direction]`

Key files:

- [examples/minimal/main.ts](./examples/minimal/main.ts)
- [examples/minimal/example-pages.ts](./examples/minimal/example-pages.ts)
- [examples/minimal/lazy-drafts.ts](./examples/minimal/lazy-drafts.ts)

### `examples/demo/` — Interactive Demo

A full interactive demo with navigation bar, status panel, guarded lab route,
and dynamic module loading. Run it with:

```bash
deno serve --port 8000 index.html
```

Key files:

- [examples/demo/app-root.ts](./examples/demo/app-root.ts)
- [examples/demo/demo-pages.ts](./examples/demo/demo-pages.ts)
- [examples/demo/lazy-drafts-panel.ts](./examples/demo/lazy-drafts-panel.ts)

## Production Notes

- This package is validated and published with the Deno toolchain. JSR publishes
  the TypeScript source directly.
- The source still imports `lit` through Deno's native `npm:` support. That is a
  Deno runtime feature, not an `npm install` / `npm publish` workflow.
- The router intentionally depends on the native `URLPattern` API. Use a modern
  browser baseline or load a `URLPattern` polyfill before `router.start()`.
- When the `Navigation API` is available, the router prefers it over `popstate`
  for same-document navigations.
- Only one started `Router` instance is supported per document at a time.
- Route guards, lazy loaders, and route commits are async and race-aware.
- History-entry direction bookkeeping is bounded instead of growing without
  limit during very long-lived sessions.
- `router-view` keeps a bounded scroll-position cache instead of allowing
  unbounded growth during long sessions.
- For production shells, render explicit UI for `route-error` and
  `route-not-found`.

## API Reference

The full exported API surface is documented in [docs/api.md](./docs/api.md).
