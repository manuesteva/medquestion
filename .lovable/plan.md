# Ajustes finais: onboarding, footer e landing

## 1. Bug do passo 5 do onboarding (Concluir → /dashboard)

**Causa provável**: o `signup` agora redireciona direto para `/dashboard`, então o `profile` do usuário já existe sem precisar de onboarding. Quando o onboarding é acessado manualmente e o usuário clica em "Concluir", o `completeOnboarding` faz um `update` na tabela `profiles`. Se a linha de profile ainda não foi criada (ou o `update` retorna 0 linhas afetadas sem erro), o `navigate({ to: "/dashboard" })` deveria rodar — a menos que a serverFn esteja lançando erro silenciosamente (toast de erro) ou o `useNavigate` esteja sem fallback.

**Correção**:
- Em `src/lib/profile.functions.ts`, trocar o `update` em `profiles` por um `upsert` (`onConflict: "id"`) para garantir que a linha sempre exista e que o retorno seja sempre sucesso quando os dados são válidos.
- Em `src/routes/_authenticated/onboarding.tsx`, ajustar `finish()` para:
  - Usar `await navigate({ to: "/dashboard", replace: true })` (com `replace` para o usuário não voltar ao step 5 com o botão "voltar" do navegador).
  - Fazer fallback hard com `window.location.assign("/dashboard")` caso o `navigate` não dispare por algum motivo (defensivo, mínimo).
  - Mover o `setLoading(false)` para antes do navigate só no caminho de erro (manter loading ativo durante a transição em caso de sucesso).

Sem mudanças em schema do banco.

## 2. Footer com a mesma cor do resto do site

**Causa**: `src/components/site-footer.tsx` força `backgroundColor: "#0f1f5c"` e cores brancas inline, ignorando o tema.

**Correção**: reescrever o footer usando tokens semânticos:
- Container: `bg-background text-foreground border-t border-border` (remover todo `style={{...}}`).
- Marca "MedQuest": destaque com `text-primary` no "Quest".
- Headings de coluna: `text-muted-foreground`.
- Links: `text-muted-foreground hover:text-foreground`.
- Linha inferior: `border-t border-border` + `text-muted-foreground`.

Resultado: footer herda automaticamente o background do site em light/dark mode.

## 3. Remover depoimentos e menções a "preceptor" da landing

Em `src/routes/index.tsx`:
- Remover o componente `Testimonials` (linhas ~491–560) e a sua referência no render (`<Testimonials />` ~linha 695).
- Reescrever o parágrafo do hero (linha ~157–158) tirando "como ter um preceptor 24h". Nova versão:
  > "Envie qualquer prova em PDF ou imagem. A IA identifica cada questão, você resolve e recebe explicações detalhadas e direcionadas."
- Conferir se restou algum uso de "preceptor" em outras seções (features/process) e remover/parafrasear.

Nada mais da landing é alterado (hero, stats, features, processo, FAQ e CTA permanecem).

## Arquivos afetados
- `src/lib/profile.functions.ts` — `update` → `upsert` em `profiles` dentro de `completeOnboarding`.
- `src/routes/_authenticated/onboarding.tsx` — `finish()` com `await navigate(... replace: true)` + fallback.
- `src/components/site-footer.tsx` — reescrita usando tokens semânticos.
- `src/routes/index.tsx` — remover `Testimonials` e parafrasear menções a "preceptor".
