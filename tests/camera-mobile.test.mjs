import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../", import.meta.url);
const read = name => readFile(new URL(name, base), "utf8");
const [server, ar, html, css] = await Promise.all([
  read("server.mjs"), read("js/esp32-ar.js"), read("index.html"), read("components/esp32-webgl.css")
]);

test("servidor autoriza câmera apenas na própria origem e bloqueia microfone", () => {
  assert.match(server, /Permissions-Policy", "camera=\(self\), microphone=\(\), geolocation=\(\)"/);
  assert.doesNotMatch(server, /Permissions-Policy", "camera=\(\)/);
});

test("RA no celular usa a câmera real diretamente com vídeo e 3D", () => {
  const handler = ar.match(/async function enterMobileAR\(\)\{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(handler, /openCameraFallback\(\)/);
  assert.doesNotMatch(handler, /enterAR\(/);
  assert.match(ar, /mediaDevices\.getUserMedia/);
  assert.match(ar, /video\.srcObject=stream/);
  assert.match(ar, /await video\.play\(\)/);
  assert.match(ar, /CodaESP3D\?\.createOverlay/);
  assert.match(html, /<video id="mobileARVideo" autoplay muted playsinline>/);
});

test("botões da RA são ligados mesmo após DOMContentLoaded, e camadas escondem corretamente", () => {
  assert.match(ar, /document\.readyState === "loading"/);
  assert.match(ar, /else bind\(\)/);
  assert.match(ar, /openMobileAR"\)\?\.addEventListener\("click",enterMobileAR\)/);
  assert.match(css, /#mobileARCanvas\[hidden\], \.mobile-ar-reticle\[hidden\]/);
});
