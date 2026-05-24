## Status atual vs. especificação

Já implementado: simulado com timer + sliders livres (count 1..máx, minutos 1..180, persistidos em localStorage), upload por Texto, configurações (perfil/e-mail/gênero/senha/excluir conta/meta diária — sem seção "Preferências"), botão "Rever depois" na prática, busca global. Backend de pastas (`folders.functions.ts`) e gráfico de longo prazo (`LongTermChart.tsx`) existem mas **não estão ligados à UI**. Não existe nenhum conceito de Study Session persistente.

## O que falta (escopo deste plano)

Cinco entregas, agrupadas para evitar refazer trabalho:

### 1. Study Sessions persistentes (base para itens 2 e 5)
Nova tabela `study_sessions` salvando todo o estado de uma atividade. Server functions para criar / atualizar / pausar / retomar / finalizar / listar / pegar sessão ativa. Tipos suportados: `simulado`, `practice`, `review`.

Campos: `id`, `user_id`, `kind`, `status` (`active`|`paused`|`finished`), `question_ids` (uuid[]), `picks` (jsonb mapa questionId→optionId), `current_index`, `elapsed_sec`, `time_limit_sec` (nullable, só simulado), `meta` (jsonb — filtros de origem como uploadIds, onlyWrong…), `last_activity_at`, `created_at`, `finished_at`. RLS por `user_id`.

### 2. Pausar / Retomar Simulado
- Substituir `useQuery(["sim", count])` em `simulado.tsx` por: ao montar, tenta `resumeSession(kind=simulado)`; se não existir, cria nova com `startSimulado` + `createSession`.
- A cada resposta/avanço, debounce `updateSession` (picks, current_index, elapsed_sec).
- Novo botão **"Pausar simulado"** no header do timer ao lado de "Finalizar": chama `pauseSession` e navega ao dashboard.
- Ao finalizar, `finishSession` + tela de resultado atual.

### 3. Dashboard — "Continue de onde você parou" + Rever depois + Longo prazo
- Card novo no topo do dashboard (acima de "Ações rápidas"): se houver sessão `active`/`paused`, mostra tipo + progresso (ex.: 12/30) + tempo restante (se simulado) + botão **Continuar**. Sem sessão: oculto.
- Adicionar `ActionCard` **"Rever depois"** em "Ações rápidas" (`/practice?reviewLater=1`).
- Importar e renderizar `<LongTermChart />` abaixo de "Desempenho da semana".
- Nova rota `/sessions` listando todas as sessões (tipo, progresso, data de última atividade, botão Continuar/Ver resultado).

### 4. Pastas na Biblioteca
Refatorar `library.tsx` em layout 2-colunas:
- **Sidebar esquerda**: "Todas as provas" + "Sem pasta" + lista de pastas (nome, contagem). Botão "+ Nova pasta" (modal: nome + cor). Cada pasta: menu de ações (renomear, excluir). Pasta selecionada filtra o grid à direita.
- **Grid direita**: cards de prova atuais + dropdown "Mover para…" em cada card chamando `moveUploadToFolder`. Busca dentro da pasta atual (input já-estilo Notion).
- Mobile: sidebar vira drawer.

### 5. Prática — botão "Rever depois" no dashboard (já existe na prática)
Sem mudança no `practice.tsx` além de garantir que a navegação `?reviewLater=1` funciona (já funciona).

## Detalhes técnicos

```text
DB migration:
  CREATE TABLE study_sessions (
    id uuid PK default gen_random_uuid(),
    user_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('simulado','practice','review')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','finished')),
    question_ids uuid[] NOT NULL DEFAULT '{}',
    picks jsonb NOT NULL DEFAULT '{}',
    current_index int NOT NULL DEFAULT 0,
    elapsed_sec int NOT NULL DEFAULT 0,
    time_limit_sec int,
    meta jsonb NOT NULL DEFAULT '{}',
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
  );
  -- RLS: select/insert/update/delete WHERE auth.uid() = user_id
  CREATE INDEX ON study_sessions(user_id, status, last_activity_at DESC);

Novos arquivos:
  src/lib/sessions.functions.ts   (create/get/update/pause/resume/finish/list/getActive)
  src/routes/_authenticated/sessions.tsx
  src/components/SessionsResumeCard.tsx       (usado no dashboard)
  src/components/library/FoldersSidebar.tsx
  src/components/library/FolderDialog.tsx     (criar/renomear)
  src/components/library/MoveToFolderMenu.tsx

Arquivos editados:
  src/routes/_authenticated/dashboard.tsx     (+ resume card, + rever depois, + LongTermChart)
  src/routes/_authenticated/simulado.tsx      (integração session: persistir picks/idx/elapsed; botão Pausar)
  src/routes/_authenticated/library.tsx       (layout 2-col com pastas)
  src/lib/practice.functions.ts               (listUploadsWithStats: incluir folder_id)
```

Garantir que ao restaurar simulado o cronômetro continua do `time_limit_sec - elapsed_sec`. `updateSession` é chamado com debounce 1.5s para evitar flood. A retomada de prática/revisão usa o mesmo padrão mas sem timer.

## Sugestão de execução

Recomendo fazer em **2 entregas** para revisão incremental:

- **Entrega A (base + simulado)**: migração `study_sessions`, `sessions.functions.ts`, pausar/retomar simulado, card "Continue de onde parou" no dashboard, rota `/sessions`, atalho Rever depois e LongTermChart no dashboard.
- **Entrega B (pastas)**: UI completa de pastas na biblioteca.

Confirma se posso seguir com **A primeiro** (recomendado) ou prefere **tudo de uma vez**, ou só um item específico?
