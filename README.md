# CODA Educacional v14.5.0 — Aprendizagem, sincronização e laboratório VR/RA

Esta edição mantém as 14 matérias e as 98 aulas da versão de conteúdo. Contas, conteúdo, registros acadêmicos e progresso ficam no banco SQLite do servidor. Quando o servidor é publicado com disco persistente, o aluno acessa a mesma conta em outro computador e recupera o avanço automaticamente.

O progresso também possui fila offline: se a conexão cair, a alteração permanece no navegador e é reenviada quando a internet voltar. Na entrada seguinte, a data da cópia local é comparada com a do servidor para evitar que um avanço offline mais novo seja apagado.

O tema claro agora usa superfícies suaves com contraste AA, enquanto o tema escuro possui tokens próprios. Botões, campos, cartões, estados de interface e tamanhos mínimos de texto foram padronizados.

O modo Código do Tutor agora possui os botões **Analisar código atual**, **Analisar os 14 códigos**, **Comparar versões**, **Corrigir atividade**, **Criar exercício** e **Revisar linhas**. Também continua aceitando código colado diretamente, com detecção automática da linguagem e uma verificação local mais ampla de sintaxe e estrutura.

As telas de login e cadastro preservam uma estrutura comum e usam identidade visual específica para aluno, professor e administrador. As orbitais possuem movimento contínuo lento, posição estável, objetos alinhados e desligamento automático quando a preferência de reduzir movimento está ativa.

## Principais recursos

- 14 trilhas, 98 aulas sequenciais e 98 exemplos de código diferentes;
- 98 microvideoaulas internas de um minuto, cada uma montada com o assunto específico da aula, legenda visível, transcrição completa e leitura por voz;
- videoaula externa completa de cada matéria como alternativa, com aviso claro quando o YouTube não carregar;
- exercício final em todas as aulas, correção automática, explicação do erro e liberação progressiva da aula seguinte;
- questões adaptativas com variação por tentativa, recomendações de revisão e certificado/relatório final em PDF;
- laboratórios das linguagens, SQL e ESP32 interativo em 3D;
- versões de código, comparação por linha e laboratório responsivo para celular e tablet;
- portais separados para aluno, professor e administrador;
- progresso, desempenho por matéria, competências, tempo de estudo, metas, anotações, favoritos e exportação;
- turmas, matrículas, avisos, dúvidas, avaliações, correções e backups;
- diário do professor com frequência, notas, devolutivas e rubricas por competência;
- importação de alunos por CSV, calendário de avaliações, relatório PDF e painel de alunos em risco de atraso;
- editor do administrador para textos, exemplos, atividades, objetivos, vídeos e status das 98 aulas;
- separação institucional por `institution_id`, histórico de versões, registro de auditoria e backups automáticos diários;
- painel inicial do aluno personalizável e seções recolhíveis para reduzir a poluição visual sem remover conteúdo.

## Arquitetura modular 10.5

- `style.css` é o manifesto; estilos novos ficam em `themes/`, `components/`, `pages/` e `styles/`.
- `script.js` é o carregador; os domínios ficam em `js/login.js`, `js/lessons.js`, `js/laboratory.js`, `js/esp32.js`, `js/tutor.js` e `js/institution.js`.
- `styles/legacy.css` e `js/core.js` preservam compatibilidade durante a migração sem permitir que os novos temas dependam da ordem de regras antigas.
- Os 38 testes cobrem catálogo, servidor, três perfis, temas, responsividade, orbitais, teclado, Tutor, programador ESP32 em 3D e controles institucionais.

## Cadastro e acesso

O aluno agora tem dois fluxos separados na tela inicial:

1. **Criar conta:** escolha o portal Aluno, clique em **Criar conta**, informe nome, matrícula, e-mail, senha e confirmação.
2. **Entrar:** depois do cadastro, escolha **Entrar** e use apenas e-mail e senha.

A matrícula aceita de 3 a 30 letras, números, ponto, traço ou sublinhado e não pode se repetir. O professor consegue localizar o aluno cadastrado e adicioná-lo diretamente a uma turma.

Professor e administrador não usam o cadastro público do aluno. O próprio primeiro login cria a conta do perfil:

