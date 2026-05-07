import * as esbuild from "npm:esbuild@0.25.8";

const result = await esbuild.build({
  entryPoints: ["src/router.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist-e2e/router.bundle.js",
  platform: "browser",
  external: ["lit", "lit/decorators.js"],
  target: "esnext",
});

if (result.errors.length) {
  console.error("Build failed:", result.errors);
  Deno.exit(1);
}

console.log("E2E bundle built to dist-e2e/router.bundle.js");
