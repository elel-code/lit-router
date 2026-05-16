import { Window } from "happy-dom";

const NativeEvent = globalThis.Event;
const NativeEventTarget = globalThis.EventTarget;

const globalScope = globalThis as typeof globalThis & {
  __litRouterTestSetup?: boolean;
  __litRouterWindow?: Window;
  __litRouterScrollRestoration?: History["scrollRestoration"];
  __litRouterNavigationMock?: TestNavigationMock;
};

const ROUTER_HISTORY_ENTRY_KEY = "__litRouterEntryKey";

const domGlobals = [
  "AbortController",
  "AbortSignal",
  "Comment",
  "CSSStyleSheet",
  "CustomEvent",
  "Document",
  "DocumentFragment",
  "DOMParser",
  "Element",
  "Event",
  "EventTarget",
  "FocusEvent",
  "FormData",
  "HTMLAnchorElement",
  "HTMLElement",
  "HTMLSlotElement",
  "HTMLTemplateElement",
  "KeyboardEvent",
  "location",
  "history",
  "MouseEvent",
  "MutationObserver",
  "navigator",
  "Node",
  "Range",
  "ResizeObserver",
  "ShadowRoot",
  "Text",
] as const;

type TestHistoryMode = "push" | "replace";

interface TestNavigationEntry {
  key: string;
  url: string;
}

interface TestNavigateEvent extends Event {
  canIntercept: boolean;
  destination: TestNavigationEntry;
  downloadRequest: string | null;
  formData: FormData | null;
  intercept: (options: {
    handler: () => Promise<void> | void;
    scroll?: "manual" | "after-transition";
  }) => void;
}

let testNavigationKey = 0;

function createNavigationKey(): string {
  testNavigationKey += 1;
  return `test-navigation-${testNavigationKey}`;
}

function historyStateWithKey(
  state: unknown,
  key: string,
): Record<string, unknown> {
  return state && typeof state === "object" && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>), [ROUTER_HISTORY_ENTRY_KEY]: key }
    : { [ROUTER_HISTORY_ENTRY_KEY]: key };
}

function keyFromHistoryState(state: unknown): string | undefined {
  if (!state || typeof state !== "object") {
    return undefined;
  }

  const value = (state as Record<string, unknown>)[ROUTER_HISTORY_ENTRY_KEY];
  return typeof value === "string" && value ? value : undefined;
}

function createNavigateEvent(
  url: string,
  key: string,
  navigationType: "push" | "replace" | "traverse",
): { event: TestNavigateEvent; runHandler: () => Promise<void> } {
  let handler: (() => Promise<void> | void) | undefined;
  const event = new NativeEvent("navigate") as TestNavigateEvent;

  Object.defineProperties(event, {
    canIntercept: { configurable: true, value: true },
    destination: { configurable: true, value: { key, url } },
    downloadRequest: { configurable: true, value: null },
    formData: { configurable: true, value: null },
    navigationType: { configurable: true, value: navigationType },
    intercept: {
      configurable: true,
      value: (
        options: {
          handler: () => Promise<void> | void;
          scroll?: "manual" | "after-transition";
        },
      ) => {
        handler = options.handler;
      },
    },
  });

  return {
    event,
    runHandler: async () => {
      await handler?.();
    },
  };
}

class TestNavigationMock extends NativeEventTarget {
  currentEntry: TestNavigationEntry;
  private entries: TestNavigationEntry[];
  private index = 0;
  private readonly originalPushState: History["pushState"];
  private readonly originalReplaceState: History["replaceState"];

  constructor(private readonly dom: Window) {
    super();
    const key = createNavigationKey();
    this.currentEntry = { key, url: dom.location.href };
    this.entries = [this.currentEntry];
    this.originalPushState = dom.history.pushState.bind(dom.history);
    this.originalReplaceState = dom.history.replaceState.bind(dom.history);
    this.patchHistory();
  }

  reset(url: string): void {
    const key = createNavigationKey();
    this.currentEntry = { key, url };
    this.entries = [this.currentEntry];
    this.index = 0;
    this.originalReplaceState(
      historyStateWithKey(null, key),
      "",
      url,
    );
  }

  navigate(url: string, options?: { history?: TestHistoryMode }): void {
    const href = new URL(url, this.dom.location.href).href;
    const mode = options?.history === "replace" ? "replace" : "push";
    const key = mode === "replace"
      ? this.currentEntry.key
      : createNavigationKey();
    const { event, runHandler } = createNavigateEvent(href, key, mode);

    this.dispatchEvent(event);
    this.commit(href, key, mode);
    void runHandler();
  }

