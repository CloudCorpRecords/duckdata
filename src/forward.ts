/**
 * duckdata core: a forwarding client for the hosted
 * HasData DuckDuckGo MCP server.
 *
 * No search is run locally. tools/list is answered from
 * the literal tool definition below, taken verbatim from
 * a live capture of the upstream server (name, title,
 * description and inputSchema exactly as captured,
 * including the title key the tool carries and the
 * absence of any required array). A tools/call is
 * forwarded over a streamable-HTTP JSON-RPC session: an
 * initialize POST, a notifications/initialized POST, then
 * the tools/call POST, honouring the Mcp-Session-Id
 * response header when the upstream issues one. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client.
 *
 * The upstream endpoint is pinned to
 * https://mcp.hasdata.com/mcp?apis=duckduckgo — the query
 * string is part of the pinned URL — and can be
 * overridden with the HASDATA_DUCKDUCKGO_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). When HASDATA_API_KEY is set in the
 * environment, every upstream request carries an
 * `x-api-key: <key>` header (the header name is pinned
 * by the registry record's remote declaration; forwarding
 * the key from this env var is a labelled reconstruction
 * — the capture itself was taken keyless). When the
 * variable is unset, no key header is sent, and no
 * Authorization header is sent in either case.
 *
 * Upstream results pass through verbatim, including any
 * isError flag and any extra result fields. Failures — a
 * JSON-RPC error from the upstream, a non-2xx status, an
 * unparseable response, or a fetch that throws or times
 * out — surface as an isError result whose text starts
 * with `duckdata error:` (that rendering is a labelled
 * reconstruction). Responses may be plain JSON or SSE
 * (data: lines); the JSON-RPC message with the matching
 * id wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://mcp.hasdata.com/mcp?apis=duckduckgo";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/hasdata-duckduckgo-tools-original.json) */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "hasdata_duckduckgo_serp_getSearchResults",
    "title": "duckduckgo_serp: GET /",
    "description": "Get DuckDuckGo Search Results\n\nFetches DuckDuckGo SERPs for a query with region targeting (kl, or cc+setLang), safesearch (off/moderate/strict), device type, and token-based pagination. Returns organic results (title, url, snippet, displayed url, position, date, sitelinks, video metadata), ads, and the Search Assist AI answer. Use for SEO rank tracking, SERP feature monitoring, DuckDuckGo-specific visibility audits, and training/eval data for search agents.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "q": {
          "type": "string",
          "description": "Specify the search term for which you want to scrape the SERP. Required unless `nextPageToken` is provided (which carries the query of the page it continues)."
        },
        "kl": {
          "type": "string",
          "enum": [
            "ar-es",
            "au-en",
            "at-de",
            "be-nl",
            "be-fr",
            "br-pt",
            "ca-en",
            "ca-fr",
            "cl-es",
            "dk-da",
            "fi-fi",
            "fr-fr",
            "de-de",
            "hk-tzh",
            "in-en",
            "id-en",
            "it-it",
            "jp-jp",
            "kr-kr",
            "my-en",
            "mx-es",
            "nl-nl",
            "nz-en",
            "no-no",
            "cn-zh",
            "pl-pl",
            "ph-en",
            "ru-ru",
            "za-en",
            "es-es",
            "se-sv",
            "ch-de",
            "tw-tzh",
            "tr-tr",
            "uk-en",
            "us-en",
            "wt-wt"
          ],
          "description": "DuckDuckGo region code in `<country>-<language>` form (e.g. `us-en`, `de-de`). Sets country and interface language at once; takes precedence over `cc`/`setLang`. Use `wt-wt` for no region."
        },
        "cc": {
          "type": "string",
          "enum": [
            "ar",
            "au",
            "at",
            "be",
            "br",
            "ca",
            "cl",
            "dk",
            "fi",
            "fr",
            "de",
            "hk",
            "in",
            "id",
            "it",
            "jp",
            "kr",
            "my",
            "mx",
            "nl",
            "nz",
            "no",
            "cn",
            "pl",
            "pt",
            "ph",
            "ru",
            "sa",
            "za",
            "es",
            "se",
            "ch",
            "tw",
            "tr",
            "gb",
            "us"
          ],
          "description": "The two-letter country code for the country to search from. Combined with `setLang` to form the DuckDuckGo region. Ignored if `kl` is set."
        },
        "setLang": {
          "type": "string",
          "enum": [
            "ar",
            "ca",
            "zh-hans",
            "zh-hant",
            "hr",
            "cs",
            "da",
            "nl",
            "en",
            "et",
            "fi",
            "fr",
            "de",
            "he",
            "hu",
            "it",
            "ja",
            "ko",
            "lv",
            "lt",
            "nb",
            "pl",
            "pt",
            "ro",
            "ru",
            "sk",
            "sl",
            "es",
            "sv",
            "th",
            "tr",
            "uk",
            "vi"
          ],
          "description": "The preferred result/interface language code — usually two letters (e.g. `en`, `de`), with script-tag variants for some languages (e.g. `zh-hans`, `zh-hant`). Combined with `cc` to form the DuckDuckGo region. Ignored if `kl` is set."
        },
        "safeSearch": {
          "type": "string",
          "enum": [
            "off",
            "moderate",
            "strict"
          ],
          "description": "Adult Content Filtering option."
        },
        "deviceType": {
          "type": "string",
          "enum": [
            "desktop",
            "mobile",
            "tablet"
          ],
          "description": "Specify the device type for the search."
        },
        "nextPageToken": {
          "type": "string",
          "description": "Opaque token returned in each response as `nextPageToken`. Pass it back (in place of `q`) to fetch the next page of results. It carries a pre-signed page URL bound to the original request's session, so it must be used as-is and cannot be constructed manually. Absent when there are no further pages.\n"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` is one of the captured tools. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `duckdata error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Parse a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * one is present, else the last parseable message, else
 * null when nothing parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not JSON; ignore this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding one upstream session. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client (the
 * process lifetime when the client is the MCP server's
 * or a one-shot client for the CLI).
 */
export class DuckdataClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HASDATA_DUCKDUCKGO_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HASDATA_API_KEY;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["x-api-key"] = key;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "duckdata", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // The notification response body carries nothing we need.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Pass the upstream result through verbatim.
    return result;
  }
}

/** Create a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): DuckdataClient {
  return new DuckdataClient(deps);
}

/** One-shot helper: a fresh client per call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new DuckdataClient(deps).callTool(name, args);
}
