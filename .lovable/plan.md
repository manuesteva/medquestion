## Entrega B — Pastas na Biblioteca

Objetivo: transformar `library.tsx` (lista plana) em layout 2-colunas com sidebar de pastas e grade de provas filtrável, usando o backend `folders.functions.ts` que já existe.

### Layout

```
┌────────────────────┬───────────────────────────────────────────┐
│  Pastas            │  Header: título + busca + "Nova prova"    │
│  ─────────────     │  ─────────────────────────────────────── │
│  ▸ Todas (12)      │  Toolbar de seleção (quando aplicável)    │
│  ▸ Sem pasta (3)   │                                           │
│                    │  Grid de ExamCards (2 colunas)            │
│  PASTAS            │   • cada card tem dropdown "Mover para…"  │
│  • Cardio (4)      │   • drop-target: arrastar p/ sidebar      │
│  • Pediatria (2)   │                                           │
│  + Nova pasta      │                                           │
└────────────────────┴───────────────────────────────────────────┘
```

### Mudanças em `library.tsx`

- **Sidebar à esquerda** (`w-60`, colapsa em mobile via Sheet):
  - Item "Todas as provas" (default) + "Sem pasta"
  - Lista de pastas com nome, contagem, dot colorido
  - Item ativo destacado; clique filtra a grade
  - Botão "+ Nova pasta" abre `FolderDialog`
  - Hover na pasta revela menu (⋯): Renomear, Mudar cor, Excluir
- **Busca** no header (filtra por `display_name` + `file_name`, case-insensitive)
- **ExamCard ganha menu "Mover para…"**: dropdown com a lista de pastas + "Sem pasta", chama `moveUploadToFolder` e invalida `["library", "folders"]`
- **Estado local** `activeFolder: string | "all" | "unfiled"` controla o filtro da grade

### Novos componentes

- `src/components/FoldersSidebar.tsx` — sidebar com lista, contadores, ações (Renomear/Cor/Excluir via popover)
- `src/components/FolderDialog.tsx` — modal de criar/renomear pasta com seletor de cor (6 swatches: blue, violet, emerald, amber, rose, slate)
- `src/components/MoveToFolderMenu.tsx` — dropdown reutilizável no ExamCard

### Backend

Sem mudanças. `folders.functions.ts` e a coluna `uploads.folder_id` já existem. `listUploadsWithStats` em `practice.functions.ts` precisa retornar `folder_id` — verificar e adicionar se faltar (pequeno ajuste).

### Confirmações de UX

- Excluir pasta: confirm modal explicando que as provas vão para "Sem pasta" (FK `ON DELETE SET NULL`)
- Toasts em todas as mutations
- Mobile: sidebar vira Sheet acionado por botão "Pastas" no header

### Out of scope

- Drag-and-drop nativo HTML5 (fica para depois; por ora, só dropdown "Mover para…")
- Reordenar pastas via DnD (backend existe, mas UI fica para Entrega C se quiser)

Pronto para implementar quando aprovar.