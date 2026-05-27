import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Direct Gemini API client (used for OCR + Validation stages)
// ============================================================
const GEMINI_MODEL = "gemini-1.5-pro-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function fetchFileAsBase64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar arquivo (${r.status})`);
  const buf = await r.arrayBuffer();
  // Convert in chunks to avoid call-stack overflow on large files.
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function callGemini<T>(opts: {
  apiKey: string;
  systemPrompt: string;
  parts: GeminiPart[];
  responseSchema: Record<string, unknown>;
}): Promise<T> {
  const resp = await fetch(`${GEMINI_URL}?key=${opts.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [{ role: "user", parts: opts.parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: 0.1,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Gemini ${resp.status}: ${txt.slice(0, 240)}`);
  }
  const json = await resp.json();
  const text: string | undefined =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ||
    json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta vazia do Gemini.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini retornou JSON inválido.");
  }
}

// ============================================================
// Text cleanup
// ============================================================
function cleanText(input: string): string {
  let s = (input ?? "").replace(/\r\n?/g, "\n");
  // join hyphenated word breaks
  s = s.replace(/([A-Za-zÀ-ÿ])-\n([a-zà-ÿ])/g, "$1$2");
  // collapse tabs/spaces
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/ ?\n ?/g, "\n");
  // fix spacing around punctuation
  s = s.replace(/\s+([,.;:!?])/g, "$1");
  s = s.replace(/([,.;:!?])([A-Za-zÀ-ÿ])/g, "$1 $2");
  // collapse 3+ blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function cleanOption(input: string): string {
  let s = cleanText(input);
  s = s.replace(/^\s*\(?[A-E]\)?\s*[\.\)\-:]\s+/i, "");
  return s.trim();
}

// ============================================================
// Schemas
// ============================================================
const FileSchema = z.object({
  path: z.string().min(1),
  mimeType: z.string().min(1),
});

const InputSchema = z.object({
  uploadId: z.string().uuid(),
  // New multi-file shape
  files: z.array(FileSchema).min(1).max(40).optional(),
  // Legacy single-file shape (kept for back-compat)
  filePath: z.string().optional(),
  mimeType: z.string().optional(),
});

const ExtractedQuestionSchema = z.object({
  question_number: z.number().int().min(1).max(2000).nullable().optional(),
  statement: z.string().min(1),
  subject: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  incomplete: z.boolean().optional().default(false),
  correct_letter: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
  explanation: z.string().nullable().optional(),
  question_type: z.string().nullable().optional(),
  affirmatives: z.array(z.string()).nullable().optional(),
  options: z
    .array(
      z.object({
        label: z.enum(["A", "B", "C", "D", "E"]),
        text: z.string().min(1),
        is_correct: z.boolean(),
      }),
    )
    .min(2)
    .max(5),
});

