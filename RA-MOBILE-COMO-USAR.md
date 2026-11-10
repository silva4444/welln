# ESP32 em RA no celular — bancada interativa

1. Entre no CODA pelo navegador do celular (Chrome Android ou Safari iOS) em HTTPS. Autorize a câmera.
2. Abra **ESP32 em 3D → RA no celular → Abrir câmera em RA**. Toque na mesa para posicionar o modelo (posição manual sobre o vídeo, não ancoragem espacial por WebXR).
3. Toque em **Ligar fios**. Toque em dois terminais para conectá-los. Adicione até 4 LEDs e 4 resistores. Exemplo válido: **GPIO2 → R1:A → R1:B → LED1:A → LED1:B → GND**. Cores e fios são desenhados na cena 3D; o painel lista e permite remover cada fio. Use **Exemplo pronto** se quiser testar rapidamente.
4. Toque em **Programar**. Edite o sketch (subconjunto: definições inteiras simples, `void setup(){pinMode(N, OUTPUT);}`, `void loop(){digitalWrite(N,HIGH/LOW);delay(ms);}`). Toque em **▶ Simular**. O LED acende somente com ligação correta e `HIGH` no GPIO. Toque em **■ Parar** para interromper.
5. O código, as peças e os fios ficam salvos **no navegador deste dispositivo**, mas não são compartilhados entre contas/aparelhos e não são enviados ao ESP32 físico.

## Limitações reais

- A RA via câmera sobrepõe um modelo manualmente posicionado à imagem da câmera; **não** oferece detecção real de superfícies, rastreamento espacial ou circuitos físicos por visão computacional.
- Simula ligações LED + resistor + GPIO + GND e ciclos digitais básicos. **Não** executa firmware ESP32 real, bibliotecas Arduino gerais, Wi-Fi, sensores ou periféricos de hardware. A execução é determinística, sem `eval` ou execução de C++ arbitrário.
- **Programar a placa ESP32 física** exige conectar a placa e usar navegador e interface USB compatíveis no computador, ou outra ponte de comunicação própria. A câmera do celular não faz flash do microcontrolador.
- Celulares de menor desempenho podem ficar lentos se a câmera, o WebGL e outros aplicativos estiverem ativos. Há limite de componentes e desenho sob demanda para reduzir o consumo.

## Validação automatizada

`npm run check` e `npm test` (inclui testes de circuitos, validação do sketch e ligação entre interface e renderizador). Ainda é necessário testar permissões e câmera real em Android/iOS; nenhum teste automatizado substitui esse teste físico.

## Publicação de demonstração

A hospedagem pública pode definir `CODA_DISABLE_INTERNAL_ACCOUNTS=1` para não criar perfis administrativos com credenciais conhecidas. Nesse caso, novos professores/administradores precisam ser configurados pelo responsável em um ambiente privado antes de usar os recursos de gestão. O plano gratuito pode reiniciar e perder o banco SQLite local.


## CODA RA Studio v14.4 — Controles novos

1. Entre em **Laboratório ESP32 em 3D → RA no celular → Abrir câmera em RA** (HTTPS e câmera traseira).
2. Toque sobre a imagem da mesa para colocar o ESP32. Arraste a placa para ajustar e toque em **Fixar posição**. A trava impede mover a placa sem querer.
3. No modo **Bancada**, arraste com um dedo sobre um componente 3D para mudar de posição. Para mover a placa novamente, use **Posição fixa** para desbloquear. Com dois dedos, aproxime ou afaste para mudar o tamanho do modelo.
4. Use **+ LED**, **Conexões** para adicionar peças e ligar terminais, e **Código** para escrever o sketch Arduino/C++.
5. Em **Código**, use **Verificar**, **Executar**, **Parar**, **Abrir .ino** ou **Salvar .ino**. O simulador interpreta apenas os comandos Arduino que ele suporta.

**Importante:** No modo câmera sem WebXR, a placa está sobreposta à imagem e a trava é uma posição **na tela**. Isso **não** reconhece uma mesa, nem acompanha a mesa ao caminhar. Para ancoragem espacial rastreada são necessários hardware, navegador e WebXR/AR compatíveis; o recurso não está disponível no modo câmera.

**Segurança:** Nenhuma alteração precisa ser feita no circuito físico ou na configuração do ESP32 real. A simulação não grava firmware no microcontrolador.
