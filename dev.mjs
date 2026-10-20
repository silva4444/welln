// Modo de edição do CODA: inicia o servidor com reinício automático, abre o navegador
// e mostra o endereço para o celular. Uso: npm run dev:open  (ou ABRIR-PARA-EDITAR.bat)
// Opções: --port 8080   --no-open   --local (só este computador, sem acesso do celular)
import { spawn, exec } from "node:child_process";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ""; };
const port = Number(option("--port") || process.env.PORT || 8080);
const host = args.includes("--local") ? "127.0.0.1" : "0.0.0.0";
const url = `http://localhost:${port}`;

const healthy = async () => {
  try { const r = await fetch(`${url}/api/health`); return (await r.json()).ok === true; } catch { return false; }
};
const openBrowser = target => {
  const command = process.platform === "win32" ? `start "" "${target}"` : process.platform === "darwin" ? `open "${target}"` : `xdg-open "${target}"`;
  exec(command, () => {});
};
const lanAddresses = () => Object.values(networkInterfaces()).flat()
  .filter(item => item && item.family === "IPv4" && !item.internal).map(item => item.address);

function banner() {
  console.log("\n  CODA em modo de edição");
  console.log("  ──────────────────────");
  console.log(`  Computador:  ${url}`);
  if (host === "0.0.0.0") {
    for (const ip of lanAddresses()) console.log(`  Celular:     http://${ip}:${port}   (mesmo Wi-Fi; no app React Native digite ${ip}:${port})`);
  }
  console.log("\n  Edite os arquivos e aperte F5 no navegador para ver a mudança.");
  console.log("  Mudanças em server.mjs, db.mjs, chat-service.mjs reiniciam o servidor sozinhas.");
  console.log("  Para parar, feche esta janela ou aperte Ctrl+C.\n");
}

if (await healthy()) {
  console.log(`\n  Já existe um CODA rodando na porta ${port}. Vou só abrir o navegador nele.`);
  console.log("  (Para o reinício automático, feche o outro servidor e abra este de novo.)\n");
  if (!args.includes("--no-open")) openBrowser(url);
  process.exit(0);
}

const server = spawn(process.execPath, ["--watch", "--watch-preserve-output", "server.mjs", "--host", host, "--port", String(port)], { cwd: root, stdio: "inherit" });
server.on("exit", code => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.kill(); process.exit(0); });

for (let tries = 0; tries < 40; tries += 1) {
  if (await healthy()) {
    banner();
    if (!args.includes("--no-open")) openBrowser(url);
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  if (tries === 39) console.log("\n  O servidor não respondeu em 20 s. Veja as mensagens acima (porta ocupada? Node 22.5+?).\n");
}
