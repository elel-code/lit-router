import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RouteContext, RouterChangeDetail } from "../../src/router.ts";

const panelStyles = css`
  :host {
    display: block;
  }

  .panel,
  .subpanel {
    border: 1px solid rgba(16, 32, 51, 0.12);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 18px 36px rgba(16, 32, 51, 0.08);
  }

  .panel {
    border-radius: 28px;
    padding: 26px;
  }

  .subpanel {
    border-radius: 22px;
    padding: 20px;
  }

  h2,
  h3 {
    margin: 0;
    color: #102033;
    font-family: "Iowan Old Style", "Palatino Linotype", serif;
    letter-spacing: -0.03em;
  }

  h2 {
    font-size: clamp(1.7rem, 3vw, 2.3rem);
  }

  h3 {
    font-size: 1.15rem;
  }

  p,
  li {
    color: #556070;
    line-height: 1.7;
  }

  p {
    margin: 0;
  }

  .stack {
    display: grid;
    gap: 14px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }

  .actions a,
  .actions button {
    appearance: none;
    border: none;
    border-radius: 999px;
    padding: 11px 15px;
    background: rgba(194, 77, 44, 0.12);
    color: #102033;
    cursor: pointer;
    text-decoration: none;
    font: 600 0.94rem/1 "Avenir Next", "Segoe UI", sans-serif;
  }

  code,
  pre {
    font-family: "SFMono-Regular", "Cascadia Code", monospace;
  }

  pre {
    margin: 0;
    overflow: auto;
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(16, 32, 51, 0.06);
    color: #102033;
    line-height: 1.55;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
  }
`;

class ExampleRouteElement extends LitElement {
  @property({ attribute: false })
  accessor routeContext: RouteContext | undefined;

  protected get detail(): RouterChangeDetail | undefined {
    return this.routeContext?.detail;
  }

  protected get params(): Record<string, string> {
    return this.routeContext?.params ?? {};
  }
}

@customElement("example-home-page")
export class ExampleHomePage extends ExampleRouteElement {
  render() {
    return html`
      <section class="panel stack">
        <div class="stack">
          <h2 data-route-focus tabindex="-1">Minimal Router Playground</h2>
          <p>
            这个示例不是“只有首页能跑”的 hello world，而是把核心能力压缩到一页：
            懒加载、leave guard、动态插入 route tree、方向感知、fallback slot 和 route
            context 都能直接点出来。
          </p>
        </div>

        <div class="stack">
          <h3>建议按这个顺序试：</h3>
          <ul>
            <li>进入 Inbox Drafts，观察 loading badge 和事件日志。</li>
            <li>进入 Editor，点“Mark Dirty”，再尝试离开，看 beforeLeave 阻断。</li>
            <li>切换 Reports plugin，观察 route-tree-change 和当前页面重匹配。</li>
            <li>打开 Broken / Missing，看自定义 error 与 404 slot。</li>
            <li>打开 Message 42，看 params、query、hash 如何进入 RouteContext。</li>
          </ul>
        </div>
      </section>
    `;
  }

  static styles = panelStyles;
}

@customElement("example-inbox-layout")
export class ExampleInboxLayout extends ExampleRouteElement {
  render() {
    return html`
      <section class="panel stack">
        <div class="stack">
          <h2 data-route-focus tabindex="-1">Inbox Layout</h2>
          <p>
            这个父路由组件只负责布局和 <code>&lt;slot name="route-child"&gt;</code>，
            子页面通过原生 slot 投影进来。
          </p>
        </div>

        <nav class="actions">
          <a href="/examples/minimal/inbox">Inbox Home</a>
          <a href="/examples/minimal/inbox/drafts">Lazy Drafts</a>
          <a href="/examples/minimal/inbox/message/42?tab=activity#summary">
            Message 42
          </a>
        </nav>

        <slot name="route-child"></slot>
      </section>
    `;
  }

  static styles = [
    panelStyles,
    css`
      ::slotted(*) {
        display: block;
        margin-top: 10px;
      }
    `,
  ];
}

@customElement("example-inbox-home")
export class ExampleInboxHome extends ExampleRouteElement {
  render() {
    return html`
      <section class="subpanel">
        <p>
          Inbox index 路由已命中。继续点 Lazy Drafts 可以看到
          <code>route-loading-start</code> / <code>route-loading-end</code>。
        </p>
      </section>
    `;
  }

  static styles = panelStyles;
}

@customElement("example-message-page")
export class ExampleMessagePage extends ExampleRouteElement {
  render() {
    const query: Record<string, string> = {};
    new URLSearchParams(this.detail?.search ?? "").forEach((value, key) => {
      query[key] = value;
    });

    const snapshot = {
      params: this.params,
      query,
      hash: this.detail?.hash ?? "",
      direction: this.detail?.direction ?? "none",
    };

    return html`
      <section class="subpanel stack">
        <h3 data-route-focus tabindex="-1">Message ${this.params.id}</h3>
        <p>
          这个页面演示 <code>RouteContext</code>：路径参数、query、hash 和 direction
          都可以直接从上下文里读取。
        </p>
        <pre>${JSON.stringify(snapshot, null, 2)}</pre>
      </section>
    `;
  }

  static styles = panelStyles;
}

@customElement("example-editor-page")
export class ExampleEditorPage extends ExampleRouteElement {
  @property({ attribute: false })
  accessor readDirty: (() => boolean) | undefined;

  @property({ attribute: false })
  accessor toggleDirty: (() => void) | undefined;

  private onToggleDirty(): void {
    this.toggleDirty?.();
    this.requestUpdate();
  }

  render() {
    const dirty = Boolean(this.readDirty?.());

    return html`
      <section class="panel stack">
        <div class="stack">
          <h2 data-route-focus tabindex="-1">Editor</h2>
          <p>
            这个页面挂了 <code>beforeLeave</code>。只要状态是 dirty，离开当前分支的
            导航就会被阻断，包含浏览器后退。
          </p>
        </div>

        <section class="subpanel stack">
          <p>
            Current dirty state:
            <strong>${dirty ? "dirty" : "clean"}</strong>
          </p>
          <div class="actions">
            <button type="button" @click="${this.onToggleDirty}">
              ${dirty ? "Mark Clean" : "Mark Dirty"}
            </button>
            <a href="/examples/minimal/">Try Leaving To Home</a>
          </div>
        </section>
      </section>
    `;
  }

  static styles = panelStyles;
}

@customElement("example-lab-page")
export class ExampleLabPage extends ExampleRouteElement {
  render() {
    return html`
      <section class="panel stack">
        <h2 data-route-focus tabindex="-1">Guarded Lab</h2>
        <p>
          这个路由受 <code>guard</code> 保护。未解锁时会直接重定向回首页并带上 query
          标记。
        </p>
      </section>
    `;
  }

  static styles = panelStyles;
}

@customElement("example-reports-page")
export class ExampleReportsPage extends ExampleRouteElement {
  render() {
    return html`
      <section class="panel stack">
        <h2 data-route-focus tabindex="-1">Reports Plugin Route</h2>
        <p>
          这个页面不是初始 route tree 的一部分，而是运行时通过
          <code>insertRoutes()</code> 加进去的。
        </p>
      </section>
    `;
  }

  static styles = panelStyles;
}
