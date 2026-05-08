# Router Todo

## Done

- [x] 将路由定义从 HTML 属性迁移到 TypeScript 路由树
- [x] 用浏览器 `URLPattern` 替换手写路径匹配
- [x] 用原生 DOM API 控制路由子组件切换显示
- [x] 用父组件命名 `slot` 承载嵌套路由子页面
- [x] 接入 `Navigation API`、`View Transition API` 和 `replace()` 导航

## Functional Improvements

- [x] 增加 `base-path` 支持，方便在子路径和嵌套路由中复用
- [x] 增加 route guard 机制，支持阻止跳转和重定向
- [x] 增加懒加载 loader 机制，按路由首次进入时再加载模块
- [x] 完成嵌套路由示例，验证路由树 children 可以直接驱动父子页面嵌套

## Refactors Done

- [x] 拆分 `routeTo()` 的解析、守卫、重定向、加载和提交阶段
- [x] 统一 `route-not-found` 派发逻辑，避免重复分支各自维护
- [x] 收口 `router-view` 的 commit + `route-change` 派发流程
- [x] 拆分 `mountBranch()` 的复用、创建、挂载和收尾步骤
- [x] 抽出共享 `browser-env`，统一浏览器宿主访问
- [x] 将滚动恢复逻辑抽成独立的 `ScrollManager`
- [x] 将 `routeDetail` / `routeParams` 注入协议显式化为 `RouteContext`
- [x] 为 `router-view` 增加默认 404 / error 回退视图和 slot 覆盖
- [x] 为路由定义增加 `name`，并提供 `router.link()` 反向生成 URL
- [x] 删除旧的 `routeDetail` / `routeParams` 兼容注入
- [x] 迁移到当前 Lit 装饰器字段写法，移除 `experimentalDecorators`

## Slot Multi-Outlet (已落地核心)

- [x] `RouteDefinition.slot?: string` — 路由声明投影目标 slot，默认
      `"route-child"`
- [x] `matchSlotRoutes()` — 多 slot 贪心匹配，含 `matchCache` 去重
- [x] `RouterChangeDetail.slotBranches` / `slotParams` / `slots` — 侧 slot
      完整分支详情
- [x] `RouteContext.slot` / `RouteContext.branch` — 组件感知自身 slot 和分支
- [x] `normalizeRouteSlot()` + `RESERVED_ROUTE_SLOTS` — 禁止 `"404"` / `"error"`
      作为路由 slot 名
- [x] `collectLeavingRoutes()` — beforeLeave 收集侧 slot 离开路由，字典序排序
- [x] `collectMatchedRoutes()` — guard 遍历侧 slot 去重并集
- [x] `detailBranches()` — load 遍历所有分支
- [x] `loadBranchForNavigation` — 遍历所有 slot 分支的 lazy loading
- [x] `isSameDetail` — 比较 slot 分支引用一致性
- [x] `renderedBranches: Map<string, HTMLElement[]>` — 按 slot 分桶渲染
- [x] `mountRouteBranch()` — 统一主链/侧链挂载逻辑
- [x] `routeSlot()` — 解析路由定义的 slot 名
- [x] `applyRouteState` — 传入 slot/branch/params，填充正确 RouteContext
- [x] `validateChildOutlet` — per-slot 验证父组件子路由出口

## Next

- [x] E2E 测试已就绪 — 4 条 Puppeteer 测试覆盖 push/back/title/slot/404，通过
      `deno task test:e2e` 运行（需 Chromium）。CI workflow 已配置 e2e job。

## Polishing (低优先级完善)

- [x] **`mountBranch` 签名 `_previousDetail` 已移除** —
      参数已从签名和所有调用点删除。
- [x] **`dispatchRouteLoading` 中 `loadingSlots` 双重克隆已合并** — 移除内层
      `[...loadingSlots]`，调用方已提供新数组。
- [x] **`detailSlotBranches` 已内联** — 合并到 `detailBranches`，消除单次 spread
      临时对象。
- [x] **侧 slot 嵌套 children 专项测试已添加** — 通过
      `test-route-sidebar-layout` 验证 sidebar → sidebar-tools 递归投影链。
- [x] **API 文档已补充** — `docs/api.md` / `docs/api.zh-CN.md` 已包含
      `slot`、`slotBranches`、`slotParams`、`slots`、`RouteContext.slot/branch`、`RouterSlotDetail`、`RouterChangeDetailJson`、`loadingSlots`
      等全部新类型。
