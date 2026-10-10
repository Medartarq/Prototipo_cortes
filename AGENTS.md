# Indesaco Agent Notes

## Commands

- Requires Node.js 20+; there are no npm dependencies, so do not run `npm install`.
- Run all automated checks with `npm test`; run one suite with `node --test tests/core.test.mjs` or `node --test tests/quote.test.mjs`.
- Build the deployable static site with `npm run build`. It regenerates ignored `dist/`; do not edit files there.
- Use `npm start` for local development at `http://127.0.0.1:4173`. Do not open `index.html` directly: ES modules, assets, and the optimizer Web Worker require HTTP.

## Structure

- This is a static browser application. `app.mjs` wires the UI and imports the domain modules; `core.mjs` owns CSV/project validation; `optimizer*.mjs` implements and verifies cutting plans; `exports.mjs` creates downloadable reports; `quote.mjs` and `hardware.mjs` provide cost estimation.
- The optimizer runs in the browser through `optimizer-worker.mjs`; preserve worker-safe module imports and validate layout changes with the exported optimizer validation flow.
- `assets/ejemplo.csv` is a test fixture used by both test suites. `vendor/` contains checked-in browser libraries and their licenses.

## Build And Deployment

- `build.mjs` copies an explicit allowlist of root files plus `assets/` and `vendor/`. When adding, removing, or renaming a browser-loaded root module, update that allowlist or it will not reach `dist/`.
- Cloudflare Pages deploys `dist/`; `_headers` is part of the static output. The local `server.mjs` and `tests/` are not deployed.
