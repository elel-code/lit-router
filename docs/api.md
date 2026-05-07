# API Reference

This document describes the public surface exported from `@elelcode/lit-router`.

Import both the class API and the custom element registration:

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## Exports

```ts
import {
  DEFAULT_CHILD_SLOT,
  type NavigationDirection,
  type RouteComponentFactory,
  type RouteContext,
  type RouteContextReceiver,
  type RouteDefinition,
  type RouteErrorDetail,
  type RouteGuard,
  type RouteGuardResult,
  type RouteInsertOptions,
  type RouteLeaveGuard,
  type RouteLoadContext,
  type RouteLoadingDetail,
  type RouteLocation,
  type RouteNotFoundDetail,
  type RouteParamsInput,
  type RouteParamValue,
  type RouteQueryInit,
  type RouteQueryValue,
  Router,
  type RouterChangeDetail,
  type RouterLinkAttributes,
  type RouterLinkOptions,
  RouterView,
  type RouteSelector,
  type RouteTreeChangeDetail,
} from "@elelcode/lit-router";
```

## Router

### `new Router(options?)`

Creates a router instance and starts it immediately unless
`options.autoStart === false`.

```ts
const router = new Router({
  basePath: "/app",
  routes: [
    { path: "", name: "home", component: "home-page" },
    { path: "settings", name: "settings", component: "settings-page" },
  ],
});
```

Constructor options:

- `routes?: RouteDefinition[]`
- `basePath?: string`
- `beforeRoute?: RouteGuard`
- `autoStart?: boolean`

Notes:

- `basePath` defaults to `"/"`.
- Only one started `Router` instance is supported per document.
- Use `configure()` to update router options after construction.

### Properties

#### `router.current: RouterChangeDetail`

The latest committed route state. Treat it as read-only application state.

#### `router.routes: RouteDefinition[]`

Gets a cloned snapshot of the current route tree.

Assigning `router.routes = [...]` replaces the full tree and triggers a route
refresh.

#### `router.basePath: string`

Current base path. Prefer `configure({ basePath })` when changing it at runtime
so the router refreshes immediately.

#### `router.beforeRoute?: RouteGuard`

Current global enter guard. Prefer `configure({ beforeRoute })` when changing it
at runtime.

#### `router.lastError?: RouteErrorDetail`

The latest route error, if the current state is an error state.

#### `router.lastNotFound?: RouteNotFoundDetail`

The latest not-found detail, if the current state is a not-found state.

### Methods

#### `router.start(): void`

Starts listening to browser navigation and resolves the current URL.

Throws when:

- `URLPattern` is not available
- another router is already started in the same document

#### `router.stop(): void`

Stops browser event handling and invalidates in-flight navigation work.

#### `router.configure(options): void`

Updates one or more router options and refreshes the current URL once.

```ts
router.configure({
  basePath: "/workspace",
  beforeRoute: authGuard,
  routes,
});
```

Supported fields:

- `routes`
- `basePath`
- `beforeRoute`

#### `router.setRoutes(routes): void`

Replaces the entire route tree.

Use this when you really want a full tree swap. If you are enabling or disabling
features incrementally, prefer `insertRoutes()` and `removeRoute()`.

#### `router.insertRoutes(routes, options?): void`

Inserts one or more route definitions at runtime.

```ts
router.insertRoutes([
  { path: "reports", id: "reports-plugin", component: "reports-page" },
]);

router.insertRoutes([
  { path: "audit", id: "settings-audit", component: "audit-page" },
], {
  parentId: "settings-shell",
  index: 1,
});
```

`RouteInsertOptions`:

- `parentId?: string`
- `parentName?: string`
- `index?: number`

Rules:

- Provide either `parentId` or `parentName`, not both.
- Duplicate route `id` and duplicate route `name` are rejected.
- Inserted child routes still require the parent component to expose the child
  slot.
- The router immediately re-matches the current URL after insertion.

#### `router.removeRoute(selector): boolean`

Removes a runtime route branch by `name` or by selector object.

```ts
router.removeRoute("reports");
router.removeRoute({ id: "reports-plugin" });
```

`selector` may be:

- `string`: treated as a route `name`
- `RouteSelector`: `{ id?: string; name?: string }`

Returns `true` when a route was removed, otherwise `false`.

#### `router.batchRouteUpdates(update): void`

Groups multiple tree updates into a single refresh.

```ts
router.batchRouteUpdates(() => {
  router.insertRoutes([{
    path: "alpha",
    name: "alpha",
    component: "alpha-page",
  }]);
  router.insertRoutes([{ path: "beta", name: "beta", component: "beta-page" }]);
});
```

Rules:

- The callback must stay synchronous.
- If the callback throws, the router rolls the batch back.
- A successful batch emits one `route-tree-change` event with `reason: "batch"`.

#### `router.push(url): void`

