import * as vscode from 'vscode';
import { Orchestrator } from '../../agents/orchestrator';
import { CodeRequest, PipelineResult } from '../../types';

const orchestrator = new Orchestrator();

let flowModeUntil: number | null = null;
let questionCountThisHour: { count: number; windowStart: number } = { count: 0, windowStart: Date.now() };
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'vibe-socratic.toggleFlowMode';
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const reviewCommand = vscode.commands.registerCommand('vibe-socratic.reviewRequest', async () => {
    await handleReviewRequest();
  });

  const toggleFlowCommand = vscode.commands.registerCommand('vibe-socratic.toggleFlowMode', async () => {
    await toggleFlowMode();
  });

  const showGraphCommand = vscode.commands.registerCommand('vibe-socratic.showUnderstandingGraph', async () => {
    await showUnderstandingGraph();
  });

  context.subscriptions.push(reviewCommand, toggleFlowCommand, showGraphCommand);

  const config = vscode.workspace.getConfiguration('vibeSocratic');
  const enabled = config.get<boolean>('enabled', true);
  if (!enabled) {
    statusBarItem.text = '$(circle-slash) Socratic';
  }
}

export function deactivate() {}

async function handleReviewRequest() {
  const config = vscode.workspace.getConfiguration('vibeSocratic');
  if (!config.get<boolean>('enabled', true)) return;

  if (isInFlowMode()) {
    vscode.window.showInformationMessage('🧘 Flow Mode active — Socratic questions paused.');
    return;
  }

  if (!checkRateLimit()) {
    const maxQ = config.get<number>('maxQuestionsPerHour', 10);
    vscode.window.showWarningMessage(`⏸️ Socratic paused — reached ${maxQ} sessions this hour. Resumes next hour.`);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Open a file before requesting code review.');
    return;
  }

  const prompt = await vscode.window.showInputBox({
    prompt: 'What code are you about to request from AI?',
    placeHolder: 'E.g., "viết hàm chuyển tiền giữa 2 tài khoản"',
  });

  if (!prompt) return;

  const selection = editor.selection;
  const selectedCode = selection.isEmpty ? '' : editor.document.getText(selection);

  const request: CodeRequest = {
    id: `vscode-${Date.now()}`,
    rawPrompt: prompt,
    language: config.get<string>('defaultLanguage', 'typescript') as CodeRequest['language'],
    context: {
      urgency: 'normal',
      developerMessage: selectedCode ? `Current selection: ${selectedCode.slice(0, 200)}...` : undefined,
      currentFile: editor.document.fileName,
    },
  };

  const devId = `vscode-dev`;

  const result = await orchestrator.intercept(request, devId);

  questionCountThisHour.count++;

  if (!result.questions || result.questions.length === 0) {
    vscode.window.showInformationMessage('📝 Direct mode — no Socratic questions needed. Generating code.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'socraticQuestions',
    'Socratic Review',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = buildQuestionsHtml(result);

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'submitAnswers': {
        const answers = message.answers as string[];

        if (answers.length === 0 || answers.every(a => !a.trim())) {
          panel.webview.postMessage({ command: 'showError', text: 'Vui lòng trả lời ít nhất câu hỏi đầu tiên.' });
          return;
        }

        const evaluation = await orchestrator.evaluateAnswers(result.questions!, answers, devId);
        const unlock = evaluation.unlock;

        let resultHtml = '<div style="padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif">';

        if (unlock.type === 'FULL_UNLOCK' && unlock.celebration) {
          resultHtml += `<h2 style="color:#4caf50">🎉 ${unlock.celebration}</h2>`;
        } else if (unlock.type === 'TEACH_FIRST') {
          resultHtml += `<h3 style="color:#ff9800">📚 ${unlock.note}</h3>`;
          if (evaluation.teachingMessage) {
            resultHtml += `<div style="background:#1e1e1e;padding:12px;border-radius:4px;margin:12px 0">${evaluation.teachingMessage}</div>`;
          }
        }

        resultHtml += '<p style="color:#888">Code generated with annotations. Check your editor.</p>';
        resultHtml += '</div>';

        panel.webview.html = resultHtml;
        break;
      }
      case 'override': {
        panel.dispose();
        vscode.window.showInformationMessage('⏭️ Overridden — code will be generated with risk annotations.');
        break;
      }
    }
  });

  panel.onDidDispose(() => {
    updateStatusBar();
  });
}