1. Escolha **Professor** ou **Administrador**.
2. Digite seu próprio e-mail.
3. Escolha uma senha com pelo menos 6 caracteres.
4. Informe o código correspondente.
5. Se o e-mail ainda não estiver cadastrado, a Coda cria a conta. Nos próximos acessos, use o mesmo e-mail, a mesma senha e o código.

Os códigos administrativos não são publicados no repositório. Defina e-mails, senhas e códigos fortes pelas variáveis de ambiente `CODA_TEACHER_EMAIL`, `CODA_TEACHER_PASSWORD`, `CODA_TEACHER_CODE`, `CODA_ADMIN_EMAIL`, `CODA_ADMIN_PASSWORD` e `CODA_ADMIN_CODE` antes de iniciar a versão pública.

## Tutor Coda 10.5 — sem API de IA

O antigo bot de respostas fixas foi substituído por um tutor contextual integrado à plataforma:

- mantém o contexto entre várias mensagens e salva o histórico por aluno no SQLite;
- recupera trechos relacionados das 98 aulas e mostra botões para abrir as fontes utilizadas;
- considera matéria, aula atual e resumo do progresso ao montar a pergunta;
- possui modos **Explicar**, **Dar dica**, **Código**, **Revisão** e **Artigos**;
- analisa o código atual do laboratório, faz uma varredura resumida dos 14 códigos salvos ou recebe um código colado diretamente na mensagem;
- detecta a linguagem quando possível e informa linha, erro provável, correção, confiança e próximo teste sem fingir que executou o programa;
- possui regras próprias para todas as 14 opções do laboratório: HTML, CSS, JavaScript, TypeScript, Python, C, C+, C++, C#, Java, React, React Native, ESP32/Arduino e SQL;
- reconhece também linguagens comuns fora do laboratório, como Go, Rust, PHP, Ruby, Swift, Kotlin, Dart, R, Bash e Lua, aplicando nelas a verificação estrutural genérica;
- confere estrutura, delimitadores, strings e comentários sem fechamento, erros frequentes de sintaxe, nomes digitados incorretamente, operadores inadequados, comandos incompletos e problemas específicos de JSX, componentes nativos, sketches e consultas;
- oferece ações para abrir o laboratório, a aula relacionada ou a área de dúvidas;
- permite começar, reabrir, avaliar e excluir conversas;
- funciona sem chave, crédito ou API de modelo de IA;
- pesquisa artigos de periódico no índice público Crossref quando há internet;
- mostra título, autores, ano, periódico, DOI e link verificável;
- separa conteúdo da aula, interpretação do Tutor e limite da evidência;
- não inventa referência quando a pesquisa científica estiver indisponível.

O modo **Artigos** usa apenas metadados públicos do Crossref. Ele serve para encontrar e organizar fontes, mas não afirma que o título de um artigo prova uma conclusão. Para usar uma fonte em trabalho acadêmico, abra o DOI e confira resumo, método, amostra, resultados e data.

Para revisar um código, abra o Tutor e selecione **Código**. Você pode usar **Analisar código atual**, **Analisar os 14 códigos** ou colar o trecho no campo de mensagem; blocos entre três crases também são aceitos. A verificação é estática e educativa: ela encontra padrões conhecidos, mas não substitui o compilador nem garante que um programa sem alertas esteja correto.

Documentação oficial: https://www.crossref.org/documentation/retrieve-metadata/rest-api/

Para usar a modalidade recomendada pelo Crossref em uma implantação pública, configure um e-mail de contato do projeto:

```powershell
$env:CODA_RESEARCH_EMAIL="contato@seu-dominio.com.br"
npm.cmd start
```

## Acessibilidade

- Widget oficial do VLibras no canto inferior direito quando houver internet, carregado de forma assíncrona somente depois da interface para não bloquear a Coda: https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras;
- transcrição das microvideoaulas, legendas internas e leitura da página em português;
- navegação por teclado, link “Pular para o conteúdo” e descrições acessíveis;
- ampliação global de todo o texto para 115% ou 130%;
- alto contraste, redução de animações e tema claro/escuro;
- modos para protanopia, deuteranopia, tritanopia e monocromático.

