import { assert, assertEquals } from "@std/assert";
import { ScrollManager } from "../src/scroll-manager.ts";
import { ensureDom, resetDom, settle, teardownDom } from "./test_setup.ts";
type Router = import("../src/router-core.ts").Router;
type RouteContext = import("../src/router-core.ts").RouteContext;
type RouteDefinition = import("../src/router-core.ts").RouteDefinition;
type RouteErrorDetail = import("../src/router-core.ts").RouteErrorDetail;
type RouteLoadingDetail = import("../src/router-core.ts").RouteLoadingDetail;
type RouteNotFoundDetail = import("../src/router-core.ts").RouteNotFoundDetail;
type RouteTreeChangeDetail =
  import("../src/router-core.ts").RouteTreeChangeDetail;

function browser(): typeof globalThis & Window {
  ensureDom();
  return globalThis as typeof globalThis & Window;
}

function ensureTestElements(): void {
  const dom = browser();

  if (!dom.customElements.get("test-route-page")) {
    dom.customElements.define(
      "test-route-page",
      class TestPageElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (!this.textContent) {
            this.textContent = this.localName;
          }
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-layout")) {
    dom.customElements.define(
      "test-route-layout",
      class TestLayoutElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (this.shadowRoot) {
            return;
          }

          const shadow = this.attachShadow({ mode: "open" });
          const slot = dom.document.createElement("slot");
          slot.name = "route-child";
          shadow.append(slot);
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-slotted-layout")) {
    dom.customElements.define(
      "test-route-slotted-layout",
      class TestSlottedLayoutElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (this.shadowRoot) {
            return;
          }

          const shadow = this.attachShadow({ mode: "open" });
          const main = dom.document.createElement("main");
          const mainSlot = dom.document.createElement("slot");
          mainSlot.name = "route-child";
          main.append(mainSlot);

          const aside = dom.document.createElement("aside");
          aside.textContent = "fallback sidebar";
          const sidebarSlot = dom.document.createElement("slot");
          sidebarSlot.name = "sidebar";
          aside.append(sidebarSlot);
          shadow.append(main, aside);
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-sidebar-layout")) {
    dom.customElements.define(
      "test-route-sidebar-layout",
      class TestSidebarLayoutElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (this.shadowRoot) {
            return;
          }

          const shadow = this.attachShadow({ mode: "open" });
          const defaultSlot = dom.document.createElement("slot");
          defaultSlot.name = "route-child";

          const toolsSlot = dom.document.createElement("slot");
          toolsSlot.name = "sidebar-tools";

          shadow.append(defaultSlot, toolsSlot);
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-broken-layout")) {
    dom.customElements.define(
      "test-route-broken-layout",
      class TestBrokenLayoutElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (this.shadowRoot) {
            return;
          }

          const shadow = this.attachShadow({ mode: "open" });
          const frame = dom.document.createElement("section");
          frame.textContent = "broken layout";
          shadow.append(frame);
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-drafts")) {
    dom.customElements.define(
      "test-route-drafts",
      class TestDraftsElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (!this.textContent) {
            this.textContent = this.localName;
          }
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-security")) {
    dom.customElements.define(
      "test-route-security",
      class TestSecurityElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (!this.textContent) {
            this.textContent = this.localName;
          }
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-alt")) {
    dom.customElements.define(
      "test-route-alt",
      class TestAltElement extends dom.HTMLElement {
        connectedCallback(): void {
          if (!this.textContent) {
            this.textContent = this.localName;
          }
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-aware")) {
    dom.customElements.define(
      "test-route-aware",
      class TestRouteAwareElement extends dom.HTMLElement {
        routeContext?: RouteContext;
        receivedContexts: RouteContext[] = [];

        setRouteContext(context: RouteContext): void {
          this.routeContext = context;
          this.receivedContexts.push(context);
        }
      },
    );
  }

  if (!dom.customElements.get("test-route-context-prop")) {
    dom.customElements.define(
      "test-route-context-prop",
      class TestRouteContextPropElement extends dom.HTMLElement {
        routeContext?: RouteContext;
      },
    );
  }

  if (!dom.customElements.get("test-route-legacy-probe")) {
    dom.customElements.define(
      "test-route-legacy-probe",
      class TestRouteLegacyProbeElement extends dom.HTMLElement {
        routeDetailAssignments = 0;
        routeParamsAssignments = 0;

        set routeDetail(_value: unknown) {
          this.routeDetailAssignments += 1;
        }

        set routeParams(_value: unknown) {
          this.routeParamsAssignments += 1;
        }
      },
    );
  }
}

async function withRouters(
  run: (
    createRouter: (
      options?: ConstructorParameters<
        typeof import("../src/router-core.ts").Router
      >[0],
    ) => Router,
  ) => void | Promise<void>,
): Promise<void> {
  ensureTestElements();
  const { Router } = await import("../src/router-core.ts");
  await import("../src/router-view.ts");
  resetDom();
  const routers: Router[] = [];

  const createRouter = (
    options: ConstructorParameters<typeof Router>[0] = {},
  ): Router => {
    const router = new Router(options);
    routers.push(router);
    return router;
  };

  try {
    await run(createRouter);
  } finally {
    try {
      const dom = browser();
      for (const router of routers) {
        router.stop();
      }
      dom.document.body.replaceChildren();
      await settle();
    } finally {
      teardownDom();
    }
  }
}

Deno.test("guard relative redirect resolves from the target URL", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "settings",
          component: "test-route-layout",
          children: [
            {
              path: "profile",
              component: "test-route-page",
              guard: () => "./security",
            },
            {
              path: "security",
              component: "test-route-security",
            },
          ],
        },
      ],
    });

    await settle();
    router.push("/settings/profile");
    await settle();

    assertEquals(router.current.localPathname, "/settings/security");
  });
});

Deno.test("router click interception respects preventDefault from app code", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();

    const dom = browser();
    const anchor = dom.document.createElement("a");
    anchor.href = "http://localhost/next";
    anchor.addEventListener("click", (event) => event.preventDefault());
    dom.document.body.append(anchor);

    anchor.dispatchEvent(
      new dom.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    await settle();

    assertEquals(router.current.localPathname, "/");
    assertEquals(dom.location.pathname, "/");
  });
});

Deno.test("router ignores same-origin links outside basePath", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/app/");

    const routeNotFoundEvents: Event[] = [];
    const router = createRouter({
      basePath: "/app",
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    router.addEventListener("route-not-found", (event) => {
      routeNotFoundEvents.push(event);
    });

    await settle();

    const anchor = dom.document.createElement("a");
    anchor.href = "http://localhost/blog/article";
    dom.document.body.append(anchor);

    const clickEvent = new dom.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    const dispatchResult = anchor.dispatchEvent(clickEvent);
    await settle();

    assertEquals(dispatchResult, true);
    assertEquals(clickEvent.defaultPrevented, false);
    assertEquals(routeNotFoundEvents.length, 0);
    assertEquals(router.current.localPathname, "/");
  });
});

Deno.test("router-view shows default 404 fallback for initial not-found state", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/missing");

    const router = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);

    const fallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="404"]',
    );
    assert(fallback);
    assertEquals(fallback.hidden, false);
    assertEquals(fallback.textContent?.includes("/missing"), true);
  });
});

Deno.test("router-view allows custom 404 slot fallback", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/missing");

    const router = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    const customFallback = dom.document.createElement("section");
    customFallback.slot = "404";
    customFallback.textContent = "custom 404";

    view.router = router;
    view.append(customFallback);
    dom.document.body.append(view);

    await settle(view);

    const slot = view.shadowRoot?.querySelector<HTMLSlotElement>(
      'slot[name="404"]',
    );
    assert(slot);
    assertEquals(slot.assignedElements({ flatten: true })[0], customFallback);
  });
});

Deno.test("router-view shows default error fallback when route loading fails", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "broken",
          component: "test-route-page",
          load: () => Promise.reject(new Error("load failed")),
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/broken");
    await settle(view);

    const fallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="error"]',
    );
    assert(fallback);
    assertEquals(fallback.hidden, false);
    assertEquals(fallback.textContent?.includes("load"), true);
    assertEquals(fallback.textContent?.includes("load failed"), true);
  });
});

Deno.test("router deduplicates concurrent route loads for the same branch", async () => {
  await withRouters(async (createRouter) => {
    let loadCalls = 0;
    let resolveLoad: (() => void) | undefined;
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "slow",
          component: "test-route-page",
          load: () => {
            loadCalls += 1;
            return new Promise<void>((resolve) => {
              resolveLoad = resolve;
            });
          },
        },
      ],
    });

    await settle();
    router.push("/slow");
    await settle();
    router.push("/slow");
    await settle();

    assertEquals(loadCalls, 1);

    resolveLoad?.();
    await settle();

    assertEquals(router.current.localPathname, "/slow");
  });
});

