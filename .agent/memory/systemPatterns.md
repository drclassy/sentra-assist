# System Patterns

## Architecture Overview
- **The Abyss - The Cerebrum:** *Technical Neural Operations Center* yang mengatur tata kelola multi-agent.
- **Edge-First Modular Monolith:** Memastikan aksesibilitas di daerah terpencil dengan kemampuan *offline*.

## Technical Decisions
- **Next.js 15 (React 19):** Frontend dengan *React Server Components* (RSC) dan *Streaming SSR*.
- **FastAPI (Python 3.12):** Backend yang efisien untuk API Gateway.
- **LangGraph:** Orkestrasi multi-agent untuk alur kerja klinis yang kompleks.

## Component Relationships
- **Safety Gates:** Lima gerbang keamanan (Scope, Destruction, Access, Quality, Approval) yang terintegrasi dalam CI/CD.
