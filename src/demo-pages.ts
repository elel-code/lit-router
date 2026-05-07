import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RouteContext, RouterChangeDetail } from "./router.ts";

class RouteAwareElement extends LitElement {
  @property({ attribute: false })
  accessor routeContext: RouteContext | undefined;

  private renderCount = 0;

  protected get detail(): RouterChangeDetail | undefined {
    return this.routeContext?.detail;
  }

  protected get params(): Record<string, string> {
    return this.routeContext?.params ?? {};
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.logLifecycle("connected");
  }

  disconnectedCallback(): void {
    this.logLifecycle("disconnected");
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    this.renderCount += 1;
    this.logLifecycle("willUpdate", changedProperties);
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    this.logLifecycle("updated", changedProperties);
  }

  private logLifecycle(
    phase: "connected" | "disconnected" | "willUpdate" | "updated",
    changedProperties?: Map<PropertyKey, unknown>,
  ): void {
    const path = this.detail?.pathname ?? "(no-route)";
    const changed = changedProperties
      ? Array.from(changedProperties.keys()).map(String)
      : [];

    console.log(`[demo-route] ${this.localName}:${phase}`, {
      renderCount: this.renderCount,
      path,
      params: this.params,
      changedProperties: changed,
    });
  }
}

@customElement("demo-overview-page")
export class DemoOverviewPage extends RouteAwareElement {
  render() {
    return html`
      <section class="panel">
        <h2>TS 声明式路由</h2>
        <p>
          路由定义完全在 TypeScript 里声明，router 根据路由树实例化 Web Components，
          不再依赖 HTML 上的 ${"`data-route`"}。
        </p>
        <pre><code>{
          path: "settings",
          component: "demo-settings-layout",
          children: [
            { path: "", component: "demo-settings-home" },
            { path: "profile", component: "demo-settings-profile" }
          ]
        }</code></pre>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border-radius: 32px;
      padding: 28px;
      border: 1px solid rgba(16, 32, 51, 0.14);
      background: rgba(255, 252, 247, 0.88);
      box-shadow: 0 18px 40px rgba(16, 32, 51, 0.1);
    }

    h2 {
      margin: 0 0 12px;
      font: 700 clamp(1.5rem, 3vw, 2rem) / 1 "Iowan Old Style", serif;
      color: #102033;
    }

    p {
      margin: 0;
      color: #556070;
      line-height: 1.65;
    }

    pre {
      overflow-x: auto;
      margin: 18px 0 0;
      padding: 16px;
      border-radius: 20px;
      background: rgba(16, 32, 51, 0.06);
      color: #102033;
      font: 0.9rem/1.5 "SFMono-Regular", "Cascadia Code", monospace;
    }
  `;
}

@customElement("demo-inbox-layout")
export class DemoInboxLayout extends RouteAwareElement {
  render() {
    return html`
      <section class="panel">
        <h2>Inbox</h2>
        <p>这个父组件自身不关心路径匹配，只负责给子路由提供布局和投影位。</p>
        <nav class="actions">
          <a href="/inbox">Overview</a>
          <a href="/inbox/drafts">Drafts</a>
          <a href="/inbox/archive">Archive</a>
        </nav>
        <slot name="route-child"></slot>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border-radius: 32px;
      padding: 28px;
      border: 1px solid rgba(16, 32, 51, 0.14);
      background: rgba(255, 252, 247, 0.88);
      box-shadow: 0 18px 40px rgba(16, 32, 51, 0.1);
    }

    h2 {
      margin: 0 0 10px;
      font: 700 clamp(1.5rem, 3vw, 2rem) / 1 "Iowan Old Style", serif;
      color: #102033;
    }

    p {
      margin: 0;
      color: #556070;
      line-height: 1.65;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 18px 0 0;
    }

    .actions a {
      padding: 12px 16px;
      border-radius: 999px;
      color: #102033;
      text-decoration: none;
      background: rgba(194, 77, 44, 0.12);
      font: 600 0.95rem/1 "Avenir Next", "Segoe UI", sans-serif;
    }

    ::slotted(*) {
      display: block;
      margin-top: 18px;
    }
  `;
}

@customElement("demo-inbox-home")
export class DemoInboxHome extends RouteAwareElement {
  render() {
    return html`
      <section class="subpanel">
        <p>这是 inbox 的 index 路由。</p>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .subpanel {
      padding: 20px;
      border-radius: 24px;
      background: rgba(16, 32, 51, 0.06);
      color: #556070;
    }
  `;
}

@customElement("demo-inbox-archive")
export class DemoInboxArchive extends RouteAwareElement {
  render() {
    return html`
      <section class="subpanel">
        <p>这是 archive 子路由，适合配合 replace 导航。</p>
      </section>
    `;
  }

  static styles = DemoInboxHome.styles;
}

@customElement("demo-settings-layout")
export class DemoSettingsLayout extends RouteAwareElement {
  render() {
    return html`
      <section class="panel">
        <h2>Settings</h2>
        <p>这是一个嵌套路由父层，子页面会通过原生 slot 投影到这里。</p>
        <nav class="actions">
          <a href="/settings">Home</a>
          <a href="/settings/profile">Profile</a>
          <a href="/settings/security">Security</a>
        </nav>
        <slot name="route-child"></slot>
      </section>
    `;
  }

  static styles = DemoInboxLayout.styles;
}

@customElement("demo-settings-home")
export class DemoSettingsHome extends RouteAwareElement {
  render() {
    return html`
      <section class="subpanel">
        <p>settings index 路由已命中，当前 local path 是 ${this.detail
          ?.localPathname}。</p>
      </section>
    `;
  }

  static styles = DemoInboxHome.styles;
}

@customElement("demo-settings-profile")
export class DemoSettingsProfile extends RouteAwareElement {
  render() {
    return html`
      <section class="subpanel">
        <p>Profile 页面通过子路由树声明，不需要额外写嵌套 router 模板。</p>
      </section>
    `;
  }

  static styles = DemoInboxHome.styles;
}

@customElement("demo-settings-security")
export class DemoSettingsSecurity extends RouteAwareElement {
  render() {
    return html`
      <section class="subpanel">
        <p>Security 页面和 Profile 一样，都是 settings 的 children route。</p>
      </section>
    `;
  }

  static styles = DemoInboxHome.styles;
}

@customElement("demo-lab-page")
export class DemoLabPage extends RouteAwareElement {
  render() {
    return html`
      <section class="panel">
        <h2>Guarded Lab</h2>
        <p>这个路由受 guard 保护，未解锁时会被重定向回首页。</p>
      </section>
    `;
  }

  static styles = DemoOverviewPage.styles;
}

@customElement("demo-not-found-page")
export class DemoNotFoundPage extends RouteAwareElement {
  render() {
    return html`
      <section class="panel danger">
        <h2>404</h2>
        <p>没有匹配到当前 URL 的路由定义。</p>
        <a href="/">回到首页</a>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border-radius: 32px;
      padding: 28px;
      border: 1px solid rgba(138, 45, 32, 0.28);
      background: rgba(255, 252, 247, 0.88);
      box-shadow: 0 18px 40px rgba(16, 32, 51, 0.1);
    }

    h2 {
      margin: 0 0 10px;
      font: 700 clamp(1.5rem, 3vw, 2rem) / 1 "Iowan Old Style", serif;
      color: #102033;
    }

    p {
      margin: 0 0 16px;
      color: #556070;
      line-height: 1.65;
    }

    a {
      color: #c24d2c;
      text-decoration: none;
      font-weight: 700;
    }
  `;
}
