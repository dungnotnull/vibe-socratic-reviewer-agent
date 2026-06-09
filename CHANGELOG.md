# Changelog

All notable changes to vibe-socratic-reviewer-agent will be documented in this file.

## [1.0.0] — 2025-06-09

### Added
- Initial release — production-grade Socratic AI teaching agent
- 7 operating modes: SOCRATIC, ANNOTATED, EMERGENCY, TRUSTED, REVERSE_SOCRATIC, AUDIT, TRANSPARENT_CHOICE
- 10 blind spot categories: SQL injection, missing transactions, auth bypass, double-spend, lost-update, connection leak, silent error, N+1 queries, wrong data structure, cache invalidation
- Bilingual keyword detection (Vietnamese + English) across all classifiers
- Question generation with 3-tier structure (Critical / Design / Edge case) via LLM-first or template fallback
- Answer evaluation with 6 understanding levels (DEEP / ADEQUATE / PARTIAL / SURFACE / MISSING / DEFLECTING)
- Progressive unlock: FULL_UNLOCK, TEACH_FIRST, PARTIAL_UNLOCK, EMERGENCY paths
- Code annotation engine: WHY / RISK / CONSIDER / DANGER comment types across 5 languages
- Developer understanding graph via SQLite with mastery, progress, and gap tracking
- Question quality system with effectiveness scoring and automatic retirement
- Knowledge updater with OWASP Top 10 sync and extensible concept library
- VS Code extension with webview Q&A panel, flow mode, and rate limiting
- CLI wrapper: `socratic <tool> "<prompt>"` with interactive terminal dialogue
- Real Anthropic API client with structured stub fallback for offline development
- Structured logging via pino with configurable log levels
- Zod runtime validation on all external API boundaries
- Graceful shutdown handlers for SIGINT/SIGTERM
