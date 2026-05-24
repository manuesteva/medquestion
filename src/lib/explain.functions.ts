import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ questionId: z.string().uuid() });

const ExplanationSchema = z.object({
  summary: z.string().min(1),
  correct_rationale: z.string().min(1),
  wrong_rationales: z.record(z.string(), z.string()),
  keywords: z.array(z.string()).max(12),
});

const TOOL = {
  type: "function",
  function: {
    name: "save_explanation",
    description: "Salva a explicação estruturada da questão.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo do tema clínico/jurídico em 2-3 frases." },
        correct_rationale: { type: "string", description: "Por que a alternativa correta está certa." },
        wrong_rationales: {
          type: "object",
          description: "Objeto com chave = label (A,B,C,D,E) e valor = motivo de estar errada. Inclua apenas as alternativas erradas.",
          additionalProperties: { type: "string" },
        },
        keywords: { type: "array", items: { type: "string" }, maxItems: 12 },
      },
      required: ["summary", "correct_rationale", "wrong_rationales", "keywords"],
      additionalProperties: false,
    },
  },
} as const;

export const explainQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    // Cache hit?
    const { data: cached } = await supabase
      .from("explanations")
      .select("*")
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (cached) return cached;

    const { data: q, error: qErr } = await supabase
      .from("questions")
      .select("id, statement, subject, question_options(label, text, is_correct)")
      .eq("id", data.questionId)
      .single();
    if (qErr || !q) throw new Error("Questão não encontrada");

    const optionsText = (q.question_options ?? [])
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((o) => `${o.label}) ${o.text}${o.is_correct ? "  ← GABARITO" : ""}`)
      .join("\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um professor de medicina/concursos. Explique de forma clara, objetiva e didática, em português brasileiro, em nível de prova de residência. Cite condutas, critérios e diagnósticos diferenciais quando aplicável.",
          },
          {
            role: "user",
            content: `Matéria: ${q.subject ?? "—"}\n\nEnunciado:\n${q.statement}\n\nAlternativas:\n${optionsText}\n\nGere a explicação estruturada usando a tool save_explanation.`,
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_explanation" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      const status = resp.status;
      if (status === 429) throw new Error("Muitas requisições. Aguarde e tente novamente.");
      if (status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na IA (${status}): ${txt.slice(0, 200)}`);
    }
    const json = await resp.json();
    const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) throw new Error("Resposta vazia da IA");
    const parsed = ExplanationSchema.parse(JSON.parse(argsRaw));

    const { data: inserted, error: insErr } = await supabase
      .from("explanations")
      .upsert({
        question_id: data.questionId,
        summary: parsed.summary,
        correct_rationale: parsed.correct_rationale,
        wrong_rationales: parsed.wrong_rationales,
        keywords: parsed.keywords,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    return inserted;
  });
