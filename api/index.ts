// Vercel serverless function entry point (mapped via vercel.json rewrites).
//
// IMPORTANT: We intentionally do NOT import the raw "../server" (server.ts) here.
// With "type": "module" in package.json, Vercel's Node.js function builder does not
// reliably bundle relative TypeScript imports that live outside of /api, which causes:
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server'
// at runtime, crashing every single API request.
//
// Instead, we import the already-bundled, dependency-resolved build that the
// project's own `build` script produces via esbuild:
//   "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs
//             --packages=external --sourcemap --outfile=dist/server.cjs"
// dist/server.cjs is a single self-contained CommonJS file with no unresolved
// relative imports, so Vercel's function tracing has nothing to fail to resolve.
//
// @ts-ignore - dist/server.cjs has no type declarations; that's fine, we only need the runtime value.
import app from "../dist/server.cjs";

export default app;
