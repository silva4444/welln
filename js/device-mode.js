(() => {
  "use strict";

  // Restaura a preferência escolhida; o padrão na primeira visita é claro.
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem("nexo-theme") === "dark" ? "dark" : "light"; } catch {}
  document.documentElement.dataset.theme = savedTheme;

  function applyTheme(next, { persist = true } = {}) {
    const theme = next === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    if (persist) { try { localStorage.setItem("nexo-theme", theme); } catch {} }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#090b0a" : "#ffffff");
    document.querySelectorAll("[data-theme-switch],#themeToggle").forEach(button => {
      const nextLabel = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.setAttribute("aria-pressed", String(theme === "dark"));
      if (button.hasAttribute("data-theme-switch")) button.textContent = theme === "dark" ? "☀ Tema claro" : "☾ Tema escuro";
    });
  }
  window.CodaTheme = { apply: applyTheme, current: () => document.documentElement.dataset.theme };
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-theme-switch]");
    if (button) applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  const STORAGE_KEY = "coda_device_mode";
  const MODES = new Set(["mobile", "desktop"]);
  const query = new URLSearchParams(location.search).get("device");
  const stored = localStorage.getItem(STORAGE_KEY);
  let mode = MODES.has(query) ? query : (MODES.has(stored) ? stored : null);
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function apply(next, { persist = true, reload = false } = {}) {
    if (!MODES.has(next)) return;
    mode = next;
    document.documentElement.dataset.deviceMode = next;
    document.documentElement.classList.toggle("coda-mobile-mode", next === "mobile");
    document.documentElement.classList.toggle("coda-desktop-mode", next === "desktop");
    if (persist) localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("coda-device-mode", { detail: { mode: next } }));
    resolveReady?.(next);
    resolveReady = null;
    if (reload) location.reload();
  }

  function buildChooser() {
    if (document.getElementById("codaDeviceChooser")) return;
    const wrap = document.createElement("div");
    wrap.id = "codaDeviceChooser";
    wrap.className = "device-chooser";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "deviceChooserTitle");
    wrap.innerHTML = `
      <div class="device-chooser-card">
        <span class="device-chooser-logo">C</span>
        <small>CODA EDUCACIONAL</small>
        <h1 id="deviceChooserTitle">Qual dispositivo você está usando?</h1>
        <p>Escolha uma opção para abrir a versão mais adequada e evitar travamentos.</p>
        <div class="device-chooser-options">
          <button type="button" data-device-choice="mobile">
            <b>📱 Celular</b>
            <span>Mesmo modelo 3D, com renderização otimizada para celular.</span>
          </button>
          <button type="button" data-device-choice="desktop">
            <b>🖥️ Computador</b>
            <span>Versão completa com os modelos 3D e WebGL.</span>
          </button>
        </div>
        <small class="device-chooser-hint">A escolha fica salva neste aparelho e pode ser alterada depois.</small>
      </div>`;
    document.body.prepend(wrap);
    wrap.querySelectorAll("[data-device-choice]").forEach(button => {
      button.addEventListener("click", () => {
        apply(button.dataset.deviceChoice);
        wrap.remove();
      });
    });
  }

  function addSwitcher() {
    if (document.getElementById("codaDeviceSwitcher")) return;
    const button = document.createElement("button");
    button.id = "codaDeviceSwitcher";
    button.className = "device-switcher";
    button.type = "button";
    button.title = "Trocar versão do dispositivo";
    button.setAttribute("aria-label", "Trocar versão do dispositivo");
    button.textContent = mode === "mobile" ? "📱 Celular" : "🖥️ PC";
    button.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
    document.body.appendChild(button);
  }

  window.CodaDeviceMode = {
    ready,
    get mode() { return mode; },
    isMobile() { return mode === "mobile"; },
    isDesktop() { return mode === "desktop"; },
    choose(next) { apply(next, { reload: true }); },
    reset() { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };

  if (mode) apply(mode, { persist: Boolean(stored || query) });

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme, { persist: false });
    if (!mode) buildChooser();
    else resolveReady?.(mode);
    addSwitcher();
  });
})();
