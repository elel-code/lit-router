# 并行命名 Outlet — Slot 方案设计

版本：v4 状态：已完整落地，多 slot 匹配、渲染、守卫、懒加载、焦点策略均已实现并通过测试
章节：设计概览 | RouterChangeDetail | 匹配算法 | RouterView | 守卫/懒加载 | 边界处理 | 性能优化 | 实施清单 | 落地数据流

## 1. 概览

### 1.1 目标

允许同一个父路由下，多个子路由匹配同一 URL 段并渲染到父组件内**不同的命名
slot**。典型场景：

```
/settings/profile:
  主内容区 → settings-profile
  侧栏     → profile-sidebar
```

### 1.2 核心改动：一个字段

```ts
interface RouteDefinition {
  slot?: string; // 默认 "route-child"
  // ... 其余不变
}
```

### 1.3 示例路由树

```ts
const routes = [
  {
    path: "settings",
    component: "settings-layout",
    children: [
      { path: "profile", component: "settings-profile" },
      { path: "profile", slot: "sidebar", component: "profile-sidebar" },
      { path: "security", component: "settings-security" },
      { path: "security", slot: "sidebar", component: "security-sidebar" },
    ],
  },
];
```

父组件模板：

```html
<div class="main"><slot name="route-child"></slot></div>
<aside><slot name="sidebar">默认侧栏内容</slot></aside>
```

URL `/settings/profile` 的渲染结果：

```
<settings-layout>
  #shadow-root
    <div class="main">
      <slot name="route-child">  ← 投影 settings-profile
    </div>
    <aside>
      <slot name="sidebar">      ← 投影 profile-sidebar
    </aside>
</settings-layout>
```

### 1.4 与 `components` map 方案的对比

| 维度            | `components` map                                      | slot                   |
| --------------- | ----------------------------------------------------- | ---------------------- |
| 新增 API 面     | `components` + `RouterView.name` + `outletComponents` | 一个 `slot` 字段       |
| RouterView 数量 | 1 + N                                                 | 1                      |
| 渲染模型        | 主链 + 独立 outlet                                    | 统一 slot 投影树       |
| 侧栏嵌套        | 不支持                                                | 完全递归               |
| 侧栏 fallback   | RouterView 处理                                       | `<slot>` 原生 fallback |
| 守卫/懒加载     | 需感知 outlet                                         | 完全透明               |
| DOM 元素数      | 多组 ShadowRoot + ScrollManager                       | 仅一组                 |

---

## 2. RouterChangeDetail 变更

### 2.1 当前结构

```ts
interface RouterChangeDetail {
  branch: RouteDefinition[]; // 主链
  leaf?: RouteDefinition; // 主链叶子
  // ...
}
```

### 2.2 目标结构

```ts
interface RouterChangeDetail {
  branch: RouteDefinition[]; // 主链，向后兼容
  leaf?: RouteDefinition; // 主链叶子
  slotBranches?: Record<string, RouteDefinition[]>; // 每个命名 slot 的分支
  // ...
}
```

- `slotBranches["sidebar"]` → `[settings-layout, profile-sidebar]`（包含父级到该
  slot 叶子的完整链）
- `slotBranches` 仅包含有匹配路由的 slot。无匹配的 slot 不出现。
- 守卫和懒加载遍历 `branch` + 所有 `slotBranches` 的叶子路由。

### 2.3 消费方行为

只关心主链的代码：行为完全不变——`detail.branch`、`detail.leaf`、`detail.params`
都是当前语义。

关心侧栏的代码：读 `detail.slotBranches["sidebar"]` 获取该 slot 的完整分支。

---

## 3. `matchRoutes` 适配

### 3.1 当前算法（伪代码）

```
function matchRoutes(routes, remainingSegments, parentRecords):
    for each route in routes (specificity sorted):
        matches = execPatternMatches(route, remainingSegments)
        if no match: continue

        for each match in matches:
            record = { route, params: merge(parentParams, match.params) }
            branch = [...parentRecords, record]
            nextRemaining = remainingSegments.slice(match.consumedCount)

            if route has children:
                child = matchRoutes(children, nextRemaining, branch, record.params)
                if child: return child

            if nextRemaining.length == 0 or route is catch-all:
                return branch  // ← greedy first match

    return null
```

### 3.2 目标算法（伪代码）

```
function matchSlotRoutes(routes, remainingSegments, parentParams):
    slotResults = {}  // slot name → RouteRecord[]

    for each route in routes (specificity sorted):
        slot = route.slot ?? "route-child"
        if slotResults has this slot: continue  // already found best match

        matches = execPatternMatches(route, remainingSegments)
        if no match: continue

        for each match in matches:
            params = merge(parentParams, match.params)
            nextRemaining = remainingSegments.slice(match.consumedCount)

            childResults = matchSlotRoutes(children, nextRemaining, params)
                if route has children else null

            if nextRemaining.length == 0 or route is catch-all:
                slotResults[slot] = { route, params, childResults }
                break  // next slot

            else if childResults not null:
                slotResults[slot] = { route, params, childResults }
                break  // next slot

    return slotResults  // may be empty
```

### 3.3 复杂度

- 当前：O(routes × segments) 单次贪心
- 目标：O(routes × segments) 多 slot 贪心，每 slot 提前跳出
- 由于同级 routes 按 specificity 排序后按 slot 分组，总 `execPatternMatches`
  调用次数粗略等于 routes 数量（同一 route 不会因不同 slot 被重复匹配）

增量几乎为零。

---

## 4. RouterView 适配

### 4.1 `mountBranch` 变更

