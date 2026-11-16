import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../styles/visual-refresh.css", import.meta.url), "utf8");
const manifest = await readFile(new URL("../style.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + .05) / (darker + .05);
}

test("entrada dos três perfis tem a mesma paleta com contraste AA", () => {
  const palette = Object.fromEntries([...css.matchAll(/--(login-accent|auth-ink|auth-white):\s*(#[\da-f]{3,6})/gi)]
    .map(([, key, value]) => [key, value]));
  assert.ok(contrast(palette["login-accent"], palette["auth-white"]) >= 4.5);
  assert.ok(contrast(palette["auth-ink"], palette["auth-white"]) >= 4.5);
  assert.match(css, /body\.teacher-login \.login-screen,[\s\S]*body\.admin-login \.login-screen\s*\{/);
  assert.ok(manifest.indexOf("styles/visual-refresh.css") > manifest.indexOf("styles/polish.css"));
  assert.match(html, /style\.css\?v=14\.7\.4/);
});

test("cartões e controles continuam legíveis em telas pequenas e com menos movimento", () => {
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /min-height: 48px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.app-shell \.subnav button:focus-visible/);
  assert.match(css, /\.login-screen \[hidden\] \{ display: none !important; \}/);
});
