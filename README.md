# Painel Eleitoral Fortaleza 2024 — Análise de Votação por Bairro

Dashboard executivo de Business Intelligence e Data Analytics com os dados das Eleições Municipais de 2024 em Fortaleza/CE (586.560 votos, 54 candidatos, 111 bairros).

---

## Como Publicar no GitHub Pages Sem Erro de Tela Branca

O erro de **tela branca** no GitHub Pages geralmente ocorre por dois motivos:
1. **Caminhos absolutos:** Os scripts buscam `/assets/...` na raiz do domínio em vez de `./assets/...` dentro do repositório (`https://usuario.github.io/repositorio/`). Isso já foi corrigido com `base: './'` no `vite.config.ts`.
2. **Servidor estático sem build:** O GitHub Pages padrão tenta carregar arquivos `.tsx` diretamente sem compilá-los com o Vite.

### Opção 1: Publicação Automática via GitHub Actions (Recomendada)
O repositório já inclui o arquivo de automação `.github/workflows/deploy.yml`.

1. Envie o código para o GitHub:
   ```bash
   git add .
   git commit -m "Publicação do painel eleitoral"
   git push origin main
   ```
2. No seu repositório no GitHub, acesse:
   **Settings** > **Pages**
3. Em **Build and deployment** > **Source**, selecione:
   **GitHub Actions**
4. O GitHub executará o build e publicará seu site automaticamente com endereço:
   `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

---

### Opção 2: Publicação Manual da Pasta `dist`
Se preferir gerar os arquivos compilados localmente e publicá-los:

1. Gere o build de produção:
   ```bash
   npm run build
   ```
2. A pasta `dist/` conterá todo o site pronto para qualquer hospedagem estática.
3. Você pode publicar a pasta `dist/` diretamente na branch `gh-pages` ou no branch raiz.

---

### Opção 3: Usar o Arquivo Autocontido `dashboard.html`
Se quiser um único arquivo que funcione 100% offline em qualquer navegador ou hospedagem simples sem depender de Node.js:
- Abra ou publique diretamente o arquivo `dashboard.html` (disponível na raiz e em `/public/dashboard.html`).
- Ele contém todos os 5.789 registros, estilos Tailwind e biblioteca ECharts incorporados.
