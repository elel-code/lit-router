/**
 * E2E tests for lit-router.
 *
 * Requires Chromium. Puppeteer downloads it automatically on first run.
 *
 * Provide dist-e2e/router.bundle.js, then run:
 * deno test -A tests/e2e/e2e_test.ts
 */

import { assertEquals } from "@std/assert";
import puppeteer, { type Page } from "puppeteer";

// ---------- server ----------

function startServer(root: string) {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal },
    async (request: Request) => {
      const url = new URL(request.url);
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = `${root}${pathname}`;

      try {
        const text = await Deno.readTextFile(filePath);

        const ext = pathname.split(".").pop() ?? "";
        const contentType = {
          js: "application/javascript",
          html: "text/html",
          css: "text/css",
        }[ext] ?? "text/plain";

        return new Response(text, {
          headers: { "content-type": contentType },
        });
      } catch {
        return new Response(`Not found: ${url.pathname}`, { status: 404 });
      }
    },
  );

  return {
    shutdown: async () => {
      controller.abort();
      await server.finished;
    },
    port: server.addr.port,
  };
}

// ---------- browser ----------

async function prepareBrowser(port: number) {
  const execPath = Deno.env.get("PUPPETEER_EXECUTABLE_PATH") || undefined;
  const browser = await puppeteer.launch({
    headless: true,
    ...(execPath ? { executablePath: execPath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const diagnostics: string[] = [];
  page.on("pageerror", (error) => {
    diagnostics.push(
      `pageerror: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warn") {
      diagnostics.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle0" });
  await waitForRouterReady(page, diagnostics);
  return { browser, page };
}

async function waitForRouterReady(page: Page, diagnostics: string[] = []) {
  try {
    await page.waitForFunction(() => {
      const view = document.querySelector("router-view") as
        | (HTMLElement & { router?: unknown })
        | null;
      return Boolean(customElements.get("router-view") && view?.router);
    }, { timeout: 5_000 });
  } catch (error) {
    const state = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).map((script) =>
        script.src || script.textContent?.slice(0, 120) || ""
      );
      return {
        hasRouterView: Boolean(document.querySelector("router-view")),
        routerViewDefined: Boolean(customElements.get("router-view")),
        body: document.body.innerHTML.slice(0, 400),
        scripts,
      };
    }).catch((stateError) => ({
      evaluationError: stateError instanceof Error
        ? stateError.message
        : String(stateError),
    }));

    throw new Error(
      `router-view did not become ready.\nState: ${
        JSON.stringify(state)
      }\nDiagnostics: ${diagnostics.join(" | ")}\nCause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function waitForPath(
  page: Page,
  path: string,
) {
  await page.waitForFunction(
    (p: string) => globalThis.location.pathname === p,
    { timeout: 5_000 },
    path,
  );
}

async function waitForText(
  page: Page,
  sel: string,
  expected: string,
) {
  await page.waitForFunction(
    (s: string, value: string) => {
      const view = document.querySelector("router-view");
      const element = view?.shadowRoot?.querySelector(s) ??
        document.querySelector(s);
      return element?.textContent === value;
    },
    { timeout: 5_000 },
    sel,
    expected,
  );
}

async function nav(
  page: Page,
  path: string,
) {
  await waitForRouterReady(page);
  await page.evaluate((p: string) => {
    (document.querySelector("router-view") as { push?: (p: string) => void })
      ?.push?.(p);
  }, path);
  await waitForPath(page, path);
}

async function back(
  page: Page,
  expectedPath: string,
) {
  await page.evaluate(() => globalThis.history.back());
  await waitForPath(page, expectedPath);
}

function pathname(page: Page) {
  return page.evaluate(() => globalThis.location.pathname);
}

function text(
  page: Page,
  sel: string,
) {
  return page.evaluate(
    (s: string) => {
      const view = document.querySelector("router-view");
      const element = view?.shadowRoot?.querySelector(s) ??
        document.querySelector(s);
      return element?.textContent ?? "";
    },
    sel,
  );
}

// ---------- pages ----------

function indexHtml(routerScript: string, componentsScript: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><base href="/"></head>
<body>
  <router-view></router-view>
  <script type="module" src="/router.bundle.js"></script>
  <script type="module">
    ${componentsScript}
  </script>
  <script type="module">
    ${routerScript}
  </script>
</body>
</html>`;
}

// ---------- tests ----------

Deno.test({
  name: "E2E: push navigates and renders components",
  async fn() {
    const tmp = await Deno.makeTempDir();
    try {
      await Deno.copyFile(
        "dist-e2e/router.bundle.js",
        `${tmp}/router.bundle.js`,
      );

      await Deno.writeTextFile(
        `${tmp}/index.html`,
        indexHtml(
          `
        import { Router } from "/router.bundle.js";

        customElements.whenDefined("router-view").then(() => {
          const router = new Router({
            routes: [
              { path: "", component: "x-home", name: "home" },
              { path: "about", component: "x-about" },
              {
                path: "products/:id",
                name: "product",
                component: "x-product",
                title: "Product :id",
                viewTransitionName: "product-stage",
              },
            ],
          });
          document.querySelector("router-view").router = router;
        });
      `,
          `
        customElements.define("x-home", class extends HTMLElement {
          connectedCallback() { this.textContent = "Home"; }
        });
        customElements.define("x-about", class extends HTMLElement {
          connectedCallback() { this.textContent = "About"; }
        });
        customElements.define("x-product", class extends HTMLElement {
          connectedCallback() { this.textContent = "Product"; }
        });
      `,
        ),
      );

      const server = await startServer(tmp);
      const { browser, page } = await prepareBrowser(server.port);

      // initial page
      await waitForText(page, "x-home", "Home");
      assertEquals(await pathname(page), "/");
      assertEquals(await text(page, "x-home"), "Home");

      // push
      await nav(page, "/products/42");
      await waitForText(page, "x-product", "Product");
      assertEquals(await pathname(page), "/products/42");
      assertEquals(await text(page, "x-product"), "Product");

      // view transition name
      const vtn = await page.evaluate(() => {
        const view = document.querySelector("router-view") as HTMLElement & {
          dataset: DOMStringMap;
        };
        return view?.dataset.viewTransitionName ?? "";
      });
      assertEquals(vtn, "product-stage");

      await browser.close();
      await server.shutdown();
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E: back button returns to previous route",
  async fn() {
    const tmp = await Deno.makeTempDir();
    try {
      await Deno.copyFile(
        "dist-e2e/router.bundle.js",
        `${tmp}/router.bundle.js`,
      );

      await Deno.writeTextFile(
        `${tmp}/index.html`,
        indexHtml(
          `
        import { Router } from "/router.bundle.js";
        customElements.whenDefined("router-view").then(() => {
          const router = new Router({
            routes: [
              { path: "", component: "x-home" },
              { path: "about", component: "x-about" },
              { path: "contact", component: "x-contact" },
            ],
          });
          document.querySelector("router-view").router = router;
        });
      `,
          `
        customElements.define("x-home", class extends HTMLElement {
          connectedCallback() { this.textContent = "Home"; }
        });
        customElements.define("x-about", class extends HTMLElement {
          connectedCallback() { this.textContent = "About"; }
        });
        customElements.define("x-contact", class extends HTMLElement {
          connectedCallback() { this.textContent = "Contact"; }
        });
      `,
        ),
      );

      const server = await startServer(tmp);
      const { browser, page } = await prepareBrowser(server.port);

      await nav(page, "/about");
      await nav(page, "/contact");
      assertEquals(await pathname(page), "/contact");

      await back(page, "/about");
      assertEquals(await pathname(page), "/about");

      await back(page, "/");
      assertEquals(await pathname(page), "/");

      await browser.close();
      await server.shutdown();
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E: slot-based parallel outlet renders sidebar",
  async fn() {
    const tmp = await Deno.makeTempDir();
    try {
      await Deno.copyFile(
        "dist-e2e/router.bundle.js",
        `${tmp}/router.bundle.js`,
      );

      await Deno.writeTextFile(
        `${tmp}/index.html`,
        indexHtml(
          `
        import { Router } from "/router.bundle.js";

        customElements.define("x-layout", class extends HTMLElement {
          connectedCallback() {
            if (this.shadowRoot) return;
            this.attachShadow({ mode: "open" }).innerHTML =
              '<main><slot name="route-child"></slot></main><aside><slot name="sidebar">fallback</slot></aside>';
          }
        });

        customElements.whenDefined("router-view").then(() => {
          const router = new Router({
            routes: [{
              path: "settings",
              component: "x-layout",
              children: [
                { path: "profile", component: () => {
                  const el = document.createElement("section");
                  el.textContent = "Profile";
                  return el;
                }},
                { path: "profile", slot: "sidebar", component: () => {
                  const el = document.createElement("section");
                  el.textContent = "SidebarContent";
                  return el;
                }},
              ],
            }],
          });
          document.querySelector("router-view").router = router;
        });
      `,
          ``,
        ),
      );

      const server = await startServer(tmp);
      const { browser, page } = await prepareBrowser(server.port);

      await nav(page, "/settings/profile");
      await page.waitForFunction(() => {
        const layout = document.querySelector("router-view")?.shadowRoot
          ?.querySelector("x-layout");
        if (!layout?.shadowRoot) return false;
        const slot = layout.shadowRoot.querySelector(
          'slot[name="sidebar"]',
        ) as HTMLSlotElement | null;
        return slot?.assignedElements()?.[0]?.textContent === "SidebarContent";
      }, { timeout: 5_000 });
      const sidebarText = await page.evaluate(() => {
        const layout = document.querySelector("router-view")?.shadowRoot
          ?.querySelector("x-layout");
        if (!layout?.shadowRoot) return "no-shadow";
        const slot = layout.shadowRoot.querySelector(
          'slot[name="sidebar"]',
        ) as HTMLSlotElement;
        return slot?.assignedElements()?.[0]?.textContent ?? "no-assigned";
      });
      assertEquals(sidebarText, "SidebarContent");

      await browser.close();
      await server.shutdown();
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E: 404 fallback renders when URL does not match",
  async fn() {
    const tmp = await Deno.makeTempDir();
    try {
      await Deno.copyFile(
        "dist-e2e/router.bundle.js",
        `${tmp}/router.bundle.js`,
      );

      await Deno.writeTextFile(
        `${tmp}/index.html`,
        indexHtml(
          `
        import { Router } from "/router.bundle.js";
        customElements.whenDefined("router-view").then(() => {
          const router = new Router({
            routes: [{ path: "", component: "x-home" }],
          });
          document.querySelector("router-view").router = router;
        });
      `,
          `
        customElements.define("x-home", class extends HTMLElement {
          connectedCallback() { this.textContent = "Home"; }
        });
      `,
        ),
      );

      const server = await startServer(tmp);
      const { browser, page } = await prepareBrowser(server.port);

      await nav(page, "/missing-page");
      await page.waitForFunction(() => {
        const view = document.querySelector("router-view");
        return Boolean(
          view?.shadowRoot?.querySelector('[data-fallback="404"]')
            ?.textContent?.includes("404"),
        );
      }, { timeout: 5_000 });
      const fallbackText = await page.evaluate(() => {
        const view = document.querySelector("router-view");
        return view?.shadowRoot?.querySelector('[data-fallback="404"]')
          ?.textContent ?? "";
      });
      assertEquals(fallbackText.includes("404"), true);

      await browser.close();
      await server.shutdown();
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