当前：

```
mountBranch(detail, previousDetail):
    mainBranch = detail.branch
    // 复用 / 创建主链元素，slot 投影到父级
```

目标：

```
mountBranch(detail, previousDetail):
    mainBranch = detail.branch
    slotBranches = detail.slotBranches ?? {}

    // 1. 挂载主链（与当前一致）
    mainElements = mountMainChain(mainBranch, previousDetail)

    // 2. 为每个命名 slot 挂载侧分支
    for each (slotName, slotBranch) in slotBranches:
        mountSlotChain(slotName, slotBranch, previousDetail.slotBranches?.[slotName])
```

### 4.2 `mountSlotChain` 行为

与主链挂载类似的复用/创建逻辑，但子元素直接 append 到主链中对应深度的父元素上：

```
// slotBranch = [settings-layout, profile-sidebar]
// 主链中 settings-layout 已经在 depth 0，直接作为父元素
parent = mainElements[0]   // settings-layout
child = createElement(profile-sidebar)
child.slot = "sidebar"     // 投影到父组件的 <slot name="sidebar">
parent.append(child)
```

- 如果 slotBranch 长度 > 2（即侧栏路由有嵌套 children），则递归投影
- `reuseBranchPrefix` 逻辑按 slot 独立执行：比较
  `previous.slotBranches["sidebar"]` 与 `next.slotBranches["sidebar"]` 的引用

### 4.3 `validateChildOutlet` 扩展

当前只验证 `<slot name="route-child">`。扩展为验证所有使用的 slot：

```
for each usedSlot in detail.slotBranches.keys():
    validateParentHasSlot(parentElement, usedSlot)
```

如果父组件缺少对应的 slot，warn。这与现有的 missing-slot 警告机制一致。

---

## 5. 守卫与懒加载

### 5.1 保持不变的部分

- `guard` / `beforeLeave` / `load()` 绑定在 `RouteDefinition` 上，不感知 slot
- `runGuards` 遍历 **所有匹配路由的集合**（主链 + 所有 slot 分支的并集）
- `sharedBranchPrefixLength` 和 `leavingRoutes` 的计算需要包含所有 slot

### 5.2 `beforeLeave` 变更

当前只考虑主链分支的 suffix：

```ts
const leavingRoutes = from.branch.slice(
  sharedBranchPrefixLength(from.branch, detail?.branch ?? []),
).reverse();
```

目标：需要同时考虑 slot 分支中离开的路由：

```ts
const leavingRoutes = [
  ...from.branch.slice(prefixLen).reverse(),
  ...collectLeavingSlotRoutes(from, to),
];
```

`collectLeavingSlotRoutes(from, to)` 对 `from.slotBranches` 中的每条 slot
分支做与主链相同的 suffix 计算。

### 5.3 `loadBranch` 变更

当前：

```ts
await this.loadBranch(detail.branch, signal);
```

目标：

```ts
await this.loadBranch(detail.branch, signal);
for (const slotBranch of Object.values(detail.slotBranches ?? {})) {
  await this.loadBranch(slotBranch, signal);
}
```

所有 slot 的懒加载与主链共享 `loadedRoutes` 和
`pendingRouteLoads`，去重逻辑不变。

---

## 6. 未解决的问题

### 6.1 同路径不同 slot 必须消耗相同段数

`{ path: "profile" }`（主 slot）和 `{ path: "profile/:tab" }`（sidebar
slot）作为同级子路由时，后者的 `:tab` 需要 1 段输入，但前者已经消耗了 `profile`
段后无剩余。sidebar slot 不会匹配。

**设计决策**：这是合理约束。不同 slot 的子路由应从同一 URL
段出发，保持一致的分段消费数。

### 6.2 `slot` 字段已进入 `ReadonlyRouteDefinition`

`slot` 是静态字符串，不是可变状态。`ReadonlyRouteDefinition` 通过
`Omit<RouteDefinition, "children" | "meta" | "props">` 构建——`slot` 不在
排除列表中，因此通过 `...route` 展开时自然传递。不需要额外处理。

### 6.3 `isSameDetail` 已支持 slot 分支比较

`isSameDetail` 已扩展：收集 `current.slotBranches` 和 `next.slotBranches` 的
slot 名并按字典序排序，逐 slot 比较分支长度和每个元素的引用一致性。

### 6.4 `resolveNamed` + slot

命名路由的反向生成（`router.link()` / `router.resolveNamed()`）如何与 slot
交互？每条命名路由的 branch 仍然唯一——`buildNamedRouteIndex` 遍历树时，slot
路由与主链路由在同一个索引中。反向 URL 生成不受 slot 影响。

### 6.5 `viewTransitionName` — 仅主链生效（设计决定）

当前 `viewTransitionName` 绑定在路由上，RouterView 将其应用到 viewport。如果多个
slot 各自指定 `viewTransitionName`，只有一个 RouterView，无法同时承载多个
transition name。当前实现取 `detail.leaf?.viewTransitionName`（主链叶子）。

如业务需要，可通过 CSS 自定义属性或 `data-*` attribute 提供过渡名给侧栏组件。

### 6.6 Routes getter 的冻结快照 — 已落地

`ReadonlyRouteDefinition` 包含 `slot` 字段。`freezeRouteDefinition` 通过
`...route` 展开时自然传递，无需特殊处理。

---

## 7. 优化点

### 7.1 `matchCache` 共享 `execPatternMatches` 结果 — 已落地