Deno.test("router emits loading start and end events around async route loads", async () => {
  await withRouters(async (createRouter) => {
    let resolveLoad: (() => void) | undefined;
    const loadingEvents: Array<{
      type: string;
      detail: RouteLoadingDetail;
    }> = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "slow",
          component: "test-route-page",
          load: () =>
            new Promise<void>((resolve) => {
              resolveLoad = resolve;
            }),
        },
      ],
    });

    router.addEventListener("route-loading-start", (event) => {
      loadingEvents.push({
        type: "start",
        detail: (event as CustomEvent<RouteLoadingDetail>).detail,
      });
    });
    router.addEventListener("route-loading-end", (event) => {
      loadingEvents.push({
        type: "end",
        detail: (event as CustomEvent<RouteLoadingDetail>).detail,
      });
    });

    await settle();
    router.push("/slow");
    await settle();

    assertEquals(loadingEvents.length, 1);
    assertEquals(loadingEvents[0]?.type, "start");
    assertEquals(loadingEvents[0]?.detail.url.pathname, "/slow");
    assertEquals(loadingEvents[0]?.detail.branch.at(-1)?.path, "slow");
    assertEquals(loadingEvents[0]?.detail.pending, 1);
    assertEquals(loadingEvents[0]?.detail.direction, "forward");

    resolveLoad?.();
    await settle();

    assertEquals(loadingEvents.length, 2);
    assertEquals(loadingEvents[1]?.type, "end");
    assertEquals(loadingEvents[1]?.detail.pending, 0);

    router.push("/");
    await settle();
    router.push("/slow");
    await settle();

    assertEquals(loadingEvents.length, 2);
  });
});

Deno.test("router aborts stale guard signals when a newer navigation starts", async () => {
  await withRouters(async (createRouter) => {
    const guardSignals: AbortSignal[] = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "slow",
          component: "test-route-page",
          guard: ({ signal }) => {
            guardSignals.push(signal);
            return new Promise<true>((resolve) => {
              signal.addEventListener("abort", () => resolve(true), {
                once: true,
              });
            });
          },
        },
        { path: "next", component: "test-route-alt" },
      ],
    });

    await settle();
    router.push("/slow");
    await settle();
    router.push("/next");
    await settle();

    assertEquals(guardSignals.length, 1);
    assertEquals(guardSignals[0]?.aborted, true);
    assertEquals(router.current.localPathname, "/next");
  });
});

Deno.test("commitNavigation does not mutate the resolved route detail", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-alt" },
      ],
    });
    type RouterInternals = {
      resolve(url: URL): RouteContext["detail"] | null;
      commitNavigation(
        detail: RouteContext["detail"],
        history: "push" | "replace" | "none",
        historyKey?: string,
      ): void;
    };
    const internals = router as unknown as RouterInternals;

    await settle();
    const detail = internals.resolve(new URL("/next", dom.location.href));
    assert(detail);
    const originalHistoryKey = detail.historyKey;
    const originalDirection = detail.direction;

    internals.commitNavigation(detail, "none", "test-commit-entry");

    assertEquals(detail.historyKey, originalHistoryKey);
    assertEquals(detail.direction, originalDirection);
    assertEquals(router.current.localPathname, "/next");
    assertEquals(router.current.direction, "forward");
  });
});

Deno.test("route beforeLeave blocks leaving the current page", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        {
          path: "",
          component: "test-route-page",
          beforeLeave: () => false,
        },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();
    router.push("/next");
    await settle();

    assertEquals(router.current.localPathname, "/");
    assertEquals(dom.location.pathname, "/");
  });
});

Deno.test("route beforeLeave only runs for the leaving branch suffix", async () => {
  await withRouters(async (createRouter) => {
    let parentLeaveCalls = 0;
    let childLeaveCalls = 0;
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-layout",
          beforeLeave: () => {
            parentLeaveCalls += 1;
            return false;
          },
          children: [
            {
              path: "profile",
              component: "test-route-page",
              beforeLeave: () => {
                childLeaveCalls += 1;
                return true;
              },
            },
            {
              path: "security",
              component: "test-route-security",
            },
          ],
        },
      ],
    });

    await settle();
    router.push("/settings/profile");
    await settle();
    router.push("/settings/security");
    await settle();

    assertEquals(router.current.localPathname, "/settings/security");
    assertEquals(parentLeaveCalls, 0);
    assertEquals(childLeaveCalls, 1);
  });
});

Deno.test("router-view uses explicit route context receiver contract", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "users/:id", component: "test-route-aware" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/users/1");
    await settle(view);

    const element = view.shadowRoot?.querySelector("test-route-aware") as
      | (HTMLElement & {
        routeContext?: RouteContext;
        receivedContexts: RouteContext[];
      })
      | null;

    assert(element);
    assertEquals(element.routeContext?.params.id, "1");
    assertEquals(
      element.receivedContexts.at(-1)?.detail.localPathname,
      "/users/1",
    );

    router.push("/users/2");
    await settle(view);

    assertEquals(element.routeContext?.params.id, "2");
    assertEquals(element.receivedContexts.length, 2);
    assertEquals(element.receivedContexts.at(-1)?.params.id, "2");
  });
});

Deno.test("router-view warns once when a parent route is missing the child slot", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown, ...args: unknown[]) => {
      warnings.push([message, ...args].map(String).join(" "));
    };

    try {
      const router = createRouter({
        routes: [
          {
            path: "settings",
            name: "settings",
            component: "test-route-broken-layout",
            children: [
              { path: "", component: "test-route-page" },
              { path: "security", component: "test-route-security" },
            ],
          },
        ],
      });

      const view = dom.document.createElement("router-view") as HTMLElement & {
        router?: Router;
        shadowRoot: ShadowRoot | null;
        updateComplete?: Promise<unknown>;
      };
      view.router = router;
      dom.document.body.append(view);

      await settle(view);
      router.push("/settings/security");
      await settle(view);
      router.push("/settings");
      await settle(view);
      router.push("/settings/security");
      await settle(view);

      const slotWarnings = warnings.filter((message) =>
        message.includes(
          "[router-view] Parent component <test-route-broken-layout>",
        )
      );

      assertEquals(slotWarnings.length, 1);
      assertEquals(
        slotWarnings[0]?.includes('<slot name="route-child">'),
        true,
      );
    } finally {
      console.warn = originalWarn;
    }
  });
});

Deno.test("router resolves parallel named slot branches for one URL", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: "profile", component: "test-route-page" },
            {
              path: "profile",
              slot: "sidebar",
              component: "test-route-alt",
            },
          ],
        },
      ],
    });

    await settle();
    router.push("/settings/profile");
    await settle();

    assertEquals(router.current.branch.map((route) => route.component), [
      "test-route-slotted-layout",
      "test-route-page",
    ]);
    assertEquals(
      router.current.slotBranches?.sidebar?.map((route) => route.component),
      ["test-route-slotted-layout", "test-route-alt"],
    );
    assertEquals(
      router.current.slots?.sidebar?.leaf?.component,
      "test-route-alt",
    );
  });
});

Deno.test("router-view projects parallel route branches into named slots", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: "profile", component: "test-route-page" },
            {
              path: "profile",
              slot: "sidebar",
              component: "test-route-alt",
            },
            { path: "security", component: "test-route-security" },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/profile");
    await settle(view);

    const layout = view.shadowRoot?.querySelector("test-route-slotted-layout");
    const page = view.shadowRoot?.querySelector("test-route-page") as
      | HTMLElement
      | null;
    const sidebar = view.shadowRoot?.querySelector("test-route-alt") as
      | HTMLElement
      | null;

    assert(layout);
    assert(page);
    assert(sidebar);
    assertEquals(page.slot, "route-child");
    assertEquals(sidebar.slot, "sidebar");

    router.push("/settings/security");
    await settle(view);

    assert(view.shadowRoot?.querySelector("test-route-security"));
    assertEquals(view.shadowRoot?.querySelector("test-route-alt"), null);
  });
});

Deno.test("slot route components receive slot-aware route context", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: "profile/:id", component: "test-route-page" },
            {
              path: "profile/:id",
              slot: "sidebar",
              component: "test-route-aware",
            },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/profile/42");
    await settle(view);

    const sidebar = view.shadowRoot?.querySelector("test-route-aware") as
      | (HTMLElement & { routeContext?: RouteContext })
      | null;

    assert(sidebar);
    assertEquals(sidebar.routeContext?.slot, "sidebar");
    assertEquals(sidebar.routeContext?.params.id, "42");
    assertEquals(
      sidebar.routeContext?.branch.at(-1)?.component,
      "test-route-aware",
    );
  });
});

