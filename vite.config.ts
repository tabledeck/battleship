import path from "node:path";
import type { Plugin } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { RouterContextProvider } from "react-router";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import babel from "vite-plugin-babel";

export default defineConfig((config) => {
  const isServe = config.command === "serve";

  // Prisma's generated client imports `*.wasm?module` (Workers syntax).
  // Production builds leave that import external so Wrangler compiles it.
  // Vite dev SSR runs in Node and cannot load `?module`, and a relative
  // external id resolved to a doubled `app/app/db/...` path — so in dev we
  // compile the bytes into a WebAssembly.Module.
  const cloudflareWasmModule: Plugin = {
    name: "cloudflare-wasm-module",
    enforce: "pre",
    resolveId(id) {
      if (!id.includes("query_compiler_fast_bg.wasm") || !id.includes("?module")) return;
      if (!isServe) {
        return {
          id: "../../app/db/internal/query_compiler_fast_bg.wasm?module",
          external: true,
        };
      }
      return "\0prisma-query-compiler-wasm";
    },
    load(id) {
      if (!isServe || id !== "\0prisma-query-compiler-wasm") return null;
      const file = path.resolve(process.cwd(), "app/db/internal/query_compiler_fast_bg.wasm");
      return `
        import { readFileSync } from "node:fs";
        const bytes = readFileSync(${JSON.stringify(file)});
        export default new WebAssembly.Module(bytes);
      `;
    },
  };

  const env = loadEnv(config.mode, process.cwd(), "");

  return {
    resolve: {
      alias:
        config.mode === "development"
          ? {
              "~/db.server": path.resolve(
                process.cwd(),
                "app/db.local.server.ts",
              ),
            }
          : undefined,
    },
    ssr: {
      resolve: {
        conditions: ["workerd", "browser"],
        externalConditions: ["workerd", "browser"],
      },
    },
    server: {
      port: 3002,
    },
    plugins: [
      // Local DOs + D1. Must be registered before the React Router plugin.
      // Mirrors production workers/app.ts, which hangs env off a RouterContextProvider.
      cloudflareDevProxy({
        getLoadContext({ context }) {
          const loadContext = new RouterContextProvider();
          (loadContext as { cloudflare?: unknown }).cloudflare = context.cloudflare;
          return loadContext;
        },
      }),
      cloudflareWasmModule,
      tailwindcss(),
      reactRouter(),
      tsconfigPaths(),
      devtoolsJson(),
      babel({
        filter: /app\/.*\.[jt]sx?$/,
        babelConfig: {
          presets: ["@babel/preset-typescript"],
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
    ],
  };
});
