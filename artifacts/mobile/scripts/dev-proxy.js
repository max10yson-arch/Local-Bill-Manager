#!/usr/bin/env node
/**
 * Dev proxy for Expo on Replit.
 *
 * Problem: Expo CLI's CORS middleware rejects requests that arrive from
 * https://<repl>.sisko.replit.dev (the standard Replit preview domain)
 * because it only permits its own configured proxy URL origin.
 *
 * Solution:
 *  1. Start Metro / Expo dev-server on an internal port (METRO_PORT).
 *  2. Start a lightweight HTTP proxy on $PORT (the port Replit exposes).
 *     The proxy adds permissive CORS headers and forwards every request
 *     verbatim to Metro, including WebSocket upgrades for HMR.
 */

"use strict";

const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

const METRO_PORT = 19001;
const PORT = parseInt(process.env.PORT || "18115", 10);

// ── Inherit all env vars but point Metro at the internal port ─────────────────

const metroEnv = {
  ...process.env,
  CI: "1",
  PORT: String(METRO_PORT),
};

// ── Launch Metro ──────────────────────────────────────────────────────────────

const metroParts = [
  "exec",
  "expo",
  "start",
  "--localhost",
  "--port",
  String(METRO_PORT),
];

console.log("Starting Metro on internal port", METRO_PORT, "...");

const metro = spawn("pnpm", metroParts, {
  env: metroEnv,
  stdio: "inherit",
  cwd: process.cwd(),
});

metro.on("exit", (code) => process.exit(code || 0));

["exit", "SIGTERM", "SIGINT"].forEach((sig) => {
  process.on(sig, () => {
    try { metro.kill(); } catch (_) {}
    process.exit(0);
  });
});

// ── Wait for Metro to open its port ──────────────────────────────────────────

function waitForPort(port, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      if (Date.now() > deadline) return reject(new Error(`Timeout waiting for Metro on :${port}`));
      const s = net.createConnection({ port, host: "127.0.0.1" });
      s.once("connect", () => { s.destroy(); resolve(); });
      s.once("error", () => { s.destroy(); setTimeout(attempt, 1000); });
      s.once("timeout", () => { s.destroy(); setTimeout(attempt, 1000); });
      s.setTimeout(1000);
    };
    attempt();
  });
}

// ── HTTP proxy ────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers":
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, expo-platform, expo-channel-name",
  };
}

function createProxy() {
  const server = http.createServer((req, res) => {
    // Pre-flight
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // Strip the Origin header so Expo CLI's CORS middleware doesn't reject us.
    // We're a server-side proxy so origin checks are irrelevant here.
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders["origin"];
    delete forwardHeaders["referer"];

    const options = {
      host: "127.0.0.1",
      port: METRO_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...forwardHeaders,
        host: `localhost:${METRO_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const outHeaders = { ...proxyRes.headers, ...corsHeaders() };
      res.writeHead(proxyRes.statusCode, outHeaders);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, corsHeaders());
        res.end("Proxy error: " + err.message);
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  // WebSocket tunnel for Metro HMR
  server.on("upgrade", (req, clientSocket, head) => {
    const serverSocket = net.createConnection(METRO_PORT, "127.0.0.1", () => {
      const headerLines = Object.entries({
        ...req.headers,
        host: `localhost:${METRO_PORT}`,
      })
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");

      serverSocket.write(
        `${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`,
      );
      if (head && head.length) serverSocket.write(head);
    });

    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);

    clientSocket.on("error", () => serverSocket.destroy());
    serverSocket.on("error", () => clientSocket.destroy());
  });

  server.listen(PORT, () => {
    console.log(`CORS proxy running on :${PORT}  →  Metro on :${METRO_PORT}`);
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

waitForPort(METRO_PORT)
  .then(createProxy)
  .catch((err) => {
    console.error(err.message);
    metro.kill();
    process.exit(1);
  });