`matchSlotRoutes` 内部使用 `matchCache: Map<string, PatternMatch[]>` 以
`normalizedPath` 为 key 缓存 `execPatternMatches` 结果。两个 slot 的路由如果
path 相同（如 `{ path: "profile" }` 和 `{ path: "profile", slot: "sidebar" }`），
第二次遍历直接从缓存读取，避免重复 `URLPattern.exec()`。

### 7.2 RouterView 可延迟挂载未激活的 slot

如果某个 slot 在当前导航中没有变化（引用相同），跳过挂载。`reuseBranchPrefix`
逻辑本就可以处理。

### 7.3 编译期生成 slot → routes 索引

当前 `buildCompiledRoutes` 生成按 specificity 排序的数组。可以额外生成一个
`slot → CompiledRouteDefinition[]` 的分组索引，使每个 slot
的匹配跳过不相关路由。

收益：每个 slot 的匹配只遍历 target 到该 slot 的子集，而非所有同级路由。

实现：在 `buildCompiledRoutes` 中收集每层的 slot 分组，存入一个新字段或以辅助
Map 返回。

---

## 8. 不做的事

### 8.1 路由级的 `slot` 字段不传给 children

`slot` 只决定**当前路由**投影到**父级**的哪个 slot。路由的 `children`
仍然默认投影到该路由自身模板的 `"route-child"`，除非 child 显式指定了自己的
`slot`。

### 8.2 slot 名称不与 `child-slot` attribute 耦合

`child-slot` 控制 RouterView **为嵌套主链**使用的 slot 名。命名 slot（如
`"sidebar"`）是路由定义层的声明，不经过 RouterView——子元素直接
`child.slot = "sidebar"` 投影到父组件。

### 8.3 不引入 `RouterView.name`

slot 方案不需要额外的 `<router-view>` 元素。所有渲染由单一 RouterView 完成。

---

## 9. 审阅意见与落地建议

### 9.1 总体判断

我倾向认可 slot 方案，而不是并行 `<router-view name="...">`
方案。当前实现的核心抽象是“一个 Router 解析出一条分支，一个 RouterView
负责把这条分支提交到 DOM”。slot
方案是在这个模型上扩展“同一父节点下的多个投影目标”，仍然由同一个 RouterView
统一处理守卫、懒加载、滚动、焦点和 commit 事件；多 RouterView
方案则会把这些责任复制到多个 outlet，最后需要重新协调一致性。

更重要的是，slot 方案把并行区域定义为**父组件模板的布局能力**，而不是 RouterView
的全局命名能力。这符合 Web Components 的组合方式：父组件声明自己有哪些
slot，路由只声明当前页面片段应该投影到哪个 slot。

### 9.2 需要先收紧的设计约束

建议在真正实现前明确三条约束，否则后续行为会变得含糊：

1. `slot` 只表示当前 route 元素投影到父 route 元素的哪个 slot，不影响它自己的
   children。
2. 默认主链 slot 必须有一个常量名，建议复用当前
   `DEFAULT_CHILD_SLOT`。不要同时存在
   `"default"`、`"route-child"`、空字符串三套语义。
3. 同一层同一 slot 仍然只能选一个最佳匹配；不同 slot 可以各自选一个最佳匹配。

第 3 点很关键。否则如果同一 slot 下允许多个匹配同时渲染，模型会从“命名
outlet”变成“route fragments list”，这会显著扩大 diff、guard、beforeLeave
和焦点策略的复杂度。

### 9.3 `slotBranches` 的结构建议

文档里的 `Record<string, RouteDefinition[]>` 能表达最终结果，但实现层最好保留
`RouteRecord[]` 形式直到最后一步，因为每条 slot 分支可能有自己的 params
合并结果。

建议内部结构：

```ts
interface MatchedBranch {
  records: RouteRecord[];
  params: Record<string, string>;
}

type SlotBranchRecords = Record<string, MatchedBranch>;
```

对外仍然可以暴露：

```ts
slotBranches?: Record<string, RouteDefinition[]>;
slotParams?: Record<string, Record<string, string>>;
```

或者更简洁地暴露一个只读结构：

```ts
slots?: Record<string, {
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  params: Record<string, string>;
}>;
```

我更推荐第三种 `slots` 结构。它比 `slotBranches + slotParams`
更不容易错配，也为后续给每个 slot 加 `viewTransitionName`、loading 状态或 commit
状态留下空间。

### 9.4 主链与 slot 分支的关系

需要避免把主链特殊化得太深。当前为了兼容，`detail.branch` 和 `detail.leaf`
必须保留。但内部可以把主链视为一个保留 slot：

```ts
const MAIN_SLOT = DEFAULT_CHILD_SLOT;
detail.slots[MAIN_SLOT].branch === detail.branch;
detail.slots[MAIN_SLOT].leaf === detail.leaf;
```

这样 `runGuards`、`loadBranch`、`isSameDetail`、route-change diff
都可以遍历统一的 slot 集合，而不是到处写“主链 + 侧链”的双路径逻辑。

对外兼容层可以继续填充 `branch` 和 `leaf`，但实现层尽量以统一结构为准。

### 9.5 匹配算法要避免“局部成功导致整体假成功”

slot 方案里最容易出错的是：某个 slot 匹配成功，但主 slot 没有匹配，Router
却仍然认为 URL 命中。

建议规则：

- 主 slot 匹配失败时，整个 URL 应视为 not-found。
- 侧 slot 匹配失败时，不影响主 slot；对应 slot 不渲染，使用父组件原生 `<slot>`
  fallback。
- 如果某个侧 slot 匹配到了更深层 children，但主 slot 只匹配到父层且无法消耗完整
  URL，应视为 not-found。

