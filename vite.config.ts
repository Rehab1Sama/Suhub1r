// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside the Lovable sandbox the deploy plugin defaults to a Cloudflare Worker
// bundle. On Vercel that output is never served, which renders a blank page.
// When Vercel builds the app (VERCEL=1), target Nitro's Vercel preset instead.
// Inside Lovable the sandbox build keeps its own Cloudflare output untouched.
const isVercel = !!process.env["VERCEL"];

export default defineConfig({
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel" as const,
          vercel: {
            functions: { runtime: "nodejs22.x" as const },
          },
        },
      }
    : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
