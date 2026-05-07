# API 参考

本文档描述 `@elelcode/lit-router` 当前公开导出的 API。

使用时通常要同时引入类 API 和自定义元素注册：

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## 导出项

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
  RouterView,
  type RouteSelector,
  type RouteTreeChangeDetail,
} from "@elelcode/lit-router";
```

## Router

### `new Router(options?)`

创建路由实例。除非显式传入 `options.autoStart === false`，否则构造后会立即启动。

```ts
const router = new Router({
  basePath: "/app",
  routes: [
    { path: "", name: "home", component: "home-page" },
    { path: "settings", name: "settings", component: "settings-page" },
  ],
});
```

构造参数对象：

- `routes?: RouteDefinition[]`
- `basePath?: string`
- `beforeRoute?: RouteGuard`
- `autoStart?: boolean`

说明：

- `basePath` 默认是 `"/"`
- 同一个 document 内只允许同时启动一个 `Router`
- 运行时更新配置建议统一走 `configure()`

### 属性

#### `router.current: RouterChangeDetail`

最近一次已提交的路由状态。应把它当作只读状态使用。

#### `router.routes: RouteDefinition[]`

获取当前路由树的克隆副本。

直接赋值 `router.routes = [...]` 会整体替换路由树，并触发一次重新匹配。

#### `router.basePath: string`

当前 `basePath`。如果要在运行时修改，建议使用
`configure({ basePath })`，这样会立即刷新当前 URL。

#### `router.beforeRoute?: RouteGuard`

当前全局进入守卫。运行时修改也建议使用 `configure({ beforeRoute })`。

#### `router.lastError?: RouteErrorDetail`

最近一次路由错误详情。

#### `router.lastNotFound?: RouteNotFoundDetail`

最近一次 404 详情。

### 方法

#### `router.start(): void`

开始接管浏览器导航，并解析当前 URL。

以下情况会抛错：

- 浏览器没有 `URLPattern`
- 当前 document 里已有其他已启动的 `Router`

#### `router.stop(): void`

停止接管浏览器事件，并让当前未完成的导航失效。

#### `router.configure(options): void`

一次性更新一个或多个配置，并对当前 URL 只做一次刷新。

```ts
router.configure({
  basePath: "/workspace",
  beforeRoute: authGuard,
  routes,
});
```

支持字段：

- `routes`
- `basePath`
- `beforeRoute`

#### `router.setRoutes(routes): void`

整体替换整棵路由树。

如果只是按权限、插件、功能开关增删局部分支，优先使用 `insertRoutes()` /
`removeRoute()`。

#### `router.insertRoutes(routes, options?): void`

运行时插入一个或多个路由定义。

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

`RouteInsertOptions`：

- `parentId?: string`
- `parentName?: string`
- `index?: number`

规则：

- `parentId` 和 `parentName` 只能二选一
- 重复的 `id` 或重复的 `name` 会直接报错
- 动态插入子路由时，父组件仍然必须暴露对应的命名 `slot`
- 插入完成后，路由器会立刻用当前 URL 重新匹配

#### `router.removeRoute(selector): boolean`

按 `name` 或按选择器对象删除一个运行时路由分支。

```ts
router.removeRoute("reports");
router.removeRoute({ id: "reports-plugin" });
```

`selector` 可取：

- `string`：按路由 `name`
- `RouteSelector`：`{ id?: string; name?: string }`

找到并删除时返回 `true`，否则返回 `false`。

#### `router.batchRouteUpdates(update): void`

把多次路由树修改合并成一次刷新。

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

规则：

- 回调必须保持同步
- 回调抛错时，整批修改会回滚
- 成功提交时只会派发一次 `route-tree-change`，且 `reason` 为 `"batch"`

#### `router.push(url): void`

以 push 语义导航。

可接受参数：

- `string`
- `URL`
- `RouteLocation`

#### `router.replace(url): void`

以 replace 语义导航。

参数类型与 `push()` 相同。

#### `router.link(location): string`

基于命名路由生成应用内 href。

```ts
const href = router.link({
  name: "message",
  params: { id: "42" },
  query: { tab: "activity" },
  hash: "summary",
});
```

说明：

- 依赖路由 `name`
- 支持字面量片段、`:param`、`:param(<pattern>)`、`*`，以及 `:lang?/docs`
  这类可选 `?` 片段
- 路径里如果出现 `+` 或 `*` 参数修饰符，反向生成时会直接抛错

### 事件

监听对象是 `Router` 实例本身：

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.localPathname);
});
```

#### `route-change`

详情类型：`RouterChangeDetail`

在路由器完成 URL / current 状态提交后触发。

#### `route-tree-change`

详情类型：`RouteTreeChangeDetail`

运行时路由树发生变化后触发。

`reason` 取值：

- `"replace"`
- `"insert"`
- `"remove"`
- `"batch"`

#### `route-loading-start`

详情类型：`RouteLoadingDetail`

分支进入懒加载前触发。

#### `route-loading-end`

详情类型：`RouteLoadingDetail`

分支结束懒加载后触发，即使这次加载最终失败也会触发。

#### `route-error`

详情类型：`RouteErrorDetail`

导航在以下阶段失败时触发：

- 守卫
- 懒加载
- 视图 commit
- 其他内部错误，记为 `"unknown"`

#### `route-not-found`

详情类型：`RouteNotFoundDetail`

当前 URL 位于 `basePath` 内，但没有任何路由命中时触发。

## `<router-view>`

`<router-view>` 是 `Router` 的渲染出口。

```html
<router-view></router-view>
```

### 注册

通过副作用导入注册元素：

```ts
import "@elelcode/lit-router";
```

### 属性与 attribute

#### `.router: Router | undefined`

把路由实例挂到当前 outlet 上。

