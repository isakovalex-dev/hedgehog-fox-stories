const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile, readdir } = require("node:fs/promises");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");

async function readProjectFile(path) {
  return readFile(resolve(root, path), "utf8");
}

test("every static HTML route keeps executable scripts external for the global CSP", async () => {
  const staticHtmlFiles = (await readdir(root)).filter((file) => file.endsWith(".html"));
  assert.ok(staticHtmlFiles.length > 0, "project must contain static HTML pages");

  for (const file of staticHtmlFiles) {
    const html = await readProjectFile(file);
    const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1].trim())
      .filter(Boolean);

    assert.deepEqual(inlineScripts, [], `${file} must not contain executable inline scripts`);
  }
});

test("initial deployment sends exact report-only CSP and browser security headers", async () => {
  const config = JSON.parse(await readProjectFile("vercel.json"));
  const globalHeaders = config.headers?.find((rule) => rule.source === "/(.*)")?.headers;
  assert.ok(globalHeaders, "vercel.json must configure headers for every route");

  const headers = Object.fromEntries(globalHeaders.map(({ key, value }) => [key, value]));
  assert.equal(headers["Strict-Transport-Security"], "max-age=63072000; includeSubDomains; preload");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=(), payment=()");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Content-Security-Policy"], undefined, "CSP must remain report-only during observation");

  const csp = headers["Content-Security-Policy-Report-Only"];
  assert.equal(
    csp,
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://ynidvdesfolavhngubqv.supabase.co https://opcnhhujyckmccvvpihc.supabase.co; connect-src 'self' https://ynidvdesfolavhngubqv.supabase.co https://opcnhhujyckmccvvpihc.supabase.co https://va.vercel-scripts.com; upgrade-insecure-requests"
  );
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /\*\.supabase\.co|https:\/\/\*\.supabase\.co/);
  assert.match(csp, /https:\/\/ynidvdesfolavhngubqv\.supabase\.co/);
  assert.match(csp, /https:\/\/opcnhhujyckmccvvpihc\.supabase\.co/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
});

test("landing page loads the analytics bootstrap externally", async () => {
  const html = await readProjectFile("index.html");
  const bootstrap = await readProjectFile("js/vercel-analytics.js");

  assert.match(html, /<script defer src="js\/vercel-analytics\.js\?v=1"><\/script>/);
  assert.match(html, /<script defer src="\/_vercel\/insights\/script\.js"><\/script>/);
  assert.doesNotMatch(html, /window\.va\s*=/);
  assert.equal(
    bootstrap,
    "(function (window) {\n  \"use strict\";\n\n  window.va = window.va || function () {\n    (window.vaq = window.vaq || []).push(arguments);\n  };\n})(window);\n"
  );
});

test("operations runbook defines the 48-hour report-only observation gate", async () => {
  const operations = await readProjectFile("docs/supabase-operations.md");
  assert.match(operations, /48 hours/i);
  assert.match(operations, /Content-Security-Policy-Report-Only/);
  assert.match(operations, /Content-Security-Policy/);
  assert.match(operations, /non-production/i);
});

test("404 redirect and analytics scripts stay reachable from a nested missing URL", async () => {
  const html = await readProjectFile("404.html");
  await readProjectFile("js/notFoundRedirect.js");
  await readProjectFile("js/vercelAnalytics.js");
  const scripts = [...html.matchAll(/<script(?:\s+defer)?\s+src="([^"]+)"><\/script>/g)].map((match) => match[1]);

  assert.ok(scripts.includes("/js/notFoundRedirect.js"));
  assert.ok(scripts.includes("/js/vercelAnalytics.js"));

  for (const script of ["/js/notFoundRedirect.js", "/js/vercelAnalytics.js"]) {
    assert.equal(
      new URL(script, "https://ezhik-i-lisenok.ru/missing/path").pathname,
      script,
      `${script} must not resolve beneath the unknown nested path`
    );
  }
});
