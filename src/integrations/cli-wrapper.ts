#!/usr/bin/env node

import * as readline from 'readline';
import { Orchestrator } from '../agents/orchestrator';
import { CodeRequest } from '../types';
import { closeDatabase } from '../agents/session-tracker/developer-db';
import { logger, createChildLogger } from '../tools/logger';

const log = createChildLogger('cli');
const orchestrator = new Orchestrator();

interface CliOptions {
  devId: string;
  tool: string;
  prompt: string;
  language: string;
  nonInteractive: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let tool = 'claude';
  let prompt = '';
  let devId = process.env.SOCRATIC_DEV_ID ?? `cli-${process.env.USER ?? process.env.USERNAME ?? 'dev'}`;
  let language = 'typescript';
  let nonInteractive = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dev':
      case '--developer':
        devId = args[++i] ?? devId;
        break;
      case '--lang':
      case '--language':
        language = args[++i] ?? language;
        break;
      case '--non-interactive':
      case '--batch':
        nonInteractive = true;
        break;
      default:
        if (!tool || tool === 'claude') {
          tool = args[i];
        } else {
          prompt = args.slice(i).join(' ');
          i = args.length;
        }
    }
  }

  if (!prompt) {
    prompt = args.join(' ');
  }

  return { devId, tool, prompt, language, nonInteractive };
}

async function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer.trim()));
  });
}

function print(line: string) {
  process.stdout.write(line + '\n');
}

function warnNoApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    print('\x1b[33m⚠️  ANTHROPIC_API_KEY not set — running in offline mode. Questions will use templates, answers will use heuristics.\x1b[0m');
    print('\x1b[33m   Set ANTHROPIC_API_KEY to enable LLM-powered question generation and evaluation.\x1b[0m\n');
    log.warn('ANTHROPIC_API_KEY not set — running in offline mode');
  }
}

async function interactiveFlow(opts: CliOptions): Promise<void> {
  const request: CodeRequest = {
    id: `cli-${Date.now()}`,
    rawPrompt: opts.prompt,
    language: opts.language as CodeRequest['language'],
  };

  log.info({ devId: opts.devId, language: opts.language }, 'Starting Socratic pipeline');

  const result = await orchestrator.intercept(request, opts.devId);

  if (result.decision.mode === 'EMERGENCY') {
    print('\n⚠️  EMERGENCY MODE — code generated without questions.\n');
    print('Code would be generated immediately with annotations.');
    print('⚠️  Make sure to review these before deploying:\n');
    if (result.decision.blindSpots) {
      for (const bs of result.decision.blindSpots) {
        print(`   - ${bs.type}: ${bs.description}`);
      }
    }
    log.warn({ blindSpots: result.decision.blindSpots?.map(b => b.type) }, 'Emergency mode triggered');
    return;
  }

  if (!result.decision.trigger || !result.questions || result.questions.length === 0) {
    print('\n📝 DIRECT MODE — no Socratic questions needed.\n');
    print('Code would be generated with annotations.');
    log.info('Direct mode — no questions');
    return;
  }

  print('\n' + '═'.repeat(60));
  print('🤔 SOCRATIC MODE — 3 câu hỏi trước khi có code');
  print('═'.repeat(60) + '\n');

  log.info({ questionCount: result.questions.length }, 'Socratic mode — presenting questions');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers: string[] = [];

  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i];
    const prefix = q.tier === 'tier3' ? '🔴 Q' + (i + 1) + ' (QUAN TRỌNG)' : q.tier === 'tier2' ? '🟡 Q' + (i + 1) : '🟢 Q' + (i + 1);
    print(`${prefix}: ${q.text}\n`);

    if (opts.nonInteractive) {
      answers.push('');
      continue;
    }

    const answer = await askQuestion(rl, '👉 Trả lời của bạn: ');
    answers.push(answer);

    if (isOverrideRequest(answer)) {
      print('\n⏭️  Override — bỏ qua các câu hỏi còn lại.\n');
      log.info('Override invoked');
      break;
    }
  }

  rl.close();

  const evaluation = await orchestrator.evaluateAnswers(result.questions, answers, opts.devId);
  const unlock = evaluation.unlock;

  print('\n' + '─'.repeat(60));

  if (unlock.type === 'FULL_UNLOCK' && unlock.celebration) {
    print(`🎉 ${unlock.celebration}`);
    log.info({ unlock: unlock.type }, 'Full unlock');
  } else if (unlock.type === 'TEACH_FIRST') {
    print(`📚 ${unlock.note}`);
    if (evaluation.teachingMessage) {
      print(`\n${evaluation.teachingMessage}`);
    }
    log.info({ unlock: unlock.type, concept: unlock.teachConcept }, 'Teach first');
  } else if (unlock.type === 'PARTIAL_UNLOCK') {
    print(`📝 ${unlock.instruction}`);
    if (unlock.gaps) {
      for (const gap of unlock.gaps) {
        print(`   - ${gap.keyInsightMissing}`);
      }
    }
    log.info({ unlock: unlock.type, gapCount: unlock.gaps?.length }, 'Partial unlock');
  }

  print('\nCode sẽ được generate với annotation phù hợp.');
  print(`Tool: ${opts.tool} | Language: ${opts.language}`);
}

function isOverrideRequest(answer: string): boolean {
  return /cho\s+(tôi|t)\s+code\s+đi|just\s+give\s+me\s+the\s+code|skip|bỏ\s+qua|override/i.test(answer);
}

function setupGracefulShutdown() {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown initiated');
    closeDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    closeDatabase();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });
}

async function main() {
  setupGracefulShutdown();
  const opts = parseArgs();

  if (!opts.prompt) {
    print('vibe-socratic — Socrates for software engineering');
    print('');
    print('Usage: npx vibe-socratic <tool> "<prompt>"');
    print('       npx vibe-socratic claude "viết hàm chuyển tiền giữa 2 tài khoản"');
    print('');
    print('Options:');
    print('  --dev <id>        Developer ID for session tracking');
    print('  --lang <lang>     Target language (typescript, python, go, java)');
    print('  --batch           Non-interactive mode');
    print('');

    warnNoApiKey();
    closeDatabase();
    process.exit(0);
  }

  warnNoApiKey();

  try {
    await interactiveFlow(opts);
  } catch (err: any) {
    logger.error({ err }, 'CLI error');
    print(`\n❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
