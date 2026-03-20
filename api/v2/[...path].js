/**
 * Vercel serverless function: proxy for /api/v2/*
 *
 * The backend at app.epsilonengg.in rejects requests that include an
 * Origin or Referer header (returns 502). Browsers always send Origin on
 * fetch() calls, so we need a server-side proxy that strips those headers
 * before forwarding to the backend.
 */

const BACKEND_BASE = "https://app.epsilonengg.in/api/v2";

// Headers from the client that must NOT be forwarded to the backend
const BLOCKED_REQUEST_HEADERS = new Set([
  "origin",
  "referer",
  "host",
  "connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-vercel-deployment-url",
  "x-vercel-id",
  "x-vercel-ip-city",
  "x-vercel-ip-country",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude",
]);

export default async function handler(req, res) {
  const { path = [] } = req.query;
  const pathStr = Array.isArray(path) ? path.join("/") : path;

  // Build the URL – preserve all query params except `path`
  const params = new URLSearchParams(req.query);
  params.delete("path");
  const targetUrl = `${BACKEND_BASE}/${pathStr}${params.toString() ? `?${params.toString()}` : ""}`;

  // Build forwarded headers, stripping the blocked ones
  const forwardedHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders[key] = value;
    }
  }

  try {
    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardedHeaders,
      // Only attach a body for methods that support one
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    });

    const contentType = backendRes.headers.get("content-type") ?? "application/json";
    const body = await backendRes.text();

    res.status(backendRes.status);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(body);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: String(err) } });
  }
}