Deno.test("guards and lazy loads include parallel slot routes", async () => {
  await withRouters(async (createRouter) => {
    let sidebarGuardCalls = 0;
    let sidebarLoadCalls = 0;
    const loadingEvents: RouteLoadingDetail[] = [];
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: "profile", component: "test-route-page" },
            {
              path: "profile",
              slot: "sidebar",
              component: "test-route-alt",
              guard: () => {
                sidebarGuardCalls += 1;
                return true;
              },
              load: () => {
                sidebarLoadCalls += 1;
                return Promise.resolve();
              },
            },
          ],
        },
      ],
    });
    router.addEventListener("route-loading-start", (event) => {
      loadingEvents.push((event as CustomEvent<RouteLoadingDetail>).detail);
    });
    router.addEventListener("route-loading-end", (event) => {
      loadingEvents.push((event as CustomEvent<RouteLoadingDetail>).detail);
    });

    await settle();
    router.push("/settings/profile");
    await settle();

    assertEquals(router.current.localPathname, "/settings/profile");
    assertEquals(sidebarGuardCalls, 1);
    assertEquals(sidebarLoadCalls, 1);
    assertEquals(loadingEvents.map((event) => event.loadingSlots), [
      ["sidebar"],
      ["sidebar"],
    ]);
  });
});

Deno.test("router change details serialize URLSearchParams with toJSON", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "settings/:section", component: "test-route-page" },
      ],
    });

    await settle();
    const detail = router.resolveUrl(
      "/settings/profile?filter=new&filter=open&tab=profile#summary",
    );
    assert(detail);

    const json = JSON.parse(JSON.stringify(detail)) as {
      query: Record<string, string | string[]>;
      url: string;
      params: Record<string, string>;
    };

    assertEquals(json.query, {
      filter: ["new", "open"],
      tab: "profile",
    });
    assertEquals(json.params.section, "profile");
    assertEquals(
      json.url,
      "http://localhost/settings/profile?filter=new&filter=open&tab=profile#summary",
    );
  });
});

Deno.test("router-view only moves focus between side slots when focus was inside the old side slot", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const makeSidebar = (label: string) => {
      const section = dom.document.createElement("section");
      const button = dom.document.createElement("button");
      button.dataset.routeFocus = "";
      button.textContent = label;
      section.append(button);
      return section;
    };
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: ":section", component: "test-route-page" },
            {
              path: "profile",
              slot: "sidebar",
              component: () => makeSidebar("profile side"),
            },
            {
              path: "security",
              slot: "sidebar",
              component: () => makeSidebar("security side"),
            },
          ],
        },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/profile");
    await settle(view);

    const profileSideFocus = view.shadowRoot?.querySelector(
      "section[slot='sidebar'] button",
    ) as HTMLButtonElement | null;
    assert(profileSideFocus);
    view.focus();
    assert(dom.document.activeElement === view);

    router.push("/settings/security");
    await settle(view);

    const securitySideFocus = view.shadowRoot?.querySelector(
      "section[slot='sidebar'] button",
    ) as HTMLButtonElement | null;
    assert(securitySideFocus);
    assert(dom.document.activeElement === view);
    assert(view.shadowRoot?.activeElement !== securitySideFocus);

    securitySideFocus.focus();
    assert(view.shadowRoot?.activeElement === securitySideFocus);

    router.push("/settings/profile");
    await settle(view);

    const nextProfileSideFocus = view.shadowRoot?.querySelector(
      "section[slot='sidebar'] button",
    ) as HTMLButtonElement | null;
    assert(nextProfileSideFocus);
    assert(view.shadowRoot?.activeElement === nextProfileSideFocus);
  });
});

Deno.test("beforeLeave runs for leaving slot branches before the main branch", async () => {
  await withRouters(async (createRouter) => {
    const calls: string[] = [];
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            {
              path: "profile",
              component: "test-route-page",
              beforeLeave: () => {
                calls.push("main");
                return true;
              },
            },
            {
              path: "profile",
              slot: "sidebar",
              component: "test-route-alt",
              beforeLeave: () => {
                calls.push("sidebar");
                return true;
              },
            },
            { path: "security", component: "test-route-security" },
          ],
        },
      ],
    });

    await settle();
    router.push("/settings/profile");
    await settle();
    router.push("/settings/security");
    await settle();

    assertEquals(calls, ["sidebar", "main"]);
    assertEquals(router.current.localPathname, "/settings/security");
  });
});

Deno.test("slot route branches support nested recursive projection through side slots", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "settings",
          component: "test-route-slotted-layout",
          children: [
            { path: "profile", component: "test-route-page" },
            {
              path: "profile",
              slot: "sidebar",
              component: "test-route-sidebar-layout",
              children: [
                { path: "", component: "test-route-drafts" },
                {
                  path: "",
                  slot: "sidebar-tools",
                  component: "test-route-security",
                },
              ],
            },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/profile");
    await settle(view);

    const sidebarLayout = view.shadowRoot?.querySelector(
      "test-route-sidebar-layout",
    );
    const sidebarHome = view.shadowRoot?.querySelector("test-route-drafts") as
      | HTMLElement
      | null;
    const sidebarTools = view.shadowRoot?.querySelector(
      "test-route-security",
    ) as
      | HTMLElement
      | null;

    assert(sidebarLayout);
    assert(sidebarHome);
    assert(sidebarTools);
    assertEquals(sidebarLayout.slot, "sidebar");
    assertEquals(sidebarHome.slot, "route-child");
    assertEquals(sidebarTools.slot, "sidebar-tools");
  });
});

Deno.test("router rejects reserved route slot names", async () => {
  await withRouters((createRouter) => {
    let thrown: unknown;

    try {
      createRouter({
        routes: [
          { path: "", component: "test-route-page" },
          { path: "missing", slot: "404", component: "test-route-alt" },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    assert(thrown instanceof Error);
    assertEquals(thrown.message.includes('Route slot "404" is reserved'), true);
  });
});

Deno.test("router-view supports routeContext property receivers", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "users/:id", component: "test-route-context-prop" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/users/7");
    await settle(view);

    const element = view.shadowRoot?.querySelector("test-route-context-prop") as
      | (HTMLElement & { routeContext?: RouteContext })
      | null;

    assert(element);
    assertEquals(element.routeContext?.detail.localPathname, "/users/7");
    assertEquals(element.routeContext?.params.id, "7");
  });
});

Deno.test("router-view no longer injects legacy routeDetail and routeParams fields", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "legacy", component: "test-route-legacy-probe" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/legacy");
    await settle(view);

    const element = view.shadowRoot?.querySelector("test-route-legacy-probe") as
      | (HTMLElement & {
        routeDetailAssignments: number;
        routeParamsAssignments: number;
      })
      | null;

    assert(element);
    assertEquals(element.routeDetailAssignments, 0);
    assertEquals(element.routeParamsAssignments, 0);
  });
});

Deno.test("route meta is available to guards and route detail without DOM injection", async () => {
  await withRouters(async (createRouter) => {
    const guardMetaValues: unknown[] = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "admin",
          component: "test-route-context-prop",
          meta: { requiresAuth: true, roles: ["admin"] },
          guard: ({ leaf }) => {
            guardMetaValues.push(leaf?.meta?.requiresAuth);
            return true;
          },
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/admin");
    await settle(view);

    const element = view.shadowRoot?.querySelector("test-route-context-prop") as
      | (HTMLElement & { meta?: unknown })
      | null;

    assert(element);
    assertEquals(guardMetaValues, [true]);
    assertEquals(router.current.leaf?.meta?.requiresAuth, true);
    assertEquals(element.meta, undefined);
    assertEquals(router.routes[1]?.meta?.requiresAuth, true);
    assertEquals(Object.isFrozen(router.routes[1]?.meta), true);
  });
});

Deno.test("router builds links from named routes and route params", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/app/");

    const router = createRouter({
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        {
          path: "users",
          name: "users",
          component: "test-route-layout",
          children: [
            {
              path: ":id",
              name: "user-detail",
              component: "test-route-aware",
            },
          ],
        },
      ],
    });

    await settle();

    assertEquals(
      router.link({
        name: "user-detail",
        params: { id: 123 },
        query: { tab: "profile", filter: ["new", "open"] },
        hash: "summary",
      }),
      "/app/users/123?tab=profile&filter=new&filter=open#summary",
    );
    assertEquals(
      router.linkAttributes({
        name: "user-detail",
        params: { id: 123 },
      }, { replace: true }),
      {
        href: "/app/users/123",
        "data-router-replace": "",
      },
    );

    router.push({
      name: "user-detail",
      params: { id: "456" },
      query: { tab: "activity" },
    });
    await settle();

    assertEquals(
      router.current.url.pathname + router.current.url.search,
      "/app/users/456?tab=activity",
    );
    assertEquals(router.current.params.id, "456");
  });
});