换句话说，主链仍然是 URL 可达性的判定基础；命名 slot
是“附加并行渲染”，不是独立路由入口。这能避免侧栏路由意外让一个本该 404 的 URL
变成成功导航。

### 9.6 beforeLeave 顺序建议

`beforeLeave` 的顺序要稳定，否则多 slot
分支同时离开时会出现难以复现的行为。建议：

1. 先执行非主 slot 的 leaving guards，slot 名按字典序排序，每个 slot
   内从叶子到父级。
2. 最后执行主链 leaving guards，从叶子到父级。

原因是主链通常代表页面主体，最可能触发“是否离开当前页面”的确认。把主链放最后，可以让辅助区域先释放或重定向；如果主链最终阻止离开，整体仍恢复当前
URL。

如果希望更接近 DOM 语义，也可以主链先执行，但必须写进文档和测试。不要依赖对象
key 插入顺序作为隐式行为。

### 9.7 routeContext 需要携带 slot 信息

并行 slot 出现后，组件只靠 `routeContext.detail` 和 `params`
不一定知道自己属于哪个 slot。建议扩展：

```ts
interface RouteContext {
  detail: RouterChangeDetail;
  params: Record<string, string>;
  slot: string;
  branch: RouteDefinition[];
}
```

其中主链组件的 `slot` 为 `DEFAULT_CHILD_SLOT`。这样组件可以根据 slot
做轻量行为区分，也方便调试。

### 9.8 RouterView 的 renderedElements 需要按 slot 分桶

当前 `renderedElements: HTMLElement[]` 对应主链深度。slot
方案不能把所有元素塞进同一个数组，否则同深度不同 slot 的复用会互相污染。

建议改成：

```ts
private renderedBranches = new Map<string, HTMLElement[]>();
```

主链使用 `DEFAULT_CHILD_SLOT` 作为 key。这样 `reuseBranchPrefix`
可以复用现有逻辑，只是参数从 `this.renderedElements` 变成
`renderedBranches.get(slot)`。

### 9.9 滚动与焦点策略

slot 方案仍然只有一个 RouterView，所以滚动恢复不需要为每个 slot
单独保存。焦点则需要谨慎：如果侧栏变化、主链不变，不应该把焦点强制拉回主内容或
RouterView host。

建议：

- 主链变化时，沿用当前 focus 策略。
- 只有非主 slot 变化时，不主动移动焦点，除非新 slot 元素内有
  `[data-route-focus]` 且当前焦点已经在旧 slot 分支内。

这能避免侧栏随 URL 更新时打断用户正在主内容中的键盘操作。

### 9.10 实施顺序（已完成）

所有 6 步已按计划落地，实际演变路径与建议高度一致：

1. 类型层：`RouteDefinition.slot?: string` + `ReadonlyRouteDefinition` 自然传递
2. 匹配层：`matchSlotRoutes` 替换 `matchRoutes`，含 `matchCache` + `candidatePrefixes`
3. 渲染层：`renderedBranches: Map<string, HTMLElement[]>` 分桶
4. 匹配层多 slot：主 slot 判定可达性、侧 slot 独立匹配、同路径不同 slot
5. 守卫/懒加载：`collectLeavingRoutes` + `collectMatchedRoutes` + `detailBranches`
6. 焦点、slot warning、loading 事件、`toJSON` 序列化

总计 ~15 个函数/字段新增或重构，跨 router-core.ts 和 router-view.ts，
70 条测试全部通过（含 8 条多 slot 专项测试）。

### 9.11 暂不建议做的优化

`execPatternMatches` 缓存和 slot
分组索引可以等基础语义稳定后再做。当前路由匹配已经有
`minSegments/maxSegments`，性能瓶颈更可能出现在 RouterView 的 DOM diff
和自定义元素升级，而不是 URLPattern exec
次数。先把模型和测试打牢，再优化匹配器。

---

## 10. 性能深入分析

### 10.1 匹配层的热路径

每次导航的匹配路径：

```
resolve()
  → matchSlotRoutes(compiledRoutes, segments)
    → execPatternMatches(route, remainingSegments)   ← 最热
      → candidatePath(segments, count)                ← 临时数组分配
      → route.pattern.exec({ pathname })              ← 原生调用
    → 子递归 matchSlotRoutes(children, ...)
```

`execPatternMatches` 已经被 `minSegments/maxSegments` 限制过循环边界，不再是
O(segments²)。但以下热点仍可优化：

#### 10.1.1 `candidatePath` 每次 slice 分配新数组

```ts
function candidatePath(segments: string[], count: number): string {
  return `/${segments.slice(0, count).join("/")}`;
}
```

`segments.slice(0, count)` 分配新数组，然后 `join("/")` 再分配新字符串。每次
`execPatternMatches` 调用最多产生 `(maxSegments - minSegments + 1)` 次 slice。

**优化**：预计算所有可能的前缀路径字符串。`segments` 在单次 `resolve()` 调用中
不变，所有前缀可以一次性计算：

```ts
function candidatePrefixes(segments: string[]): string[] {
  const prefixes = ["/"]; // count=0
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += "/" + segments[i];
    prefixes.push(acc);
  }
  return prefixes;
}
```

然后 `candidatePath(segments, count)` → `prefixes[count]`，O(1) 无分配。

对于 3 段路径、3 个 slot、每层 5 条路由的典型场景，每次导航节约约 15 次
`slice()` + 15 次 `join()`。

#### 10.1.2 `decodePatternParams` 分配新对象

