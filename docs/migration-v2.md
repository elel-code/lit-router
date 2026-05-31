# v2 Migration Guide

`@elelcode/lit-router` v2 is a Navigation API-first release. It removes the
legacy hash routing branch and aligns public route state with
`navigation.currentEntry.key`.

## Version Boundary

Upgrade to v2 when your application targets browsers with:

- `window.navigation`
- `navigation.currentEntry.key`
- `URLPattern`

The package version is `2.0.0` because the router removes public API surface and
changes one public route-detail field.

## Router Options

Remove `mode: "hash"` from every `new Router()` or `router.configure()` call.

```ts
const router = new Router({
  basePath: "/app",
  routes,
});
```

The only URL model is now path-based same-document navigation. Production
deployments must rewrite application routes to the app shell, such as
`/index.html`, before the browser loads the SPA.

## URLs And Links

Hash route URLs such as `/#/settings` are no longer treated as application
routes. Use path URLs instead:

```ts
router.push("/settings");
router.link({ name: "settings" }); // "/settings"
```

Plain document fragments remain valid URL hashes:

```ts
router.link({ name: "message", params: { id: "42" }, hash: "summary" });
// "/messages/42#summary"
```

## Route Detail Keys

Rename `historyKey` to `navigationKey` wherever application code reads route
state:

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.navigationKey);
});
```

The value comes from `navigation.currentEntry.key` and is used for per-entry
direction and scroll restoration.

## Runtime Requirements

v2 does not provide a `popstate`, `hashchange`, or direct History API fallback.
If `window.navigation.navigate` or `navigation.currentEntry.key` is unavailable,
the router fails during startup with an explicit Navigation API error.
