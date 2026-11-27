# Desktop Pets · 0.1.0

Projeto inicial de mascotes animados, com Tauri 2, Rust, TypeScript/JavaScript, Vite e Canvas 2D. Sem servidor de produção e sem banco de dados. Gato e cachorro têm aparência, posição e tamanho independentes. Interface em português.

## Começar no Windows

Use PowerShell **no Windows**, não no WSL. Pré-requisitos de desenvolvimento: Node.js 22 LTS, Rust/Cargo (stable MSVC), Microsoft C++ Build Tools (Desktop development with C++) e WebView2. Instale em https://v2.tauri.app/start/prerequisites/ e reinicie o terminal.

```powershell
node -v
npm -v
rustc --version
cargo --version
npm install
npm run desktop:dev
```

Para testar apenas a interface no navegador: `npm run dev`, abra `http://localhost:1420`. Nesta modalidade os eventos só são recebidos na prévia e as preferências são guardadas no armazenamento local do navegador.

## Gerar a versão de produção

### Windows (NSIS)

```powershell
npm run production:windows
```

Saída: `production/windows/DesktopPets-Setup.exe`.

O instalador incorpora o instalador offline do WebView2, para que não seja necessário pedir ao usuário para instalá-lo manualmente. Isso aumenta o tamanho do download; não é a quantidade de RAM consumida pelo aplicativo. Instalação por usuário, sem exigir Rust, Node, Visual Studio, Docker ou um servidor. Não há assinatura de código configurada: o SmartScreen pode exibir um aviso. Antes de distribuir publicamente, valide o instalador em uma máquina limpa e considere assinatura de código.

### Linux (Debian/Ubuntu, x86_64, sessão X11)

No Linux, instale Rust estável, Node.js e os pacotes de compilação:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libx11-dev libxi-dev libxtst-dev
npm run production:linux
```

Saída: `production/linux/desktop-pets.deb`. Para instalar em outra máquina:

```bash
sudo apt install ./desktop-pets.deb
```

O APT resolve dependências de execução a partir dos repositórios configurados; pode precisar de internet. O Linux deve oferecer WebKitGTK 4.1, GTK e bibliotecas X11 compatíveis. Ubuntu 22.04/Debian 12 ou posteriores são alvos iniciais; é necessário validar cada distribuição. A captura global usa `rdev::listen`, que requer X11, e não funciona em Wayland nativo. Não execute como root nem altere permissões de dispositivos de entrada. A aparência da bandeja e o comportamento das janelas variam por ambiente gráfico.

### GitHub Actions

O workflow `.github/workflows/production.yml` oferece execução manual em Actions → Instaladores de produção → Run workflow; também executa em tags `v*`. Os jobs geram arquivos separados para Windows e Linux e os publicam como artifacts. Não publica Releases automaticamente. Para distribuição, extraia o arquivo do artifact e envie somente o instalador correspondente. Não é preciso usar WSL ou manter uma máquina Linux local para compilar se o workflow funcionar.

## Organização

```
src/config.js       modelos, preferências e opções de aparência
src/engine.js       estados e animações, lógica independente do Canvas
src/renderer.js     renderização Canvas 2D e composição em camadas
src/main.ts         editor, prévia, comunicação nativa, perfis JSON
src/style.css       aparência da interface
src-tauri/src/      janelas transparentes, persistência, tray, entrada global
scripts/            compilação de cada sistema e cópia do instalador
production/         destino exclusivo dos instaladores finais
tests/              testes do motor
.github/workflows/  CI de produção
```

## Uso

- Aparência: modelos de gato (laranja, siamês, frajola, persa, tricolor, cinza, preto) e cachorro (salsicha, husky, caramelo, poodle, golden, dálmata, beagle). Cores nativas, orelhas, pelos, padrões, rajados, cauda, peitoral, esfumado, acessórios.
- Área de trabalho: escolha gato, cachorro ou ambos ativando cada janela. Tamanho de 40 a 200%, nove posições, monitor, distância das bordas, opacidade, espelhamento, sempre no topo e click-through. Para arrastar, desative click-through. Arraste é temporário, pois a posição fixa volta ao salvar ou reiniciar.
- Geral: FPS, economia em repouso, entrada global, autostart. Fechar a janela de configuração esconde-a; reabra pela bandeja ou executando o aplicativo novamente. Use Sair para finalizar.
- Perfis: exporte/importa aparência individual JSON. Preferências são salvas localmente no diretório de configuração do Tauri em `settings.json`.
- O motor usa somente estados temporários de teclas físicas, frequência e mouse. Não salva histórico de digitação, não envia dados e não exige conta. A opção de desativar captura impede processamento e emissão dos eventos; o listener nativo permanece registrado enquanto o processo está aberto.

## Validação e pendências

- `npm test`: cinco testes automatizados passaram (prioridade das duas patas, mouse preso à pata, samba por proximidade, fade-in, configurações independentes).
- Smoke test da interface em Chromium com módulos carregados localmente e armazenamento simulado: editor, Poodle/Husky/Caramelo, botão de estresse, aba desktop, persistência do modelo. Sem erros JavaScript observados nesses cenários.
- **Não foi possível compilar o backend Rust nem empacotar os instaladores neste ambiente**: Rust não está instalado e o registro NPM não estava acessível. Não foram gerados Cargo.lock/package-lock.json. As dependências serão resolvidas na primeira compilação; versionar os lockfiles gerados antes de uma distribuição estável.
- Validação ainda necessária em Windows e Linux X11: WebView2/WebKitGTK, hooks, posicionamento em múltiplos monitores/DPI, bandeja, atalhos, autostart, click-through, instalação/desinstalação, desempenho real e segurança. O layout ABNT2 é aproximado; a biblioteca de entrada pode não diferenciar todas as teclas físicas em todos os sistemas.
- Detecção automática de aplicativos em tela cheia, arraste persistente e suporte global a Wayland são melhorias pendentes. O software é um MVP inicial, não uma versão de produção homologada.

Referências técnicas: https://v2.tauri.app/distribute/windows-installer/ · https://v2.tauri.app/distribute/debian/ · https://docs.rs/rdev/0.5.3/rdev/