// ============================================================
// Prompt + tool
// ============================================================
const SYSTEM_PROMPT = `Você é um extrator profissional de provas brasileiras (residência médica, concursos). As páginas a seguir compõem UMA ÚNICA prova.

REGRAS OBRIGATÓRIAS:
1. Extraia TODAS as questões objetivas presentes. Não pule nenhuma. Se a prova tem questões 1 a 40, devolva 40.
2. Para cada questão, devolva o número original em "question_number".
3. Reconstrua o enunciado em texto fiel ao original. Junte palavras quebradas por hifenização. Corrija erros óbvios de OCR (acentos, caracteres trocados) SEM alterar o sentido clínico/técnico.
4. Preserve a ÊNFASE original usando Markdown: palavras em maiúsculas-chave (EXCETO, NÃO, INCORRETA, CORRETA, FALSA, VERDADEIRA) e termos em negrito devem aparecer entre **dois asteriscos**.
5. Quando o enunciado tiver afirmativas numeradas (I, II, III) ou itens (1., 2., 3., a., b., c.), coloque cada uma em SUA PRÓPRIA LINHA, exatamente como na prova. Não fundir em texto corrido.
6. Para cada alternativa, escreva o texto integral SEM o rótulo (apenas o conteúdo). Use letras A–E.
7. Se o documento traz gabarito, use-o. Caso contrário, infira pela melhor resposta. Marque "correct_letter" com a LETRA correta. A alternativa correspondente em "options" deve ter is_correct=true; as outras false.
8. Se uma questão estiver incompleta no documento (faltam alternativas, afirmativas ou parte do enunciado), inclua mesmo assim e marque "incomplete": true.
9. Identifique a matéria (Cardiologia, Pediatria, etc.) quando claramente identificável.
10. Ignore cabeçalhos, rodapés, números de página e instruções gerais.

NÃO INVENTE conteúdo. NÃO REPITA questões. NÃO PULE questões.
Devolva o resultado APENAS via a tool save_questions.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "save_questions",
    description: "Salva todas as questões extraídas da prova.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_number: { type: "number" },
              statement: { type: "string" },
              subject: { type: "string" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              incomplete: { type: "boolean" },
              correct_letter: { type: "string", enum: ["A", "B", "C", "D", "E"] },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", enum: ["A", "B", "C", "D", "E"] },
                    text: { type: "string" },
                    is_correct: { type: "boolean" },
                  },
                  required: ["label", "text", "is_correct"],
                  additionalProperties: false,
                },
              },
            },
            required: ["statement", "options"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  },
} as const;

// ============================================================
// Gemini response schemas + validation prompt
// ============================================================
const GEMINI_EXTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_number: { type: "integer", nullable: true },
          statement: { type: "string" },
          subject: { type: "string", nullable: true },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"], nullable: true },
          incomplete: { type: "boolean", nullable: true },
          correct_letter: { type: "string", enum: ["A", "B", "C", "D", "E"], nullable: true },
          explanation: { type: "string", nullable: true },
          question_type: { type: "string", nullable: true },
          affirmatives: { type: "array", items: { type: "string" }, nullable: true },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", enum: ["A", "B", "C", "D", "E"] },
                text: { type: "string" },
                is_correct: { type: "boolean" },
              },
              required: ["label", "text", "is_correct"],
            },
          },
        },
        required: ["statement", "options"],
      },
    },
  },
  required: ["questions"],
};

const GEMINI_VALIDATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          idx: { type: "integer" },
          validation_status: { type: "string", enum: ["ok", "alerta", "erro"] },
          validation_reason: { type: "string", nullable: true },
          resolved_letter: { type: "string", enum: ["A", "B", "C", "D", "E"], nullable: true },
          confidence: { type: "number", nullable: true },
        },
        required: ["idx", "validation_status"],
      },
    },
  },
  required: ["items"],
};

const VALIDATION_PROMPT = `Você é um revisor pedagógico. Você recebe uma lista de questões já extraídas (JSON) com enunciado, alternativas, gabarito ("correct_letter") e, quando disponível, "explanation".

Para cada questão, devolva um item com:
- idx (mesmo idx recebido)
- validation_status: "ok" se o gabarito e a explicação são coerentes; "alerta" se a explicação aponta uma letra diferente do gabarito ou há ambiguidade; "erro" se a questão está claramente quebrada (faltam alternativas/enunciado).
- validation_reason: explique o problema em uma frase curta em português.
- resolved_letter: a LETRA correta segundo a EXPLICAÇÃO (regra: a explicação sempre prevalece sobre o gabarito impresso quando divergem). Use null se não houver explicação clara.
- confidence: número 0–1 estimando sua certeza na resposta correta.

