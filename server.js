import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "srvx";
import { track } from "./analytics.js";

const { default: app } = await import("./dist/server/ssr.js");

const port = parseInt(process.env.PORT || "3000");

// www and apex both resolve here; send www to the apex so search engines see one site
const CANONICAL_HOST = process.env.CANONICAL_HOST || "istheinternetdying.com";

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/;

function compress(request, response) {
  const type = response.headers.get("content-type") || "";
  if (
    !response.body ||
    response.headers.has("content-encoding") ||
    !COMPRESSIBLE.test(type) ||
    !/\bgzip\b/.test(request.headers.get("accept-encoding") || "")
  ) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  headers.append("vary", "Accept-Encoding");
  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const MIME_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

serve({
  port,
  async fetch(request) {
    const response = await handle(request);
    track(request, response.status, CANONICAL_HOST);
    return compress(request, response);
  },
});

async function handle(request) {
  const url = new URL(request.url);

  const host = (request.headers.get("host") || "").split(":")[0];
  if (host === `www.${CANONICAL_HOST}`) {
    return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301);
  }

  // Serve static files from public/
  const PUBLIC_FILES = {
    "/favicon.ico": { type: "image/x-icon", cache: "public, max-age=86400" },
    "/og.png": { type: "image/png", cache: "public, max-age=86400" },
    "/apple-touch-icon.png": { type: "image/png", cache: "public, max-age=86400" },
    "/robots.txt": { type: "text/plain", cache: "public, max-age=86400" },
  };

  if (PUBLIC_FILES[url.pathname]) {
    try {
      const { type, cache } = PUBLIC_FILES[url.pathname];
      const content = await readFile(join("public", url.pathname.slice(1)));
      return new Response(content, {
        headers: { "Content-Type": type, "Cache-Control": cache },
      });
    } catch {
      // Fall through
    }
  }

  // Serve static client assets from dist/client/
  if (url.pathname.startsWith("/assets/")) {
    try {
      const filePath = join("dist", "client", url.pathname);
      const content = await readFile(filePath);
      const ext = url.pathname.slice(url.pathname.lastIndexOf("."));
      return new Response(content, {
        headers: {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Fall through to app handler
    }
  }

  return app.fetch(request);
}

console.log(`Server listening on http://0.0.0.0:${port}`);
