import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("logo oficial do CODA é carregável como arquivo estático", async () => {
  const root = new URL("../", import.meta.url);
  const [server, html, logo] = await Promise.all([
    readFile(new URL("server.mjs", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/coda-logo.webp", root))
  ]);

  // O servidor usa uma allowlist restrita: a imagem precisa constar nela.
  assert.match(server, /publicFiles = new Set\(\["assets\/coda-logo\.webp"/);
  assert.match(server, /"\.webp": "image\/webp"/);

  assert.equal(logo.toString("ascii", 0, 4), "RIFF");
  assert.equal(logo.toString("ascii", 8, 12), "WEBP");
  assert.equal((html.match(/src="assets\/coda-logo\.webp"/g) || []).length, 3);
});
