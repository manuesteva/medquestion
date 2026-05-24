## Fase 3 — Escopo

Três blocos: **Biblioteca com pastas**, **Configurações SaaS** e **Extras** (Rever depois, busca global, progresso de longo prazo).

---

### 1. Biblioteca com pastas (drag-and-drop)

**Banco**
- Nova tabela `folders` (`id`, `user_id`, `name`, `color`, `position`, `created_at`).
- Nova coluna `folder_id uuid NULL` em `uploads` (sem cascade — exclusão de pasta apenas move provas para "Sem pasta").
- RLS por `user_id` em ambas. Índice em `uploads(folder_id, user_id)`.

**Server functions** (`src/lib/folders.functions.ts`)
- `listFolders` — pastas + contagem de provas.
- `createFolder({ name, color })`.
- `renameFolder({ id, name, color? })`.
- `deleteFolder({ id })` — apenas tira `folder_id` das provas, depois remove a pasta.
- `moveUploadToFolder({ uploadId, folderId | null })`.
- `reorderFolders({ ids: string[] })`.

**UI** (`src/routes/_authenticated/library.tsx`)
- Sidebar esquerda com lista de pastas: "Todas", "Sem pasta", pastas do usuário, botão "+ Nova pasta".
- Card de prova vira **draggable** (HTML5 DnD nativo, sem libs extras).
- Cada item da sidebar é **drop target**: solta a prova → chama `moveUploadToFolder`.
- Filtro visual: ao clicar numa pasta, lista só mostra provas dela.
- Menu de contexto na pasta: renomear, escolher cor (4-6 cores fixas dos tokens), excluir.
- Pasta exibe contagem; "Sem pasta" agrupa `folder_id IS NULL`.
- Mobile (<sm): sidebar vira drawer (botão "Pastas" no topo). DnD desabilitado em touch — fallback para botão "Mover para…" no card.

---

### 2. Configurações — padrão SaaS

Reescrever `src/routes/_authenticated/settings.tsx` em **duas seções separadas** (estilo Notion/Stripe):

**Perfil** (dados pessoais editáveis inline com botão "Salvar" por campo)
- Nome completo (input).
- Avatar (upload para bucket `avatars` novo, público; fallback iniciais).
- E-mail — input + botão "Alterar e-mail" → chama `supabase.auth.updateUser({ email })`; UI mostra "Verifique seu novo e-mail" até confirmação.
- Gênero (chips — mantém existente).
- Meta diária (slider — mantém existente).

**Conta** (ações críticas, separadas visualmente com card destacado)
- Trocar senha → modal com 3 campos: senha atual, nova senha, confirmar. Server fn `changePassword`: reautentica com `signInWithPassword(currentEmail, oldPassword)`, então `supabase.auth.updateUser({ password: newPassword })`. Erros: "senha atual incorreta", "senhas não coincidem", "mínimo 8 caracteres".
- Sair (mantém).
- **Excluir conta** (card destructive, no rodapé):
  - Modal de confirmação com 2 gates: checkbox "Entendo que é permanente" + campo onde digita "EXCLUIR".
  - Server fn `deleteMyAccount` (admin): valida sessão via `requireSupabaseAuth`, depois `supabaseAdmin.auth.admin.deleteUser(userId)` — cascade no DB já apaga profile/uploads/questions/attempts.
  - Storage: remove arquivos do bucket `prova-uploads` sob `userId/*` e avatar antes do delete.
  - Após sucesso, signOut + redirect para `/`.

**Excluir** seção "Preferências" (não-editável) como pedido.

**Bucket novo**: `avatars` (público). Server fn `uploadAvatar` recebe arquivo via FormData, valida tipo (jpg/png/webp) e tamanho (≤2MB).

---

### 3. Funcionalidades extras

**3a. Rever depois**
- Tabela `review_later` (`user_id`, `question_id`, `created_at`) — PK composta, RLS por user_id.
- Server fns `toggleReviewLater({ questionId })` e `getReviewLaterIds` em `practice.functions.ts`.
- Botão **🔖 "Rever depois"** ao lado do "Favoritar" em `practice.tsx` e `simulado.tsx` (ícone `BookmarkPlus`).
- Filtro `onlyReviewLater` no schema `Filters` de `listQuestions`.
- Card "Rever depois" no dashboard mostrando contagem + atalho para `/practice?reviewLater=1`.

