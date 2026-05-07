import { Window } from "happy-dom";

const globalScope = globalThis as typeof globalThis & {
  __litRouterTestSetup?: boolean;
  __litRouterWindow?: Window;
  __litRouterScrollRestoration?: History["scrollRestoration"];
};

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

export function ensureDom(): void {
  const dom = browser();
  installDomGlobals(dom);

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
  dom.history.replaceState(null, "", url);
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