Pushes a new navigation entry.

Accepted inputs:

- `string`
- `URL`
- `RouteLocation`

#### `router.replace(url): void`

Navigates with replace semantics.

Accepted inputs are the same as `push()`.

#### `router.link(location): string`

Builds an application-relative href from a named route.

```ts
const href = router.link({
  name: "message",
  params: { id: "42" },
  query: { tab: "activity" },
  hash: "summary",
});
```

Notes:

- Requires a route `name`.
- Supports literal segments, `:param`, `:param(<pattern>)`, `*`, and optional
  `?` tokens such as `:lang?/docs`.
- Rejects `+` and `*` parameter modifiers during reverse routing.

#### `router.linkAttributes(location, options?): RouterLinkAttributes`

Builds attributes for a named-route anchor. Use this when JavaScript creates
links that need replace semantics.

```ts
const attrs = router.linkAttributes(
  { name: "message", params: { id: "42" } },
  { replace: true },
);
// { href: "/messages/42", "data-router-replace": "" }
```

### Events

Listen on the `Router` instance:

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.localPathname);
});
```

#### `route-change`

Detail type: `RouterChangeDetail`

Fires after the router commits URL/current state.

#### `route-tree-change`

Detail type: `RouteTreeChangeDetail`

Fires after runtime route-tree changes.

`reason` is one of:

- `"replace"`
- `"insert"`
- `"remove"`
- `"batch"`

#### `route-loading-start`

Detail type: `RouteLoadingDetail`

Fires before a branch starts lazy loading.

#### `route-loading-end`

Detail type: `RouteLoadingDetail`

Fires after a branch finishes lazy loading, even when the load fails.

#### `route-error`

Detail type: `RouteErrorDetail`

Fires when navigation fails during:

- guard evaluation
- lazy loading
- view commit
- other internal failures reported as `"unknown"`

#### `route-not-found`

Detail type: `RouteNotFoundDetail`

Fires when the current URL is inside `basePath` but no route matches.

## `<router-view>`

`<router-view>` is the rendering outlet for a `Router`.

```html
<router-view></router-view>
```

### Registration

The element is registered by importing the package side effect:

```ts
import "@elelcode/lit-router";
```

### Properties and attributes

#### `.router: Router | undefined`

Attaches the router instance to this outlet.

```ts
const outlet = document.querySelector("router-view")!;
outlet.router = router;
```

When a router is attached, the outlet starts it if needed.

#### `child-slot="route-child"`

Configures the slot name used for nested child routes.

Default: `DEFAULT_CHILD_SLOT`, which is `"route-child"`.

If a route has children, the parent component must expose a matching slot:

```html
<slot name="route-child"></slot>
```

#### `no-view-transition`

Disables View Transitions for this outlet.

#### `routerView.current: RouterChangeDetail`

The latest detail committed into this outlet.

### Methods

#### `routerView.push(url): void`

Imperative passthrough to `router.push(url)`.

#### `routerView.replace(url): void`

Imperative passthrough to `router.replace(url)`.

### Events

Listen on the outlet when you care about DOM commit completion instead of router
state only:

```ts
outlet.addEventListener("route-change", (event) => {
  console.log("DOM committed", event.detail.pathname);
});
```

#### `route-change`

Detail type: `RouterChangeDetail`

Fires after the outlet has:

- mounted the branch
- restored scroll
- moved focus

This is later than `Router`'s `route-change`.

#### `route-error`

Detail type: `RouteErrorDetail`

Fires when commit fails inside the outlet, or when the attached router emits a
route error.

#### `route-not-found`

Detail type: `RouteNotFoundDetail`

Fires when the attached router enters a not-found state.

### Fallback slots

Override the built-in fallback UI with light DOM slots:

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

Available slots:

- `slot="404"`
- `slot="error"`

### Host data attributes

The outlet host reflects navigation direction:

- `data-transition-direction="forward"`
- `data-transition-direction="backward"`
- `data-transition-direction="none"`

Use this to write direction-aware View Transition CSS.

### Focus and scroll behavior

After a successful route commit:

- the outlet first tries to focus `[data-route-focus]`
- otherwise it focuses the viewport itself
- scroll restoration is tracked per history entry
- hash scrolling uses `document.getElementById()` only

If an anchor target lives inside a shadow tree, expose the same `id` on the host
element so lookup stays O(1).

## RouteDefinition

```ts
interface RouteDefinition {
  id?: string;
  name?: string;
  path: string;
  title?: string;
  viewTransitionName?: string;
  component?: string | RouteComponentFactory;
  children?: RouteDefinition[];
  guard?: RouteGuard;
  beforeLeave?: RouteLeaveGuard;
  load?: (context?: RouteLoadContext) => Promise<unknown>;
  props?: Record<string, unknown>;
}
```

Field notes:

- `id`: stable tree-management identifier for runtime insertion/removal
- `name`: stable route name for `push({ name })`, `replace({ name })`, and
  `link()`
- `path`: route segment. Use `""` for index routes and `"*"` for catch-all
- `title`: document title template. `:param` tokens are expanded on commit
- `viewTransitionName`: route-level `view-transition-name` used by
  `<router-view>` when this route is the leaf
- `component`: custom-element tag name or factory returning an `HTMLElement`
- `children`: nested route tree rendered through a named slot
- `guard`: enter guard for this route
- `beforeLeave`: leave guard for this route when its branch segment unloads
- `load`: first-entry async loader. Its resolved value is ignored; use it for
  code splitting or side effects only. Receives `{ signal }` for cancellation.
- `props`: extra properties assigned onto the rendered element with a shallow
  `Object.assign`

Matching semantics:

- routes are compiled with specificity sorting
- static segments win over params
- params win over catch-all
- declaration order does not decide specificity bugs

## Navigation and guard types

### `RouteLocation`

```ts
interface RouteLocation {
  name: string;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}
