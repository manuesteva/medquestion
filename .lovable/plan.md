# Finalização do MedQuest

Duas entregas em paralelo: (1) QA e correções de fluxo, (2) redesign criativo da landing page.

---

## 1. QA e correções de funcionalidades

### Autenticação
- **Signup**: hoje redireciona para `/onboarding`. Ajustar para ir direto à **home logada (`/dashboard`)** após cadastro bem-sucedido, conforme pedido. O onboarding fica acessível pelo menu (ou como passo opcional dentro do dashboard).
- **Login**: já vai para `/dashboard` — validar mensagens de erro (e-mail/senha incorretos, conta inexistente) e estados de loading.
- **Reset de senha**: testar fluxo `/forgot-password` → e-mail → `/reset-password` → login.
- **Validação visual** em todos os formulários (signup, login, reset, upload, configurações): bordas vermelhas + mensagens claras em campos inválidos, toasts de sucesso/erro consistentes.

### Rotas e links
- Varredura de todas as rotas (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/termos`, `/privacidade`, `/dashboard`, `/library`, `/upload`, `/practice`, `/simulado`, `/review`, `/sessions`, `/settings`, `/onboarding`) garantindo que renderizam sem branco e sem erro.
- Conferir links do header, footer, dashboard cards, sidebar de pastas, GlobalSearch e SessionsResumeCard apontando para destinos válidos.
- Adicionar/validar `notFoundComponent` no root e `errorComponent` nas rotas com loader.

### Responsividade
- Testes em **mobile (375px)**, **tablet (768px)** e **desktop (1280px+)** em: landing, login/signup, dashboard, biblioteca (sidebar vira sheet), prática, simulado, configurações.
- Corrigir qualquer overflow, botão pequeno demais para toque (<44px) ou texto cortado.

### Critérios de aceite QA
- Criar conta de teste → redireciona para `/dashboard` sem erro.
- Login com credenciais válidas/ inválidas → comportamento correto.
- Nenhuma rota em branco; nenhum link 404 interno.
- Layout íntegro nas 3 viewports.

---

## 2. Landing page redesign — direção visual

**Identidade escolhida:**
- Paleta **Ocean Deep**: `#0c2340` (navy profundo), `#1a4a6e` (azul médio), `#2d8a9e` (teal), `#5cbdb9` (mint), fundos claros `#f8fafc`.
- Tipografia **Outfit** (headings, peso 600–800, tracking apertado) + **Figtree** (body, 400–500).
- Layout **Hero Grid**: hero centralizado forte + grid de features + seções de prova social.
- **Intensidade de animação: 3/5** — movimento presente, polido, sem exageros.

### Estrutura proposta

```
┌─────────────────────────────────────────┐
│  Header sticky (blur on scroll)         │
├─────────────────────────────────────────┤
│         HERO CENTRALIZADO               │
│  • Badge "IA treinada em residência"    │
│  • H1 grande gradiente teal             │
│  • Subtítulo + 2 CTAs                   │
│  • Mockup/visual abaixo (parallax sutil)│
├─────────────────────────────────────────┤
│  Faixa de logos/números (stats)         │
├─────────────────────────────────────────┤
│  GRID DE FEATURES (3 cols)              │
│  cards com ícone, hover lift, gradient  │
├─────────────────────────────────────────┤
│  "Como funciona" — 3 steps numerados    │
│  com linha conectora animada            │
├─────────────────────────────────────────┤
│  Demonstração visual (mockup grande)    │
│  com scroll-reveal                      │
├─────────────────────────────────────────┤
│  Depoimentos / casos                    │
├─────────────────────────────────────────┤
│  FAQ (já existe, manter, restilizar)    │
├─────────────────────────────────────────┤
│  CTA final + Footer                     │
└─────────────────────────────────────────┘
```

### Animações (framer-motion, intensidade 3)
- **Hero**: fade + slide-up escalonado (badge → título → subtítulo → CTAs), 80–120ms entre cada.
- **Gradient text** no título com leve animação de gradiente.
- **Scroll-reveal** nos blocos (`whileInView`, `once: true`) — fade + slide-up de 20px.
- **Hover** em feature cards: lift sutil (translateY -4px) + glow teal.
- **Números** dos stats com count-up ao entrar no viewport.
- **Header**: backdrop-blur ao rolar.
- **Botão CTA primário**: shimmer sutil + glow no hover.
- Sem efeitos pesados (sem parallax 3D, sem WebGL, sem cursor custom).

### Detalhes técnicos
- Atualizar tokens em `src/styles.css` (cores Ocean Deep em `oklch`, gradientes `--gradient-primary`, sombras `--shadow-elegant`/`--shadow-glow`, fontes Outfit/Figtree via `<link>` no `__root.tsx`).
- Refatorar `src/routes/index.tsx`: nova landing com seções componentizadas em `src/components/landing/` (`HeroSection`, `StatsBar`, `FeaturesGrid`, `HowItWorks`, `Showcase`, `Testimonials`, `FinalCTA`, `LandingHeader`, `LandingFooter`).
- Reusar `FaqSection` existente, repintada com os novos tokens.
- Adicionar `framer-motion` (verificar se já está nas deps).
- Manter SEO: title, description, og:title, og:description no `head()` da rota `/`.
- Todas as cores via tokens semânticos — zero hex hardcoded em componentes.

### Critérios de aceite landing
- Visual coerente com Ocean Deep + Outfit/Figtree.
- Animações suaves de entrada e scroll, sem jank.
- Hero impactante, CTA "Criar conta grátis" muito visível.
- Responsivo: hero adapta para 1 coluna em mobile, features 2 cols em tablet, 3 em desktop.
- Lighthouse Performance ≥ 85.

---

## Ordem de execução

1. Atualizar tokens + fontes em `src/styles.css` e `__root.tsx`.
2. Criar componentes da landing em `src/components/landing/`.
3. Substituir `src/routes/index.tsx` pelo novo layout.
4. Ajustar redirect de signup → `/dashboard`.
5. Varredura de rotas, links e responsividade; corrigir o que aparecer.
6. QA manual com browser tool nas 3 viewports.