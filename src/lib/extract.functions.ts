import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Text cleanup pipeline ----
function cleanText(input: string): string {
  let s = (input ?? "").replace(/\r\n?/g, "\n");
  s = s.replace(/([A-Za-zÀ-ÿ])-\n([a-zà-ÿ])/g, "$1$2");
  s = s.replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s+([,.;:!?])/g, "$1");
  s = s.replace(/([,.;:!?])([A-Za-zÀ-ÿ])/g, "$1 $2");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function cleanOption(input: string): string {
  let s = cleanText(input);
  s = s.replace(/^\s*\(?[A-E]\)?\s*[\.\)\-:]\s+/i, "");
  return s.trim();
}

const InputSchema = z.object({
  uploadId: z.string().uuid(),
  filePath: z.string().min(1),
  mimeType: z.string().min(1),
});

const ExtractedQuestionSchema = z.object({
  statement: z.string().min(1),
  subject: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
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

const SYSTEM_PROMPT = `Você extrai questões de múltipla escolha de provas brasileiras (residência médica, concursos).

Para cada questão:
- Reconstrua o enunciado em texto contínuo, limpo, em português correto. Junte palavras quebradas por hifenização. Corrija espaçamento.
- Para cada alternativa, escreva o texto integral SEM o rótulo (apenas o conteúdo). Use letras A, B, C, D, E.
- Identifique a alternativa correta. Se houver gabarito no documento, use-o; caso contrário, infira pela melhor resposta clínica/técnica.
- Quando possível: matéria (ex.: Cardiologia) e dificuldade (easy/medium/hard).

Ignore cabeçalhos, rodapés, números de página e instruções gerais. Use a tool save_questions.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "save_questions",
    description: "Retorna as questões estruturadas.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              statement: { type: "string" },
              subject: { type: "string" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
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

export const extractQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // 1) Download file from storage
    const { data: file, error: dlErr } = await supabase.storage
      .from("prova-uploads")
      .download(data.filePath);
    if (dlErr || !file) {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: dlErr?.message ?? "download falhou" })
        .eq("id", data.uploadId);
      throw new Error(dlErr?.message ?? "Falha ao baixar o arquivo");
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // Use the fast/lite model for big speed gains with acceptable accuracy.
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todas as questões de múltipla escolha." },
              {
                type: "image_url",
                image_url: { url: `data:${data.mimeType};base64,${b64}` },
              },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "save_questions" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      const status = resp.status;
      const msg =
        status === 429
          ? "Muitas requisições — aguarde alguns segundos."
          : status === 402
            ? "Créditos de IA esgotados."
            : `Falha na IA (${status}): ${txt.slice(0, 200)}`;
      await supabase
        .from("uploads")
        .update({ status: "failed", error: msg })
        .eq("id", data.uploadId);
      throw new Error(msg);
    }

    const result = await resp.json();
    const argsRaw = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: "Nenhuma questão encontrada" })
        .eq("id", data.uploadId);
      throw new Error("A IA não conseguiu extrair questões deste arquivo.");
    }
    const parsed = JSON.parse(argsRaw);
    const list = z.object({ questions: z.array(ExtractedQuestionSchema) }).parse(parsed);

    const filtered = list.questions
      .map((q) => ({ ...q, statement: cleanText(q.statement) }))
      .filter((q) => q.statement.length >= 15);

    if (filtered.length === 0) {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: "Nenhuma questão detectada" })
        .eq("id", data.uploadId);
      throw new Error("Nenhuma questão objetiva foi detectada.");
    }

    // Bulk insert: questions first, then all options in a single insert.
    const questionRows = filtered.map((q) => ({
      user_id: userId,
      upload_id: data.uploadId,
      statement: q.statement,
      subject: q.subject?.trim() || null,
      difficulty: q.difficulty ?? null,
    }));

    const { data: inserted, error: qErr } = await supabase
      .from("questions")
      .insert(questionRows)
      .select("id");

    if (qErr || !inserted) {
      await supabase
        .from("uploads")
        .update({ status: "failed", error: qErr?.message ?? "Erro ao salvar" })
        .eq("id", data.uploadId);
      throw new Error(qErr?.message ?? "Erro ao salvar questões.");
    }

    const optionRows: Array<{
      question_id: string;
      label: string;
      text: string;
      is_correct: boolean;
    }> = [];
    inserted.forEach((row, i) => {
      const q = filtered[i];
      for (const o of q.options) {
        optionRows.push({
          question_id: row.id,
          label: o.label,
          text: cleanOption(o.text),
          is_correct: o.is_correct,
        });
      }
    });

    if (optionRows.length > 0) {
      await supabase.from("question_options").insert(optionRows);
    }

    await supabase
      .from("uploads")
      .update({ status: "done", questions_count: inserted.length })
      .eq("id", data.uploadId);

    return { ok: true as const, count: inserted.length };
  });

// =========================================================================
// Extract from raw text input (third upload modality)
// =========================================================================

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
  return { count: 1 };
}

export const extractQuestionsFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TextInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // 1) Register a synthetic "upload" row so it appears in the library.
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

    // 2) Try LLM extraction with the SAME prompt/tool used for PDFs.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Hard fallback: save raw text as a single question.
      return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
    }

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
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
      const argsRaw = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }
      const parsed = JSON.parse(argsRaw);
      const list = z.object({ questions: z.array(ExtractedQuestionSchema) }).safeParse(parsed);
      if (!list.success) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }
      const filtered = list.data.questions
        .map((q) => ({ ...q, statement: cleanText(q.statement) }))
        .filter((q) => q.statement.length >= 15);
      if (filtered.length === 0) {
        return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
      }

      const questionRows = filtered.map((q) => ({
        user_id: userId,
        upload_id: uploadId,
        statement: q.statement,
        subject: q.subject?.trim() || null,
        difficulty: q.difficulty ?? null,
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
        const q = filtered[i];
        for (const o of q.options) {
          optionRows.push({
            question_id: row.id,
            label: o.label,
            text: cleanOption(o.text),
            is_correct: o.is_correct,
          });
        }
      });
      if (optionRows.length > 0) {
        await supabase.from("question_options").insert(optionRows);
      }

      await supabase
        .from("uploads")
        .update({ status: "done", questions_count: inserted.length })
        .eq("id", uploadId);

      return { ok: true as const, count: inserted.length };
    } catch {
      return insertFallbackQuestion({ supabase, userId, uploadId, text: data.text });
    }
  });

