# lit-router 中文指南

## 定位

`@elelcode/lit-router` 是一个面向现代浏览器和 Web Components / Lit 的
客户端路由。

它的设计目标不是“兼容所有旧环境”，而是优先利用现代原生能力：

- `URLPattern`
- `Navigation API`
- `View Transitions API`
- 命名 `slot`
- Custom Elements / Lit

如果你的应用就是现代浏览器单 SPA，这套模型会比传统框架式路由更直接。

当前功能层面也支持运行时按分支插入、删除、替换 `route tree`，适合权限路由、
特性开关、插件式页面装配这类场景。

相关文档：

- 英文指南：[guide.md](./guide.md)
- 英文 API 参考：[api.md](./api.md)
- 中文 API 参考：[api.zh-CN.md](./api.zh-CN.md)
- Slot 多出口设计：[slot-outlets-design.md](./slot-outlets-design.md)
- 变更日志：[CHANGELOG.md](../CHANGELOG.md)
- 完整示例：[examples/minimal/main.ts](../examples/minimal/main.ts)

## 安装

```bash
deno add jsr:@elelcode/lit-router
```

使用：

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## 最小用法

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

## Playground 示例

如果你想一次看全当前特性，直接看仓库里的 `examples/minimal/`。

它不是单纯的 hello world，而是一个压缩过的真实 playground，覆盖了：

- 懒加载与 `route-loading-start` / `route-loading-end`
- `beforeLeave` 阻断离开
- 运行时 `insertRoutes()` / `removeRoute()`
- `guard` 重定向
- `route-error` / `route-not-found` fallback slot
- `RouteContext`
- `router-view[data-transition-direction]`

关键文件：

- [examples/minimal/main.ts](../examples/minimal/main.ts)
- [examples/minimal/example-pages.ts](../examples/minimal/example-pages.ts)
- [examples/minimal/lazy-drafts.ts](../examples/minimal/lazy-drafts.ts)

### `examples/demo/` — 交互式 Demo

一个带有导航栏、状态面板、守卫 Lab 路由和动态模块加载的完整交互式 Demo。
在项目根目录运行：

```bash
deno serve --port 8000 index.html
```

关键文件：

- [examples/demo/app-root.ts](../examples/demo/app-root.ts)
- [examples/demo/demo-pages.ts](../examples/demo/demo-pages.ts)
- [examples/demo/lazy-drafts-panel.ts](../examples/demo/lazy-drafts-panel.ts)

## 核心概念

### 1. 路由树在 TypeScript 中声明

路由定义不依赖 HTML 里的 `data-route` 标记，而是直接由 `routes` 驱动。

常用字段：

- `id`: 稳定树管理标识，用于运行时增删改路由树
- `name`: 稳定路由名，用于 `router.link()` 和命名导航
- `path`: 路径片段，`""` 表示 index，`"*"` 表示兜底
- `component`: 组件标签名，或组件工厂函数
- `children`: 子路由
- `title`: 文档标题模板，支持 `:param`
- `props`: 额外注入到组件实例的属性
- `guard`: 路由守卫
- `beforeLeave`: 离开当前分支前触发的守卫
- `load`: 首次进入时的异步加载器

路由编译阶段会按 specificity 排序，匹配优先级是： 静态片段 > 动态参数 >
兜底通配。也就是说，`/me` 不会再因为你把 `/:id` 写在前面而被错误拦截。

### 2. 嵌套路由靠命名 slot 渲染

如果父路由声明了 `children`，父组件必须提供：

```html
<slot name="route-child"></slot>
```

默认 slot 名就是 `route-child`。也可以通过 `<router-view child-slot="...">`
改掉。

### 3. 路由上下文使用显式协议

推荐的组件契约是：

