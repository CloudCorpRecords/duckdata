# BUILD REPORT — duckdata

Rebuild of `com.hasdata/duckduckgo` v1.0.7 (remote-only, keyless capture)
as `@reneturcios/duckdata` 0.1.0 / `io.github.CloudCorpRecords/duckdata`.

## Fixture conflicts

**None.** The brief, the spec prose, and the fixture agree on the single
tool name and its surface. Required fields as served, taken from the
fixture (`harness/fixtures/hasdata-duckduckgo-tools-original.json`):

- `hasdata_duckduckgo_serp_getSearchResults` — required: (none — the
  capture carries no `required` array on this tool; the inputSchema is
  served verbatim and no required field was invented)

The fixture's tool literal (name, title, description, inputSchema —
including the `title` key, every property description and enum, the
trailing newline in the `nextPageToken` description,
`additionalProperties: false`, and the `$schema` key) is served verbatim
from `src/forward.ts`; the literal was generated programmatically by
parsing the fixture JSON and re-serialising it (no retyping). This was
verified by the registration-integrity test (served tools/list
deep-equals the fixture's 1 tool object) and again by the parity harness.

## What was built

All 19 factory files under `builds/duckdata/`:

- `package.json` (`@reneturcios/duckdata` 0.1.0, bin
  `duckdata` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 90-char string
  "DuckDuckGo search results as JSON: ranked results with ads in their own array, 37 regions.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/duckdata:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/duckdata"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/duckdata`, smoke assertion on server name
  `duckdata`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://mcp.hasdata.com/mcp?apis=duckduckgo`
  (pinned; the query string is part of the pinned URL), overridable via
  `HASDATA_DUCKDUCKGO_MCP_URL` (labelled reconstruction). tools/call is
  forwarded as a streamable-HTTP JSON-RPC client: initialize
  (protocolVersion `2025-03-26`, clientInfo `duckdata`) →
  notifications/initialized → tools/call, honouring `Mcp-Session-Id`
  when issued; session established lazily and reused per client.
  Plain-JSON and SSE replies both parsed; the matching-id message
  wins; upstream results pass through verbatim (including `isError`
  and extra fields such as `structuredContent`).
- When `HASDATA_API_KEY` is set, an `x-api-key: <value>` header is
  sent on every upstream request (header name pinned by the registry
  record's remote declaration; forwarding it from this env var is a
  labelled reconstruction — the capture was keyless). When unset, no
  key header is sent. No `Authorization` header is sent in either
  case. Both branches are covered by tests.
- Upstream failures (JSON-RPC error, non-2xx status, malformed body,
  throwing/timing-out fetch) surface as `duckdata error:` text
  results (labelled reconstruction).
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers) serving
  the fixture literal exactly; no `McpServer` + zod registration.
  `src/mcp.ts` also exports `createServer` / `startMcpServer` /
  `handleCallTool` so the MCP layer is testable without a transport;
  the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed anywhere. The captured surface is one
  read-only search fetch; no write, messaging, or payment tool exists
  in the surface — none was added.

## Lockfile (Route 3, clean)

Generated in the build dir with no `node_modules` present:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/duckdata`,
**128 package entries**. Then `npm install --ignore-scripts --offline`
in the build dir for `node_modules`.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js, forward.js, mcp.js, index.js,
  types.js, all non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`
- `npm test` → **44 tests, 44 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's 1 tool object, name
  in order, exactly the fixture's keys, no `required` array, every
  property key in order, enums verbatim (kl 37, cc 36, setLang 33);
  session establishment/reuse/session-id handling; env and explicit
  URL overrides; x-api-key header present on every request when the key
  is set / absent when unset / no Authorization header in either case;
  verbatim argument forwarding; verbatim result pass-through incl.
  upstream isError and SSE; JSON-RPC/init/malformed/HTTP/throw/timeout
  failures → `duckdata error:`; parseRpcBody JSON + SSE cases;
  MCP-layer validation — unknown tool → MethodNotFound, non-object
  args → InvalidParams; CLI --version / -v / unknown exit 2 /
  bad-JSON exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/hasdata-duckduckgo-tools-original.json --rebuild
  "stdio:node builds/duckdata/dist/cli.js mcp" --out
  builds/duckdata/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 1/1 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 90 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for duckdata; only the
mechanics were patterned on the sibling staydata build, and only the
fixture's tool literal is served verbatim.
