import {
  css,
  type CSSResultGroup,
  html,
  LitElement,
  type TemplateResult,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { browserDocument, browserWindow } from "./browser-env.ts";
import { ScrollManager } from "./scroll-manager.ts";
import type {
  NavigationDirection,
  RouteContext,
  RouteContextReceiver,
  RouteDefinition,
  RouteErrorDetail,
  RouteLocation,
  RouteNotFoundDetail,
  Router,
  RouterChangeDetail,
} from "./router-core.ts";

export const DEFAULT_CHILD_SLOT = "route-child";
type ViewMode = "route" | "not-found" | "error";

@customElement("router-view")
export class RouterView extends LitElement {
  @property({ attribute: false })
  accessor router: Router | undefined;

  @property({ attribute: "child-slot" })
  accessor childSlot: string = DEFAULT_CHILD_SLOT;

  @property({ attribute: "no-view-transition", type: Boolean })
  accessor noViewTransition: boolean = false;

  private viewMode: ViewMode = "route";

  private routeErrorDetail?: RouteErrorDetail;

  private routeNotFoundDetail?: RouteNotFoundDetail;

  private activeDetail: RouterChangeDetail = {
    pathname: "/",
    localPathname: "/",
    basePath: "/",
    search: "",
    query: new URLSearchParams(),
    hash: "",
    params: {},
    branch: [],
    url: new URL(browserWindow().location.href),
    historyKey: "",
    direction: "none",
  };

  private renderedElements: HTMLElement[] = [];
  private readonly scrollManager = new ScrollManager({ maxPositions: 50 });
  private readonly validatedChildOutlets = new WeakSet<HTMLElement>();
  private pendingChildOutletChecks = new Map<HTMLElement, RouteDefinition>();
  private subscribedRouter?: Router;
  private commitId = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.scrollManager.acquireBrowserScrollRestoration();
    this.setTransitionDirection(this.activeDetail.direction);
    this.setViewTransitionName(this.activeDetail.leaf?.viewTransitionName);
    this.connectRouter();
  }

  disconnectedCallback(): void {
    this.invalidatePendingCommits({ clearRenderedElements: true });
    this.disconnectRouter();
    this.scrollManager.releaseBrowserScrollRestoration();
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.syncFromRouter(false);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("router")) {
      const previousRouter = changed.get("router") as Router | undefined;
      this.invalidatePendingCommits();
      this.disconnectRouter();
      if (previousRouter && previousRouter !== this.router) {
        previousRouter.stop();
      }
      this.connectRouter();
      this.syncFromRouter(false);
    }

    if (changed.has("childSlot") && this.activeDetail.branch.length > 0) {
      this.renderedElements = [];
      this.mountBranch(this.activeDetail, {
        ...this.activeDetail,
        branch: [],
      });
    }
  }

  protected shouldUpdate(): boolean {
    return true;
  }

  get current(): RouterChangeDetail {
    return this.activeDetail;
  }

  private get viewport(): HTMLDivElement | null {
    return this.renderRoot.querySelector<HTMLDivElement>(".viewport");
  }

  push(url: string | URL | RouteLocation): void {
    this.router?.push(url);
  }

  replace(url: string | URL | RouteLocation): void {
    this.router?.replace(url);
  }

  private connectRouter(): void {
    if (!this.router || this.subscribedRouter === this.router) {
      return;
    }

    this.router.start();
    this.router.addEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.router.addEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.router.addEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.subscribedRouter = this.router;
  }

  private disconnectRouter(): void {
    if (!this.subscribedRouter) {
      return;
    }

    this.subscribedRouter.removeEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.subscribedRouter.removeEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.subscribedRouter.removeEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.subscribedRouter = undefined;
  }

  private syncFromRouter(allowTransition: boolean): void {
    if (!this.router) {
      return;
    }

    if (this.router.lastError) {
      this.showRouteError(this.router.lastError);
      return;
    }

    if (this.router.lastNotFound) {
      this.showRouteNotFound(this.router.lastNotFound);
      return;
    }

    if (this.router.current.branch.length === 0) {
      return;
    }

    this.commitAndEmit(this.router.current, {
      skipTransition: !allowTransition,
    });
  }

  private readonly onRouteChange = (event: CustomEvent<RouterChangeDetail>) => {
    this.commitAndEmit(event.detail, {
      captureCurrentScroll: true,
    });
  };

  private readonly onRouteError = (event: CustomEvent<RouteErrorDetail>) => {
    this.showRouteError(event.detail);
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly onRouteNotFound = (
    event: CustomEvent<RouteNotFoundDetail>,
  ) => {
    this.showRouteNotFound(event.detail);
    this.dispatchEvent(
      new CustomEvent<RouteNotFoundDetail>("route-not-found", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private dispatchCommitError(
    detail: RouterChangeDetail,
    error: unknown,
  ): void {
    this.showRouteError({
      url: detail.url,
      error,
      phase: "commit",
      direction: detail.direction,
    });
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail: {
          url: detail.url,
          error,
          phase: "commit",
          direction: detail.direction,
        },
        bubbles: true,
        composed: true,
      }),
    );
    console.error("[router-view] Route commit failed", error);
  }

  private invalidatePendingCommits(
    options: { clearRenderedElements?: boolean } = {},
  ): void {
    this.commitId += 1;
    this.pendingChildOutletChecks.clear();

    if (options.clearRenderedElements) {
      this.renderedElements = [];
    }
  }

  private commitAndEmit(
    detail: RouterChangeDetail,
    options: {
      captureCurrentScroll?: boolean;
      skipTransition?: boolean;
    } = {},
  ): void {
    if (options.captureCurrentScroll) {
      this.captureScrollPosition(this.activeDetail);
    }

    void this.commit(detail, {
      skipTransition: options.skipTransition,
    }).then((committed) => {
      if (!committed) {
        return;
      }

      this.dispatchRouteChange(detail);
    }).catch((error) => {
      this.dispatchCommitError(detail, error);
    });
  }

  private dispatchRouteChange(detail: RouterChangeDetail): void {
    this.dispatchEvent(
      new CustomEvent<RouterChangeDetail>("route-change", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private showRouteStage(): void {
    this.viewMode = "route";
    this.routeErrorDetail = undefined;
    this.routeNotFoundDetail = undefined;
    this.requestUpdate();
  }

  private showRouteNotFound(detail: RouteNotFoundDetail): void {
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName();
    this.viewMode = "not-found";
    this.routeNotFoundDetail = detail;
    this.routeErrorDetail = undefined;
    this.requestUpdate();
    this.focusFallbackAfterRender("404");
  }

  private showRouteError(detail: RouteErrorDetail): void {
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName();
    this.viewMode = "error";
    this.routeErrorDetail = detail;
    this.routeNotFoundDetail = undefined;
    this.requestUpdate();
    this.focusFallbackAfterRender("error");
  }

  private focusFallbackAfterRender(kind: "404" | "error"): void {
    void this.updateComplete.then(() => {
      if (
        (kind === "404" && this.viewMode !== "not-found") ||
        (kind === "error" && this.viewMode !== "error")
      ) {
        return;
      }

      this.moveFocusIntoFallback(kind);
    });
  }

  private async commit(
    detail: RouterChangeDetail,
    options: { skipTransition?: boolean } = {},
  ): Promise<boolean> {
    const title = detail.leaf?.title;
    const previousDetail = this.activeDetail;
    const currentCommitId = ++this.commitId;
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName(detail.leaf?.viewTransitionName);

    const applyRoute = async (): Promise<boolean> => {
      if (this.isCommitStale(currentCommitId)) {
        return false;
      }

      await this.updateComplete;
      if (this.isCommitStale(currentCommitId)) {
        return false;
      }

      const renderedElements = this.mountBranch(detail, previousDetail);
      await this.waitForRouteElements(renderedElements);
      await this.validatePendingChildOutlets();
      if (this.isCommitStale(currentCommitId)) {
        return false;
      }

      this.activeDetail = detail;
      this.showRouteStage();
      this.restoreScrollPosition(detail);
      this.moveFocusIntoRoute();
      return true;
    };

    let committed = false;
    if (options.skipTransition || this.noViewTransition) {
      committed = await applyRoute();
    } else {
      await this.runViewTransition(async () => {
        committed = await applyRoute();
      });
    }

    if (!committed || this.isCommitStale(currentCommitId)) {
      return false;
    }

    if (title) {
      browserDocument().title = this.fillTitle(title, detail.params);
    }

    return true;
  }

  private isCommitStale(commitId: number): boolean {
    return commitId !== this.commitId;
  }

  private setTransitionDirection(direction: NavigationDirection): void {
    this.dataset.transitionDirection = direction;
  }

  private setViewTransitionName(name?: string): void {
    const normalized = name?.trim();
    if (normalized && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(normalized)) {
      this.style.setProperty("--router-view-transition-name", normalized);
      this.dataset.viewTransitionName = normalized;
      return;
    }

    this.style.removeProperty("--router-view-transition-name");
    delete this.dataset.viewTransitionName;
  }

  private mountBranch(
    detail: RouterChangeDetail,
    previousDetail: RouterChangeDetail,
  ): HTMLElement[] {
    if (!this.viewport) {
      return [];
    }

    if (detail.branch.length === 0) {
      this.viewport.replaceChildren();
      this.viewport.dataset.path = detail.pathname;
      this.renderedElements = [];
      return [];
    }

    const { newElements, diffIndex } = this.reuseBranchPrefix(
      detail,
      previousDetail,
    );
    this.appendBranchTail(detail, newElements, diffIndex);
    return this.finalizeBranchMount(
      detail,
      previousDetail,
      newElements,
      diffIndex,
    );
  }

  private reuseBranchPrefix(
    detail: RouterChangeDetail,
    previousDetail: RouterChangeDetail,
  ): {
    newElements: HTMLElement[];
    diffIndex: number;
  } {
    const newElements: HTMLElement[] = [];
    let diffIndex = 0;

    while (
      diffIndex < detail.branch.length &&
      diffIndex < previousDetail.branch.length &&
      detail.branch[diffIndex] === previousDetail.branch[diffIndex]
    ) {
      const element = this.renderedElements[diffIndex];
      if (!element) {
        break;
      }

      this.applyRouteState(element, detail.branch[diffIndex], detail);
      element.setAttribute("data-route-depth", String(diffIndex));
      newElements.push(element);
      diffIndex += 1;
    }

    return { newElements, diffIndex };
  }

  private appendBranchTail(
    detail: RouterChangeDetail,
    newElements: HTMLElement[],
    diffIndex: number,
  ): void {
    for (let index = diffIndex; index < detail.branch.length; index += 1) {
      newElements.push(
        this.createRouteElement(detail.branch[index], detail, index),
      );
    }

    for (let index = diffIndex; index < newElements.length; index += 1) {
      this.attachNestedBranchElement(detail, newElements, index, diffIndex);
    }
  }

  private attachNestedBranchElement(
    detail: RouterChangeDetail,
    newElements: HTMLElement[],
    index: number,
    diffIndex: number,
  ): void {
    if (index === 0) {
      return;
    }

    const parent = newElements[index - 1];
    const child = newElements[index];
    child.slot = this.childSlot;

    if (index === diffIndex) {
      this.removeProjectedChild(parent);
    }

    parent.append(child);
    this.scheduleChildOutletValidation(parent, detail.branch[index - 1]);
  }

  private finalizeBranchMount(
    detail: RouterChangeDetail,
    previousDetail: RouterChangeDetail,
    newElements: HTMLElement[],
    diffIndex: number,
  ): HTMLElement[] {
    if (diffIndex === 0) {
      this.viewport?.replaceChildren(newElements[0]);
    }

    if (
      previousDetail.branch.length > detail.branch.length &&
      newElements.length > 0
    ) {
      this.removeProjectedChild(newElements[newElements.length - 1]);
    }

    this.viewport?.setAttribute("data-path", detail.pathname);
    this.renderedElements = newElements;
    return newElements;
  }

  private removeProjectedChild(parent: HTMLElement): void {
    const oldChild = Array.from(parent.children).find(
      (candidate) =>
        candidate instanceof HTMLElement && candidate.slot === this.childSlot,
    );
    oldChild?.remove();
  }

  private createRouteElement(
    route: RouteDefinition,
    detail: RouterChangeDetail,
    depth: number,
  ): HTMLElement {
    let element: HTMLElement;

    if (typeof route.component === "function") {
      element = route.component(detail);
    } else if (typeof route.component === "string") {
      element = browserDocument().createElement(route.component);
    } else {
      element = browserDocument().createElement("section");
    }

    this.applyRouteState(element, route, detail);
    element.setAttribute("data-route-depth", String(depth));
    return element;
  }

  private applyRouteState(
    element: HTMLElement,
    route: RouteDefinition,
    detail: RouterChangeDetail,
  ): void {
    const routeContext: RouteContext = {
      detail,
      params: detail.params,
    };
    const assignProps = () => {
      Object.assign(element, route.props ?? {});
      this.applyRouteContext(element, routeContext);
    };

    const customElementsRegistry = browserWindow().customElements;
    if (
      element.localName.includes("-") &&
      !customElementsRegistry.get(element.localName)
    ) {
      void customElementsRegistry.whenDefined(element.localName).then(
        assignProps,
      );
      return;
    }

    assignProps();
  }

  private applyRouteContext(
    element: HTMLElement,
    context: RouteContext,
  ): void {
    const receiver = element as HTMLElement & RouteContextReceiver;

    if (typeof receiver.setRouteContext === "function") {
      receiver.setRouteContext(context);
      return;
    }

    if ("routeContext" in receiver) {
      receiver.routeContext = context;
      return;
    }
  }

  private async waitForRouteElements(elements: HTMLElement[]): Promise<void> {
    await Promise.all(
      elements.map(async (element) => {
        const candidate = element as HTMLElement & {
          updateComplete?: Promise<unknown>;
        };
        await candidate.updateComplete;
      }),
    );
  }

  private scheduleChildOutletValidation(
    element: HTMLElement,
    route: RouteDefinition,
  ): void {
    if (this.validatedChildOutlets.has(element)) {
      return;
    }

    this.pendingChildOutletChecks.set(element, route);
  }

  private async validatePendingChildOutlets(): Promise<void> {
    const pendingChecks = this.pendingChildOutletChecks;
    this.pendingChildOutletChecks = new Map();

    for (const [element, route] of pendingChecks) {
      await this.validateChildOutlet(element, route);
    }
  }

  private async validateChildOutlet(
    element: HTMLElement,
    route: RouteDefinition,
  ): Promise<void> {
    if (this.validatedChildOutlets.has(element)) {
      return;
    }

    const customElementsRegistry = browserWindow().customElements;
    if (
      element.localName.includes("-") &&
      !customElementsRegistry.get(element.localName)
    ) {
      await customElementsRegistry.whenDefined(element.localName);
    }

    if (!element.isConnected) {
      return;
    }

    this.validatedChildOutlets.add(element);

    if (!element.shadowRoot) {
      return;
    }

    const outlet = element.shadowRoot.querySelector<HTMLSlotElement>(
      `slot[name="${this.childSlot}"]`,
    );
    if (outlet) {
      return;
    }

    const routeLabel = route.name
      ? `route "${route.name}"`
      : `path "${route.path || "/"}"`;
    console.warn(
      `[router-view] Parent component <${element.localName}> for ${routeLabel} is missing <slot name="${this.childSlot}">, so nested routes cannot render into its shadow root.`,
    );
  }

  private async runViewTransition(update: () => Promise<void>): Promise<void> {
    const transitionDocument = browserDocument() as Document & {
      startViewTransition?: (
        callback: () => Promise<void> | void,
      ) => {
        finished: Promise<void>;
        updateCallbackDone?: Promise<void>;
      };
    };

    if (!transitionDocument.startViewTransition) {
      await update();
      return;
    }

    const transition = transitionDocument.startViewTransition(() => update());
    try {
      await (transition.updateCallbackDone ?? transition.finished);
    } finally {
      await transition.finished.catch(() => undefined);
    }
  }

  private captureScrollPosition(detail: RouterChangeDetail): void {
    this.scrollManager.capture(detail.historyKey, detail.url);
  }

  private restoreScrollPosition(detail: RouterChangeDetail): void {
    this.scrollManager.restore(detail.historyKey, detail.url);
  }

  private moveFocusIntoRoute(): void {
    const focusTarget = this.viewport?.querySelector<HTMLElement>(
      "[data-route-focus]",
    );
    if (focusTarget) {
      focusTarget.focus();
      return;
    }

    this.tabIndex = -1;
    this.focus();
  }

  private moveFocusIntoFallback(kind: "404" | "error"): void {
    const assignedFocusTarget = this.findAssignedFallbackFocusTarget(kind);
    if (assignedFocusTarget) {
      assignedFocusTarget.focus();
      return;
    }

    const fallback = this.renderRoot.querySelector<HTMLElement>(
      `.fallback[data-fallback="${kind}"]`,
    );
    const focusTarget = fallback?.querySelector<HTMLElement>(
      "[data-route-focus]",
    );
    if (focusTarget) {
      focusTarget.focus();
      return;
    }

    if (fallback) {
      fallback.tabIndex = -1;
      fallback.focus();
    }
  }

  private findAssignedFallbackFocusTarget(
    kind: "404" | "error",
  ): HTMLElement | null {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>(
      `slot[name="${kind}"]`,
    );
    if (!slot) {
      return null;
    }

    for (const element of slot.assignedElements({ flatten: true })) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      if (element.hasAttribute("data-route-focus")) {
        return element;
      }

      const descendant = element.querySelector<HTMLElement>(
        "[data-route-focus]",
      );
      if (descendant) {
        return descendant;
      }
    }

    return null;
  }

  private describeRouteError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return "Unknown route error";
  }

  private fillTitle(template: string, params: Record<string, string>): string {
    return template.replace(/:([A-Za-z0-9_-]+)/g, (_, key: string) => {
      return params[key] ?? `:${key}`;
    });
  }

  render(): TemplateResult {
    const notFoundPath = this.routeNotFoundDetail?.url.pathname ?? "";
    const errorPhase = this.routeErrorDetail?.phase ?? "unknown";
    const errorMessage = this.describeRouteError(this.routeErrorDetail?.error);

    return html`
      <div class="viewport" ?hidden="${this.viewMode !== "route"}"></div>
      <section
        class="fallback"
        data-fallback="404"
        ?hidden="${this.viewMode !== "not-found"}"
      >
        <slot name="404">
          <article class="fallback-card">
            <p class="fallback-eyebrow">Route Not Found</p>
            <h1 data-route-focus tabindex="-1">404</h1>
            <p>No route matched <code>${notFoundPath}</code>.</p>
          </article>
        </slot>
      </section>
      <section
        class="fallback"
        data-fallback="error"
        ?hidden="${this.viewMode !== "error"}"
      >
        <slot name="error">
          <article class="fallback-card">
            <p class="fallback-eyebrow">Route Error</p>
            <h1 data-route-focus tabindex="-1">Navigation Failed</h1>
            <p>The route transition failed during <code>${errorPhase}</code>.</p>
            <pre class="fallback-error">${errorMessage}</pre>
          </article>
        </slot>
      </section>
    `;
  }

  static styles: CSSResultGroup = css`
    :host {
      display: block;
      min-height: 100%;
      contain: content;
    }

    .viewport {
      min-height: 100%;
      view-transition-name: var(--router-view-transition-name, route-stage);
      outline: none;
    }

    .fallback[hidden],
    .viewport[hidden] {
      display: none;
    }

    .fallback {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
      outline: none;
    }

    .fallback-card {
      width: min(32rem, 100%);
      padding: 1.5rem;
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      border-radius: 1rem;
      background: color-mix(in srgb, canvas 92%, currentColor 8%);
      box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.08);
    }

    .fallback-eyebrow {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.72;
    }

    .fallback-card h1 {
      margin: 0 0 0.75rem;
      font-size: clamp(2rem, 6vw, 3rem);
      line-height: 1;
      outline: none;
    }

    .fallback-card p {
      margin: 0;
      line-height: 1.55;
    }

    .fallback-error {
      margin: 1rem 0 0;
      padding: 0.75rem;
      border-radius: 0.75rem;
      overflow: auto;
      font: inherit;
      background: color-mix(in srgb, canvas 86%, currentColor 14%);
    }
  `;
}