```ts
const outlet = document.querySelector("router-view")!;
outlet.router = router;
```

如果传入的路由尚未启动，outlet 会自动调用 `start()`。

#### `child-slot="route-child"`

配置嵌套路由的子出口 slot 名。

默认值是 `DEFAULT_CHILD_SLOT`，即 `"route-child"`。

如果某个路由声明了 `children`，父组件必须提供匹配的 slot：

```html
<slot name="route-child"></slot>
```

#### `no-view-transition`

关闭当前 outlet 的 View Transitions。

#### `routerView.current: RouterChangeDetail`

当前 outlet 最近一次已完成 commit 的路由详情。

### 方法

#### `routerView.push(url): void`

对 `router.push(url)` 的透传。

#### `routerView.replace(url): void`

对 `router.replace(url)` 的透传。

### 事件

如果你关心的是 DOM 真正挂载完成后的时机，而不是路由器状态提交本身，就监听
`<router-view>`：

```ts
outlet.addEventListener("route-change", (event) => {
  console.log("DOM committed", event.detail.pathname);
});
```

#### `route-change`

详情类型：`RouterChangeDetail`

该事件会在以下流程全部完成后触发：

- 页面分支挂载
- 滚动恢复
- 焦点移动

它晚于 `Router` 实例上的 `route-change`。

#### `route-error`

详情类型：`RouteErrorDetail`

当前 outlet 自身 commit 失败，或它所挂载的 `Router` 进入错误状态时触发。

#### `route-not-found`

详情类型：`RouteNotFoundDetail`

当前 outlet 所挂载的 `Router` 进入 404 状态时触发。

### fallback slot

你可以用 light DOM slot 覆盖内建兜底视图：

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

可用 slot：

- `slot="404"`
- `slot="error"`

### Host data attribute

outlet host 会反映导航方向：

- `data-transition-direction="forward"`
- `data-transition-direction="backward"`
- `data-transition-direction="none"`

可直接拿来写方向感知的 View Transition CSS。

### 焦点与滚动行为

成功 commit 后：

- 优先聚焦 `[data-route-focus]`
- 找不到时回退到聚焦 viewport 自身
- 滚动恢复绑定在 history entry 上，而不是单纯的 URL
- hash 锚点只通过 `document.getElementById()` 查找

如果锚点在组件的 shadow tree 里，请把同样的 `id` 暴露到 host 上，保持 O(1)
查找。

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

字段说明：

- `id`：运行时树管理标识，用于插入、删除、替换分支
- `name`：路由名，供 `push({ name })`、`replace({ name })`、`link()` 使用
- `path`：路径片段。`""` 表示 index，`"*"` 表示兜底
- `title`：文档标题模板，commit 时会展开 `:param`
- `viewTransitionName`：当前路由作为叶子路由时，`<router-view>` 使用的
  `view-transition-name`
- `component`：自定义元素标签名，或返回 `HTMLElement` 的工厂函数
- `children`：嵌套路由树，通过命名 slot 渲染
- `guard`：进入守卫
- `beforeLeave`：离开当前分支该段路由时触发的守卫
- `load`：首次进入时的异步加载器。Promise
  返回值会被忽略，只用于代码分割或副作用；会收到 `{ signal }` 以便取消
- `props`：额外赋值到组件实例上的属性

匹配语义：

- 路由会在编译阶段做 specificity 排序
- 静态片段优先于参数片段
- 参数片段优先于兜底通配
- 不再依赖声明顺序规避拦截错误

## 导航与守卫类型

### `RouteLocation`

```ts
interface RouteLocation {
  name: string;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}
```

### `RouteGuardResult`

进入守卫和离开守卫都可以返回：

- `true`
- `undefined`
- `false`
- `string`
- `URL`
- `{ to: string | URL; replace?: boolean }`

语义：

- `true` 或 `undefined`：放行
- `false`：阻止导航
- 重定向值：立即重定向

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

执行顺序：

- 全局 `beforeRoute`
- 命中分支上的 `guard`，从父到子
- 每个 guard 都会收到导航 `signal`，当更新的导航取代它时会被 abort

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

执行顺序：

- 只作用于即将被卸载的那段后缀分支
- 从叶子往回执行，直到共享父级边界

### `RouteLoadContext`

```ts
interface RouteLoadContext {
  signal: AbortSignal;
}
```

`load()` 可以使用 `signal` 在更新的导航取代当前导航时取消自己的异步工作。

## RouteContext 协议

路由组件应该暴露以下契约之一：

```ts
@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

或者：

```ts
setRouteContext(context: RouteContext): void
```

`RouteContext`：

```ts
interface RouteContext {
  detail: RouterChangeDetail;
  params: Record<string, string>;
}
```

其中 `detail.query` 是 `URLSearchParams`。

## 事件详情类型

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

字段补充：

- `pathname`：浏览器完整 pathname
- `localPathname`：相对 `basePath` 的本地 pathname
- `branch`：从根到叶的命中分支
- `leaf`：命中的叶子路由
- `historyKey`：history entry 级别的方向与滚动跟踪键
- `direction`：当前导航方向

### `RouteLoadingDetail`

```ts
interface RouteLoadingDetail {
  url: URL;
  branch: RouteDefinition[];
  pending: number;
  direction: NavigationDirection;
}
```

`pending` 表示当前路由器里仍在进行中的懒加载数量。

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

## 边界与约束

- 仅面向现代浏览器，依赖原生 `URLPattern`
- 设计目标是单 document SPA，不覆盖 SSR
- 同源链接拦截只发生在配置的 `basePath` 内
- 异步懒加载与导航 commit 都做了竞态保护
- history 方向缓存是有界的，不会无限增长
- 同一路由在 `load()` 未完成期间会复用同一个 pending Promise
