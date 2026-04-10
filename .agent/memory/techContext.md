# Tech Context

## Technologies
- **Frontend:** Next.js 15, Tailwind CSS v4, shadcn/ui.
- **Backend:** FastAPI (Python), LangGraph, Celery, Redis.
- **Databases:** PostgreSQL 16, Pinecone (Vector DB), MongoDB.

## Elite Solo Dev Stack (Cursor Extensions)
- **Intelligence:** MCP Client, Continue (Local Model Support).
- **Validation:** Error Lens (Inline diagnostics), Trivy (Security), Console Ninja (Real-time logs).
- **Architecture:** Repo Visualizer, Project Manager.
- **Frontend Specs:** Tailwind CSS IntelliSense, Tailwind Fold, Color Highlight.
- **Aesthetics (SOTA):** Claudesy Dark Theme (Primary), Material Icon Theme, Peacock, Apc Customize UI++.

## Optimized Environment Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "errorLens.enabledDiagnosticLevels": ["error", "warning"],
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*?)[\"'`]"]
  ],
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', monospace",
  "editor.fontLigatures": true,
  "editor.fontSize": 14.5,
  "editor.lineHeight": 24,
  "editor.letterSpacing": 0.5,
  "editor.cursorBlinking": "smooth",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "editor.minimap.enabled": false,
  "workbench.list.smoothScrolling": true,
  "workbench.editor.centeredLayoutAutoRescale": true,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active"
}
```

## Environment Constraints
- **OS:** Windows 11 Home (Build 26200).
- **CPU:** AMD Ryzen 5 7500F | **RAM:** 32 GB.
- **Tools:** PowerShell 7, Windows Terminal Canary.

## Dependencies
- Turborepo, pnpm, Docker, Kubernetes.
- Google Gemini API (Flash & Pro).