Deno.test("hash mode builds links and navigates without changing document path", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/#/app");

    const router = createRouter({
      mode: "hash",
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        { path: "users/:id", name: "user", component: "test-route-aware" },
      ],
    });

    await settle();

    assertEquals(
      router.link({
        name: "user",
        params: { id: 123 },
        query: { tab: "profile" },
        hash: "summary",
      }),
      "/#/app/users/123?tab=profile#summary",
    );
    assertEquals(router.link({ name: "home" }), "/#/app");

    router.push({
      name: "user",
      params: { id: "456" },
      query: { tab: "activity" },
    });
    await settle();

    assertEquals(dom.location.pathname, "/");
    assertEquals(dom.location.hash, "#/app/users/456?tab=activity");
    assertEquals(router.current.pathname, "/app/users/456");
    assertEquals(router.current.localPathname, "/users/456");
    assertEquals(router.current.params.id, "456");
    assertEquals(router.current.query.get("tab"), "activity");

    router.replace("/app/users/789#details");
    await settle();

    assertEquals(dom.location.pathname, "/");
    assertEquals(dom.location.hash, "#/app/users/789#details");
    assertEquals(router.current.localPathname, "/users/789");
    assertEquals(router.current.hash, "#details");
  });
});

Deno.test("hash mode resolves hash URLs and route URLs without navigating", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/#/app");

    const router = createRouter({
      mode: "hash",
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        { path: "users/:id", name: "user", component: "test-route-aware" },
      ],
    });

    await settle();

    const hashUrl = router.resolveUrl("/#/app/users/42?tab=profile#summary");
    assert(hashUrl);
    assertEquals(hashUrl.localPathname, "/users/42");
    assertEquals(hashUrl.params.id, "42");
    assertEquals(hashUrl.query.get("tab"), "profile");
    assertEquals(hashUrl.hash, "#summary");

    const routeUrl = router.resolveUrl("/app/users/99?tab=activity");
    assert(routeUrl);
    assertEquals(routeUrl.localPathname, "/users/99");
    assertEquals(routeUrl.query.get("tab"), "activity");
    assertEquals(router.resolveUrl("/#/app")?.localPathname, "/");
    assertEquals(router.resolveUrl("/#/app/missing"), null);
    assertEquals(router.current.localPathname, "/");
  });
});

Deno.test("hash mode treats an initial index document URL as the base route", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/index.html");

    const router = createRouter({
      mode: "hash",
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        { path: "settings", name: "settings", component: "test-route-page" },
      ],
    });

    await settle();

    assertEquals(dom.location.pathname, "/index.html");
    assertEquals(dom.location.hash, "");
    assertEquals(router.current.pathname, "/app");
    assertEquals(router.current.localPathname, "/");
    assertEquals(
      router.link({ name: "settings" }),
      "/index.html#/app/settings",
    );
  });
});

Deno.test("hash mode initial redirects go through Navigation API", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/index.html#/");
    const windowTarget = dom.window as Window & {
      navigation?: EventTarget & {
        currentEntry?: { key?: string };
        navigate?: (
          url: string,
          options?: { history?: "push" | "replace" },
        ) => unknown;
      };
    };
    const originalNavigation = windowTarget.navigation;
    const navigationApi = new EventTarget() as EventTarget & {
      currentEntry: { key: string };
      navigate: (
        url: string,
        options?: { history?: "push" | "replace" },
      ) => unknown;
    };
    const navigations: Array<{
      url: string;
      history?: "push" | "replace";
    }> = [];

    navigationApi.currentEntry = { key: "initial-hash-entry" };
    navigationApi.navigate = (url, options) => {
      navigations.push({ url, history: options?.history });
    };

    Object.defineProperty(windowTarget, "navigation", {
      configurable: true,
      value: navigationApi,
    });

    try {
      createRouter({
        mode: "hash",
        routes: [
          { path: "", component: "test-route-page", guard: () => "/auth" },
          { path: "auth", component: "test-route-page" },
        ],
      });

      await settle();

      assertEquals(navigations, [{
        url: "/index.html#/auth",
        history: "push",
      }]);
    } finally {
      Object.defineProperty(windowTarget, "navigation", {
        configurable: true,
        value: originalNavigation,
      });
    }
  });
});

Deno.test("hash mode intercepts hash route links but leaves plain fragments alone", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      mode: "hash",
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();

    const dom = browser();
    const plainFragment = dom.document.createElement("a");
    plainFragment.href = "http://localhost/#section";
    dom.document.body.append(plainFragment);

    const plainClick = new dom.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    plainFragment.dispatchEvent(plainClick);
    await settle();

    assertEquals(plainClick.defaultPrevented, false);
    assertEquals(router.current.localPathname, "/");

    const rootLink = dom.document.createElement("a");
    rootLink.href = "http://localhost/#";
    dom.document.body.append(rootLink);

    const rootClick = new dom.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    rootLink.dispatchEvent(rootClick);
    await settle();

    assertEquals(rootClick.defaultPrevented, true);
    assertEquals(router.current.localPathname, "/");
    assertEquals(dom.location.href, "http://localhost/#");

    const routeLink = dom.document.createElement("a");
    routeLink.href = "http://localhost/#/next";
    dom.document.body.append(routeLink);

    const routeClick = new dom.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    routeLink.dispatchEvent(routeClick);
    await settle();

    assertEquals(routeClick.defaultPrevented, true);
    assertEquals(router.current.localPathname, "/next");
    assertEquals(dom.location.hash, "#/next");
  });
});

Deno.test("hash mode ignores route links outside basePath", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/#/app");
    const routeNotFoundEvents: Event[] = [];
    const router = createRouter({
      mode: "hash",
      basePath: "/app",
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    router.addEventListener("route-not-found", (event) => {
      routeNotFoundEvents.push(event);
    });

    await settle();

    const anchor = dom.document.createElement("a");
    anchor.href = "http://localhost/#/outside";
    dom.document.body.append(anchor);

    const clickEvent = new dom.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    const dispatchResult = anchor.dispatchEvent(clickEvent);
    await settle();

    assertEquals(dispatchResult, true);
    assertEquals(clickEvent.defaultPrevented, false);
    assertEquals(routeNotFoundEvents.length, 0);
    assertEquals(router.current.localPathname, "/");
  });
});

Deno.test("hash mode guard relative redirects resolve from the hash route", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      mode: "hash",
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "settings",
          component: "test-route-layout",
          children: [
            {
              path: "profile",
              component: "test-route-page",
              guard: () => "./security",
            },
            {
              path: "security",
              component: "test-route-security",
            },
          ],
        },
      ],
    });

    await settle();
    router.push("#/settings/profile");
    await settle();

    assertEquals(router.current.localPathname, "/settings/security");
    assertEquals(browser().location.hash, "#/settings/security");
  });
});

Deno.test("router resolves URLs and named routes without navigating", async () => {
  await withRouters(async (createRouter) => {
    const typedEvents: string[] = [];
    const router = createRouter({
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        { path: "users/:id", name: "user", component: "test-route-aware" },
      ],
    });

    router.addEventListener("route-change", (event) => {
      typedEvents.push(event.detail.localPathname);
    });

    await settle();

    const resolvedUrl = router.resolveUrl("/app/users/42?tab=profile#summary");
    assert(resolvedUrl);
    assertEquals(resolvedUrl.localPathname, "/users/42");
    assertEquals(resolvedUrl.params.id, "42");
    assertEquals(resolvedUrl.query.get("tab"), "profile");
    assertEquals(resolvedUrl.hash, "#summary");
    assertEquals(router.current.localPathname, "/");

    const resolvedNamed = router.resolveNamed("user", {
      params: { id: "99" },
      query: { tab: "activity" },
    });
    assert(resolvedNamed);
    assertEquals(
      resolvedNamed.url.pathname + resolvedNamed.url.search,
      "/app/users/99?tab=activity",
    );
    assertEquals(resolvedNamed.params.id, "99");
    assertEquals(router.resolveUrl("/outside"), null);
    assertEquals(router.resolveUrl("/app/missing"), null);

    router.push("/app/users/7");
    await settle();
    assertEquals(typedEvents.at(-1), "/users/7");
  });
});

Deno.test("router rejects duplicate route names", async () => {
  await withRouters((createRouter) => {
    let thrown: unknown;

    try {
      createRouter({
        routes: [
          { path: "", name: "home", component: "test-route-page" },
          { path: "other", name: "home", component: "test-route-page" },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message.includes('Duplicate route name "home"'),
      true,
    );
  });
});

Deno.test("router rejects duplicate route ids", async () => {
  await withRouters((createRouter) => {
    let thrown: unknown;

    try {
      createRouter({
        routes: [
          { id: "home", path: "", component: "test-route-page" },
          { id: "home", path: "other", component: "test-route-page" },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message.includes('Duplicate route id "home"'),
      true,
    );
  });
});

Deno.test("router prioritizes static routes over dynamic and catch-all siblings", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "*", name: "catch-all", component: "test-route-page" },
        { path: ":id", name: "user", component: "test-route-page" },
        { path: "me", name: "me", component: "test-route-alt" },
      ],
    });

    await settle();

    router.push("/me");
    await settle();
    assertEquals(router.current.leaf?.name, "me");
    assertEquals(router.current.leaf?.component, "test-route-alt");
    assertEquals(router.current.params.id, undefined);

    router.push("/alice");
    await settle();
    assertEquals(router.current.leaf?.name, "user");
    assertEquals(router.current.params.id, "alice");

    router.push("/docs/guides/getting-started");
    await settle();
    assertEquals(router.current.leaf?.name, "catch-all");
    assertEquals(router.current.params["*"], "docs/guides/getting-started");
  });
});