function buildQuestionsHtml(result: PipelineResult): string {
  const questions = result.questions ?? [];
  const blindSpots = result.decision.blindSpots ?? [];

  const qItems = questions.map((q, i) => {
    const color = q.tier === 'tier3' ? '#ff5252' : q.tier === 'tier2' ? '#ffd740' : '#69f0ae';
    const label = q.tier === 'tier3' ? 'QUAN TRỌNG' : q.tier === 'tier2' ? 'Thiết kế' : 'Edge case';
    return `<div style="margin-bottom:16px;padding:12px;background:#2a2a2a;border-radius:6px;border-left:4px solid ${color}">
      <div style="color:${color};font-weight:600;margin-bottom:6px">Q${i + 1} (${label}) — ${q.blindSpotType}</div>
      <div style="color:#ddd;margin-bottom:10px">${q.text}</div>
      <textarea id="answer-${i}" style="width:100%;min-height:60px;background:#1e1e1e;color:#ddd;border:1px solid #444;border-radius:4px;padding:8px;font-size:13px" placeholder="Trả lời của bạn..."></textarea>
    </div>`;
  }).join('');

  const bsList = blindSpots.map(b => `<span style="background:#333;padding:4px 8px;border-radius:3px;margin:4px;display:inline-block;font-size:12px">[${b.severity}] ${b.type}</span>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background:#1a1a1a;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;margin:0">
  <h1 style="color:#e0e0e0;font-size:18px;margin:0 0 8px">🤔 Socratic Review — 3 câu hỏi</h1>
  <div style="margin-bottom:16px;font-size:12px;color:#888">Blind spots: ${bsList}</div>
  <div id="questions">${qItems}</div>
  <div style="margin-top:16px;display:flex;gap:8px">
    <button onclick="submit()" style="flex:1;padding:10px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px">✅ Gửi câu trả lời</button>
    <button onclick="override()" style="flex:1;padding:10px;background:#555;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px">⏭️ Cho tôi code luôn</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function submit() {
      const answers = [];
      for (let i = 0; i < ${questions.length}; i++) {
        const el = document.getElementById('answer-' + i);
        answers.push(el ? el.value : '');
      }
      vscode.postMessage({ command: 'submitAnswers', answers });
    }
    function override() { vscode.postMessage({ command: 'override' }); }
  </script>
</body></html>`;
}

function isInFlowMode(): boolean {
  return flowModeUntil !== null && Date.now() < flowModeUntil;
}

async function toggleFlowMode() {
  const config = vscode.workspace.getConfiguration('vibeSocratic');
  const duration = config.get<number>('flowModeDurationMinutes', 30);

  if (isInFlowMode()) {
    flowModeUntil = null;
    vscode.window.showInformationMessage('🧘 Flow Mode deactivated — Socratic questions resumed.');
  } else {
    flowModeUntil = Date.now() + duration * 60 * 1000;
    const mins = Math.round((flowModeUntil - Date.now()) / 60000);
    vscode.window.showInformationMessage(`🧘 Flow Mode activated — no Socratic questions for ${mins} minutes.`);
  }
  updateStatusBar();
}

function checkRateLimit(): boolean {
  const config = vscode.workspace.getConfiguration('vibeSocratic');
  const maxPerHour = config.get<number>('maxQuestionsPerHour', 10);
  const now = Date.now();

  if (now - questionCountThisHour.windowStart > 3600000) {
    questionCountThisHour = { count: 0, windowStart: now };
    return true;
  }

  return questionCountThisHour.count < maxPerHour;
}

async function showUnderstandingGraph() {
  const panel = vscode.window.createWebviewPanel(
    'understandingGraph',
    'My Understanding Graph',
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = `<!DOCTYPE html>
<html><body style="background:#1a1a1a;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px">
  <h1>Understanding Graph</h1>
  <p>Your learning progress across CS concepts.</p>
  <p style="color:#888">Full graph visualization requires the session database. Open from CLI for full details.</p>
</body></html>`;
}

function updateStatusBar() {
  if (isInFlowMode()) {
    statusBarItem.text = '$(eye-closed) Socratic: Flow';
    statusBarItem.tooltip = 'Socratic questions paused (Flow Mode) — Click to resume';
  } else {
    statusBarItem.text = '$(comment-discussion) Socratic';
    statusBarItem.tooltip = 'Socratic active — Click for Flow Mode';
  }
}
