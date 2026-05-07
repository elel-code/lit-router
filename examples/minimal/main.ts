import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  type RouteDefinition,
  type RouteErrorDetail,
  type RouteLoadingDetail,
  type RouteNotFoundDetail,
  Router,
  type RouterChangeDetail,
  type RouteTreeChangeDetail,
} from "../../src/router.ts";
import "../../src/router.ts";
import "./example-pages.ts";

const BASE_PATH = "/examples/minimal";
const REPORTS_ROUTE: RouteDefinition = {
  id: "reports-plugin",
  path: "reports",
  name: "reports",
  title: "Reports Plugin",
  component: "example-reports-page",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type EventLineTone = "default" | "info" | "error";

interface EventLine {
  label: string;
  message: string;
  tone: EventLineTone;
}

@customElement("minimal-router-example")
export class MinimalRouterExample extends LitElement {
  @state()
  private accessor committedUrl = `${BASE_PATH}/`;

  @state()
  private accessor localPath = "/";

  @state()
  private accessor direction: RouterChangeDetail["direction"] = "none";

  @state()
  private accessor loadingPending = 0;

  @state()
  private accessor reportsInstalled = false;

  @state()
  private accessor labUnlocked = false;

  @state()
  private accessor editorDirty = false;

  @state()
  private accessor eventLog: EventLine[] = [];

  private routerListenersAttached = false;

  private readonly router = new Router({
    basePath: BASE_PATH,
    routes: this.createRoutes(),
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.attachRouterListeners();
  }

  disconnectedCallback(): void {
    this.detachRouterListeners();
    this.router.stop();
    super.disconnectedCallback();
  }

  private createRoutes(): RouteDefinition[] {
    return [
      {
        path: "",
        name: "home",
        title: "Minimal Router Playground",
        component: "example-home-page",
      },
      {
        id: "inbox-shell",
        path: "inbox",
        name: "inbox",
        title: "Inbox",
        component: "example-inbox-layout",
        children: [
          {
            path: "",
            name: "inbox-home",
            title: "Inbox Home",
            component: "example-inbox-home",
          },
          {
            path: "drafts",
            name: "inbox-drafts",
            title: "Lazy Drafts",
            component: "example-drafts-panel",
            load: async () => {
              await delay(420);
              await import("./lazy-drafts.ts");
            },
          },
          {
            path: "message/:id",
            name: "message",
            title: "Message :id",
            component: "example-message-page",
          },
        ],
      },
      {
        path: "editor",
        name: "editor",
        title: "Editor",
        component: "example-editor-page",
        beforeLeave: () => !this.editorDirty,
        props: {
          readDirty: () => this.editorDirty,
          toggleDirty: () => this.toggleEditorDirty(),
        },
      },
      {
        path: "lab",
        name: "lab",
        title: "Guarded Lab",
        component: "example-lab-page",
        guard: () => {
          if (this.labUnlocked) {
            return true;
          }

          return {
            to: `${BASE_PATH}/?guard=locked`,
            replace: true,
          };
        },
      },
      {
        path: "broken",
        name: "broken",
        title: "Broken Route",
        component: "example-home-page",
        load: async () => {
          await delay(240);
          throw new Error("Intentional example load failure.");
        },
      },
    ];
  }

  private attachRouterListeners(): void {
    if (this.routerListenersAttached) {
      return;
    }

    this.router.addEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.router.addEventListener(
      "route-tree-change",
      this.onRouteTreeChange as EventListener,
    );
    this.router.addEventListener(
      "route-loading-start",
      this.onRouteLoadingStart as EventListener,
    );
    this.router.addEventListener(
      "route-loading-end",
      this.onRouteLoadingEnd as EventListener,
    );
    this.router.addEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.router.addEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.routerListenersAttached = true;
  }

  private detachRouterListeners(): void {
    if (!this.routerListenersAttached) {
      return;
    }

    this.router.removeEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.router.removeEventListener(
      "route-tree-change",
      this.onRouteTreeChange as EventListener,
    );
    this.router.removeEventListener(
      "route-loading-start",
      this.onRouteLoadingStart as EventListener,
    );
    this.router.removeEventListener(
      "route-loading-end",
      this.onRouteLoadingEnd as EventListener,
    );
    this.router.removeEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.router.removeEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.routerListenersAttached = false;
  }

  private pushEventLog(
    label: string,
    message: string,
    tone: EventLineTone = "default",
  ): void {
    this.eventLog = [{ label, message, tone }, ...this.eventLog].slice(0, 10);
  }

  private readonly onRouteChange = (event: CustomEvent<RouterChangeDetail>) => {
    this.committedUrl =
      `${event.detail.pathname}${event.detail.search}${event.detail.hash}`;
    this.localPath = event.detail.localPathname;
    this.direction = event.detail.direction;
    this.pushEventLog(
      "route-change",
      `${event.detail.localPathname} (${event.detail.direction})`,
      "info",
    );
  };

  private readonly onViewRouteChange = (
    event: CustomEvent<RouterChangeDetail>,
  ) => {
    this.pushEventLog(
      "view-route-change",
      `DOM committed for ${event.detail.localPathname}`,
      "default",
    );
  };

  private readonly onRouteTreeChange = (
    event: CustomEvent<RouteTreeChangeDetail>,
  ) => {
    this.pushEventLog(
      "route-tree-change",
      `${event.detail.reason} (${event.detail.routes.length} root routes)`,
      "default",
    );
  };

  private readonly onRouteLoadingStart = (
    event: CustomEvent<RouteLoadingDetail>,
  ) => {
    this.loadingPending = event.detail.pending;
    this.pushEventLog(
      "route-loading-start",
      `${event.detail.url.pathname} (pending: ${event.detail.pending})`,
      "info",
    );
  };

  private readonly onRouteLoadingEnd = (
    event: CustomEvent<RouteLoadingDetail>,
  ) => {
    this.loadingPending = event.detail.pending;
    this.pushEventLog(
      "route-loading-end",
      `${event.detail.url.pathname} (pending: ${event.detail.pending})`,
      "default",
    );
  };

  private readonly onRouteError = (event: CustomEvent<RouteErrorDetail>) => {
    const message = event.detail.error instanceof Error
      ? event.detail.error.message
      : String(event.detail.error);
    this.pushEventLog(
      "route-error",
      `${event.detail.phase}: ${message}`,
      "error",
    );
  };

  private readonly onRouteNotFound = (
    event: CustomEvent<RouteNotFoundDetail>,
  ) => {
    this.pushEventLog(
      "route-not-found",
      event.detail.url.pathname,
      "error",
    );
  };

  private toggleLabAccess(): void {
    this.labUnlocked = !this.labUnlocked;
    this.pushEventLog(
      "lab-guard",
      this.labUnlocked ? "Lab unlocked" : "Lab locked",
      "info",
    );
  }

  private toggleEditorDirty(): void {
    this.editorDirty = !this.editorDirty;
    this.pushEventLog(
      "editor",
      this.editorDirty
        ? "Editor is dirty. Leaving routes is now blocked."
        : "Editor is clean. Leaving routes is allowed again.",
      "info",
    );
  }

  private toggleReportsRoute(): void {
    if (this.reportsInstalled) {
      this.router.removeRoute({ id: "reports-plugin" });
      this.reportsInstalled = false;
      return;
    }

    this.router.insertRoutes([REPORTS_ROUTE]);
    this.reportsInstalled = true;
  }

  private isActive(path: string, options: { exact?: boolean } = {}): boolean {
    if (options.exact === false) {
      return this.localPath === path || this.localPath.startsWith(`${path}/`);
    }

    return this.localPath === path;
  }

  private get messageHref(): string {
    return this.router.link({
      name: "message",
      params: { id: "42" },
      query: { tab: "activity" },
      hash: "summary",
    });
  }

  render() {
    const editorGuardHint = this.localPath === "/editor" && this.editorDirty
      ? html`
        <p class="hint danger">
          Editor 当前是 dirty。试着点其他链接，导航会被 <code>beforeLeave</code>
          阻断，直到你把它标记为 clean。
        </p>
      `
      : nothing;

    return html`
      <main class="shell">
        <header class="hero">
          <p class="eyebrow">@elelcode/lit-router</p>
          <h1>Minimal Example, but not Minimal Capability</h1>
          <p class="lede">
            这份 playground 把最重要的生产特性放在同一页里：懒加载、leave guard、 动态
            route tree、错误 fallback、方向感知，以及显式 RouteContext。
          </p>
        </header>

        <section class="toolbar">
          <a
            href="${BASE_PATH}/"
            aria-current="${this.isActive("/") ? "page" : nothing}"
          >
            Home
          </a>
          <a
            href="${BASE_PATH}/inbox"
            aria-current="${this.isActive("/inbox", { exact: false })
              ? "page"
              : nothing}"
          >
            Inbox
          </a>
          <a
            href="${BASE_PATH}/editor"
            aria-current="${this.isActive("/editor") ? "page" : nothing}"
          >
            Editor
          </a>
          <a
            href="${BASE_PATH}/lab"
            aria-current="${this.isActive("/lab") ? "page" : nothing}"
          >
            Guarded Lab
          </a>
          ${this.reportsInstalled
            ? html`
              <a
                href="${BASE_PATH}/reports"
                aria-current="${this.isActive("/reports") ? "page" : nothing}"
              >
                Reports
              </a>
            `
            : nothing}
          <a href="${this.messageHref}">Message 42</a>
          <a href="${BASE_PATH}/broken">Broken Route</a>
          <a href="${BASE_PATH}/missing">Missing Route</a>
          <button type="button" @click="${this.toggleLabAccess}">
            ${this.labUnlocked ? "Lock Lab" : "Unlock Lab"}
          </button>
          <button type="button" @click="${this.toggleEditorDirty}">
            ${this.editorDirty ? "Mark Editor Clean" : "Mark Editor Dirty"}
          </button>
          <button type="button" @click="${this.toggleReportsRoute}">
            ${this.reportsInstalled
              ? "Remove Reports Route"
              : "Install Reports Route"}
          </button>
        </section>

        ${editorGuardHint}

        <section class="dashboard">
          <article class="status-card">
            <span class="label">Committed URL</span>
            <strong>${this.committedUrl}</strong>
          </article>
          <article class="status-card">
            <span class="label">Local Path</span>
            <strong>${this.localPath}</strong>
          </article>
          <article class="status-card">
            <span class="label">Direction</span>
            <strong>${this.direction}</strong>
          </article>
          <article class="status-card">
            <span class="label">Loading Pending</span>
            <strong>${this.loadingPending}</strong>
          </article>
          <article class="status-card">
            <span class="label">Reports Plugin</span>
            <strong>${this.reportsInstalled
              ? "installed"
              : "not installed"}</strong>
          </article>
          <article class="status-card">
            <span class="label">Editor Dirty</span>
            <strong>${this.editorDirty ? "dirty" : "clean"}</strong>
          </article>
          <article class="status-card wide">
            <span class="label">Reverse Link Example</span>
            <code>${this.messageHref}</code>
          </article>
        </section>

        <section class="event-log">
          <div class="event-log-header">
            <h2>Event Log</h2>
            <span class="badge">${this.eventLog.length} entries</span>
          </div>
          <ol>
            ${this.eventLog.map((line) =>
              html`
                <li class="tone-${line.tone}">
                  <strong>${line.label}</strong>
                  <span>${line.message}</span>
                </li>
              `
            )}
          </ol>
        </section>

        <router-view
          class="stage"
          .router="${this.router}"
          @route-change="${this.onViewRouteChange}"
        >
          <section slot="404" class="custom-slot stack">
            <p class="slot-eyebrow">Custom 404 Slot</p>
            <h2 data-route-focus tabindex="-1">This example route does not exist.</h2>
            <p>
              这里展示的是壳层自定义 slot，不是默认 fallback 模板。回到 Home 或 Inbox
              继续试其它能力。
            </p>
          </section>

          <section slot="error" class="custom-slot stack danger-slot">
            <p class="slot-eyebrow">Custom Error Slot</p>
            <h2 data-route-focus tabindex="-1">The route failed before commit.</h2>
            <p>
              点 Broken Route 时会命中这里。日志里会保留 load phase 的错误信息。
            </p>
          </section>
        </router-view>
      </main>
    `;
  }

  static styles = css`
    :host {
      --paper: #f7f3ea;
      --ink: #102033;
      --muted: #586171;
      --line: rgba(16, 32, 51, 0.14);
      --accent: #c24d2c;
      --accent-soft: rgba(194, 77, 44, 0.12);
      --sea: #176b5d;
      --sea-soft: rgba(23, 107, 93, 0.12);
      --panel: rgba(255, 252, 247, 0.86);
      --shadow: 0 24px 54px rgba(16, 32, 51, 0.1);

      display: block;
      min-height: 100svh;
      background:
        radial-gradient(
          circle at top left,
          rgba(194, 77, 44, 0.14),
          transparent 30%
        ),
        radial-gradient(
        circle at bottom right,
        rgba(23, 107, 93, 0.12),
        transparent 28%
      ),
        linear-gradient(180deg, #faf6ef 0%, #f0e6d9 100%);
      color: var(--ink);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }

    .shell {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 46px 0 72px;
    }

    .hero {
      margin-bottom: 24px;
    }

    .eyebrow,
    .slot-eyebrow {
      margin: 0;
      color: var(--accent);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 0.74rem;
      font-weight: 700;
    }

    h1,
    h2 {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      letter-spacing: -0.04em;
    }

    h1 {
      font-size: clamp(2.8rem, 7vw, 5rem);
      line-height: 0.95;
      max-width: 11ch;
    }

    h2 {
      font-size: 1.55rem;
    }

    .lede,
    p {
      color: var(--muted);
      line-height: 1.7;
    }

    .lede {
      max-width: 72ch;
      margin: 16px 0 0;
      font-size: 1.02rem;
    }

    .toolbar,
    .event-log,
    .status-card,
    .hint {
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      padding: 14px;
      border-radius: 999px;
    }

    .toolbar a,
    .toolbar button {
      appearance: none;
      border: none;
      border-radius: 999px;
      padding: 11px 15px;
      background: transparent;
      color: var(--ink);
      text-decoration: none;
      cursor: pointer;
      font: 600 0.94rem/1 "Avenir Next", "Segoe UI", sans-serif;
      transition:
        transform 160ms ease,
        background-color 160ms ease,
        color 160ms ease;
      }

      .toolbar a:hover,
      .toolbar button:hover {
        transform: translateY(-1px);
        background: var(--accent-soft);
        color: var(--accent);
      }

      .toolbar a[aria-current="page"] {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .hint {
        margin: 18px 0 0;
        padding: 14px 16px;
        border-radius: 18px;
      }

      .hint code {
        font-family: "SFMono-Regular", "Cascadia Code", monospace;
      }

      .danger {
        color: #8a2d20;
      }

      .dashboard {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin: 18px 0 0;
      }

      .status-card {
        border-radius: 24px;
        padding: 18px;
        display: grid;
        gap: 10px;
      }

      .status-card.wide {
        grid-column: span 3;
      }

      .label {
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--muted);
        font-weight: 700;
      }

      strong,
      code {
        color: var(--ink);
        word-break: break-word;
      }

      code {
        font-family: "SFMono-Regular", "Cascadia Code", monospace;
        font-size: 0.93rem;
      }

      .event-log {
        margin-top: 18px;
        border-radius: 28px;
        padding: 20px 22px;
      }

      .event-log-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.2rem;
        padding: 0.4rem 0.7rem;
        border-radius: 999px;
        background: rgba(16, 32, 51, 0.08);
        color: var(--ink);
        font-size: 0.8rem;
        font-weight: 700;
      }

      ol {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }

      li {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 18px;
        background: rgba(16, 32, 51, 0.05);
        color: var(--muted);
      }

      li strong {
        color: var(--ink);
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .tone-info {
        border-left: 4px solid rgba(194, 77, 44, 0.45);
      }

      .tone-error {
        border-left: 4px solid rgba(138, 45, 32, 0.55);
      }

      router-view.stage {
        display: block;
        margin-top: 18px;
        border: 1px solid var(--line);
        border-radius: 34px;
        padding: 20px;
        background: rgba(255, 252, 247, 0.56);
        box-shadow: var(--shadow);
        transition:
          border-color 180ms ease,
          transform 180ms ease,
          box-shadow 180ms ease;
        }

        router-view.stage[data-transition-direction="forward"] {
          border-color: rgba(194, 77, 44, 0.35);
          transform: translateX(2px);
        }

        router-view.stage[data-transition-direction="backward"] {
          border-color: rgba(23, 107, 93, 0.35);
          transform: translateX(-2px);
        }

        .custom-slot {
          border-radius: 28px;
          padding: 26px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.96);
        }

        .danger-slot {
          border-color: rgba(138, 45, 32, 0.3);
        }

        @media (max-width: 820px) {
          .dashboard {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .status-card.wide {
            grid-column: span 2;
          }
        }

        @media (max-width: 620px) {
          .shell {
            width: min(100vw - 20px, 100%);
            padding: 28px 0 48px;
          }

          .toolbar {
            border-radius: 28px;
          }

          .dashboard {
            grid-template-columns: 1fr;
          }

          .status-card.wide {
            grid-column: span 1;
          }
        }
      `;
    }