```ts
function decodePatternParams(
  groups: Record<string, string | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value) params[key] = decodeSegment(value);
  }
  return params;
}
```

`Object.entries()` 分配数组。如果 `groups` 只有 1-2 个有效 key（多数情况），用
`for...in` 或手动遍历已知 key 更快。但这不是热点中的热点——URLPattern.exec 的成本
远高于此。

#### 10.1.3 `matchSlotRoutes` 递归中的 spread 分配

当前递归中 `{ ...parentParams, ...match.params }` 在每层重复分配。深度 ≤ 5
的树中影响微小。

**优化**：如果 params 不需要快照语义（即子递归不会修改父 params），可以使用
prototype chain 代理避免复制。但这个收益极小，不建议做。

### 10.2 RouterView 渲染层的热路径

#### 10.2.1 主链与侧链共享同一次 layout

slot 方案只需要**一次** `requestUpdate()` 和**一次** View Transition。多
RouterView 方案下，N 个 outlet 各自执行 `requestUpdate()` → Lit 的 batch
机制可能合并，但 ScrollManager 的 acquire/release 和 ShadowRoot 的样式重算都是 N
倍。

单 RouterView 的优势在渲染层最有说服力。

#### 10.2.2 `renderedBranches` 改用 Map 后的 diff 开销

当前 `reuseBranchPrefix` 是 O(branchDepth) 的引用比较。改用
`Map<string, HTMLElement[]>` 后，每个 slot 的 diff 仍然是 O(depth)。总 diff
开销从 O(depth) 变为 O(depth × activeSlots)，activeSlots 通常 ≤ 3。

增量不受 `matchSlotRoutes` 复杂度变化的影响。

#### 10.2.3 `applyRouteState` 的 `whenDefined` 等待

每个新创建的元素，如果尚未定义，RouterView 会用 `whenDefined` 等待。侧栏元素与
主链元素共享同一等待逻辑。不增加额外等待次数——因为元素是按需创建的，侧栏元素不会
比主链元素多创建。

### 10.3 不需要兼容性包袱的受益点

由于项目不追求旧浏览器兼容：

- **URLPattern**：原生可用，不引入 polyfill 的额外开销
- **Navigation API**：优先使用，避免 popstate 的序列化/反序列化
- **AbortController**：原生，用于竞态保护
- **Map / WeakMap / WeakSet**：不降级为普通对象/数组
- **`Object.freeze`**：`readonlyRoutes` 零成本只读快照，不需要 polyfill 的 Proxy
  路径

---

## 11. RouterChangeDetail 剩余设计问题

### 11.1 `query` 是 `URLSearchParams`，不可 JSON 序列化

```ts
JSON.stringify({ q: detail.query }); // → {}
```

当前 `detail.query` 是原生 `URLSearchParams`，语义正确（支持多值），但给
debugging、状态持久化和 SSR hydration 带来摩擦。

两种解决方案：

- **不改为 plain object**——URLSearchParams 保留，但增加
  `queryParams:
Record<string, string>` 便利字段。主链 params 已有这个模式
  （`detail.params` 是合并后的 plain record），query 可以同理。
- **提供 `toJSON()` 方法**——在 `RouterChangeDetail` 上挂载 `toJSON()`
  返回可序列化对象，`JSON.stringify(detail)` 自动使用。

后者更好，因为不增加 API 面。实现：

```ts
// 在 commitNavigation 创建 committedDetail 时附加：
Object.defineProperty(committedDetail, "toJSON", {
  value() {
    return {
      ...this,
      query: Object.fromEntries(this.query),
    };
  },
});
```

### 11.2 `leaf` 在 slot 方案后的语义

`detail.leaf` 当前指向主链叶子路由。多 slot 后，每个 slot 有自己的叶子。如果保持
`leaf` 为主链叶子（向后兼容），需要一个补充字段给侧 slot：

```ts
interface RouterChangeDetail {
  leaf?: RouteDefinition; // 主链叶子，向后兼容
  slots?: Record<string, {
    branch: RouteDefinition[];
    leaf?: RouteDefinition;
    params: Record<string, string>;
  }>;
}
```

### 11.3 `params` 的歧义

`detail.params` 当前是主链叶子的 params。多 slot 后，每个 slot
的叶子可能有不同的 params（虽然极罕见，因为同级路由消耗相同段数）。如果某个 slot
分支走到 `*` 通配符，它的 params 就会包含额外的 `*` key。

建议 `detail.params` 保持主链 params，`detail.slots[...].params` 各独立。

### 11.4 `title` 由哪个 slot 决定

`document.title` 当前由 `detail.leaf?.title` 决定。多 slot 后，多个叶子路由都有
`title`。规则：

- 主链叶子的 `title` 优先
- 如果主链没有 title，按 slot 名字典序取第一个有 title 的叶子
- `fillTitle` 使用该叶子对应的 `slot.params`

这个优先级顺序需要写入文档。

### 11.5 `route-loading-start/end` 的 `branch` 字段

当前 loading 事件携带主链分支。多 slot 后，如果侧栏正在懒加载，loading
事件需要反映完整的 slot 集合还是仅反映当前正在加载的 slot？

建议 `RouteLoadingDetail.branch` 仍为主链分支（不变），加可选字段：

```ts
interface RouteLoadingDetail {
  branch: RouteDefinition[];
  loadingSlots?: string[]; // 本次 loading 涉及的 slot 名
  pending: number;
  // ...
}
```

### 11.6 `route-tree-change` 事件不变

