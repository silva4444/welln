# Relatório de testes — CODA Educacional v14.5

Data: 10/11/2026

## Escopo validado

- autenticação e permissões de aluno, professor e administrador;
- banco SQLite, migrações, backup, restauração e persistência por conta;
- sincronização de progresso entre computadores e recuperação após uso offline;
- 14 matérias, 98 aulas, atividades, avaliações e Tutor CODA;
- comunidade, turmas, frequência, notas e painel administrativo;
- CSS claro/escuro, responsividade, acessibilidade e navegação por teclado;
- abas de aula e de turmas;
- ESP32 3D, editor Arduino, circuito, runtime e componentes;
- RA no celular, WebXR `immersive-ar` e ambiente de óculos `immersive-vr`;
- segurança de produção, cookies, permissões, tamanho e arquivos públicos.

## Estratégia

Foram executados testes de sintaxe, unidade, integração, segurança, persistência, interface estrutural, responsividade e WebXR. A inspeção visual local também foi tentada; o navegador isolado do ambiente de teste não acessa o servidor local, então a validação visual foi complementada pelos testes estruturais de CSS/HTML e pela suíte de interface já existente.

## Correções realizadas

1. O progresso offline mais novo não é mais substituído por uma cópia antiga do servidor.
2. Alterações sem internet entram em uma fila e são reenviadas quando a conexão retorna.
3. As abas de turmas agora usam `tablist`, `tab`, `tabpanel`, `aria-controls`, foco correto e setas do teclado.
4. O CSS recebeu foco visível, prevenção de estouro horizontal, melhor adaptação móvel e acabamento próprio para WebXR.
5. O modo de óculos passou a oferecer VR imersivo fechado e RA com passthrough separadamente.
6. O VR inclui sala, piso, mesa virtual, ESP32, componentes e entrada por mãos/controles quando disponível.

## Limite de hardware

Os fluxos WebXR foram validados por código e testes automatizados. A confirmação final de rastreamento das mãos, passthrough e desempenho precisa ser feita em um Meta Quest 3 real pelo navegador do óculos, usando HTTPS.