Devolva APENAS JSON conforme o schema fornecido.`;

// ============================================================
// Validation utilities
// ============================================================
function buildWarnings(questions: Array<z.infer<typeof ExtractedQuestionSchema>>) {
  const warnings: string[] = [];
  const numbers = questions
    .map((q) => q.question_number)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  if (numbers.length >= 2) {
    const min = numbers[0];
    const max = numbers[numbers.length - 1];
    const seen = new Set(numbers);
    const missing: number[] = [];
    for (let i = min; i <= max; i++) if (!seen.has(i)) missing.push(i);
    if (missing.length > 0) {
      const list = missing.slice(0, 10).join(", ");
      warnings.push(
        `Não foi possível identificar ${missing.length} questão(ões): ${list}${missing.length > 10 ? "…" : ""}`,
      );
    }
  }
  const incompleteCount = questions.filter((q) => q.incomplete).length;
  if (incompleteCount > 0) {
    warnings.push(`${incompleteCount} questão(ões) marcadas como incompletas — revise antes de praticar.`);
  }
  return warnings;
}

/**
 * Normalizes is_correct using correct_letter as the source of truth. Returns
 * whether the AI's option flags conflicted with its stated correct letter.
 */
function reconcileCorrectness(q: z.infer<typeof ExtractedQuestionSchema>): {
  options: typeof q.options;
  inconsistent: boolean;
} {
  const letter = q.correct_letter ?? null;
  const flaggedCorrect = q.options.filter((o) => o.is_correct);
  let inconsistent = false;

  if (letter) {
    const target = q.options.find((o) => o.label === letter);
    if (!target) {
      inconsistent = true;
    } else if (flaggedCorrect.length !== 1 || flaggedCorrect[0].label !== letter) {
      inconsistent = true;
    }
    return {
      options: q.options.map((o) => ({ ...o, is_correct: o.label === letter })),
      inconsistent,
    };
  }

  // No explicit letter: ensure exactly one is_correct
  if (flaggedCorrect.length === 1) {
    return { options: q.options, inconsistent: false };
  }
  // No agreement → mark as inconsistent and keep first
  inconsistent = true;
  const first = flaggedCorrect[0]?.label ?? q.options[0].label;
  return {
    options: q.options.map((o) => ({ ...o, is_correct: o.label === first })),
    inconsistent,
  };
}

// ============================================================
// extractQuestions — multi-page, single prova
// ============================================================
export const extractQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Normalize input to files[]
    const files =
      data.files && data.files.length > 0
        ? data.files
        : data.filePath && data.mimeType
          ? [{ path: data.filePath, mimeType: data.mimeType }]
          : [];
    if (files.length === 0) throw new Error("Nenhum arquivo enviado.");

    async function fail(msg: string): Promise<never> {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: msg, pipeline_stage: "failed" })
        .eq("id", data.uploadId);
      throw new Error(msg);
    }

    async function setStage(stage: string, progress: number) {
      await supabase
        .from("uploads")
        .update({ pipeline_stage: stage, pipeline_progress: progress })
        .eq("id", data.uploadId);
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return fail("GOOGLE_AI_API_KEY não configurada");

    await setStage("upload", 10);

    // 1) Build signed URLs and download into base64 inline parts for Gemini.
    const parts: GeminiPart[] = [
      {
        text: `Esta prova tem ${files.length} página(s)/arquivo(s). Extraia TODAS as questões objetivas em ordem.`,
      },
    ];
    for (const f of files) {
      const { data: sig, error: sigErr } = await supabase.storage
        .from("prova-uploads")
        .createSignedUrl(f.path, 60 * 30);
      if (sigErr || !sig?.signedUrl) {
        return fail(sigErr?.message ?? "Falha ao preparar arquivo para a IA.");
      }
      try {
        const b64 = await fetchFileAsBase64(sig.signedUrl);
        parts.push({ inline_data: { mime_type: f.mimeType, data: b64 } });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Falha ao carregar arquivo.");
      }
    }

    // ============ STAGE A — OCR / EXTRACTION ============
    await setStage("ocr", 25);
    let extracted: { questions: Array<z.infer<typeof ExtractedQuestionSchema>> };
    try {
      extracted = await callGemini<typeof extracted>({
        apiKey,
        systemPrompt: SYSTEM_PROMPT,
        parts,
        responseSchema: GEMINI_EXTRACT_SCHEMA,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Falha na extração (Gemini).");
    }

    const listParse = z
      .object({ questions: z.array(ExtractedQuestionSchema) })
      .safeParse(extracted);
    if (!listParse.success || listParse.data.questions.length === 0) {
      return fail("Nenhuma questão foi reconhecida pelo OCR. Tente fotos mais nítidas.");
    }

    await setStage("ocr", 50);

    // ============ STAGE B — VALIDATION (Gemini again) ============
    await setStage("validation", 55);
    const reviewInput = listParse.data.questions.map((q, idx) => ({
      idx,
      question_number: q.question_number ?? null,
      statement: q.statement,
      correct_letter: q.correct_letter ?? null,
      explanation: (q as unknown as { explanation?: string }).explanation ?? null,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
    }));
    type ReviewRow = {
      idx: number;
      validation_status: "ok" | "alerta" | "erro";
      validation_reason?: string | null;
      resolved_letter?: "A" | "B" | "C" | "D" | "E" | null;
      confidence?: number | null;
    };
    let review: { items: ReviewRow[] } = { items: [] };
    try {
      review = await callGemini<typeof review>({
        apiKey,
        systemPrompt: VALIDATION_PROMPT,
        parts: [{ text: JSON.stringify({ questions: reviewInput }) }],
        responseSchema: GEMINI_VALIDATION_SCHEMA,
      });
    } catch {
      // validation is best-effort; continue without it
      review = { items: [] };
    }
    const reviewByIdx = new Map(review.items.map((r) => [r.idx, r]));
    await setStage("validation", 75);

    // ============ STAGE C — Clean + reconcile + sequence check ============
    const cleaned = listParse.data.questions
      .map((q, idx) => {
        const rec = reconcileCorrectness(q);
        const rv = reviewByIdx.get(idx);
        // Rule: explanation prevails — if validator resolved a different letter, use it.
        let finalOptions = rec.options;
        let inconsistent = rec.inconsistent;
        let validation_status: string = rv?.validation_status ?? "ok";
        let validation_reason: string | null = rv?.validation_reason ?? null;
        if (rv?.resolved_letter && q.options.some((o) => o.label === rv.resolved_letter)) {
          const target = rv.resolved_letter;
          const currentCorrect = finalOptions.find((o) => o.is_correct)?.label;
          if (currentCorrect !== target) {
            finalOptions = finalOptions.map((o) => ({ ...o, is_correct: o.label === target }));
            inconsistent = true;
            validation_status = "alerta";
            validation_reason =
              validation_reason ??
              `Gabarito original (${currentCorrect ?? "?"}) divergente da explicação (${target}). Prevalece a explicação.`;
          }
        }
        const conf = typeof rv?.confidence === "number" ? rv.confidence : null;
        return {
          question_number: q.question_number ?? null,
          statement: cleanText(q.statement),
          subject: q.subject?.trim() || null,
          difficulty: q.difficulty ?? null,
          incomplete: !!q.incomplete,
          flagged_inconsistent: inconsistent,
          confidence: conf,
          validation_status,
          validation_reason,
          explanation_raw: (q as unknown as { explanation?: string }).explanation ?? null,
          question_type:
            (q as unknown as { question_type?: string }).question_type ?? "multiple_choice",
          affirmatives:
            (q as unknown as { affirmatives?: unknown[] }).affirmatives ?? null,
          options: finalOptions.map((o) => ({
            label: o.label,
            text: cleanOption(o.text),
            is_correct: o.is_correct,
          })),
        };
      })
      .filter((q) => q.statement.length >= 15 && q.options.length >= 2);

    if (cleaned.length === 0) {
      return fail("Nenhuma questão objetiva válida após validação.");
    }

    // Sequence check — pause if missing numbers detected
    const warnings = buildWarnings(listParse.data.questions);
    const numbers = cleaned
      .map((q) => q.question_number)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);
    const missing: number[] = [];
    if (numbers.length >= 2) {
      const seen = new Set(numbers);
      for (let i = numbers[0]; i <= numbers[numbers.length - 1]; i++) {
        if (!seen.has(i)) missing.push(i);
      }
    }

    if (missing.length > 0) {
      // Pause for user confirmation — persist the cleaned payload for later commit.
      await supabase
        .from("uploads")
        .update({
          pipeline_stage: "awaiting_confirmation",
          pipeline_progress: 85,
          missing_numbers: missing,
          pending_confirmation: true,
          pending_payload: { cleaned, warnings } as unknown as Record<string, unknown>,
        })
        .eq("id", data.uploadId);
      return {
        ok: true as const,
        pending: true as const,
        missing,
        count: cleaned.length,
      };
    }

    // No missing — persist immediately
    return await persistCleaned({
      supabase,
      userId,
      uploadId: data.uploadId,
      cleaned,
      warnings,
    });
  });

// ============================================================
// persistCleaned — write questions/options to DB, finalize upload
// ============================================================
async function persistCleaned(opts: {
  supabase: any;
  userId: string;
  uploadId: string;
  cleaned: Array<{
    question_number: number | null;
    statement: string;
    subject: string | null;
    difficulty: string | null;
    flagged_inconsistent: boolean;
    confidence: number | null;
    validation_status: string;
    validation_reason: string | null;
    explanation_raw: string | null;
    question_type: string;
    affirmatives: unknown[] | null;
    options: Array<{ label: string; text: string; is_correct: boolean }>;
  }>;
  warnings: string[];
}) {
  const { supabase, userId, uploadId, cleaned, warnings } = opts;

  await supabase
    .from("uploads")
    .update({ pipeline_stage: "saving", pipeline_progress: 92 })
    .eq("id", uploadId);

  const questionRows = cleaned.map((q) => ({
    user_id: userId,
    upload_id: uploadId,
    statement: q.statement,
    subject: q.subject,
    difficulty: q.difficulty,
    question_number: q.question_number,
    flagged_inconsistent: q.flagged_inconsistent,
    confidence: q.confidence,
    validation_status: q.validation_status,
    validation_reason: q.validation_reason,
    question_type: q.question_type,
    affirmatives: q.affirmatives as unknown,
    explanation_raw: q.explanation_raw,
  }));
  const { data: inserted, error: qErr } = await supabase
    .from("questions")
    .insert(questionRows)
    .select("id");
  if (qErr || !inserted) {
    await supabase
      .from("uploads")
      .update({ status: "failed", error: qErr?.message ?? "Erro ao salvar questões." })
      .eq("id", uploadId);
    throw new Error(qErr?.message ?? "Erro ao salvar questões.");
  }

  const optionRows: Array<{
    question_id: string;
    label: string;
    text: string;
    is_correct: boolean;
  }> = [];
  inserted.forEach((row: { id: string }, i: number) => {
    const q = cleaned[i];
    for (const o of q.options) {
      optionRows.push({
        question_id: row.id,
        label: o.label,
        text: o.text,
        is_correct: o.is_correct,
      });
    }
  });
  if (optionRows.length > 0) {
    const { error: oErr } = await supabase
      .from("question_options")
      .insert(optionRows);
    if (oErr) {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: oErr.message })
        .eq("id", uploadId);
      throw new Error(oErr.message);
    }
  }

  const flaggedCount = cleaned.filter((q) => q.flagged_inconsistent).length;
  if (flaggedCount > 0) {
    warnings.push(
      `${flaggedCount} questão(ões) com gabarito em revisão — verifique manualmente antes de praticar.`,
    );
  }

  await supabase
    .from("uploads")
    .update({
      status: "done",
      questions_count: inserted.length,
      warnings,
      pipeline_stage: "done",
      pipeline_progress: 100,
      pending_confirmation: false,
      pending_payload: null,
    })
    .eq("id", uploadId);

  return {
    ok: true as const,
    pending: false as const,
    count: inserted.length,
    warnings,
    flaggedCount,
  };
}

// ============================================================
// confirmExtraction — user decided to continue or redo after pause
// ============================================================
export const confirmExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        uploadId: z.string().uuid(),
        decision: z.enum(["continue", "redo"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("uploads")
      .select("id, user_id, pending_payload, pending_confirmation")
      .eq("id", data.uploadId)
      .single();
    if (error || !row) throw new Error("Upload não encontrado.");
    if (row.user_id !== userId) throw new Error("Sem permissão.");
    if (!row.pending_confirmation || !row.pending_payload) {
      throw new Error("Este upload não está aguardando confirmação.");
    }

    if (data.decision === "redo") {
      await supabase
        .from("uploads")
        .update({
          status: "failed",
          error: "Cancelado pelo usuário para reenvio.",
          pipeline_stage: "cancelled",
          pending_confirmation: false,
          pending_payload: null,
        })
        .eq("id", data.uploadId);
      return { ok: true as const, cancelled: true as const };
    }

    const payload = row.pending_payload as {
      cleaned: Parameters<typeof persistCleaned>[0]["cleaned"];
      warnings: string[];
    };
    return persistCleaned({
      supabase,
      userId,
      uploadId: data.uploadId,
      cleaned: payload.cleaned,
      warnings: payload.warnings ?? [],
    });
  });

// ============================================================
// extractQuestionsFromText — paste/typed input
// ============================================================
const TextInputSchema = z.object({
  text: z.string().min(1).max(200_000),
  displayName: z.string().max(120).optional().nullable(),
});

async function insertFallbackQuestion(opts: {
  supabase: any;
  userId: string;
  uploadId: string;
  text: string;
}) {
  const { supabase, userId, uploadId, text } = opts;
  const statement = cleanText(text).slice(0, 8000) || "(texto sem conteúdo)";
  const { data: q, error } = await supabase
    .from("questions")
    .insert({
      user_id: userId,
      upload_id: uploadId,
      statement,
      subject: null,
      difficulty: null,
      source: "text",
    })
    .select("id")
    .single();
  if (error || !q) throw new Error(error?.message ?? "Falha ao salvar texto");
  await supabase
    .from("uploads")
    .update({ status: "done", questions_count: 1 })
    .eq("id", uploadId);
  return { count: 1, warnings: [] as string[], flaggedCount: 0 };
}

export const extractQuestionsFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TextInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const fileName = `texto-${Date.now()}.txt`;
    const { data: upRow, error: upErr } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        file_name: fileName,
        display_name: data.displayName?.trim() || `Texto colado · ${stamp}`,
        file_path: `text://${userId}/${fileName}`,
        mime_type: "text/plain",
        status: "processing",
      })
      .select("id")
      .single();
    if (upErr || !upRow) throw new Error(upErr?.message ?? "Falha ao registrar texto");
    const uploadId = upRow.id;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
    }

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Extraia todas as questões de múltipla escolha do texto a seguir.\n\n---\n${data.text}\n---`,
            },
          ],
          tools: [TOOL_DEF],
          tool_choice: { type: "function", function: { name: "save_questions" } },
        }),
      });

      if (!resp.ok) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }
      const result = await resp.json();
      const argsRaw =
        result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }
      const parsedJson = JSON.parse(argsRaw);
      const list = z
        .object({ questions: z.array(ExtractedQuestionSchema) })
        .safeParse(parsedJson);
      if (!list.success) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }

      const cleaned = list.data.questions
        .map((q) => {
          const rec = reconcileCorrectness(q);
          return {
            question_number: q.question_number ?? null,
            statement: cleanText(q.statement),
            subject: q.subject?.trim() || null,
            difficulty: q.difficulty ?? null,
            flagged_inconsistent: rec.inconsistent,
            options: rec.options.map((o) => ({
              label: o.label,
              text: cleanOption(o.text),
              is_correct: o.is_correct,
            })),
          };
        })
        .filter((q) => q.statement.length >= 15 && q.options.length >= 2);

      if (cleaned.length === 0) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }

      const warnings = buildWarnings(list.data.questions);

      const questionRows = cleaned.map((q) => ({
        user_id: userId,
        upload_id: uploadId,
        statement: q.statement,
        subject: q.subject,
        difficulty: q.difficulty,
        question_number: q.question_number,
        flagged_inconsistent: q.flagged_inconsistent,
        source: "text",
      }));
      const { data: inserted, error: qErr } = await supabase
        .from("questions")
        .insert(questionRows)
        .select("id");
      if (qErr || !inserted) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }

      const optionRows: Array<{
        question_id: string;
        label: string;
        text: string;
        is_correct: boolean;
      }> = [];
      inserted.forEach((row: { id: string }, i: number) => {
        const q = cleaned[i];
        for (const o of q.options) {
          optionRows.push({
            question_id: row.id,
            label: o.label,
            text: o.text,
            is_correct: o.is_correct,
          });
        }
      });
      if (optionRows.length > 0) {
        await supabase.from("question_options").insert(optionRows);
      }

      const flaggedCount = cleaned.filter((q) => q.flagged_inconsistent).length;
      if (flaggedCount > 0) {
        warnings.push(
          `${flaggedCount} questão(ões) com gabarito em revisão — verifique manualmente.`,
        );
      }

      await supabase
        .from("uploads")
        .update({
          status: "done",
          questions_count: inserted.length,
          warnings,
        })
        .eq("id", uploadId);

      return {
        ok: true as const,
        count: inserted.length,
        warnings,
        flaggedCount,
      };
    } catch {
      return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
    }
  });

// ============================================================
// createUploadShell — create an upload row + return upload id
// (called BEFORE files are uploaded so the client knows the path prefix)
// ============================================================
export const createUploadShell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fileName: z.string().min(1).max(255),
        displayName: z.string().max(120).nullable().optional(),
        firstFilePath: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        file_name: data.fileName,
        display_name: data.displayName?.trim() || null,
        file_path: data.firstFilePath,
        mime_type: data.mimeType,
        status: "processing",
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Falha ao registrar prova.");
    return { uploadId: row.id as string };
  });

// ============================================================
// createSignedUploadUrl — used by the client to PUT files directly to Storage
// ============================================================
export const createSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ path: z.string().min(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // sanity: path must start with the userId/ prefix
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Caminho inválido.");
    }
    const { data: sig, error } = await supabase.storage
      .from("prova-uploads")
      .createSignedUploadUrl(data.path);
    if (error || !sig) throw new Error(error?.message ?? "Falha ao gerar URL.");
    return { signedUrl: sig.signedUrl, token: sig.token, path: sig.path };
  });