```

### `RouterLinkOptions` / `RouterLinkAttributes`

```ts
interface RouterLinkOptions {
  replace?: boolean;
}

interface RouterLinkAttributes {
  href: string;
  "data-router-replace"?: "";
}
```

### `RouteGuardResult`

Route guards and leave guards may return:

- `true`
- `undefined`
- `false`
- `string`
- `URL`
- `{ to: string | URL; replace?: boolean }`

Semantics:

- `true` or `undefined`: allow navigation
- `false`: block navigation
- redirect values: redirect immediately

### `RouteGuard`

```ts
type RouteGuard = (
  detail: RouterChangeDetail & {
    from: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) =>
  | boolean
  | void
  | string
  | URL
  | { to: string | URL; replace?: boolean }
  | Promise<
    | boolean
    | void
    | string
    | URL
    | { to: string | URL; replace?: boolean }
  >;
```

Order:

- global `beforeRoute`
- matched branch `guard` functions from parent to leaf
- each guard receives a navigation `signal` that aborts when a newer navigation
  supersedes it

### `RouteLeaveGuard`

```ts
type RouteLeaveGuard = (
  detail: RouterChangeDetail & {
    to: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) =>
  | boolean
  | void
  | string
  | URL
  | { to: string | URL; replace?: boolean }
  | Promise<
    | boolean
    | void
    | string
    | URL
    | { to: string | URL; replace?: boolean }
  >;
```

Order:

- runs only for the suffix being unloaded
- evaluated from leaf back toward the shared parent

### `RouteLoadContext`

```ts
interface RouteLoadContext {
  signal: AbortSignal;
}
```

Use `signal` to cancel work started by `load()` when a newer navigation
supersedes it.

## Route context contract

Route elements should expose one of these contracts:

```ts
@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

or

```ts
setRouteContext(context: RouteContext): void
```

`RouteContext`:

```ts
interface RouteContext {
  detail: RouterChangeDetail;
  params: Record<string, string>;
}
```

`detail.query` is a `URLSearchParams`.

## Event detail types

### `RouterChangeDetail`

```ts
interface RouterChangeDetail {
  pathname: string;
  localPathname: string;
  basePath: string;
  search: string;
  query: URLSearchParams;
  hash: string;
  params: Record<string, string>;
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  url: URL;
  historyKey: string;
  direction: "forward" | "backward" | "none";
}
```

Field notes:

- `pathname`: full browser pathname
- `localPathname`: pathname relative to `basePath`
- `branch`: matched route branch from root to leaf
- `leaf`: matched leaf route
- `historyKey`: internal key for per-entry direction and scroll tracking
- `direction`: computed navigation direction

### `RouteLoadingDetail`

```ts
interface RouteLoadingDetail {
  url: URL;
  branch: RouteDefinition[];
  pending: number;
  direction: NavigationDirection;
}
```

`pending` is the current in-flight load count across the router.

### `RouteErrorDetail`

```ts
interface RouteErrorDetail {
  url: URL;
  error: unknown;
  phase: "guard" | "load" | "commit" | "unknown";
  direction: NavigationDirection;
}
```

### `RouteNotFoundDetail`

```ts
interface RouteNotFoundDetail {
  url: URL;
  basePath: string;
  direction: NavigationDirection;
}
```

### `RouteTreeChangeDetail`

```ts
interface RouteTreeChangeDetail {
  reason: "replace" | "insert" | "remove" | "batch";
  routes: RouteDefinition[];
}
```

## Constraints

- Modern browser only. `URLPattern` is required.
- The router is designed for same-document SPA navigation, not SSR.
- Same-origin anchor interception is limited to the configured `basePath`.
- Lazy loads and navigation commits are race-safe.
- History direction bookkeeping is bounded instead of growing forever.
- `load()` is deduplicated per route while a pending import is in flight.
