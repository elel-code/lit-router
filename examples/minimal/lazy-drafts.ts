import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RouteContext } from "../../src/router.ts";

@customElement("example-drafts-panel")
export class ExampleDraftsPanel extends LitElement {
  @property({ attribute: false })
  accessor routeContext: RouteContext | undefined;

  render() {
    return html`
      <section class="panel">
        <h3 data-route-focus tabindex="-1">Lazy Drafts</h3>
        <p>
          这个组件只会在首次进入时通过 <code>load()</code> 动态导入。查看顶部状态和
          事件日志，可以看到 loading start / end。
        </p>
        <p>
          Current local path:
          <strong>${this.routeContext?.detail.localPathname}</strong>
        </p>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border-radius: 22px;
      padding: 20px;
      border: 1px solid rgba(16, 32, 51, 0.12);
      background: rgba(16, 32, 51, 0.06);
      color: #556070;
      box-shadow: 0 18px 36px rgba(16, 32, 51, 0.06);
    }

    h3 {
      margin: 0 0 12px;
      color: #102033;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      font-size: 1.2rem;
    }

    p {
      margin: 0;
      line-height: 1.7;
    }

    p + p {
      margin-top: 12px;
    }
  `;
}
