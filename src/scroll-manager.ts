import { browserDocument, browserWindow } from "./browser-env.ts";

interface ScrollPosition {
  left: number;
  top: number;
}

interface ScrollManagerOptions {
  maxPositions?: number;
}

type ScrollEntry = string | URL;

interface ScrollRestorationUsage {
  users: Set<ScrollManager>;
  previous: History["scrollRestoration"];
}

function decodeHashFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function resolveScrollKey(entry: ScrollEntry): string {
  return typeof entry === "string" ? entry : entry.href;
}

export class ScrollManager {
  private static readonly scrollRestorationUsage = new WeakMap<
    History,
    ScrollRestorationUsage
  >();

  readonly positions = new Map<string, ScrollPosition>();
  readonly maxPositions: number;
  private controlsBrowserRestoration = false;

  constructor(options: ScrollManagerOptions = {}) {
    this.maxPositions = options.maxPositions ?? 50;
  }

  acquireBrowserScrollRestoration(): void {
    const browser = browserWindow();
    if (
      this.controlsBrowserRestoration ||
      !("scrollRestoration" in browser.history)
    ) {
      return;
    }

    const usage = ScrollManager.scrollRestorationUsage.get(browser.history);
    if (usage) {
      usage.users.add(this);
    } else {
      ScrollManager.scrollRestorationUsage.set(browser.history, {
        users: new Set([this]),
        previous: browser.history.scrollRestoration,
      });
      browser.history.scrollRestoration = "manual";
    }

    this.controlsBrowserRestoration = true;
  }

  releaseBrowserScrollRestoration(): void {
    const browser = browserWindow();
    if (
      !this.controlsBrowserRestoration ||
      !("scrollRestoration" in browser.history)
    ) {
      return;
    }

    const usage = ScrollManager.scrollRestorationUsage.get(browser.history);
    this.controlsBrowserRestoration = false;

    if (!usage) {
      return;
    }

    usage.users.delete(this);

    if (usage.users.size === 0) {
      browser.history.scrollRestoration = usage.previous;
      ScrollManager.scrollRestorationUsage.delete(browser.history);
    }
  }

  capture(entry: ScrollEntry, _url?: URL): void {
    const browser = browserWindow();
    this.remember(resolveScrollKey(entry), {
      left: browser.scrollX,
      top: browser.scrollY,
    });
  }

  restore(entry: ScrollEntry, url?: URL): void {
    const activeUrl = entry instanceof URL ? entry : url;
    if (!activeUrl) {
      return;
    }

    if (activeUrl.hash) {
      const target = browserDocument().getElementById(
        decodeHashFragment(activeUrl.hash.slice(1)),
      );
      if (target) {
        target.scrollIntoView();
        return;
      }
    }

    const stored = this.positions.get(resolveScrollKey(entry));
    if (stored) {
      browserWindow().scrollTo({
        left: stored.left,
        top: stored.top,
        behavior: "instant",
      });
      return;
    }

    browserWindow().scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  private remember(href: string, position: ScrollPosition): void {
    this.positions.delete(href);
    this.positions.set(href, position);

    while (this.positions.size > this.maxPositions) {
      const oldestHref = this.positions.keys().next().value;
      if (!oldestHref) {
        break;
      }
      this.positions.delete(oldestHref);
    }
  }
}