**3b. Busca global (⌘K)**
- Componente `GlobalSearch.tsx` montado no header de `_authenticated.tsx`.
- Atalho `⌘K` / `Ctrl+K` abre modal centralizado (`<dialog>` ou portal).
- Server fn `globalSearch({ query, limit=20 })` que faz `ilike` em `questions.statement`, `questions.subject`, `uploads.display_name/file_name`, e busca em `notes.body`.
- Resultados agrupados: Questões / Provas / Notas. Click → navega para o destino (prova → biblioteca, questão → sessão filtrada por aquela questão, nota → questão correspondente).
- Histórico das últimas 5 buscas em `localStorage` ("global-search:history").

**3c. Progresso de longo prazo**
- Seção nova "Evolução" no `dashboard.tsx`, abaixo das stats atuais.
- Server fn `getLongTermProgress` que agrupa `attempts` por semana (últimas 12) e por mês (últimos 6) — retorna `{ weekly: [{label, total, correct}], monthly: [...] }`.
- Toggle "Semanal | Mensal" → gráfico de barras com taxa de acerto sobreposta (usar `recharts`, já instalado se houver, senão SVG inline).
- Cálculo de "curva de aprendizado": % acerto mês-a-mês com delta vs. mês anterior.

---

## Detalhes técnicos

**Migrações SQL** (1 migration consolidada):
- `folders` table + RLS + índice.
- `uploads.folder_id` + FK + índice.
- `review_later` table + RLS.
- Não criar avatars bucket via SQL — usar `supabase--storage_upload` ou criar pelo handler na primeira escrita; melhor: incluir `INSERT INTO storage.buckets` na migration + policies.

**Server functions novas**:
- `src/lib/folders.functions.ts` (6 fns)
- `src/lib/profile.functions.ts` — adicionar `updateFullName`, `uploadAvatar`, `changePassword`, `deleteMyAccount`
- `src/lib/practice.functions.ts` — adicionar `toggleReviewLater`, `getReviewLaterIds`, estender `Filters` com `onlyReviewLater`
- `src/lib/search.functions.ts` — `globalSearch`
- `src/lib/stats.functions.ts` (ou existente) — `getLongTermProgress`

**UI atualizadas**:
- `settings.tsx` (reescrita Perfil/Conta)
- `library.tsx` (sidebar pastas + DnD)
- `_authenticated.tsx` (botão busca no header + atalho ⌘K)
- `practice.tsx` + `simulado.tsx` (botão Rever depois)
- `dashboard.tsx` (gráfico longo prazo + card Rever depois)

**Arquivos novos**:
- `src/components/GlobalSearch.tsx`
- `src/components/FolderSidebar.tsx`
- `src/components/DeleteAccountDialog.tsx`
- `src/components/ChangePasswordDialog.tsx`
- `src/components/LongTermChart.tsx`

**Segurança**:
- `deleteMyAccount` é admin client; só executa após `requireSupabaseAuth` (precisa do bearer do próprio usuário). Re-valida `userId === context.userId` para evitar uso indevido.
- `changePassword` exige reautenticação server-side (sign in com senha atual num client temporário) antes de chamar update.

---

## Plano de entrega

Implementação em ordem (1 migration + código em paralelo):

1. Migration SQL (folders + review_later + uploads.folder_id + avatars bucket).
2. Server functions (folders, profile extra, search, long-term, review-later).
3. Reescrita de `settings.tsx` (Perfil/Conta + dialogs).
4. Sidebar de pastas + DnD em `library.tsx`.
5. Botão "Rever depois" em practice/simulado + filtro.
6. `GlobalSearch` no header com ⌘K.
7. Gráfico de longo prazo no dashboard.

Você confirma este escopo? Se preferir entregar em sub-fases (ex: 3a Biblioteca, 3b Configurações, 3c Extras), me diga e eu separo.