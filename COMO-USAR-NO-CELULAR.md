# CODA no celular

Esta é a mesma aplicação web com layout adaptado ao toque. Login, dados, aulas, tutor, laboratório e ESP32 usam o servidor e o banco SQLite do projeto. Não é um APK ou um app Expo.

## Na mesma rede Wi-Fi

1. Extraia o ZIP no computador e instale Node.js 22.5 ou superior.
2. Execute `INICIAR-NO-CELULAR.bat` e mantenha a janela aberta. Se o Windows perguntar sobre o acesso à rede, permita na rede privada que você está usando.
3. Veja o **Endereço IPv4** mostrado na janela. Com celular e computador no mesmo Wi-Fi, abra `http://IP-DO-COMPUTADOR:8080` no navegador do celular. Exemplo: `http://192.168.1.10:8080`. Não use `localhost` ou `127.0.0.1` no celular.
4. Faça login no portal desejado. Na barra inferior estão Início, Matérias, Laboratório, ESP32 e Menu. **Menu** abre todas as áreas, inclusive Quiz, Meu espaço, Vídeos, Agenda, Comunidade e as seções do professor/administrador.

No macOS ou Linux, dentro da pasta execute `node server.mjs --host 0.0.0.0 --port 8080` e encontre o IP local do computador nas configurações de rede.

## Câmera e realidade aumentada

O navegador do celular costuma bloquear a câmera em endereços `http://192.168...`. Para usar **RA no celular**, o site deve ser servido por **HTTPS** com o servidor completo (incluindo API e SQLite). Um serviço de páginas estáticas, como GitHub Pages, não executa login e banco. O modo WebXR também depende do suporte do aparelho e navegador; quando disponível, o projeto já tenta abrir o modo de câmera compatível.

Programar uma placa ESP32 física via USB usa Web Serial, disponível apenas em navegadores e conexões compatíveis. A simulação de circuitos e os outros recursos do laboratório continuam disponíveis no celular.

O projeto não substitui um servidor publicado: se o computador for desligado, o celular deixa de acessar os dados. Não exponha a porta 8080 diretamente à internet; para acesso fora da rede local use uma hospedagem com HTTPS e configure os códigos de acesso do professor e administrador.