Deno.test("router can clear beforeRoute via configure", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      beforeRoute: () => false,
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();
    router.push("/next");
    await settle();
    assertEquals(router.current.localPathname, "/");

    router.configure({ beforeRoute: undefined });
    await settle();
    router.push("/next");
    await settle();

    assertEquals(router.current.localPathname, "/next");
  });
});

Deno.test("router can replace the route tree at runtime", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
        { path: "alpha", name: "alpha", component: "test-route-page" },
      ],
    });

    await settle();
    router.push("/alpha");
    await settle();

    assertEquals(router.link({ name: "alpha" }), "/alpha");

    router.setRoutes([
      { path: "", name: "home", component: "test-route-page" },
      { path: "alpha", name: "alpha-v2", component: "test-route-alt" },
      { path: "beta", name: "beta", component: "test-route-alt" },
    ]);
    await settle();

    assertEquals(router.current.localPathname, "/alpha");
    assertEquals(router.current.leaf?.component, "test-route-alt");
    assertEquals(router.link({ name: "beta" }), "/beta");

    let thrown: unknown;
    try {
      router.link({ name: "alpha" });
    } catch (error) {
      thrown = error;
    }

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message.includes('Unknown route name "alpha"'),
      true,
    );
  });
});

Deno.test("router can insert root routes at runtime", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();
    router.insertRoutes([
      { path: "lab", name: "lab", component: "test-route-alt" },
    ]);
    await settle();

    router.push({ name: "lab" });
    await settle();

    assertEquals(router.current.localPathname, "/lab");
    assertEquals(router.current.leaf?.component, "test-route-alt");
    assertEquals(router.link({ name: "lab" }), "/lab");
  });
});

Deno.test("unrelated route insertion emits route-tree-change without route-change", async () => {
  await withRouters(async (createRouter) => {
    const routeChanges: RouteTreeChangeDetail[] = [];
    let navigationChanges = 0;

    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();
    router.addEventListener("route-tree-change", (event) => {
      routeChanges.push((event as CustomEvent<RouteTreeChangeDetail>).detail);
    });
    router.addEventListener("route-change", () => {
      navigationChanges += 1;
    });

    router.insertRoutes([
      { path: "lab", name: "lab", component: "test-route-alt" },
    ]);
    await settle();

    assertEquals(routeChanges.length, 1);
    const detail = routeChanges[0];
    assert(detail);
    assertEquals(detail.reason, "insert");
    assertEquals(detail.routeCount, 2);
    assertEquals(detail.routes.length, 2);
    assertEquals(Object.isFrozen(detail.routes), true);
    let mutationThrown: unknown;
    try {
      (detail.routes as RouteDefinition[]).push({
        path: "mutated-event-snapshot",
        name: "mutated-event-snapshot",
        component: "test-route-alt",
      });
    } catch (error) {
      mutationThrown = error;
    }
    assert(mutationThrown instanceof TypeError);
    assertEquals(router.routes.length, 2);
    assertEquals(navigationChanges, 0);
    assertEquals(router.current.localPathname, "/");
  });
});

Deno.test("unrelated route insertion does not cancel an in-flight navigation", async () => {
  await withRouters(async (createRouter) => {
    const pendingResolutions: Array<(value: true) => void> = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "next",
          component: "test-route-page",
          guard: () =>
            new Promise<true>((resolve) => {
              pendingResolutions.push(resolve);
            }),
        },
      ],
    });

    await settle();
    router.push("/next");
    await settle();

    router.insertRoutes([
      { path: "lab", name: "lab", component: "test-route-alt" },
    ]);
    await settle();

    assertEquals(router.current.localPathname, "/");
    assertEquals(pendingResolutions.length, 1);

    pendingResolutions[0]?.(true);
    await settle();

    assertEquals(router.current.localPathname, "/next");
  });
});

Deno.test("router can insert nested routes at runtime and rematch the current URL", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/settings/security");

    const router = createRouter({
      routes: [
        {
          path: "settings",
          name: "settings",
          component: "test-route-layout",
          children: [
            { path: "", component: "test-route-page" },
          ],
        },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    const initialFallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="404"]',
    );
    assert(initialFallback);
    assertEquals(initialFallback.hidden, false);

    router.insertRoutes([
      {
        path: "security",
        name: "settings-security",
        component: "test-route-security",
      },
    ], {
      parentName: "settings",
    });
    await settle(view);

    assertEquals(router.current.localPathname, "/settings/security");
    assertEquals(
      router.link({ name: "settings-security" }),
      "/settings/security",
    );
    assert(view.shadowRoot?.querySelector("test-route-security"));
  });
});

Deno.test("router can insert nested routes by parentId when the parent has no route name", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/settings/security");

    const router = createRouter({
      routes: [
        {
          id: "settings-shell",
          path: "settings",
          component: "test-route-layout",
          children: [
            { path: "", component: "test-route-page" },
          ],
        },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.insertRoutes([
      {
        id: "settings-security-page",
        path: "security",
        component: "test-route-security",
      },
    ], {
      parentId: "settings-shell",
    });
    await settle(view);

    assertEquals(router.current.localPathname, "/settings/security");
    assert(view.shadowRoot?.querySelector("test-route-security"));
  });
});

Deno.test("router batches route tree updates into one refresh", async () => {
  await withRouters(async (createRouter) => {
    const routeChanges: RouteTreeChangeDetail[] = [];
    let navigationChanges = 0;
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();
    router.addEventListener("route-tree-change", (event) => {
      routeChanges.push((event as CustomEvent<RouteTreeChangeDetail>).detail);
    });
    router.addEventListener("route-change", () => {
      navigationChanges += 1;
    });

    router.batchRouteUpdates(() => {
      router.insertRoutes([
        { path: "alpha", name: "alpha", component: "test-route-alt" },
      ]);
      router.insertRoutes([
        { path: "beta", name: "beta", component: "test-route-alt" },
      ]);
    });
    await settle();

    assertEquals(routeChanges.length, 1);
    assertEquals(routeChanges[0]?.reason, "batch");
    assertEquals(routeChanges[0]?.routes.length, 3);
    assertEquals(navigationChanges, 0);
    assertEquals(router.link({ name: "alpha" }), "/alpha");
    assertEquals(router.link({ name: "beta" }), "/beta");
  });
});

Deno.test("router rolls back batched route updates when the batch throws", async () => {
  await withRouters(async (createRouter) => {
    const routeChanges: RouteTreeChangeDetail[] = [];
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();
    router.addEventListener("route-tree-change", (event) => {
      routeChanges.push((event as CustomEvent<RouteTreeChangeDetail>).detail);
    });

    let thrown: unknown;
    try {
      router.batchRouteUpdates(() => {
        router.insertRoutes([
          { path: "alpha", name: "alpha", component: "test-route-alt" },
        ]);
        throw new Error("batch failed");
      });
    } catch (error) {
      thrown = error;
    }

    await settle();

    let linkError: unknown;
    try {
      router.link({ name: "alpha" });
    } catch (error) {
      linkError = error;
    }

    assert(thrown instanceof Error);
    assertEquals(thrown.message, "batch failed");
    assert(linkError instanceof Error);
    assertEquals(
      linkError.message.includes('Unknown route name "alpha"'),
      true,
    );
    assertEquals(routeChanges.length, 0);
    assertEquals(router.routes.length, 1);
  });
});

Deno.test("router rejects async batchRouteUpdates callbacks", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();

    let thrown: unknown;
    try {
      router.batchRouteUpdates(() => Promise.resolve());
    } catch (error) {
      thrown = error;
    }

    let linkError: unknown;
    try {
      router.link({ name: "alpha" });
    } catch (error) {
      linkError = error;
    }

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message,
      "batchRouteUpdates callback must be synchronous.",
    );
    assert(linkError instanceof Error);
    assertEquals(
      linkError.message.includes('Unknown route name "alpha"'),
      true,
    );
  });
});

Deno.test("router routes getter returns a frozen snapshot and setter applies a replacement", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-route-page" },
      ],
    });

    await settle();

    const snapshot = router.routes;
    assertEquals(Object.isFrozen(snapshot), true);
    let mutationThrown: unknown;
    try {
      (snapshot as RouteDefinition[]).push({
        path: "ignored",
        name: "ignored",
        component: "test-route-alt",
      });
    } catch (error) {
      mutationThrown = error;
    }
    assert(mutationThrown instanceof TypeError);

    let thrown: unknown;
    try {
      router.link({ name: "ignored" });
    } catch (error) {
      thrown = error;
    }

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message.includes('Unknown route name "ignored"'),
      true,
    );
    assertEquals(router.cloneRoutes().length, 1);

    router.routes = [
      ...router.cloneRoutes(),
      { path: "applied", name: "applied", component: "test-route-alt" },
    ];
    await settle();

    assertEquals(router.link({ name: "applied" }), "/applied");
  });
});

