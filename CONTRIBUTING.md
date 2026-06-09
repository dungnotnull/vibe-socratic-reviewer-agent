# Contributing to vibe-socratic-reviewer-agent

## Getting Started

```bash
git clone https://github.com/vibe-socratic/reviewer-agent.git
cd reviewer-agent
npm install
npm run build
```

## Development

```bash
npm run dev              # Watch mode
npm run cli -- "prompt"  # Test CLI locally
npm run lint             # ESLint
npm run format           # Prettier
```

## Architecture

The agent follows a pipeline architecture:

```
CodeRequest → ComplexityClassifier → BlindSpotDetector → QuestionGenerator
→ [Developer answers] → AnswerEvaluator → UnlockController → CodeAnnotator
```

See `CLAUDE.md` and `PROJECT-detail.md` for full architecture documentation.

## Key Extension Points

- **New blind spot**: Add to `src/data/blind-spot-taxonomy.yaml` + `src/data/question-templates.yaml`
- **New CS concept**: Add to `src/data/cs-concepts.yaml` + `src/agents/answer-evaluator/concept-teacher.ts`
- **New language**: Add comment syntax to `CodeAnnotator.COMMENT_SYNTAX` + extend `generateStructuredStub()`
- **New LLM provider**: Extend `LlmClient` with additional provider implementations

## Before Submitting

- `npm run build` must pass with 0 errors
- `npm run lint` must pass with 0 warnings
- New features should include test fixtures in `test/fixtures/`
- Vietnamese text is the default; English titles/headings are acceptable throughout

## Code Style

- Strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- Named exports preferred over default exports
- Files are organized by domain (code-analyzer, question-generator, etc.), not by type
- Logging via the shared `logger` instance from `src/tools/logger.ts` — never `console.log` directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
