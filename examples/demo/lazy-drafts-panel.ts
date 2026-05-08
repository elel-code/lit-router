import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("lazy-drafts-panel")
export class LazyDraftsPanel extends LitElement {
  render() {
    return html`
      <section class="drafts">
        <p class="eyebrow">Lazy Module Ready</p>
        <h3>草稿箱面板是按需加载的</h3>
        <p>
          这个组件只会在首次命中对应路由时才通过动态 import 注册，适合后续拆页面模块。
        </p>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .drafts {
      margin-top: 18px;
      padding: 18px 20px;
      border-radius: 24px;
      background: rgba(16, 32, 51, 0.06);
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #c24d2c;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 0.75rem;
      font-weight: 700;
    }

    h3 {
      margin: 0 0 10px;
      font: 700 1.2rem/1.1 "Iowan Old Style", "Palatino Linotype", serif;
      color: #102033;
    }

    p {
      margin: 0;
      color: #556070;
      line-height: 1.6;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "lazy-drafts-panel": LazyDraftsPanel;
  }
}