## Abrir no Windows com dois cliques

1. Extraia o ZIP.
2. Abra a pasta extraída do CODA v14.5.
3. Dê dois cliques em `ABRIR-CODA-1-CLIQUE.bat`.
4. O navegador abrirá em `http://127.0.0.1:8080`.

O iniciador não usa PowerShell, não executa `winget` e não tenta instalar ou atualizar programas. Ele procura um Node.js compatível já instalado, confere o servidor e abre o navegador. Mantenha a janela minimizada do servidor aberta enquanto usar o sistema.

Se o Windows bloquear o arquivo baixado, leia `LEIA-SE-O-WINDOWS-BLOQUEAR.txt`. Em um computador pessoal, a opção **Desbloquear** pode aparecer em **Propriedades** do ZIP; use-a somente no ZIP obtido desta entrega e extraia novamente. Se a mensagem disser que o aplicativo foi bloqueado pelo administrador, não tente contornar a regra: solicite ao responsável autorização para executar o Node.js e arquivos `.bat` na pasta do Coda.

Se o Node.js não estiver instalado, use a versão 22 ou mais recente obtida em https://nodejs.org/. Em computador escolar ou empresarial, peça a instalação ao administrador.

Não abra `index.html` diretamente e não use Live Server: autenticação e SQLite dependem do servidor local.

## Domínio Coda

Nesta versão local, o endereço continua sendo `http://127.0.0.1:8080`. O final `@coda.local` das contas internas não é um domínio de internet e não deve ser usado para alunos; alunos podem cadastrar um e-mail real.

Para publicar, ainda não foi fixado um domínio. Não use `coda.io`, pois esse endereço pertence a outro produto. O ideal é registrar um nome próprio e identificável, por exemplo um domínio que combine Coda com educação ou com o nome da instituição, depois de confirmar disponibilidade e marca. Quando o domínio for escolhido, ele apontará para a plataforma hospedada; o cadastro já está preparado para continuar aceitando e-mails comuns.

## Acesso pela internet e atualização em tempo real

Avisos, avaliações, conteúdo, dados acadêmicos e comunidade são gravados no SQLite. A página mantém um canal de eventos autenticado; alterações publicadas são enviadas aos usuários conectados e cada tela busca os dados autorizados. Se o navegador ou o proxy bloquear SSE, a página usa atualização periódica de segurança. Os campos em edição não são sobrescritos.

Para acessar de outra rede, publique a pasta `server` em um repositório Git e conecte-o ao Render:

1. Crie o repositório Git e envie os arquivos desta pasta, incluindo `render.yaml`.
2. No Render, escolha **New > Blueprint**, conecte o repositório e aplique `render.yaml`.
3. Preencha os seis campos secretos pedidos: e-mail, senha e código de professor e de administrador. Use senhas e códigos aleatórios com pelo menos 16 caracteres; guarde-os em um gerenciador de senhas.
4. Aguarde o health check `/api/health` e abra a URL pública informada pelo Render. O domínio próprio é opcional.

O serviço configurado usa um plano com disco persistente para que o SQLite não seja apagado ao reiniciar. Mantenha uma única instância do serviço: o SQLite e o canal SSE deste pacote foram configurados para uma instância. O banco do computador atual não é enviado à nuvem automaticamente. Antes de migrar, crie backup e planeje a importação das contas e registros que deseja manter.

Os posts locais salvos no navegador podem ser importados uma vez por conta ao entrar na comunidade; apenas os posts cujo autor coincide com a conta autenticada são importados. Novos posts, comentários, curtidas, reações, enquetes, denúncias e moderação passam a usar o servidor.

## Banco de dados

`data/coda.sqlite` é criado automaticamente no primeiro uso. Ele armazena contas, perfis de aluno e matrículas escolares, sessões, turmas, frequência, notas, rubricas, avisos, mensagens, conversas do Tutor Coda, progresso, avaliações, conteúdo personalizado, comunidade, instituição e controles de privacidade.

