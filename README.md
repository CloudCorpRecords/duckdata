# duckdata

duckdata is a small local bridge to the hosted HasData
DuckDuckGo MCP server, which returns DuckDuckGo search
results as JSON. Ask for a query and it comes back as
ranked organic results — title, URL, snippet, displayed
URL, position, date, sitelinks and video metadata —
with the ads kept in their own separate array, plus the
Search Assist AI answer when the upstream supplies one.

The bridge holds no results of its own. It serves the
upstream server's tool list locally, exactly as captured
from the live endpoint, and forwards each tool call
upstream, returning the result untouched. The captured
surface is a single read-only search fetch. There is no
write, messaging, or payment tool in it.

## Tools

- `hasdata_duckduckgo_serp_getSearchResults` — fetch a
  DuckDuckGo SERP. The captured schema carries no
  `required` array: `q` is the search term (required
  unless `nextPageToken` is provided, which carries the
  query it continues). Target a region with `kl` (a
  `<country>-<language>` code such as `us-en` or
  `de-de`, across 37 regions), or combine `cc` with
  `setLang` instead — `kl` takes precedence. Filter
  adult content with `safeSearch` (`off`, `moderate`,
  or `strict`), pick a form factor with `deviceType`
  (`desktop`, `mobile`, or `tablet`), and page with the
  opaque `nextPageToken` returned by the previous
  response.

## Configuration

- `HASDATA_DUCKDUCKGO_MCP_URL` (optional) — override
  the upstream endpoint. Defaults to
  `https://mcp.hasdata.com/mcp?apis=duckduckgo`. (The
  override hook is this rebuild's own labelled
  reconstruction.)
- `HASDATA_API_KEY` (optional) — when set, every
  upstream request carries an `x-api-key: <key>`
  header, for the caller's own HasData API key. When
  it is not set, no key header is sent. (The header
  name and the env name are pinned by the original's
  registry record; forwarding the key from this env
  var is a labelled reconstruction — the original
  surface was captured keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session with the upstream: a JSON-RPC
`initialize` request (protocolVersion `2025-03-26`,
clientInfo name `duckdata`), then a
`notifications/initialized` notification, then the
`tools/call` request carrying the caller's arguments
unchanged. When the upstream answers `initialize`
with an `Mcp-Session-Id` header, that value rides on
every later request of the session, which is reused
for the life of the process. Replies may arrive as
plain JSON or as server-sent events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `duckdata error:` (this rendering
is this rebuild's own labelled reconstruction).

## CLI

The tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/duckdata hasdata_duckduckgo_serp_getSearchResults '{"q":"open source search","kl":"us-en","safeSearch":"moderate","deviceType":"desktop"}'
npx @reneturcios/duckdata --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/duckdata mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "duckdata": {
      "command": "npx",
      "args": ["-y", "@reneturcios/duckdata", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/duckdata
docker run --rm ghcr.io/cloudcorprecords/duckdata --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
