
# Parte 1 — Pipeline OCR + Validação de Gabaritos

## 0. Pré-requisitos (secrets)

Adicionar duas chaves via `add_secret`:
- `GOOGLE_AI_API_KEY` — Google AI Studio (Gemini 1.5 Pro)
- `ANTHROPIC_API_KEY` — Anthropic Console (Claude Sonnet 4)

A implementação só prossegue depois que ambas estiverem salvas.

## 1. Migração de banco

Novos campos para suportar confiança, afirmativas, tipo de questão e flags de validação:

- `questions`:
  - `confidence text` (`high|medium|low`)
  - `validation_status text` (`ok|warning|critical`)
  - `validation_reason text`
  - `question_type text` (`multipla_escolha|verdadeiro_falso|dissertativa`)
  - `affirmatives jsonb` (lista de itens I/II/III ou V/F)
  - `explanation_raw text` (explicação capturada do próprio documento, se houver)
- `uploads`:
  - `pipeline_stage text` (`uploaded|ocr|validation|sequence|saving|done|failed`)
  - `pipeline_progress int` (0-100)
  - `missing_numbers jsonb` (ex: `[4, 17]`)
  - `pending_confirmation boolean` (pausa antes de salvar quando faltar questão)

Grants e RLS já existentes nas duas tabelas cobrem os novos campos.

## 2. Pipeline server-side (`src/lib/extract.functions.ts` — reescrita)

Substituir a chamada única ao Lovable Gateway por **duas etapas em série**, com atualização do `pipeline_stage` + `pipeline_progress` no `uploads` a cada transição (cliente faz polling para a barra real).

### Etapa A — Extração (Gemini 1.5 Pro direto)

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=GOOGLE_AI_API_KEY`
- Envio multimodal: cada arquivo vira `inlineData` (PDF) ou `fileData` por URL assinada (imagem). Para PDFs grandes, usar `inlineData` base64 (limite 20MB do Gemini).
- `system_instruction`: prompt exato fornecido pelo usuário (extração rígida, sem omissões, preservar EXCETO/NÃO/INCORRETA, confiança por questão).
- `responseMimeType: application/json` + `responseSchema` com `numero`, `enunciado`, `afirmativas[]`, `alternativas[]`, `gabarito`, `explicacao`, `tipo`, `confianca`.
- Marca `pipeline_stage='ocr'`, progresso 10 → 50.

### Etapa B — Validação (Claude Sonnet 4 direto)

- Endpoint: `https://api.anthropic.com/v1/messages`, modelo `claude-sonnet-4-20250514`, header `x-api-key`, `anthropic-version: 2023-06-01`.
- System prompt exato fornecido pelo usuário (detector de inconsistências).
- Input: JSON da etapa A. Output: mesmo JSON + `validacao{status, motivo}` por questão.
- Regra inviolável aplicada server-side: se `gabarito` ≠ alternativa indicada pela `explicacao`, **prevalece a explicação**, `validacao.status='alerta'`, `validation_reason` registra o conflito.
- `pipeline_stage='validation'`, progresso 50 → 80.

### Etapa C — Sequência + persistência

1. `pipeline_stage='sequence'`, progresso 80 → 90. Detecta números faltantes; se houver, seta `missing_numbers` + `pending_confirmation=true` e **retorna** sem salvar questões. UI mostra modal.
2. Quando o cliente confirmar (nova server fn `confirmExtraction(uploadId, decision: 'continue'|'redo')`), executa a persistência: `pipeline_stage='saving'`, progresso 90 → 100. Mapeia `confianca→confidence`, `validacao→validation_status/reason`, grava `affirmatives`, `question_type`, `explanation_raw`. Nada é descartado silenciosamente.

### Tratamento de erros

- 429/insufficient_quota nas APIs → mensagem clara, `uploads.status='failed'` com `error` legível.
- Falha de parsing JSON → registra `validation_status='critical'` no upload inteiro e mantém o melhor esforço.

## 3. UI de upload (`src/routes/_authenticated/upload.tsx`)

- Barra de progresso passa a refletir as 5 etapas reais (Upload → OCR Gemini → Validação Claude → Sequência → Salvando), com label visível e percentual, lidos via polling de `uploads.pipeline_stage/progress` (intervalo 1s, para no `done|failed`).
- Quando `pending_confirmation=true` aparece modal: "⚠️ Questão X não foi identificada. Deseja continuar mesmo assim?" com botões **Continuar** / **Refazer leitura**. Os dois chamam `confirmExtraction`.
- Mantém DnD/multi-upload já implementado.

## 4. UI de questões (biblioteca + prática)

- Badge de confiança em cada questão:
  - 🟢 alta · 🟡 média (revisar) · 🔴 baixa/crítica (revisão necessária)
- Banner amarelo no topo da prova quando o upload tem warnings ou `missing_numbers`.
- Linha extra na questão quando `validation_status='warning'` mostrando `validation_reason` (ex.: "Gabarito ajustado pela explicação: B → D").
- Renderização de `affirmatives[]` como lista numerada acima das alternativas (suporte real a V/F e I/II/III).

## 5. Fora do escopo desta parte

Itens 2 (perfil/onboarding), 3 (simulado), 4 (compartilhamento), 5 (landing/LGPD) seguem para mensagens separadas conforme combinado.

---

## Detalhes técnicos

- Novas server fns: `runExtractionPipeline(uploadId)`, `getUploadProgress(uploadId)`, `confirmExtraction(uploadId, decision)`. Todas com `requireSupabaseAuth`.
- Reuso de `createUploadShell` + `createSignedUploadUrl` já existentes (upload direto ao Storage não muda).
- Polling client-side via `useQuery` com `refetchInterval` dinâmico (para quando `done|failed|pending_confirmation`).
- Chamadas a Gemini/Claude ficam em `src/lib/extract.server.ts` (helpers server-only) e são consumidas pelo `extract.functions.ts`.
- Limites: PDF até 20MB por arquivo (limite Gemini inlineData); acima disso, fatiar em páginas (já temos pipeline multi-página).