Os backups ficam em `data/backups`. Para criar um backup, use **Criar backup agora** no portal de gestão. Para restaurar: feche a janela do servidor, escolha um arquivo `coda-backup-*.sqlite` e execute `scripts/RESTAURAR-BACKUP-WINDOWS.bat` no Windows. O restaurador valida a integridade antes de trocar o banco e guarda uma cópia do banco atual como `coda-before-restore-*.sqlite`. Em outros sistemas, da raiz de `server`, execute `CODA_RESTORE_CONFIRM=SERVER_STOPPED node scripts/restore-backup.mjs data/backups/coda-backup-....sqlite` depois de parar o servidor. Não execute a restauração com o Coda aberto.

## Pacote de distribuição

O ZIP distribuído deve ser gerado **somente** pelo script oficial, nunca com compactação manual da pasta do projeto. Com o servidor desligado, execute na raiz:

```text
npm run package
```

O script cria um ZIP de distribuição na pasta acima do projeto e exclui explicitamente `data/`, `.git/`, `node_modules/`, arquivos de log e artefatos SQLite. Assim, banco local, backups e dados de teste não entram na entrega. Para escolher outro destino, use a variável `CODA_PACKAGE_OUT`.

## Migrações do banco

O histórico do bootstrap SQLite e a convenção para novas alterações estruturais estão documentados em [`MIGRATIONS.md`](MIGRATIONS.md). Antes de publicar uma alteração de schema, gere um backup, valide banco novo e banco legado e execute `npm run check` e `npm test`.

## Segurança

As senhas usam PBKDF2. Em produção, o servidor não inicia sem e-mails reais, senhas e códigos de professor e administrador definidos; senhas e códigos precisam ter ao menos 16 caracteres. As contas internas antigas `@coda.local` ficam desativadas na primeira inicialização em produção. Cookies de sessão usam `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Há limitação de tentativas, validação de origem e permissões por perfil. Usuários podem alterar a própria senha; o administrador pode definir uma senha temporária para outra conta. A recuperação por e-mail ainda depende de configurar um serviço de envio e não está ativa.

## Testes técnicos

Para desenvolvimento, com Node.js 22.5 ou superior:

```text
npm.cmd run check
npm.cmd test
```

A suíte cobre arquivos públicos, autenticação, permissões, SQLite, comunidade entre contas, eventos SSE, restauração validada de backup, turmas, matrícula, conteúdo, avaliações, progresso, Tutor Coda, memória de conversa, análise local de código, dúvidas, correção, frequência, notas, rubricas e administração.

## Arquivos principais

- `server.mjs`: servidor local, autenticação e API.
- `db.mjs`: estrutura e operações SQLite.
- `chat-service.mjs`: respostas pedagógicas locais, análise de código, memória e pesquisa científica no Crossref.
- `style.css`: manifesto dos estilos modulares em `themes/`, `components/`, `pages/` e `styles/`.
- `admin.js`: painel e editor do administrador.
- `platform.js`: integrações acadêmicas de aluno e professor.
- `script.js`: carregador dos módulos em `js/`; o núcleo compatível permanece em `js/core.js`.
- `lesson-content.js`: 98 exemplos progressivos e diferentes.
- VLibras: Widget oficial carregado diretamente de `https://vlibras.gov.br/app` no final do `index.html`.

## Simulador de circuitos ESP32

O modo **Modo fios** da tela `ESP32 em 3D` funciona como uma bancada de prototipação inspirada no Tinkercad. A bancada possui visualizações **Protoboard 2D** e **Bancada 3D**; o 2D prioriza precisão de terminais e o 3D aplica perspectiva e profundidade para leitura espacial. Separadamente, o **Programador 3D** é uma bancada própria estilo Tinkercad para ESP32, com placa, banco de GPIOs, componentes, terminais e camada de fios. A biblioteca lateral permite arrastar ou clicar para adicionar resistores, LEDs, baterias, chaves, capacitores e sensores. Os componentes adicionados podem ser reposicionados com mouse ou toque e ficam salvos no navegador.

Para montar um circuito, arraste de um terminal até outro terminal ou selecione os dois em sequência. Isso funciona tanto no modo fios quanto no **Programador 3D**. Os fios são desenhados em SVG com prévia durante o arraste, permanecem visíveis durante o reposicionamento e são armazenados por projeto. A validação impede ligações entre dois pinos da placa, ligações de um componente com ele mesmo e fios duplicados. O componente selecionado pode ser removido com `Delete` ou `Backspace`. O botão **Testar circuito** ou **Iniciar simulação** energiza a montagem quando as conexões esperadas do projeto estão completas; o resultado e o estado dos componentes são atualizados na própria bancada.