Deno.test("router can remove unnamed route branches by id", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          id: "settings-shell",
          path: "settings",
          component: "test-route-layout",
          children: [
            {
              id: "settings-security-page",
              path: "security",
              component: "test-route-security",
            },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/security");
    await settle(view);
    assert(view.shadowRoot?.querySelector("test-route-security"));

    assertEquals(router.removeRoute({ id: "settings-security-page" }), true);
    await settle(view);

    const fallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="404"]',
    );

    assertEquals(router.lastNotFound?.url.pathname, "/settings/security");
    assert(fallback);
    assertEquals(fallback.hidden, false);
    assertEquals(router.removeRoute({ id: "settings-security-page" }), false);
  });
});

Deno.test("route removal invalidates an in-flight navigation to the removed branch", async () => {
  await withRouters(async (createRouter) => {
    const pendingResolutions: Array<(value: true) => void> = [];
    const notFoundEvents: RouteNotFoundDetail[] = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "lab",
          name: "lab",
          component: "test-route-alt",
          guard: () =>
            new Promise<true>((resolve) => {
              pendingResolutions.push(resolve);
            }),
        },
      ],
    });

    router.addEventListener("route-not-found", (event) => {
      notFoundEvents.push((event as CustomEvent<RouteNotFoundDetail>).detail);
    });

    await settle();
    router.push("/lab");
    await settle();
    assertEquals(pendingResolutions.length, 1);

    assertEquals(router.removeRoute("lab"), true);
    await settle();

    assertEquals(notFoundEvents.at(-1)?.url.pathname, "/lab");
    assertEquals(router.current.localPathname, "/");

    pendingResolutions[0]?.(true);
    await settle();

    assertEquals(router.current.localPathname, "/");
    assertEquals(router.lastNotFound?.url.pathname, "/lab");
  });
});

Deno.test("router.stop invalidates an in-flight navigation", async () => {
  await withRouters(async (createRouter) => {
    const pendingResolutions: Array<(value: true) => void> = [];
    let routeChanges = 0;
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "slow",
          component: "test-route-page",
          guard: () =>
            new Promise<true>((resolve) => {
              pendingResolutions.push(resolve);
            }),
        },
      ],
    });

    await settle();
    router.addEventListener("route-change", () => {
      routeChanges += 1;
    });

    router.push("/slow");
    await settle();
    assertEquals(pendingResolutions.length, 1);

    router.stop();
    pendingResolutions[0]?.(true);
    await settle();

    assertEquals(routeChanges, 0);
    assertEquals(router.current.localPathname, "/");
  });
});

Deno.test("router stores a distinct scroll history key per pushed entry", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();

    const navigation = dom.window as Window & {
      navigation?: { currentEntry?: { key?: string } };
    };
    const initialKey = navigation.navigation?.currentEntry?.key;
    assert(typeof initialKey === "string" && initialKey.length > 0);

    router.push("/next");
    await settle();

    const pushedKey = navigation.navigation?.currentEntry?.key;
    assert(typeof pushedKey === "string" && pushedKey.length > 0);
    assert(pushedKey !== initialKey);

    router.replace("/");
    await settle();

    const replacedKey = navigation.navigation?.currentEntry?.key;
    assertEquals(replacedKey, pushedKey);
  });
});

Deno.test("router bounds history entry order bookkeeping", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "page/:id", component: "test-route-page" },
      ],
    });

    await settle();

    for (let index = 0; index < 400; index += 1) {
      router.push(`/page/${index}`);
      await settle();
    }

    const internals = router as unknown as {
      historyEntryOrders: Map<string, number>;
    };

    assertEquals(
      internals.historyEntryOrders.size <= 256,
      true,
    );
    assertEquals(
      internals.historyEntryOrders.has(router.current.historyKey),
      true,
    );
  });
});

Deno.test("route beforeLeave restores the current URL when browser back is blocked", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "next",
          component: "test-route-page",
          beforeLeave: () => false,
        },
      ],
    });

    await settle();
    router.push("/next");
    await settle();

    dom.history.back();
    await settle();
    await settle();

    assertEquals(router.current.localPathname, "/next");
    assertEquals(dom.location.pathname, "/next");
  });
});

Deno.test("router matches URLPattern splat params across multiple segments", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "docs/:parts*", component: "test-route-page" },
      ],
    });

    await settle();
    router.push("/docs/guides/native/router");
    await settle();

    assertEquals(router.current.localPathname, "/docs/guides/native/router");
    assertEquals(router.current.branch.map((route) => route.path), [
      "docs/:parts*",
    ]);
    assertEquals(router.current.params.parts, "guides/native/router");
  });
});

Deno.test("router matches optional URLPattern segments when they are omitted or present", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: ":lang?/docs",
          component: "test-route-page",
        },
      ],
    });

    await settle();
    router.push("/docs");
    await settle();

    assertEquals(router.current.branch.map((route) => route.path), [
      ":lang?/docs",
    ]);
    assertEquals(router.current.params, {});

    router.push("/zh/docs");
    await settle();

    assertEquals(router.current.branch.map((route) => route.path), [
      ":lang?/docs",
    ]);
    assertEquals(router.current.params.lang, "zh");
  });
});

Deno.test("router builds links for optional route segments when params are omitted", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: ":lang?/docs", name: "docs", component: "test-route-page" },
      ],
    });

    await settle();

    assertEquals(
      router.link({
        name: "docs",
        params: {},
      }),
      "/docs",
    );
    assertEquals(
      router.link({
        name: "docs",
        params: { lang: "zh" },
      }),
      "/zh/docs",
    );
  });
});

Deno.test("router uses Navigation API listeners without popstate", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const windowTarget = dom.window as Window & {
      navigation?: EventTarget & {
        currentEntry?: { key?: string };
        navigate?: (
          url: string,
          options?: { history?: "push" | "replace" },
        ) => unknown;
      };
    };
    const originalNavigation = windowTarget.navigation;
    const originalAddEventListener = windowTarget.addEventListener;
    const originalRemoveEventListener = windowTarget.removeEventListener;
    const navigationApi = new EventTarget() as EventTarget & {
      currentEntry: { key: string };
      navigate: (
        url: string,
        options?: { history?: "push" | "replace" },
      ) => unknown;
    };
    navigationApi.currentEntry = { key: "test-navigation-entry" };
    navigationApi.navigate = () => undefined;

    let popstateAdds = 0;
    let popstateRemoves = 0;
    let navigateAdds = 0;
    let navigateRemoves = 0;

    Object.defineProperty(windowTarget, "navigation", {
      configurable: true,
      value: navigationApi,
    });
    Object.defineProperty(windowTarget, "addEventListener", {
      configurable: true,
      value: function (
        this: Window,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean,
      ): void {
        if (type === "popstate") {
          popstateAdds += 1;
        }
        if (!listener) {
          return;
        }
        return originalAddEventListener.call(this, type, listener, options);
      },
    });
    Object.defineProperty(windowTarget, "removeEventListener", {
      configurable: true,
      value: function (
        this: Window,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean,
      ): void {
        if (type === "popstate") {
          popstateRemoves += 1;
        }
        if (!listener) {
          return;
        }
        return originalRemoveEventListener.call(this, type, listener, options);
      },
    });

    const originalNavigationAddEventListener = navigationApi.addEventListener;
    const originalNavigationRemoveEventListener = navigationApi
      .removeEventListener;
    Object.defineProperty(navigationApi, "addEventListener", {
      configurable: true,
      value: function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean,
      ): void {
        if (type === "navigate") {
          navigateAdds += 1;
        }
        return originalNavigationAddEventListener.call(
          this,
          type,
          listener,
          options,
        );
      },
    });
    Object.defineProperty(navigationApi, "removeEventListener", {
      configurable: true,
      value: function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean,
      ): void {
        if (type === "navigate") {
          navigateRemoves += 1;
        }
        return originalNavigationRemoveEventListener.call(
          this,
          type,
          listener,
          options,
        );
      },
    });

    try {
      const router = createRouter({
        autoStart: false,
        routes: [{ path: "", component: "test-route-page" }],
      });

      router.start();
      await settle();
      Object.defineProperty(windowTarget, "navigation", {
        configurable: true,
        value: new EventTarget(),
      });
      router.stop();

      assertEquals(popstateAdds, 0);
      assertEquals(popstateRemoves, 0);
      assertEquals(navigateAdds, 1);
      assertEquals(navigateRemoves, 1);
    } finally {
      Object.defineProperty(windowTarget, "navigation", {
        configurable: true,
        value: originalNavigation,
      });
      Object.defineProperty(windowTarget, "addEventListener", {
        configurable: true,
        value: originalAddEventListener,
      });
      Object.defineProperty(windowTarget, "removeEventListener", {
        configurable: true,
        value: originalRemoveEventListener,
      });
    }
  });
});