`route-tree-change` 携带的是整棵路由树的冻结快照，与当前路由匹配无关。新 `slot`
字段自然包含在 `ReadonlyRouteDefinition` 中，无需额外改动。

### 11.7 侧 slot 组件的 `disconnectedCallback` 时序

侧 slot 组件从父元素 `parent.append(child)` 开始进入 DOM，退出时通过
`oldChild.remove()` 离开。`disconnectedCallback` 的触发时机与主链组件一致——由
RouterView 在 `mountBranch` 的 diff 过程中调用 `remove()`。不需要额外协调。

### 11.8 侧 slot 路由的 `name` 冲突

`buildNamedRouteIndex` 遍历整棵树时，slot 路由与主链路由共享同一个
`NamedRouteBranch` 索引。如果 `{ path: "profile", name: "profile" }` 和
`{ path: "profile", slot: "sidebar", name: "profile" }` 共存，后者会因重复 name
报错。

**规则**：slot 路由如果需要命名导航，必须使用不同的 name。通常侧栏路由不需要
name（它们由主链 URL 决定渲染，不需要独立的 `router.push({ name })` 入口）。

---

## 12. 边界点处理

### 12.1 递归嵌套：侧 slot 路由再分 slot

如果侧栏组件自身也定义了多个子 slot：

```ts
{
  path: "settings", component: "settings-layout",
  children: [
    { path: "profile", slot: "sidebar", component: "profile-sidebar",
      children: [
        { path: "", component: "sidebar-home" },
        { path: "actions", slot: "sidebar-tools", component: "sidebar-actions" },
      ]
    },
  ],
}
```

匹配 `/settings/profile` 时，`profile-sidebar` 的 `children` 会进一步匹配 `""` →
`sidebar-home`（main slot）和 `sidebar-tools`（如果在父级定义了该 slot）。

渲染链：

```
settings-layout          ← 深度 0
└─ slot "sidebar" → profile-sidebar     ← 深度 1
   └─ slot "route-child" → sidebar-home   ← 深度 2
   └─ slot "sidebar-tools" → sidebar-actions  ← 深度 2
```

`mountSlotChain("sidebar", [settings-layout, profile-sidebar])` 完成深度 0→1
的投影后，`profile-sidebar` 的 children 在 `matchSlotRoutes` 递归中已独立
匹配为子 slot 集合。RouterView 继续对 `profile-sidebar` 执行 `mountSlotChain`
递归。

**约束**：`slotBranches` 的 key（如 `"sidebar"`）是相对于**当前路由定义**的 slot
名，不是全局命名空间。不同深度的同名 slot 各自独立。

### 12.2 slot 名称与保留 slot 冲突

当前 `RouterView` 使用 `slot="404"` 和 `slot="error"` 作为 fallback slot 的
标识。如果路由定义了 `slot: "404"` 或 `slot: "error"`，会与 fallback slot 冲突。

**规则**：`"404"` 和 `"error"` 是保留 slot 名，不允许在 `slot` 字段中使用。

实现：在 `buildCompiledRoutes` 或 `rebuildRouteState` 中加校验，发现保留名时
throw。这能避免用户投影一个路由组件到错误页面的 slot 中。

### 12.3 无侧 slot 匹配时的 `<slot>` fallback 语义

当 URL `/settings/profile` 没有匹配到 sidebar slot 的路由时：

- `detail.slotBranches` 中不包含 `"sidebar"` key
- RouterView 不创建 side-slot 元素
- 父组件 `<slot name="sidebar">` 自然显示其默认内容

这与当前无路由匹配的 404 fallback 不同——不是"路由未找到"，而是"该页面区域没有
特定内容"。`<slot>` 的原生 fallback 语义处理这个比在 RouterView 中额外管理
"empty outlet"状态更干净。

### 12.4 侧 slot 路由的 `load()` 失败处理

侧 slot 路由如果有 `load()` 且加载失败：

- `loadBranch` 遍历 slot 分支时，`load()` 抛出的 error 被
  `loadBranchForNavigation` 捕获
- `dispatchRouteError(url, error, "load", direction)` 触发
- 整个导航视为失败，RouterView 显示 error fallback

**不会**出现"主链渲染成功但侧栏显示空白"的状态——`loadBranch` 对主链和侧链是
顺序调用的，任一部分失败都会导致整体失败。这与其他路由错误行为一致。

如果需要"侧栏加载失败不影响主链"的降级策略，可以通过 `guard` 或路由的
`beforeLeave`
在进入前检查侧栏模块是否可用，而不是依赖运行时期盼路由框架自动兜底。

### 12.5 删除提供侧 slot 的路由

`removeRoute("profile-sidebar")`（按 name）或
`removeRoute({ id: "sidebar-plugin" })`（按 id）从 `routeTree` 中删除路由定义
后：

- `rebuildRouteState()` 重新编译路由树
- `requestRouteRefresh(true)` 用当前 URL 重新匹配
- 如果当前位置仍有主链匹配，主链继续渲染；侧 slot 不再匹配
- 侧 slot 的 `<slot name="sidebar">` 回退到默认内容

`beforeLeave` 不触发——因为侧 slot 路由是被删除的，不是用户导航离开的。

### 12.6 侧 slot 路由的 `props`

`props` 仍然绑定在 `RouteDefinition` 上，不感知 slot。RouterView 为侧 slot
组件应用 `route.props` 的方式与主链组件相同：

```ts
Object.assign(element, route.props ?? {});
```

如果多条路由（如主链和侧链）向同一个组件传递 `props`，它们各自创建独立的元素
实例，`props` 不会合并或冲突。