Não foi adicionada dependência externa para o simulador. Ele usa apenas HTML, CSS e JavaScript nativos já presentes no projeto. Para executar localmente, use Node.js 22.5 ou superior e rode `npm install` (não há pacotes adicionais necessários), seguido de `npm start`; abra `http://127.0.0.1:8080` e entre no portal do aluno para acessar a bancada.

## Óculos VR e realidade aumentada ESP32 (WebXR)

A área ESP32 agora possui duas experiências para óculos:

- **Ambiente virtual (immersive-vr):** laboratório fechado, sem passthrough, com mesa, iluminação, placa ESP32, componentes e suporte a mãos/controles quando o navegador oferece hand tracking.
- **Bancada real (immersive-ar):** usa passthrough e posiciona o ESP32 virtual sobre uma superfície real.

Dentro de cada experiência, há dois modos de uso:

- **Somente visualizar:** posiciona o ESP32 virtual sobre uma bancada/superfície real e permite reposicioná-lo.
- **Laboratório interativo:** permite adicionar LED e resistor, selecionar uma peça com o controle/pinça e movê-la para outro ponto da superfície.

### Requisitos

1. Óculos/navegador com suporte a `WebXR immersive-vr` e/ou `WebXR immersive-ar`.
2. O site deve ser servido em **HTTPS** (ou em um contexto seguro aceito pelo navegador).
3. O navegador deve conceder acesso à sessão de realidade aumentada.

### Como usar

1. Abra **ESP32** no CODA.
2. Selecione **Realidade aumentada**.
3. Clique em **Verificar meu dispositivo**.
4. Escolha **Ambiente virtual** ou **Bancada real**.
5. Escolha **Somente visualizar** ou **Laboratório interativo**.
6. Clique em **Entrar no ambiente**.
7. Olhe para uma superfície e faça uma pinça/pressione o gatilho para posicionar o ESP32.
8. No modo laboratório, aponte para um objeto e selecione; depois selecione outro ponto da superfície para movê-lo.

### Implementação

A implementação é autocontida e fica em `js/esp32-ar.js`. Ela usa WebXR e WebGL diretamente, sem Three.js ou dependências externas. O modo normal do ESP32 continua funcionando em dispositivos sem RA.


No Meta Quest 3, abra a URL HTTPS pelo navegador do próprio óculos, escolha **Óculos VR / RA**, selecione o tipo de experiência e entre. O navegador ainda pode solicitar autorização para WebXR ou passthrough.


### Correção RA no celular (26/10/2026)

A resposta HTTP agora libera `Permissions-Policy: camera=(self)` no próprio domínio e
mantém microfone e localização bloqueados. No laboratório, a aba **RA no celular**
abre a câmera traseira pelo `getUserMedia` com HTTPS e sobrepõe a placa ESP32 3D
ao vídeo, sem depender de WebXR. Use Chrome no Android ou Safari no iPhone,
permita a câmera para o endereço do site e toque na mesa para posicionar a placa.
A opção **RA com óculos** continua separada via WebXR.


## Bancada ESP32 em RA no celular

Veja [RA-MOBILE-COMO-USAR.md](RA-MOBILE-COMO-USAR.md) para componentes, fios, editor, simulação e limitações de uso.


## CODA RA Studio — melhorias v14.4

A aba RA no celular inclui bancada mais enxuta, botão de fixar/desbloquear o ESP32 na **imagem da câmera** (posição de tela, não âncora física), movimentação independente de componentes 3D via toque, zoom por gesto de pinça, modos Bancada/Conexões/Código, ações rápidas de LED e execução, e editor Arduino com Verificar, Executar, Parar, Abrir e Salvar `.ino`. A experiência usa a câmera traseira sob HTTPS; WebXR com rastreamento real da mesa é uma capacidade diferente, dependente do dispositivo e não é simulada pela trava visual.
