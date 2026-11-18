// Server-side Umami events for requests the page script never sees: share images and
// badges fetched by link previewers and GitHub, the JSON API, and AI assistants reading pages.
// Set ANALYTICS=off to disable.

const UMAMI_URL = "https://gateway.umami.is/api/send";
const UMAMI_WEBSITE_ID = "60cd07b4-eb37-4b84-882a-d50f28544bd1";
// Umami drops bot user agents, and most of these requests come from bots, so send as a browser
// and record who actually asked in the event data
const SENDER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// [user agent token, who, kind]. "answer" fetches happen while an assistant answers someone's question.
const AI_AGENTS = [
  ["ChatGPT-User", "chatgpt", "answer"],
  ["Claude-User", "claude", "answer"],
  ["Perplexity-User", "perplexity", "answer"],
  ["MistralAI-User", "mistral", "answer"],
  ["OAI-SearchBot", "chatgpt", "search"],
  ["Claude-SearchBot", "claude", "search"],
  ["PerplexityBot", "perplexity", "search"],
  ["DuckAssistBot", "duckduckgo", "search"],
  ["GPTBot", "openai", "training"],
  ["ClaudeBot", "anthropic", "training"],
  ["meta-externalagent", "meta", "training"],
  ["Amazonbot", "amazon", "training"],
  ["Bytespider", "bytedance", "training"],
  ["CCBot", "common crawl", "training"],
];

// Link previewers and image proxies; order matters (iMessage also claims to be Facebook and Twitter)
const PREVIEWERS = [
  [/Facebot Twitterbot/, "imessage"],
  [/Twitterbot/, "x"],
  [/facebookexternalhit|Facebot/, "facebook"],
  [/Slackbot|Slack-ImgProxy/, "slack"],
  [/Discordbot/, "discord"],
  [/LinkedInBot/, "linkedin"],
  [/TelegramBot/, "telegram"],
  [/WhatsApp/, "whatsapp"],
  [/redditbot/, "reddit"],
  [/Cardyb/, "bluesky"],
  [/Mastodon/, "mastodon"],
  [/github-camo/, "github"],
  [/SkypeUriPreview|Teams/, "teams"],
  [/Googlebot|Google-InspectionTool/, "google"],
  [/bingbot/, "bing"],
];

export function aiAgent(ua) {
  const hit = AI_AGENTS.find(([token]) => ua.includes(token));
  return hit ? { bot: hit[1], kind: hit[2] } : null;
}

// Who fetched it, in one word
export function via(ua) {
  const preview = PREVIEWERS.find(([re]) => re.test(ua));
  if (preview) return preview[1];
  const ai = aiAgent(ua);
  if (ai) return ai.bot;
  return /bot|crawl|spider|fetch|curl|python|go-http/i.test(ua) ? "other bot" : "browser";
}

// The event for a successful GET, or null if the page script already counts it
export function serverEvent(pathname, ua) {
  const card = /^\/card\/(today|\d{4}-\d{2}-\d{2})\.png$/.exec(pathname);
  if (card) return { name: "card image", data: { card: card[1] === "today" ? "today" : "day", via: via(ua) } };
  if (pathname === "/badge.svg") return { name: "badge", data: { via: via(ua) } };
  if (pathname === "/llms.txt" || pathname.startsWith("/api/day/") || pathname === "/api/today.json") {
    return { name: "api", data: { path: pathname.startsWith("/api/day/") ? "/api/day" : pathname, via: via(ua) } };
  }
  const ai = aiAgent(ua);
  if (ai && !pathname.startsWith("/assets/") && !pathname.startsWith("/api/")) {
    return { name: "ai fetch", data: { ...ai, path: pathname } };
  }
  return null;
}

export function track(request, status, host) {
  if (process.env.ANALYTICS === "off" || request.method !== "GET" || status >= 400) return;
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  const event = serverEvent(url.pathname, ua);
  if (!event) return;
  fetch(UMAMI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": SENDER_UA },
    body: JSON.stringify({
      type: "event",
      payload: {
        website: UMAMI_WEBSITE_ID,
        hostname: host,
        url: url.pathname,
        referrer: request.headers.get("referer") || "",
        language: "",
        screen: "",
        title: "",
        name: event.name,
        data: event.data,
      },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
