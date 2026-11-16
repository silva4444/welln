import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("primeiro acesso do administrador escolhe senha com código e preserva a senha depois", () => {
  const scenario = `
    import { createCodaServer } from './server.mjs';
    const server = createCodaServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const url = origin + '/api/auth/login';
    const login = async (password, adminCode) => {
      const response = await fetch(url, {
        method: 'POST', headers: {'content-type':'application/json', origin},
        body: JSON.stringify({email:'dono@example.com', password, role:'Admin', adminCode})
      });
      return {status: response.status, body: await response.json()};
    };
    try {
      const invalidCode = await login('MinhaSenhaSegura2026', 'codigo-errado');
      const first = await login('MinhaSenhaSegura2026', 'codigo-admin-forte-2026');
      const repeat = await login('MinhaSenhaSegura2026', 'codigo-admin-forte-2026');
      const oldPassword = await login('SenhaInicialForte2026', 'codigo-admin-forte-2026');
      const attemptedReset = await login('OutraSenhaSegura2026', 'codigo-admin-forte-2026');
      console.log(JSON.stringify({invalidCode:invalidCode.status, first:first.status,
        role:first.body.user?.role, repeat:repeat.status, oldPassword:oldPassword.status,
        attemptedReset:attemptedReset.status}));
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const env = { ...process.env, NODE_ENV: "production", CODA_DATABASE: ":memory:",
    CODA_TEACHER_EMAIL: "professor@example.com", CODA_TEACHER_PASSWORD: "SenhaProfessorForte2026", CODA_TEACHER_CODE: "codigo-prof-forte-2026",
    CODA_ADMIN_EMAIL: "dono@example.com", CODA_ADMIN_PASSWORD: "SenhaInicialForte2026", CODA_ADMIN_CODE: "codigo-admin-forte-2026" };
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", scenario],
    { cwd: new URL("../", import.meta.url), env, encoding: "utf8", timeout: 20_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    invalidCode: 403, first: 200, role: "Admin", repeat: 200, oldPassword: 401, attemptedReset: 401
  });
});