```ts
import type { RouteContext } from "@elelcode/lit-router";

@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

其中：

- `routeContext.detail`: 完整的 `RouterChangeDetail`
- `routeContext.params`: 当前路径参数

如果你不想依赖属性更新，也可以实现：

```ts
setRouteContext(context: RouteContext): void
```

组件必须暴露 `routeContext` 或 `setRouteContext()` 之一。`router-view`
已经不再注入旧的 `routeDetail` / `routeParams` 字段。

## 守卫与重定向

守卫可以同步或异步返回：

- `true` / `undefined`: 放行
- `false`: 阻止导航
- `string` / `URL`: 重定向
- `{ to, replace }`: 带 replace 语义的重定向

示例：

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

`beforeLeave` 的返回语义与 `guard` 一致，但它只会作用在“即将被卸载的那段分支”
上。公共父级不会在兄弟子路由切换时重复触发。

## 懒加载

推荐把非首页路由统一写成：

```ts
{
  path: "settings",
  component: "settings-page",
  load: () => import("./pages/settings-page.ts"),
}
```

同一路由只会在首次进入时触发一次 `load()`。

如果你需要给全局进度条或壳层 loading 做联动，可以监听：

- `route-loading-start`
- `route-loading-end`

它们的 `event.detail.pending` 表示当前还有多少个路由加载过程在进行中。

## 导航方式

### 编程式导航

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

当前反向路由支持：

- 字面量路径片段
- `:param`
- `:param(<pattern>)`
- `*`
- `?` 可选参数片段，例如 `:lang?/docs`

如果路径里使用了 `+`、`*` 这类参数修饰符，`router.link()` 会直接抛错，而不是
静默生成错误 URL。

### 链接导航

路由会自动拦截：

- 同源
- 位于当前 `basePath` 内
- 没有 `target="_blank"` / `download`
- 没有被业务代码 `preventDefault()`
- HTML 和 SVG 中的 `<a>`

如果链接不属于当前 `basePath`，会自动回退到浏览器原生跳转。

如果要走 replace 语义：

```html
<a href="/settings" data-router-replace>Back To Settings</a>
```

## 动态更新 Route Tree

如果应用启动后需要按登录态、权限、租户能力或插件模块动态更新路由树，通常更
常见的是按分支插入或删除：

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

这里 `name` 继续用于导航和反向路由，`id` 用于运行时树管理。父路由如果没有对外
导航名，也可以只提供 `id`。如果父路由要承载新的子页面，组件模板仍然要提供对
应的命名 `slot`。

如果你要一次装入多个插件分支，建议合并成一次更新：

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

如果批次回调中途抛错，路由器会回滚这次批次，而不是留下半应用状态。

这个批次回调必须保持同步。如果你有异步加载步骤，先完成异步，再进入
`batchRouteUpdates()`。

插入或删除后，路由器会立即用当前 URL 重新匹配：

- 如果还能命中，就重新 commit 当前页面分支
- 如果当前 URL 不再存在，就派发 `route-not-found`
- 命名路由索引也会一并更新

如果你的场景确实是一次整体切换，也可以直接替换整棵树：

```ts
router.setRoutes([
  { path: "", component: "home-page" },
  { path: "workspace", component: "workspace-page" },
  { path: "admin", component: "admin-page" },
]);
```

如果你想一次同时改 `routes`、`basePath`、`beforeRoute`，继续使用：

```ts
router.configure({ routes, basePath, beforeRoute });
```

## RouterView 说明

`<router-view>` 负责把路由树真正挂到 DOM 上。

支持的主要入口：

- `.router = router`
- `child-slot="..."`
- `no-view-transition`

如果没有命中路由或导航报错，`<router-view>` 不会再留空，而是默认渲染：

- 404 fallback
- error fallback

如果你想覆盖默认视图，可以直接在 light DOM 里提供 slot：

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

路由切换后，它会：

1. 更新页面分支
2. 恢复滚动位置
3. 处理焦点移动
4. 派发 `route-change`

这里的 `router-view` `route-change` 表示“视图已经 commit 完成”，不等同于
`Router` 实例上的同名事件。

额外行为：

- 滚动恢复绑定的是 history entry，不只是 URL
- hash 锚点只走 `document.getElementById()`
- 如果锚点在组件 shadow tree 内部，请把对应 `id` 暴露到 host 上，这样查找仍然是
  O(1)
- `<router-view>` host 会带上
  `data-transition-direction="forward|backward|none"` ，方便你直接写基于方向的
  View Transitions CSS

推荐在页面主标题或主容器上标注：

```html
<h1 data-route-focus tabindex="-1">Profile</h1>
```

## 事件

建议在应用壳层统一监听：

- `route-change`
- `route-tree-change`
- `route-error`
- `route-loading-start`
- `route-loading-end`
- `route-not-found`

完整事件字段定义请直接看 [docs/api.zh-CN.md](./api.zh-CN.md)。

示例：

```ts
router.addEventListener("route-error", (event) => {
  console.error(event.detail.phase, event.detail.error);
});
```

### 建议的生产处理

- `Router` 实例上的 `route-change` 更早触发，表示 URL / current 状态已提交；
  `event.detail.direction` 会告诉你这次是前进、后退还是无方向提交
- `route-tree-change`: 路由树在运行时发生了增删改，适合驱动菜单、权限壳层、
  插件注册信息同步
- `router-view` 上的 `route-change` 更晚触发，表示对应 outlet 的 DOM 已挂载完成
- `route-loading-start/end`: 适合挂全局进度条或壳层 loading
- `route-error`: 渲染“加载失败 / 无权限 / 重试”兜底 UI
- `route-not-found`: 渲染 404 页面

## 生产约束

这套路由当前明确面向以下场景：

- 现代浏览器
- 单文档单 SPA
- 原生 `URLPattern` 可用
- history entry 方向缓存是有界的，不会在超长会话里无限增长
- 不做 SSR

额外注意：

- 同一个 document 里只支持一个已启动的 `Router`
- 如果浏览器支持 `Navigation API`，路由会优先使用它而不是 `popstate`
- `router-view` 内部有滚动缓存，但已经做了有界限制，不会无限增长
- 当前发布链路是 Deno-first + JSR-first

## 开发建议

### 推荐

- 非首页路由默认使用 `load`
- 新组件默认使用 `routeContext`
- 父路由组件显式提供 `slot`
- 根壳层统一处理 `route-error` / `route-not-found`

### 不推荐

- 假设 `router-view` 会自动写入任何未声明的路由字段
- 在同一 document 中并行启动多个 `Router`
- 让同一个页面既混用当前 SPA 路由，又混大量同源非 SPA 页面而不做边界划分

## 能力边界

这套路由当前明确面向：

- 现代浏览器
- 单 document SPA
- 原生 `URLPattern` 可用
- 纯 Web Components / Lit 渲染
- Deno-first / JSR-first 的发布模型

额外注意：

- 同一个 document 内只支持一个已启动的 `Router`
- 如果浏览器支持 `Navigation API`，路由会优先使用它而不是 `popstate`
- history entry 方向缓存和 `router-view` 滚动缓存都是有界的
- `load()` 的 Promise 返回值不会注入组件上下文，它只承担代码分割或副作用职责
- 这套核心不覆盖 SSR，也不内建激活链接之类的壳层能力

## 进一步阅读

- [英文指南](./guide.md) — English user guide
- [英文 API 参考](./api.md) — 完整类型签名与方法文档
- [中文 API 参考](./api.zh-CN.md) — Chinese API reference
- [Slot 多出口设计](./slot-outlets-design.md) — 并行命名 outlet 架构设计
- [变更日志](../CHANGELOG.md) — 版本历史