### 12.7 侧 slot 元素在 `waitForRouteElements` 中的处理

当前 `waitForRouteElements` 对主链所有元素并发执行 `updateComplete` 等待。slot
方案需要将侧 slot 分支的元素也纳入等待集合：

```ts
const allElements = [
  ...mainElements,
  ...Object.values(slotBranches).flat(),
];
await waitForRouteElements(allElements);
```

否则侧 slot 组件的 `updateComplete` 可能在 `dispatchRouteChange` 之后才完成，
导致事件时机不一致。

---

## 13. 性能优化路径

### 13.1 `candidatePrefixes` — 消除每次 slice 分配

当前 `candidatePath(segments, count)` 在每次 `execPatternMatches` 调用中重复
分配 `segments.slice()`。优化方法：

```ts
function resolve(url: URL): RouterChangeDetail | null {
  const segments = splitSegments(localPathname);
  const prefixes = candidatePrefixes(segments);  // 一次性预计算
  const branch = matchSlotRoutes(
    this.compiledRoutes, segments, prefixes, ...
  );
}

function candidatePrefixes(segments: string[]): string[] {
  const prefixes = ["/"];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += "/" + segments[i];
    prefixes.push(acc);
  }
  return prefixes;
}

function candidatePathFromPrefixes(prefixes: string[], count: number): string {
  return prefixes[count];
}
```

`prefixes` 数组的持久成本是 O(segments) 额外内存，在不超过 10 个 path 段的 URL
下可忽略。

### 13.2 按 slot 分组的编译索引 — 跳过无关路由

当前 `CompiledRouteDefinition[]` 是所有路由的线性列表。多 slot 场景下，每个 slot
的匹配需要遍历所有路由。可以加一个 `slot → CompiledRouteDefinition[]`
的分组索引：

```ts
interface CompiledRouteLevel {
  bySlot: Map<string, CompiledRouteDefinition[]>;
  all: CompiledRouteDefinition[];
}
```

`buildCompiledRoutes` 在每层递归时填充 `bySlot`：

```ts
for (const route of compiled) {
  const slot = route.route.slot ?? DEFAULT_CHILD_SLOT;
  if (!bySlot.has(slot)) bySlot.set(slot, []);
  bySlot.get(slot)!.push(route);
}
```

`matchSlotRoutes` 中改为按 slot 分组遍历：

```ts
for (const [slot, slotRoutes] of compiled.bySlot) {
  if (slotResults.has(slot)) continue;
  for (const route of slotRoutes) {
    // same matching logic
  }
}
```

收益：如果 10 条路由中有 7 条是主 slot、3 条是 sidebar slot，主 slot 的匹配只
遍历 7 条而非 10 条。但这与 `Map.has()` 的提前跳出效果重叠——skip 逻辑已经在
循环开头通过 `if (slotResults has this slot) continue` 实现。分桶索引的额外
收益仅在未匹配的 slot 非常多的场景下体现。

**暂不推荐**——当前设计在典型 slot 数量（≤ 3）下收益可忽略。

### 13.3 `dispatchRouteLoading` 中 `[...branch]` 克隆

当前 loading 事件每次都克隆分支数组。多 slot 后，对每个正在加载的 slot 分支
也需要克隆。可以只传递引用，让事件消费方知道不要修改数组——但这打破了防御性设计。

**保留克隆**——分支数组的长度通常 ≤ 5，克隆成本低于一个 `CustomEvent` 的构造。

### 13.4 `slotResults` 对象字面量 vs. Map

伪代码中 `slotResults = {}`。对于 2-3 个 slot 的场景，对象字面量比 `new Map()`
更快（没有构造函数开销和 GC 跟踪）。但对象字面量缺少 `has` 的简洁 语义（需要
`"sidebar" in slotResults`）。

如果 slot 数 ≤ 3，推荐对象字面量 + `in` 检查；如果担心动态 slot 名进入 10+，用
Map。

**推荐对象字面量**——slot 通常由模板声明，不会动态增长。

### 13.5 性能回退评估 — 单 slot 场景

见第 3.3 节分析。对于单 slot（默认 `"route-child"`），`matchSlotRoutes` 与
`matchRoutes` 的行为等价。`execPatternMatches` 调用次数完全相同。额外的
`Map.has("route-child")` 或 `"route-child" in obj` 开销 < 10ns。不需要为单 slot
做 fast-path 分支。

### 13.6 `childrenBySlot` 编译索引 — 已落地

`CompiledRouteDefinition` 新增 `childrenBySlot` 字段，在 `buildCompiledRoutes`
编译期通过 `groupBySlot()` 填充。`matchRoutes` 递归时通过
`route.childrenBySlot.get(DEFAULT_CHILD_SLOT)` 替代直接遍历 `route.children`。

**数据流**：

```
rebuildRouteState()
  → buildCompiledRoutes(routeTree, patternCache)
    → groupBySlot(children)
      → Map { "route-child" → [child1, child2, ...], "sidebar" → [...] }

resolve()
  → matchRoutes(compiledRoutes, segments)
    → for route in routes:
        match children via route.childrenBySlot.get("route-child")
        → recursive matchRoutes(defaultGroup, ...)
```

**单 slot 行为等价性**：

当前所有路由的 `slot` 默认为 `route.route.slot ?? DEFAULT_CHILD_SLOT`。
`groupBySlot` 将所有 children 归入 `"route-child"` 分组。
`route.childrenBySlot.get("route-child")` 返回与 `route.children` 相同的数组
引用。匹配行为完全不变。

**多 slot 的就绪性**：

