import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "srvx";

const { default: app } = await import("./dist/server/ssr.js");

const port = parseInt(process.env.PORT || "3000");

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
    const url = new URL(request.url);

    // Serve static files from public/
    const PUBLIC_FILES = {
      "/favicon.ico": { type: "image/x-icon", cache: "public, max-age=86400" },
      "/robots.txt": { type: "text/plain", cache: "public, max-age=86400" },
      "/sitemap.xml": { type: "application/xml", cache: "public, max-age=86400" },
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
  },
});

console.log(`Server listening on http://0.0.0.0:${port}`);
