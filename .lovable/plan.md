## Fase 1 — Críticos (OCR + Gabarito + Mobile)

Esta primeira mensagem foca apenas nos itens **2, 4 e 7** do seu brief — os bloqueadores que destroem a confiança do produto hoje. As fases 2 (Auth/Perfil/Onboarding), 3 (Simulado/Compartilhamento/Biblioteca) e 4 (Landing/LGPD/Polimento) virão em mensagens próprias, onde poderei testar cada bloco isoladamente.

---

### 1. Upload múltiplo + extração robusta (itens 2.1 – 2.9)

**`src/routes/_authenticated/upload.tsx`**
- Aceitar **vários arquivos** (drag-and-drop + file picker `multiple`) numa fila visual.
- Grid de preview com miniaturas, numeração, **arrastar para reordenar** (dnd-kit), botão excluir página, renomear a prova.
- Botão único "Processar X páginas" → envia tudo agrupado como **uma prova só**.
- Barra de progresso real (XHR + signed URL) por arquivo + fase de IA com timer e mensagens.
- Compressão client-side de imagens > 2MB (canvas → 2000px lado maior) para acelerar sem perder OCR.

**`src/lib/extract.functions.ts` — reescrita completa**
- Nova função `extractQuestionsBatch({ uploadId, files: [{path, mimeType}] })` que processa N páginas como uma prova única.
- **Modelo `google/gemini-2.5-pro`** com `max_tokens` alto (priorizar qualidade).
- Envio multi-imagem na mesma chamada via `image_url` (signed URLs, sem base64).
- **Prompt reescrito** com regras explícitas:
  - Preservar negrito/itálico/maiúsculas em palavras-chave (`EXCETO`, `NÃO`, `INCORRETA`, `CORRETA`).
  - Cada afirmativa numerada (I, II, III, 1, 2, 3) em linha própria com quebra.
  - Não fundir alternativas; não inventar conteúdo; marcar `incomplete: true` quando faltarem itens.
  - Devolver `question_number` (número original) para validação de sequência.
  - Corrigir ortografia/acentos do PT-BR sem alterar sentido clínico.
- **Validação pós-IA** server-side:
  - Detecta lacunas na sequência numérica → grava em `uploads.warnings`.
  - Bloqueia questões com < 2 alternativas, sem gabarito, ou marcadas `incomplete`.
  - Cruza `correct_rationale` com `is_correct` → se a letra citada na explicação não bater com a alternativa marcada como correta, marca `flagged_inconsistent`.

**Schema (uma migração nova)**
- `uploads.warnings jsonb default '[]'` — lista de avisos ("Questão 4 não identificada", etc.).
- `questions.question_number int` + `questions.flagged_inconsistent bool default false`.
- `questions.formatting jsonb default '{}'` — guarda spans de negrito/itálico para renderização.

**UI da biblioteca/prática**
- Banner amarelo na prova quando há `warnings` ou `flagged_inconsistent`, com lista clicável das questões problemáticas.
- Renderizar `statement` preservando quebras de linha e (via marcação Markdown leve) **negrito/maiúsculas**.

---

### 2. Confiabilidade do gabarito (item 4)

**Validação cruzada na extração (mesma chamada da IA)**
- O prompt agora exige `correct_letter` (A-E) + `correct_rationale` separados. Servidor compara: se `correct_letter ≠ option.label where is_correct`, dispara segunda chamada de "revisão" pedindo à IA que reanalise apenas aquela questão.
- Se ainda houver conflito → marca `flagged_inconsistent` e a UI exibe "Gabarito em revisão — clique para corrigir manualmente".

**Edição manual rápida**
- Em `practice.tsx` / `library`, novo botão "Corrigir gabarito" abre dialog: lista alternativas, usuário clica na correta, salva via nova server fn `fixAnswerKey`.

**`src/lib/explain.functions.ts`**
- Ajustar para nunca contradizer o `is_correct` salvo: a explicação recebe a letra correta como input e é instruída a justificar exatamente ela.

---

### 3. Responsividade mobile (item 7)

**Auditoria + correção em todas as rotas**, especialmente:
- `src/routes/_authenticated.tsx` (sidebar/topbar) — sidebar vira Sheet em < 768px, header mais compacto.
- `src/routes/_authenticated/practice.tsx` — alternativas com `min-h-12`, padding mobile, sem overflow horizontal.
- `src/routes/_authenticated/dashboard.tsx` / `library.tsx` — grids `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, cards full-width no mobile.
- `src/routes/index.tsx` — hero com `text-balance`, CTAs empilhados, sem barras gigantes.
- Adicionar `overflow-x-hidden` no body + checar todos os `min-w-*` que estouram em 360px.
- Tap targets ≥ 44px (botões `h-11` no mobile via responsive classes).
- Safe-area no iOS: `pb-[env(safe-area-inset-bottom)]` em barras fixas.

---

### Fora desta fase (próximas mensagens)
- Fase 2: nome completo obrigatório, identificação no onboarding, sessão persistente, edição de pastas.
- Fase 3: simulado com seleção de provas + modos de correção + tela final, compartilhamento com cópia.
- Fase 4: landing (remover métricas falsas), Termos/LGPD reais, checkbox de aceite, polimento geral de UX.

---

### Detalhes técnicos
- Modelo IA: `google/gemini-2.5-pro` via Lovable AI Gateway (já configurado, sem nova chave).
- Storage: bucket `prova-uploads` já existe; reutilizado.
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` (a instalar).
- Markdown leve no statement: `react-markdown` (a instalar) com whitelist mínima (`**`, `*`, quebras).
- Backwards compat: uploads antigos continuam funcionando; novos campos têm default.