当路由定义引入 `slot: "sidebar"` 后，`groupBySlot` 自动将 children 按 slot
分组。`matchRoutes` 改为 `matchSlotRoutes` 后，迭代逻辑从遍历单组改为遍历
`childrenBySlot` 的所有 entry。数据结构已就绪，算法改动仅在第 3.2 节伪代码的
for-loop 层。

**编译开销**：

`groupBySlot` 在每次 `rebuildRouteState()`（路由树变更时）执行一次。对 N 条
children，创建一个 Map 并执行 N 次 `Map.get`/`Map.set`。这是路径变更时的低频
操作，不在导航热路径上。

---
## 15. 落地数据流与改动清单

### 15.1 已完成（当前代码库）

| 改动 | 文件 | 说明 |
|------|------|------|
| `CompiledRouteDefinition.childrenBySlot` | router-core.ts | 新增字段 |
| `DEFAULT_CHILD_SLOT` | router-core.ts | 常量 `"route-child"` |
| `groupBySlot()` | router-core.ts | 按 slot 分组编译后路由 |
| `buildCompiledRoutes` 重构 | router-core.ts | 分离 children 构建与 sort |
| `matchRoutes` 适配 | router-core.ts | 通过 `childrenBySlot.get()` 取默认 slot |
| `RouteDefinition.slot?: string` | router-core.ts | v2 类型字段 |
| `ReadonlyRouteDefinition` 含 `slot` | router-core.ts | 冻结快照自然传递 |
| `matchSlotRoutes` | router-core.ts | 替换 `matchRoutes`，按 slot 遍历，含 `matchCache` |
| `candidatePrefixes` | router-core.ts | 预计算候选 pathname，减少 slice/join 分配 |
| `RouterChangeDetail.slotBranches` / `slotParams` / `slots` | router-core.ts | 侧 slot 分支、params 与统一 slot 详情 |
| `RouterChangeDetail.toJSON` | router-core.ts | 序列化 `query` 与 `url` |
| `RouteLoadingDetail.loadingSlots` | router-core.ts | loading 事件暴露本次加载涉及的 slot |
| `RouteContext.slot` / `branch` | router-core.ts | 组件感知自身 slot 和分支 |
| `renderedBranches: Map<string, HTMLElement[]>` | router-view.ts | 按 slot 分桶 |
| `mountRouteBranch` | router-view.ts | 主链/侧链统一挂载逻辑 |
| `moveFocusIntoRoute` 侧 slot 策略 | router-view.ts | 仅侧 slot 变化时避免无意义抢焦点 |
| `beforeLeave` 多 slot | router-core.ts | 收集侧 slot 离开路由，按字典序排序 |
| `loadBranch` 多 slot | router-core.ts | 遍历所有 slot 分支 |
| `isSameDetail` 多 slot | router-core.ts | 比较 slot 分支引用 |

### 15.2 后续可选增强

| 改动 | 文件 | 说明 |
|------|------|------|
| 真实浏览器 E2E | tests/e2e | 覆盖 Navigation API / View Transitions API 实机行为 |
| 清理 `mountBranch` 的 `_previousDetail` 参数 | router-view.ts | 重构后不再需要位置比对，参数可移除 |
| 合并 `loadingSlots` 双重克隆 | router-core.ts | `loadingSlotsForDetail` + `dispatchRouteLoading` 各克隆一次 |
| 缓存 `detailSlotBranches` 结果 | router-core.ts | 避免多处 spread 临时对象 |
| 侧 slot 嵌套 children 测试 | tests/ | 验证 sidebar → sidebar-tools 递归链 |
---

## 14. 实施验收清单

### 14.1 类型与编译期

- [x] `RouteDefinition.slot?: string` 类型定义
- [x] `ReadonlyRouteDefinition` 包含 `slot`
- [x] `cloneRouteDefinition` / `freezeRouteDefinition` 正确处理 `slot`
- [x] `buildCompiledRoutes` 不因 `slot` 字段产生编译错误

### 14.2 匹配

- [x] `matchSlotRoutes` 替换 `matchRoutes`
- [x] 主 slot 匹配失败 → URL not-found（主链判定规则）
- [x] 侧 slot 匹配失败 → 不影响主 slot，侧 slot 不渲染
- [x] 同路径不同 slot → 各自选择最佳匹配
- [x] 单 slot 场景行为零回退（测试验证）

### 14.3 RouterView 渲染

- [x] `renderedBranches: Map<string, HTMLElement[]>` 按 slot 分桶
- [x] `mountBranch` 遍历 `slotBranches`
- [x] `mountRouteBranch` 正确投影 `child.slot = name`
- [x] `waitForRouteElements` 包含侧 slot 元素
- [x] `validateChildOutlet` 验证所有已使用的 slot
- [x] 侧 slot 元素复用

### 14.4 守卫与懒加载

- [x] `runGuards` 遍历主链 + 所有 slot 分支的并集
- [x] `beforeLeave` 收集侧 slot 的离开路由，按字典序排序
- [x] `loadBranch` 遍历所有 slot 分支
- [x] `branchNeedsLoading` 检查所有分支

### 14.5 事件

- [x] `RouterChangeDetail.slotBranches` 字段
- [x] `RouteContext.slot` 字段
- [x] `route-loading-*` 的 `loadingSlots` 字段
- [x] 其他事件向后兼容

### 14.6 文档

- [x] `slot` 字段文档
- [x] 保留 slot 名（`"404"`, `"error"`）约束
- [x] 命名 slot 路由的 `name` 冲突规则
- [x] 侧 slot fallback 语义