Deno.test("hash mode uses Navigation API listeners when available", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/#/app");
    const windowTarget = dom.window as Window & {
      navigation?: EventTarget & {
        currentEntry?: { key?: string };
        navigate?: (
          url: string,
          options?: { history?: "push" | "replace" },
        ) => unknown;
      };
    };
    const originalNavigation = windowTarget.navigation;
    const originalAddEventListener = windowTarget.addEventListener;
    const originalRemoveEventListener = windowTarget.removeEventListener;
    const navigationApi = new EventTarget() as EventTarget & {
      currentEntry: { key: string };
      navigate: (
        url: string,
        options?: { history?: "push" | "replace" },
      ) => unknown;
    };

    let popstateAdds = 0;
    let hashchangeAdds = 0;
    let navigateAdds = 0;
    const navigations: Array<{
      url: string;
      history?: "push" | "replace";
    }> = [];

    navigationApi.currentEntry = { key: "hash-navigation-entry" };
    navigationApi.navigate = (url, options) => {
      navigations.push({ url, history: options?.history });
    };

    Object.defineProperty(windowTarget, "navigation", {
      configurable: true,
      value: navigationApi,
    });
    Object.defineProperty(windowTarget, "addEventListener", {
      configurable: true,
      value: function (
        this: Window,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean,
      ): void {
        if (type === "popstate") {
          popstateAdds += 1;
        }
        if (type === "hashchange") {
          hashchangeAdds += 1;
        }
        if (!listener) {
          return;
        }
        return originalAddEventListener.call(this, type, listener, options);
      },
    });

    const originalNavigationAddEventListener = navigationApi.addEventListener;
    Object.defineProperty(navigationApi, "addEventListener", {
      configurable: true,
      value: function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean,
      ): void {
        if (type === "navigate") {
          navigateAdds += 1;
        }
        return originalNavigationAddEventListener.call(
          this,
          type,
          listener,
          options,
        );
      },
    });

    try {
      const router = createRouter({
        autoStart: false,
        mode: "hash",
        basePath: "/app",
        routes: [
          { path: "", name: "home", component: "test-route-page" },
          { path: "next", name: "next", component: "test-route-page" },
        ],
      });

      router.start();
      await settle();
      router.push({ name: "next" });
      await settle();
      router.stop();

      assertEquals(popstateAdds, 0);
      assertEquals(hashchangeAdds, 0);
      assertEquals(navigateAdds, 1);
      assertEquals(navigations, [{ url: "/#/app/next", history: "push" }]);
    } finally {
      Object.defineProperty(windowTarget, "navigation", {
        configurable: true,
        value: originalNavigation,
      });
      Object.defineProperty(windowTarget, "addEventListener", {
        configurable: true,
        value: originalAddEventListener,
      });
      Object.defineProperty(windowTarget, "removeEventListener", {
        configurable: true,
        value: originalRemoveEventListener,
      });
    }
  });
});

Deno.test("router intercepts SVG anchor elements", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    await settle();

    const dom = browser();
    const namespace = "http://www.w3.org/2000/svg";
    const svg = dom.document.createElementNS(namespace, "svg");
    const anchor = dom.document.createElementNS(namespace, "a");
    const text = dom.document.createElementNS(namespace, "text");
    anchor.setAttribute("href", "/next");
    text.textContent = "next";
    anchor.append(text);
    svg.append(anchor);
    dom.document.body.append(svg);

    text.dispatchEvent(
      new dom.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    await settle();

    assertEquals(router.current.localPathname, "/next");
  });
});

Deno.test("router-view restores scrollRestoration on disconnect", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      current: RouteContext["detail"];
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    assertEquals(dom.history.scrollRestoration, "manual");

    view.remove();
    await settle();

    assertEquals(dom.history.scrollRestoration, "auto");
  });
});

Deno.test("scroll manager keeps browser scrollRestoration manual until all users release", () => {
  resetDom();
  const dom = browser();
  const first = new ScrollManager();
  const second = new ScrollManager();

  first.acquireBrowserScrollRestoration();
  second.acquireBrowserScrollRestoration();

  assertEquals(dom.history.scrollRestoration, "manual");

  first.releaseBrowserScrollRestoration();
  assertEquals(dom.history.scrollRestoration, "manual");

  second.releaseBrowserScrollRestoration();
  assertEquals(dom.history.scrollRestoration, "auto");
});

Deno.test("router-view exposes route-level view transition names", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "next",
          component: "test-route-alt",
          viewTransitionName: "settings-stage",
        },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      dataset: DOMStringMap;
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    assertEquals(view.dataset.viewTransitionName, undefined);

    router.push("/next");
    await settle(view);

    assertEquals(view.dataset.viewTransitionName, "settings-stage");
    assertEquals(
      view.style.getPropertyValue("--router-view-transition-name"),
      "settings-stage",
    );
  });
});

Deno.test("router-view reports commit errors even when view transitions are enabled", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const transitionDocument = dom.document as Document & {
      startViewTransition?: (
        callback: () => Promise<void> | void,
      ) => {
        finished: Promise<void>;
        updateCallbackDone?: Promise<void>;
      };
    };
    const previousStartViewTransition = transitionDocument.startViewTransition;

    Object.defineProperty(transitionDocument, "startViewTransition", {
      configurable: true,
      value: (callback: () => Promise<void> | void) => {
        const update = Promise.resolve().then(() => callback());
        return {
          finished: update.then(() => undefined),
          updateCallbackDone: update.then(() => undefined),
        };
      },
    });

    try {
      const routeErrors: RouteErrorDetail[] = [];
      const router = createRouter({
        routes: [
          { path: "", component: "test-route-page" },
          {
            path: "broken-commit",
            component: () => {
              throw new Error("commit failed");
            },
          },
        ],
      });

      const view = dom.document.createElement("router-view") as HTMLElement & {
        router?: Router;
        shadowRoot: ShadowRoot | null;
        updateComplete?: Promise<unknown>;
      };
      view.router = router;
      view.addEventListener("route-error", (event) => {
        routeErrors.push((event as CustomEvent<RouteErrorDetail>).detail);
      });
      dom.document.body.append(view);

      await settle(view);
      router.push("/broken-commit");
      await settle(view);

      const fallback = view.shadowRoot?.querySelector<HTMLElement>(
        '.fallback[data-fallback="error"]',
      );

      assertEquals(routeErrors.length, 1);
      assertEquals(routeErrors[0]?.phase, "commit");
      assert(fallback);
      assertEquals(fallback.hidden, false);
      assertEquals(fallback.textContent?.includes("commit failed"), true);
    } finally {
      Object.defineProperty(transitionDocument, "startViewTransition", {
        configurable: true,
        value: previousStartViewTransition,
      });
    }
  });
});

Deno.test("router-view exposes transition direction on the host element", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "next", component: "test-route-page" },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      dataset: DOMStringMap;
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    assertEquals(view.dataset.transitionDirection, "none");
    assertEquals(dom.document.activeElement, view);

    router.push("/next");
    await settle(view);
    assertEquals(router.current.direction, "forward");
    assertEquals(view.dataset.transitionDirection, "forward");
    assertEquals(dom.document.activeElement, view);

    dom.history.back();
    await settle(view);
    await settle(view);
    assertEquals(router.current.direction, "backward");
    assertEquals(view.dataset.transitionDirection, "backward");

    router.replace("/next");
    await settle(view);
    assertEquals(router.current.direction, "none");
    assertEquals(view.dataset.transitionDirection, "none");
  });
});

Deno.test("scroll manager decodes hash fragments before scrolling to targets", () => {
  resetDom();
  const dom = browser();
  const manager = new ScrollManager();
  const target = dom.document.createElement("section");
  target.id = "section 1";

  let scrollIntoViewCalls = 0;
  Object.defineProperty(target, "scrollIntoView", {
    configurable: true,
    value: () => {
      scrollIntoViewCalls += 1;
    },
  });

  dom.document.body.append(target);
  manager.restore(new URL("http://localhost/#section%201"));

  assertEquals(scrollIntoViewCalls, 1);
});

Deno.test("scroll manager resolves hash targets on shadow hosts exposed in light DOM", () => {
  resetDom();
  const dom = browser();
  const manager = new ScrollManager();
  const host = dom.document.createElement("section");
  host.id = "shadow section";
  host.attachShadow({ mode: "open" });

  let scrollIntoViewCalls = 0;
  Object.defineProperty(host, "scrollIntoView", {
    configurable: true,
    value: () => {
      scrollIntoViewCalls += 1;
    },
  });

  dom.document.body.append(host);
  manager.restore(new URL("http://localhost/#shadow%20section"));

  assertEquals(scrollIntoViewCalls, 1);
});

