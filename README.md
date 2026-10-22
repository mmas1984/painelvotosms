# Painel Eleitoral Fortaleza 2024 & Ceará 2026 — Inteligência de Dados

Sistema executivo de Business Intelligence e Data Analytics eleitoral com controle de acesso RBAC, sincronização Google Drive, cartografia interativa (Bairros de Fortaleza 2024 e Municípios do Ceará 2026) e filtros dinâmicos de Cargo.

**Elaborado Por Marcos Silveira**

---

## 🛠️ Correção da Tela Branca no GitHub Pages

O problema de **tela branca** no GitHub Pages foi corrigido de forma abrangente com 4 camadas de proteção:

1. **Configuração Dinâmica do Base Path no Vite:** 
   O `vite.config.ts` detecta automaticamente o nome do repositório no GitHub Actions (`process.env.GITHUB_REPOSITORY` e `process.env.BASE_PATH`), garantindo que os arquivos em `./assets/...` e `/<repo>/assets/...` sejam encontrados tanto com quanto sem barra final (`/`).

2. **Ordem Correta no GitHub Actions (`.github/workflows/deploy.yml`):**
   A ação `actions/configure-pages@v5` foi configurada para rodar **antes** do `npm run build`, exportando o `base_path` correto para o Vite compilar.

3. **Arquivos `.nojekyll` e `404.html`:**
   Adicionados na pasta `public/` e gerados no `dist/`, impedindo que o mecanismo Jekyll do GitHub Pages ignore pastas de ativos ou gere telas brancas em recargas de rota.

4. **Splash Preloader e Fallback Automático:**
   O `index.html` agora conta com um pré-carregador estilizado com a assinatura "Elaborado Por Marcos Silveira" e um temporizador que redireciona automaticamente para a versão executiva em caso de lentidão ou falha de rede.

---

### 🚀 Como Publicar Corretamente no GitHub Pages

Para publicar seu painel sem erro:

1. **Envie o código para o GitHub:**
   ```bash
   git add .
   git commit -m "Correcao tela branca e painel atualizado"
   git push origin main
   ```

2. **Ative o GitHub Actions nas configurações do repositório:**
   - Acesse seu repositório no GitHub.
   - Clique na aba **Settings** (Configurações) no topo.
   - No menu lateral esquerdo, clique em **Pages**.
   - Em **Build and deployment** > **Source**, mude de *"Deploy from a branch"* para **GitHub Actions**.

3. **Pronto!** O GitHub Actions compilará e publicará o painel automaticamente na URL:
   `https://<seu-usuario>.github.io/<seu-repositorio>/`

---

### 🔑 Credenciais Padrão do Controle de Acesso
- **Administrador Master:** Usuário `master` | Senha `master123` *(Acesso irrestrito, gestão de usuários, senhas e sincronização Google Drive)*
- **Analista de Dados:** Usuário `analista` | Senha `analista123`
- **Operador Consulta:** Usuário `consulta` | Senha `consulta123`
