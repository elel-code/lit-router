import * as esbuild from "npm:esbuild@0.25.8";

const routerEntry = Deno.env.get("E2E_ROUTER_ENTRY")?.trim();

const result = await esbuild.build({
  ...(routerEntry
    ? {
      stdin: {
        contents: `export * from ${JSON.stringify(routerEntry)};`,
        loader: "ts",
        resolveDir: Deno.cwd(),
        sourcefile: "e2e-router-entry.ts",
      },
    }
    : { entryPoints: ["src/router.ts"] }),
  bundle: true,
  format: "esm",
  outfile: "dist-e2e/router.bundle.js",
  platform: "browser",
  target: "es2022",
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: false,
    },
  },
});

if (result.errors.length) {
  console.error("Build failed:", result.errors);
  Deno.exit(1);
}

console.log("E2E bundle built to dist-e2e/router.bundle.js");