  go(delta: number): void {
    if (!Number.isInteger(delta) || delta === 0) {
      return;
    }

    const nextIndex = this.index + delta;
    if (nextIndex < 0 || nextIndex >= this.entries.length) {
      return;
    }

    const entry = this.entries[nextIndex];
    const { event, runHandler } = createNavigateEvent(
      entry.url,
      entry.key,
      "traverse",
    );

    this.dispatchEvent(event);
    this.index = nextIndex;
    this.currentEntry = entry;
    this.originalReplaceState(
      historyStateWithKey(this.dom.history.state, entry.key),
      "",
      entry.url,
    );
    void runHandler();
  }

  syncHistoryMutation(
    state: unknown,
    url: string | URL | null | undefined,
    mode: TestHistoryMode,
  ): void {
    const href = url === null || url === undefined
      ? this.dom.location.href
      : new URL(String(url), this.dom.location.href).href;
    const key = keyFromHistoryState(state) ?? createNavigationKey();
    this.commitEntry({ key, url: href }, mode);
  }

  private commit(url: string, key: string, mode: TestHistoryMode): void {
    this.commitEntry({ key, url }, mode);
    const state = historyStateWithKey(this.dom.history.state, key);
    if (mode === "replace") {
      this.originalReplaceState(state, "", url);
      return;
    }

    this.originalPushState(state, "", url);
  }

  private commitEntry(entry: TestNavigationEntry, mode: TestHistoryMode): void {
    if (mode === "replace") {
      this.entries[this.index] = entry;
    } else {
      this.entries.splice(this.index + 1, this.entries.length, entry);
      this.index += 1;
    }

    this.currentEntry = entry;
  }

  private patchHistory(): void {
    Object.defineProperties(this.dom.history, {
      pushState: {
        configurable: true,
        value: (
          state: unknown,
          title: string,
          url?: string | URL | null,
        ) => {
          this.originalPushState(state, title, url);
          this.syncHistoryMutation(state, url, "push");
        },
      },
      replaceState: {
        configurable: true,
        value: (
          state: unknown,
          title: string,
          url?: string | URL | null,
        ) => {
          this.originalReplaceState(state, title, url);
          this.syncHistoryMutation(state, url, "replace");
        },
      },
      back: {
        configurable: true,
        value: () => this.go(-1),
      },
      forward: {
        configurable: true,
        value: () => this.go(1),
      },
      go: {
        configurable: true,
        value: (delta = 0) => this.go(delta),
      },
    });
  }
}

function browser(): Window {
  if (!globalScope.__litRouterWindow) {
    globalScope.__litRouterWindow = new Window({
      url: "http://localhost/",
    });
  }

  return globalScope.__litRouterWindow;
}

function installDomGlobals(dom: Window): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: dom,
  });

  Object.defineProperty(globalThis, "self", {
    configurable: true,
    writable: true,
    value: dom,
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: dom.document,
  });

  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    writable: true,
    value: dom.customElements,
  });

  for (const key of domGlobals) {
    if (!(key in dom)) {
      continue;
    }

    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: dom[key],
    });
  }
}

function installNavigationMock(dom: Window): void {
  if (!globalScope.__litRouterNavigationMock) {
    globalScope.__litRouterNavigationMock = new TestNavigationMock(dom);
  }

  Object.defineProperty(dom, "navigation", {
    configurable: true,
    value: globalScope.__litRouterNavigationMock,
  });
}

export function ensureDom(): void {
  const dom = browser();
  installDomGlobals(dom);
  installNavigationMock(dom);

  if (!globalScope.__litRouterTestSetup) {
    Object.defineProperty(dom, "scrollTo", {
      configurable: true,
      value: () => undefined,
    });

    Object.defineProperty(dom.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    });

    Object.defineProperty(dom.history, "scrollRestoration", {
      configurable: true,
      get() {
        return globalScope.__litRouterScrollRestoration ?? "auto";
      },
      set(value: History["scrollRestoration"]) {
        globalScope.__litRouterScrollRestoration = value;
      },
    });

    globalScope.__litRouterTestSetup = true;
  }

  globalScope.__litRouterScrollRestoration = "auto";
}

export function resetDom(url = "http://localhost/"): void {
  ensureDom();
  const dom = browser();
  dom.document.body.replaceChildren();
  globalScope.__litRouterNavigationMock?.reset(url);
  (dom.history as History).scrollRestoration = "auto";
}

export function teardownDom(): void {
  // Keep the shared DOM window alive for the whole test file.
}

export async function settle(
  candidate?: HTMLElement & { updateComplete?: Promise<unknown> },
): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  if (candidate?.updateComplete) {
    await candidate.updateComplete;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (candidate?.updateComplete) {
    await candidate.updateComplete;
  }
  await Promise.resolve();
}