Deno.test("scroll manager does not recurse into shadow roots for hash targets", () => {
  resetDom();
  const dom = browser();
  const windowTarget = dom.window as Window;
  const manager = new ScrollManager();
  const host = dom.document.createElement("section");
  const shadowRoot = host.attachShadow({ mode: "open" });
  const target = dom.document.createElement("h2");
  target.id = "shadow section";

  let scrollIntoViewCalls = 0;
  Object.defineProperty(target, "scrollIntoView", {
    configurable: true,
    value: () => {
      scrollIntoViewCalls += 1;
    },
  });

  const scrollCalls: ScrollToOptions[] = [];
  Object.defineProperty(windowTarget, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      scrollCalls.push(options);
    },
  });

  shadowRoot.append(target);
  dom.document.body.append(host);
  manager.restore(new URL("http://localhost/#shadow%20section"));

  assertEquals(scrollIntoViewCalls, 0);
  assertEquals(scrollCalls.length, 1);
  assertEquals(scrollCalls[0]?.top, 0);
  assertEquals(scrollCalls[0]?.left, 0);
  assertEquals(scrollCalls[0]?.behavior, "instant");
});

Deno.test("scroll manager restores positions by history entry key instead of URL", () => {
  resetDom();
  const dom = browser();
  const windowTarget = dom.window as Window;
  const manager = new ScrollManager();

  const scrollX = 0;
  let scrollY = 480;
  Object.defineProperty(windowTarget, "scrollX", {
    configurable: true,
    get: () => scrollX,
  });
  Object.defineProperty(windowTarget, "scrollY", {
    configurable: true,
    get: () => scrollY,
  });

  const scrollCalls: ScrollToOptions[] = [];
  Object.defineProperty(windowTarget, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      scrollCalls.push(options);
    },
  });

  manager.capture("entry-a", new URL("http://localhost/list"));
  scrollY = 0;
  manager.restore("entry-b", new URL("http://localhost/list"));

  assertEquals(scrollCalls.length, 1);
  assertEquals(scrollCalls[0]?.top, 0);
  assertEquals(scrollCalls[0]?.left, 0);
  assertEquals(scrollCalls[0]?.behavior, "instant");
});

Deno.test("scroll manager falls back to top when a hash target is missing", () => {
  resetDom();
  const dom = browser();
  const windowTarget = dom.window as Window;
  const manager = new ScrollManager();

  const scrollCalls: ScrollToOptions[] = [];
  Object.defineProperty(windowTarget, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      scrollCalls.push(options);
    },
  });

  manager.restore(new URL("http://localhost/#missing"));

  assertEquals(scrollCalls.length, 1);
  assertEquals(scrollCalls[0]?.top, 0);
  assertEquals(scrollCalls[0]?.left, 0);
  assertEquals(scrollCalls[0]?.behavior, "instant");
});

Deno.test("router-view bounds scroll position cache with LRU eviction", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      current: RouteContext["detail"];
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    const internals = view as unknown as {
      scrollManager: {
        capture(url: URL): void;
        maxPositions: number;
        positions: Map<string, { left: number; top: number }>;
      };
    };
    internals.scrollManager.positions.clear();

    for (
      let index = 0;
      index < internals.scrollManager.maxPositions;
      index += 1
    ) {
      internals.scrollManager.capture(
        new URL(`http://localhost/page-${index}`),
      );
    }

    internals.scrollManager.capture(new URL("http://localhost/page-0"));
    internals.scrollManager.capture(
      new URL(`http://localhost/page-${internals.scrollManager.maxPositions}`),
    );

    assertEquals(
      internals.scrollManager.positions.size,
      internals.scrollManager.maxPositions,
    );
    assertEquals(
      internals.scrollManager.positions.has("http://localhost/page-0"),
      true,
    );
    assertEquals(
      internals.scrollManager.positions.has("http://localhost/page-1"),
      false,
    );
    assertEquals(
      internals.scrollManager.positions.has(
        `http://localhost/page-${internals.scrollManager.maxPositions}`,
      ),
      true,
    );
  });
});

Deno.test("router-view removes stale nested children when branch shrinks", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "inbox",
          component: "test-route-layout",
          children: [
            { path: "", component: "test-route-page" },
            { path: "drafts", component: "test-route-drafts" },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/inbox/drafts");
    await settle(view);
    assert(view.shadowRoot?.querySelector("test-route-drafts"));

    router.push("/inbox");
    await settle(view);
    assertEquals(view.shadowRoot?.querySelector("test-route-drafts"), null);
  });
});

Deno.test("router-view stops the previous router when swapping instances", async () => {
  await withRouters(async (createRouter) => {
    const routerA = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });
    const routerB = createRouter({
      autoStart: false,
      routes: [{ path: "", component: "test-route-alt" }],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = routerA;
    dom.document.body.append(view);
    await settle(view);

    view.router = routerB;
    await settle(view);

    assertEquals((routerA as unknown as { started: boolean }).started, false);
    assertEquals((routerB as unknown as { started: boolean }).started, true);
  });
});

Deno.test("router-view cancels pending commits and clears retained refs when disconnected", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    let resolveUpdate: (() => void) | undefined;
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "slow",
          component: () => {
            const element = dom.document.createElement("section") as
              & HTMLElement
              & { updateComplete?: Promise<unknown> };
            element.updateComplete = new Promise<void>((resolve) => {
              resolveUpdate = resolve;
            });
            return element;
          },
        },
      ],
    });

    const view = dom.document.createElement("router-view") as HTMLElement & {
      current: RouteContext["detail"];
      router?: Router;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/slow");
    await settle(view);

    const internals = view as unknown as {
      pendingChildOutletChecks: Map<HTMLElement, unknown>;
      renderedBranches: Map<string, HTMLElement[]>;
    };
    internals.pendingChildOutletChecks.set(
      dom.document.createElement("section"),
      {},
    );

    view.remove();
    resolveUpdate?.();
    await settle();

    assertEquals(view.current.localPathname, "/");
    assertEquals(internals.renderedBranches.size, 0);
    assertEquals(internals.pendingChildOutletChecks.size, 0);
  });
});

Deno.test("router-view remounts the active branch when routes are replaced at runtime", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [{ path: "", component: "test-route-page" }],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    assert(view.shadowRoot?.querySelector("test-route-page"));

    router.setRoutes([{ path: "", component: "test-route-alt" }]);
    await settle(view);

    assertEquals(view.shadowRoot?.querySelector("test-route-page"), null);
    assert(view.shadowRoot?.querySelector("test-route-alt"));
  });
});

Deno.test("router-view shows not-found when route replacement removes the active match", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        { path: "lab", component: "test-route-alt" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/lab");
    await settle(view);

    router.setRoutes([{ path: "", component: "test-route-page" }]);
    await settle(view);

    const fallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="404"]',
    );

    assertEquals(router.lastNotFound?.url.pathname, "/lab");
    assert(fallback);
    assertEquals(fallback.hidden, false);
  });
});

Deno.test("router can remove named route branches at runtime", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "settings",
          name: "settings",
          component: "test-route-layout",
          children: [
            {
              path: "security",
              name: "settings-security",
              component: "test-route-security",
            },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as HTMLElement & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
      updateComplete?: Promise<unknown>;
    };
    view.router = router;
    dom.document.body.append(view);

    await settle(view);
    router.push("/settings/security");
    await settle(view);
    assert(view.shadowRoot?.querySelector("test-route-security"));

    assertEquals(router.removeRoute("settings"), true);
    await settle(view);

    let thrown: unknown;
    try {
      router.link({ name: "settings-security" });
    } catch (error) {
      thrown = error;
    }

    const fallback = view.shadowRoot?.querySelector<HTMLElement>(
      '.fallback[data-fallback="404"]',
    );

    assert(thrown instanceof Error);
    assertEquals(
      thrown.message.includes('Unknown route name "settings-security"'),
      true,
    );
    assertEquals(router.lastNotFound?.url.pathname, "/settings/security");
    assert(fallback);
    assertEquals(fallback.hidden, false);
    assertEquals(router.removeRoute("settings"), false);
  });
});

Deno.test("independent redirect chains do not accumulate redirect depth", async () => {
  await withRouters(async (createRouter) => {
    const pendingResolutions: Array<(value: true) => void> = [];
    const routeErrors: RouteErrorDetail[] = [];
    const router = createRouter({
      routes: [
        { path: "", component: "test-route-page" },
        {
          path: "redirect-source",
          component: "test-route-page",
          guard: () => "/redirect-target",
        },
        {
          path: "redirect-target",
          component: "test-route-page",
          guard: () =>
            new Promise<true>((resolve) => {
              pendingResolutions.push(resolve);
            }),
        },
      ],
    });

    router.addEventListener("route-error", (event) => {
      routeErrors.push((event as CustomEvent<RouteErrorDetail>).detail);
    });

    await settle();

    router.push("/redirect-source");
    await settle();
    router.push("/redirect-source");
    await settle();
    router.push("/redirect-source");
    await settle();
    router.push("/redirect-source");
    await settle();

    assertEquals(routeErrors, []);
    assertEquals(pendingResolutions.length, 4);

    const latestResolution = pendingResolutions.pop();
    latestResolution?.(true);
    await settle();

    assertEquals(routeErrors, []);
    assertEquals(router.current.localPathname, "/redirect-target");

    for (const resolve of pendingResolutions) {
      resolve(true);
    }
    await settle();
  });
});
