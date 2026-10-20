(() => {
  "use strict";

  const studentItems = [
    ["⌂", "Início", "inicio"], ["▦", "Matérias", "materias"],
    ["</>", "Laboratório", "laboratorio"], ["◈", "ESP32", "esp32"]
  ];
  const teacherItems = [
    ["⌂", "Resumo", "overview"], ["♙", "Alunos", "students"],
    ["▤", "Diário", "diary"], ["✓", "Avaliações", "assessments"]
  ];
  const adminItems = [
    ["⌂", "Resumo", "overview"], ["♙", "Usuários", "users"],
    ["▤", "Acadêmico", "academics"], ["⌁", "Indicadores", "indicators"]
  ];

  function activate(key) {
    document.querySelectorAll("#mobileNav button").forEach(button => {
      const active = button.dataset.target === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function render(user = window.CodaCore?.getCurrentUser?.()) {
    const nav = document.querySelector("#mobileNav");
    if (!nav || !user) return;
    const role = user.role || "Aluno";
    const items = role === "Professor" ? teacherItems : role === "Admin" ? adminItems : studentItems;
    nav.innerHTML = items.map(([icon, label, target], index) =>
      `<button type="button" data-target="${target}" class="${index === 0 ? "active" : ""}" aria-label="${label}" aria-current="${index === 0 ? "page" : "false"}"><span>${icon}</span><small>${label}</small></button>`
    ).join("") + '<button type="button" data-target="menu" aria-label="Abrir menu com todas as áreas" aria-expanded="false"><span>☰</span><small>Menu</small></button>';
    nav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
      const target = button.dataset.target;
      if (target === "menu") {
        document.querySelector("#menuButton")?.click();
        button.setAttribute("aria-expanded", "true");
        return;
      }
      if (role === "Professor") window.CodaCore?.showTeacherSection?.(target);
      else if (role === "Admin") window.CodaAdmin?.showSection?.(target);
      else window.CodaCore?.navigate?.(target);
      activate(target);
    }));
  }

  document.addEventListener("coda:user", event => render(event.detail.user));
  document.addEventListener("coda:ready", event => render(event.detail.user));
  document.addEventListener("coda:view", event => {
    activate(event.detail.section || event.detail.view);
    document.querySelector('#mobileNav [data-target="menu"]')?.setAttribute("aria-expanded", "false");
  });
  document.querySelector("#backdrop")?.addEventListener("click", () => document.querySelector('#mobileNav [data-target="menu"]')?.setAttribute("aria-expanded", "false"));
  document.addEventListener("coda:logout", () => {
    const nav = document.querySelector("#mobileNav");
    if (nav) nav.innerHTML = "";
  });
  window.CodaLogin = { renderMobileNavigation: render };
})();
