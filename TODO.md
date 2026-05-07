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

## Next

- [ ] 增加真实浏览器 E2E，用于覆盖 `Navigation API` / `View Transitions API`
      的实机行为
