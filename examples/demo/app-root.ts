import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./demo-pages.ts";
import "../../src/router.ts";
import {
  type RouteDefinition,
  Router,
  type RouterChangeDetail,
} from "../../src/router.ts";

@customElement("app-root")
export class AppRoot extends LitElement {
  @state()
  private accessor currentPath = "/";

  @state()
  private accessor currentLocalPath = "/";

  @state()
  private accessor currentBasePath = "/";

  @state()
  private accessor currentRoute = "";

  @state()
  private accessor currentParams = "{}";

  @state()
  private accessor labUnlocked = false;

  private readonly routes: RouteDefinition[] = [
    {
      path: "",
      title: "Router Overview",
      component: "demo-overview-page",
    },
    {
      path: "inbox",
      title: "Inbox",
      component: "demo-inbox-layout",
      children: [
        {
          path: "",
          title: "Inbox Home",
          component: "demo-inbox-home",
        },
        {
          path: "drafts",
          title: "Inbox Drafts",
          component: "lazy-drafts-panel",
          load: () => import("./lazy-drafts-panel.js"),
        },
        {
          path: "archive",
          title: "Inbox Archive",
          component: "demo-inbox-archive",
        },
      ],
    },
    {
      path: "settings",
      title: "Settings",
      component: "demo-settings-layout",
      children: [
        {
          path: "",
          title: "Settings Home",
          component: "demo-settings-home",
        },
        {
          path: "profile",
          title: "Profile Settings",
          component: "demo-settings-profile",
        },
        {
          path: "security",
          title: "Security Settings",
          component: "demo-settings-security",
        },
      ],
    },
    {
      path: "lab",
      title: "Guarded Lab",
      component: "demo-lab-page",
      guard: () => {
        if (this.labUnlocked) {
          return true;
        }

        return {
          to: "/?guard=blocked",
          replace: true,
        };
      },
    },
    {
      path: "*",
      title: "Not Found",
      component: "demo-not-found-page",
    },
  ];

  private readonly router = new Router({
    routes: this.routes,
  });

  private readonly onRouteChange = (event: CustomEvent<RouterChangeDetail>) => {
    this.currentPath =
      `${event.detail.pathname}${event.detail.search}${event.detail.hash}`;
    this.currentLocalPath = event.detail.localPathname;
    this.currentBasePath = event.detail.basePath;
    this.currentRoute = event.detail.branch.map((route) => route.path || "/")
      .join(" / ");
    this.currentParams = JSON.stringify(event.detail.params);
  };

  private replaceToInboxDraft(): void {
    this.router?.replace("/inbox/drafts?mode=replace");
  }

  private toggleLabAccess(): void {
    this.labUnlocked = !this.labUnlocked;
  }

  render() {
    return html`
      <main class="shell">
        <section class="hero">
          <p class="eyebrow">Native Navigation Router</p>
          <h1>面向项目落地的 Web Components Router</h1>
          <p class="lede">
            路由定义现在完全在 TypeScript 里声明，router 直接消费路由树并实例化对应的
            Web Components。嵌套路由通过父组件内部的 ${'`<slot name="route-child">`'} 投影子页面，不再依赖
            HTML 上的路由标记。
          </p>
        </section>

        <nav class="nav">
          <a href="/">Overview</a>
          <a href="/inbox">Inbox</a>
          <a href="/settings/profile">Settings</a>
          <a href="/lab">Guarded Lab</a>
          <button type="button" @click="${this.replaceToInboxDraft}">
            Replace 到草稿箱
          </button>
          <button type="button" @click="${this.toggleLabAccess}">
            ${this.labUnlocked ? "锁定 Lab" : "解锁 Lab"}
          </button>
        </nav>

        <section class="status">
          <div>
            <span class="label">Current path</span>
            <strong>${this.currentPath}</strong>
          </div>
          <div>
            <span class="label">Local path</span>
            <strong>${this.currentLocalPath}</strong>
          </div>
          <div>
            <span class="label">Base path</span>
            <strong>${this.currentBasePath}</strong>
          </div>
          <div>
            <span class="label">Active route</span>
            <strong>${this.currentRoute || "pending"}</strong>
          </div>
          <div>
            <span class="label">Params</span>
            <code>${this.currentParams}</code>
          </div>
          <div>
            <span class="label">Lab guard</span>
            <strong>${this.labUnlocked ? "unlocked" : "locked"}</strong>
          </div>
        </section>

        <router-view
          id="root-router"
          .router="${this.router}"
          @route-change="${this.onRouteChange}"
        ></router-view>
      </main>
    `;
  }

  static styles = css`
    :host {
      --paper: #f6f0e8;
      --ink: #102033;
      --muted: #556070;
      --line: rgba(16, 32, 51, 0.14);
      --accent: #c24d2c;
      --accent-soft: rgba(194, 77, 44, 0.12);
      --panel: rgba(255, 252, 247, 0.88);
      --danger: #8a2d20;
      --shadow: 0 18px 40px rgba(16, 32, 51, 0.1);
      --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      --sans: "Avenir Next", "Segoe UI", sans-serif;
      --mono: "SFMono-Regular", "Cascadia Code", monospace;

      display: block;
      min-height: 100svh;
      color: var(--ink);
      background:
        radial-gradient(
          circle at top left,
          rgba(194, 77, 44, 0.14),
          transparent 32%
        ),
        radial-gradient(
        circle at bottom right,
        rgba(25, 93, 78, 0.12),
        transparent 28%
      ),
        linear-gradient(180deg, #fbf6ef 0%, #f0e4d6 100%);
      font-family: var(--sans);
    }

    .shell {
      width: min(960px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 56px 0 72px;
    }

    .hero {
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
    }

    h1,
    h2 {
      margin: 0;
      font-family: var(--serif);
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    h1 {
      font-size: clamp(2.8rem, 7vw, 4.8rem);
      line-height: 0.95;
      max-width: 12ch;
    }

    h2 {
      margin-bottom: 12px;
      font-size: clamp(1.5rem, 3vw, 2rem);
    }

    .lede,
    p {
      color: var(--muted);
      line-height: 1.65;
    }

    .lede {
      max-width: 68ch;
      margin: 16px 0 0;
      font-size: 1.05rem;
    }

    .nav,
    .status {
      backdrop-filter: blur(10px);
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }

    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      padding: 14px;
      border-radius: 999px;
      margin-bottom: 18px;
    }

    .nav a,
    .nav button,
    .actions a {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--ink);
      text-decoration: none;
      cursor: pointer;
      font: 600 0.96rem/1 var(--sans);
      padding: 12px 16px;
      border-radius: 999px;
      transition:
        transform 180ms ease,
        background-color 180ms ease,
        color 180ms ease;
      }

      .nav a:hover,
      .nav button:hover,
      .actions a:hover {
        transform: translateY(-1px);
        background: var(--accent-soft);
        color: var(--accent);
      }

      .status {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        border-radius: 24px;
        padding: 20px 22px;
        margin-bottom: 18px;
      }

      .status strong,
      .status code {
        display: block;
        margin-top: 6px;
        font-size: 0.98rem;
      }

      .status code,
      pre,
      code {
        font-family: var(--mono);
      }

      .label {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      router-view {
        display: block;
        min-height: 320px;
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100vw - 20px, 960px);
          padding: 28px 0 40px;
        }

        .nav {
          border-radius: 28px;
        }

        .status {
          grid-template-columns: 1fr;
        }

        router-view {
          min-height: 280px;
        }
      }
    `;
  }

  declare global {
    interface HTMLElementTagNameMap {
      "app-root": AppRoot;
    }
  }
