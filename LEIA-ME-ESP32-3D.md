# CODA — ESP32 3D atualizado

## Editor Arduino/C++ visível na aba Programador 3D (atualização)

1. Abra **Laboratório ESP32 em 3D** e depois a aba **Programador 3D**.
2. Logo abaixo do título, encontre o editor **Programar ESP32 com código**, com arquivo `sketch.ino`, números de linha e exemplos.
3. Digite código Arduino/C++ com `void setup()` e `void loop()`. Pode começar por **Exemplos de código → LED piscando**.
4. Clique em **✓ Verificar** para identificar comandos incompatíveis e, em seguida, em **▶ Executar no 3D**.
5. Use **Ver bancada 3D ↓** para observar o ESP32 e os componentes conectados. **■ Parar** interrompe a simulação.
6. O código é salvo automaticamente no navegador. **↓ Salvar .ino** baixa uma cópia, e **↑ Abrir .ino** importa um arquivo local. **Restaurar exemplo** substitui o sketch após confirmação.

**Atalhos:** Ctrl+Enter para executar, Ctrl+S para baixar o código, Tab para indentar. O editor também é utilizável no celular.

O campo opcional para gerar código a partir de uma frase continua disponível na seção recolhível **Opcional: gerar um exemplo a partir de uma descrição**. Não é preciso usar esse campo para programar.


No simulador, o circuito só reage enquanto o sketch está em execução. Para o ESP32 físico, use Chrome ou Edge no computador, cabo USB de dados e uma placa com MicroPython instalado.

Na seção opcional **Diga o que o ESP32 deve fazer**, descreva a ação em português e clique em **Gerar código**. O gerador entende pedidos de LED, botão, potenciômetro/ADC e monitor serial, coloca o resultado no editor e espera você revisar antes de executar.

## Abrir no computador

1. Extraia o ZIP inteiro para uma pasta.
2. Abra **INICIAR-CODA.bat**. Mantenha a janela do servidor aberta.
3. Faça o cadastro ou login do CODA como antes.
4. Abra **Laboratório ESP32 em 3D**.
5. Na aba **Programador 3D**, abra o editor Arduino, carregue **LED piscando** e clique em **Executar no 3D**.
6. Mexa no controle **Potenciômetro / ADC**. O exemplo lê o GPIO34, altera o tempo do LED no GPIO2 e escreve no monitor serial.

Se já tem uma instalação com alunos, turmas e resultados, guarde uma cópia dela antes de atualizar. Preserve a pasta `data` da instalação existente: ela contém o banco de dados. O pacote não inclui nem substitui esse banco.

## Onde a placa foi atualizada

- Modelo 3D: nova placa detalhada, USB, blindagem com inscrição, antena, CP2102, regulador, LEDs, botões e 38 pinos.
- Modo fios: a mesma placa, terminais correspondentes ao modelo, fios tridimensionais e componentes móveis.
- Programador 3D: a mesma placa, biblioteca de peças, conexões por clique ou arraste, seleção de fios para editar cor/remover e editor de sketch.
- RA no celular: a mesma placa sobre a câmera, ligações, LEDs, resistores, potenciômetros, botões, editor e monitor serial.
- RA com óculos: a mesma placa detalhada. Em **Laboratório interativo**, use **Usar circuito do Programador 3D** para levar a montagem para a RA.

## Usar os controles

- **EN / Reset** reinicia o sketch que está executando e roda `setup()` novamente.
- **BOOT / GPIO0** é uma entrada: segure para ler LOW, solte para ler HIGH. O exemplo **Botão BOOT + LED** demonstra o comportamento.
- **Simular código** executa o código do editor da área atual. **Parar** cancela os temporizadores e desliga as saídas simuladas.
- **Carregar exemplo…** oferece LED piscando, potenciômetro + LED e botão BOOT + LED.
- **Vista superior**, **Centralizar**, **Grade** e **Girar sozinho** controlam a visualização.
- No montador, **Todos os 38 pinos** abre as duas listas roláveis. Os contatos da memória flash aparecem identificados e desativados.
- Para mover uma peça no montador, arraste seu nome. As setas do teclado também movem a peça selecionada pelo foco.
- Para editar um fio no Programador 3D, clique nele e use o inspetor.
- Um LED externo só acende com GPIO de saída, resistor em série, polaridade e GND corretos. O LED integrado no GPIO2 responde diretamente ao sketch.

## Código aceito na simulação

O editor interpreta um subconjunto educativo de Arduino/C++:

- `setup()` e `loop()`;
- `#include <Arduino.h>`, `#define`, variáveis e contas;
- `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `delay` e `millis`;
- `Serial.begin`, `Serial.print`, `Serial.println` e `Serial.printf` (`%d`, `%i`, `%f`, `%s` e `%%`).

Bibliotecas externas, Wi-Fi, classes e blocos `if`, `for` ou `while` não são interpretados. Comandos não aceitos mostram uma mensagem; não são executados como JavaScript. O laboratório USB/MicroPython existente continua disponível para a placa física. O editor 3D não compila nem grava firmware.

GPIO34, GPIO35, GPIO36 e GPIO39 são entradas. Os três contatos GND do modelo compartilham a mesma referência elétrica.

## No celular

Acesse a instalação por HTTPS e permita a câmera. Abra **RA no celular**, toque na mesa para colocar o modelo e use **Ligar fios** ou **Programar**. A aba Programar contém EN, BOOT, controle ADC34, exemplos e monitor serial. A visualização pela câmera é uma sobreposição controlada por toque; não faz rastreamento espacial da mesa. O modo com óculos usa WebXR e depende do suporte do aparelho.

O Three.js vem dentro do projeto. Os modelos e o gráfico não dependem de Tailwind, Font Awesome, Chart.js nem de baixar bibliotecas 3D de um CDN em cada abertura. Quando WebGL está indisponível, a visualização comum usa as mesmas malhas com renderização por software; materiais e sombras completos usam WebGL. Sessões imersivas com óculos precisam de WebXR/WebGL.

## Origem e conferência

Geometria baseada no arquivo `esp32_3d_web_simulator(1).html` fornecido com o pedido, com terminais e estados integrados ao CODA. A pinagem de 38 contatos foi conferida na documentação da Espressif:
https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html

Three.js r128: licença em `js/vendor/THREE-LICENSE.txt`.

Verificação: checagem de sintaxe, suíte automatizada do CODA e interface em navegador com viewport de computador e celular. Câmera física, gravação USB e óculos WebXR precisam de conferência nos respectivos aparelhos.
