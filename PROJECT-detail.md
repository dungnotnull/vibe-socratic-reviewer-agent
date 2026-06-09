# PROJECT-detail.md — vibe-socratic-reviewer-agent

**Full Technical Specification**
Version: 1.0.0 | Last Updated: 2025-06
Status: Pre-Development → Design Finalized

---

## Table of Contents

1. [Project Overview — The Cognitive Debt Problem](#1-project-overview--the-cognitive-debt-problem)
2. [The Vibe Coding Failure Mode — Root Cause Analysis](#2-the-vibe-coding-failure-mode--root-cause-analysis)
3. [Solution Architecture](#3-solution-architecture)
4. [Code Analysis & Blind Spot Detection](#4-code-analysis--blind-spot-detection)
5. [Socratic Question Generation Engine](#5-socratic-question-generation-engine)
6. [Answer Evaluation & Progressive Unlocking](#6-answer-evaluation--progressive-unlocking)
7. [Code Annotation System](#7-code-annotation-system)
8. [Developer Understanding Graph](#8-developer-understanding-graph)
9. [Integration Architecture](#9-integration-architecture)
10. [The Socratic Conversation Examples](#10-the-socratic-conversation-examples)
11. [Data Flow (E2E)](#11-data-flow-e2e)
12. [Self-Learning Knowledge System](#12-self-learning-knowledge-system)
13. [Performance Targets](#13-performance-targets)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Success Metrics](#15-success-metrics)

---

## 1. Project Overview — The Cognitive Debt Problem

### 1.1 Name & Tagline
**vibe-socratic-reviewer-agent** — *"Trợ lý phản biện Socrates cho Lập trình viên"*
You can't ship code you don't understand. Let's make sure you understand.

### 1.2 The New Failure Mode AI Creates

Before AI code generation, developers faced **technical debt** — code that worked but was hard to maintain.

AI coding tools have introduced a new category: **cognitive debt** — code that works but that no human on the team truly understands.

The symptoms:
```
Production incident. Nobody knows why it happened.
→ The code was written by Claude 6 months ago.
→ Developer who "wrote" it vaguely remembers approving it.
→ No one can confidently debug it because no one understands it.

Security audit finds critical vulnerability.
→ SQL injection in query builder, line 234.
→ Developer: "I wouldn't have written it that way."
→ They didn't write it — they pasted it.

Performance degrades under load.
→ Root cause: HashMap used where index was needed.
→ "The AI suggested HashMap."
→ No one asked why.
```

### 1.3 Why Socratic Method Specifically

The Socratic method — asking questions until understanding is demonstrated — is 2,400 years old and still the most effective way to distinguish genuine understanding from surface familiarity.

Applied to software:
- **Passive code review**: "Looks good" / "Approved" — tests nothing
- **Question-based review**: "What happens to your connection if this call fails?" — tests understanding
- **Socratic conversation**: Series of deepening questions that build from surface to root — builds understanding

The method works because **answering a question requires retrieval**, which is the most effective form of learning. Reading code is passive. Being asked about it is active.

---

## 2. The Vibe Coding Failure Mode — Root Cause Analysis

### 2.1 The Copy-Paste Confidence Problem

There is a crucial psychological difference between:

```
1. "I copied this from Stack Overflow and don't fully understand it"
   → Developer knows they have a gap. Proceeds with caution.

2. "Claude wrote this code and I reviewed it and it looks right"
   → Developer believes they understand it. No caution.
```

The second state is **more dangerous** than the first because the developer has lost the protective uncertainty that would make them careful.

### 2.2 The Specific Blind Spots AI-Generated Code Creates

**Blind Spot 1: Error handling that looks right but isn't**
```typescript
// AI-generated: Looks complete
try {
  const user = await db.findUser(userId);
  return user;
} catch (error) {
  console.error(error);
  return null;
}

// The problem: Returning null silently swallows DB connection errors.
// Downstream code that gets null will behave incorrectly, 
// and the original error is lost.
```

**Blind Spot 2: Async code with hidden race conditions**
```typescript
// AI-generated: Looks clean
async function updateUserBalance(userId: string, amount: number) {
  const user = await User.findById(userId);
  user.balance += amount;
  await user.save();
}

// The problem: Two concurrent calls read same balance, both add,
// both save — one update is lost. Classic lost update problem.
```

**Blind Spot 3: Security patterns that pass review**
```typescript
// AI-generated: Developer accepts because "it sanitizes"
const query = `SELECT * FROM users WHERE name LIKE '%${sanitize(name)}%'`;

// The problem: Even sanitized interpolation is dangerous.
// Parameterized queries are the only safe approach.
```

### 2.3 Why This Agent Is Better Than Code Review

Traditional code review fails for AI-generated code because:
- Reviewers also don't know what the code was supposed to do
- AI generates code that "looks professional" — easy to approve
- The original developer's description becomes the spec, which AI may have subtly violated

This agent is better because:
- Questions are targeted at the specific risks in the specific code
- Questions expose gaps BEFORE the code is written, not after
- The developer's ability to answer (or inability) is a direct measurement

---

## 3. Solution Architecture

### 3.1 The Pipeline

```
Developer sends code request to any AI tool
        │
        ▼
┌───────────────────────────────────────────────────────┐
│           CODE REQUEST INTERCEPTOR                     │
│  (VS Code extension / CLI wrapper / API proxy)        │
│  Captures: request text + context                     │
└──────────────────────┬────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   COMPLEXITY CLASSIFIER     │
        │   Should this trigger       │
        │   Socratic mode?            │
        └──────────────┬──────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ YES: Has blind spots       │ NO: Simple/known
         ▼                           ▼
┌────────────────────┐    ┌──────────────────────────┐
│  BLIND SPOT        │    │  DIRECT GENERATION       │
│  DETECTOR          │    │  + Code Annotation       │
│  (3 worst risks)   │    │  (WHY/RISK/CONSIDER)     │
└────────┬───────────┘    └──────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│              QUESTION GENERATOR                         │
│  Generate exactly 3 Socratic questions, ranked:        │
│  1. Most critical blind spot (Tier 3: What breaks)    │
│  2. Design rationale (Tier 2: Why this)               │
│  3. Edge case awareness (Tier 1: Have you thought)    │
└──────────────────────┬─────────────────────────────────┘
                       │
         Present questions to developer
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              DEVELOPER RESPONSE                          │
│  Developer answers all 3 questions                      │
│  OR says "I don't know" for some                        │
│  OR requests override ("just give me the code")         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ANSWER EVALUATOR                            │
│  Score: Deep / Partial / Missing understanding          │
│  Per question                                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PROGRESSIVE UNLOCK                          │
│  Deep understanding → Full code + praise               │
│  Partial → Partial code + follow-up question           │
│  Missing → Teach concept + simpler code + note         │
│  Override → Full code + "remember to revisit X"        │
└─────────────────────────────────────────────────────────┘
```

### 3.2 The Key Decision: When to Trigger Socratic Mode

The agent must NOT trigger on everything — that would make it an annoying blocker, not a valuable teacher.

```typescript
function shouldTriggerSocratic(
  request: CodeRequest,
  developerProfile: DeveloperProfile
): SocraticDecision {
  
  // Never trigger for: simple requests
  const isSimple = isBoilerplate(request) || 
                   isSimpleCRUD(request) || 
                   isSyntaxQuestion(request);
  if (isSimple) return { trigger: false, reason: 'too_simple' };
  
  // Never trigger for: concepts developer has demonstrated mastery
  const alreadyUnderstood = developerProfile.masteredConcepts.some(
    concept => request.touchesConcept(concept)
  );
  if (alreadyUnderstood) return { trigger: false, reason: 'already_mastered' };
  
  // Never trigger in: emergency mode
  if (request.context?.urgency === 'production') {
    return { trigger: false, reason: 'emergency', generateWithNote: true };
  }
  
  // Always trigger for: high-risk patterns developer hasn't shown mastery of
  const blindSpots = detectBlindSpots(request, developerProfile);
  const criticalBlindSpots = blindSpots.filter(b => b.severity === 'CRITICAL');
  
  if (criticalBlindSpots.length > 0) {
    return { trigger: true, blindSpots: criticalBlindSpots.slice(0, 3) };
  }
  
  // Trigger with probability based on risk score for medium risks
  const riskScore = calculateRiskScore(request);
  if (riskScore > MEDIUM_RISK_THRESHOLD) {
    return { trigger: true, blindSpots: blindSpots.slice(0, 3) };
  }
  
  return { trigger: false, reason: 'low_risk' };
}
```

---

## 4. Code Analysis & Blind Spot Detection

### 4.1 Language-Agnostic AST Analysis

```typescript
import Parser from 'tree-sitter';

class BlindSpotDetector {
  
  async detectBlindSpots(
    codeRequest: string,
    language: 'typescript' | 'python' | 'go' | 'java'
  ): Promise<BlindSpot[]> {
    
    const blindSpots: BlindSpot[] = [];
    
    // First pass: semantic analysis of the REQUEST (before code generation)
    // What is the developer asking for? What are the implied requirements?
    const requestAnalysis = await this.analyzeRequest(codeRequest);
    
    // Check each risk category
    if (requestAnalysis.involvesDatabaseOperation) {
      blindSpots.push(...this.detectDatabaseRisks(requestAnalysis));
    }
    
    if (requestAnalysis.involvesAsyncOperations) {
      blindSpots.push(...this.detectConcurrencyRisks(requestAnalysis));
    }
    
    if (requestAnalysis.involvesUserInput) {
      blindSpots.push(...this.detectSecurityRisks(requestAnalysis));
    }
    
    if (requestAnalysis.involvesMoneyOrInventory) {
      blindSpots.push(...this.detectIdempotencyRisks(requestAnalysis));
    }
    
    if (requestAnalysis.involvesCaching) {
      blindSpots.push(...this.detectCacheRisks(requestAnalysis));
    }
    
    return this.rankBySeverity(blindSpots).slice(0, 3);
  }
  
  private detectDatabaseRisks(analysis: RequestAnalysis): BlindSpot[] {
    const risks: BlindSpot[] = [];
    
    if (analysis.hasMultipleWriteOperations && !analysis.mentionsTransaction) {
      risks.push({
        type: 'missing_transaction',
        severity: 'CRITICAL',
        description: 'Multiple DB writes without transaction context',
        targetQuestion: 'Nếu write thứ 2 thất bại sau khi write thứ 1 thành công, data của bạn sẽ ở trạng thái nào?',
      });
    }
    
    if (analysis.hasUserInputInQuery && !analysis.mentionsParameterization) {
      risks.push({
        type: 'potential_injection',
        severity: 'CRITICAL',
        description: 'User input may flow into query without parameterization',
        targetQuestion: 'Bạn sẽ ngăn chặn SQL injection ở bước xây dựng query này thế nào?',
      });
    }
    
    return risks;
  }
  
  private detectConcurrencyRisks(analysis: RequestAnalysis): BlindSpot[] {
    const risks: BlindSpot[] = [];
    
    if (analysis.hasReadModifyWrite && !analysis.mentionsLocking) {
      risks.push({
        type: 'read_modify_write_race',
        severity: 'HIGH',
        description: 'Read-modify-write without concurrency control',
        targetQuestion: 'Nếu 2 request cùng đọc giá trị này rồi cùng cập nhật, kết quả nào sẽ "thắng"?',
      });
    }
    
    if (analysis.hasMultipleAwaits && analysis.awaitsAreIndependent) {
      risks.push({
        type: 'sequential_when_parallel',
        severity: 'LOW',
        description: 'Independent async operations run sequentially',
        targetQuestion: 'Hai await này có phụ thuộc vào nhau không? Nếu không, chạy song song sẽ nhanh hơn bao nhiêu?',
      });
    }
    
    return risks;
  }
}
```

### 4.2 Blind Spot Classification

```typescript
const BLIND_SPOT_TAXONOMY = {
  
  CRITICAL: {
    'sql-injection': {
      triggers: ['user input', 'query building', 'search by name/id'],
      question_template: 'SQL injection risk at query construction',
    },
    'missing-transaction': {
      triggers: ['multiple writes', 'transfer', 'update two tables'],
      question_template: 'Atomicity of multiple write operations',
    },
    'auth-bypass': {
      triggers: ['authorization check', 'admin only', 'owner only'],
      question_template: 'Authorization enforcement completeness',
    },
    'double-spend': {
      triggers: ['payment', 'deduct', 'balance', 'inventory decrement'],
      question_template: 'Idempotency and race condition on financial operation',
    },
  },
  
  HIGH: {
    'lost-update': {
      triggers: ['read-modify-write', 'increment', 'append to list'],
      question_template: 'Concurrent modification of shared state',
    },
    'connection-leak': {
      triggers: ['database', 'file', 'network connection', 'stream'],
      question_template: 'Resource cleanup on all code paths including errors',
    },
    'silent-error': {
      triggers: ['catch block', 'try-catch', 'error handling'],
      question_template: 'What information is preserved when error occurs',
    },
  },
  
  MEDIUM: {
    'n-plus-one': {
      triggers: ['loop', 'forEach', 'map', 'database query inside loop'],
      question_template: 'Query count scaling with data size',
    },
    'wrong-data-structure': {
      triggers: ['search', 'find', 'lookup', 'contains'],
      question_template: 'Time complexity of search operation',
    },
    'cache-invalidation': {
      triggers: ['cache', 'redis', 'memoize'],
      question_template: 'When and how stale data gets cleared',
    },
  },
};
```

---

## 5. Socratic Question Generation Engine

### 5.1 Question Generation Prompt

```
You are Socrates — a demanding but fair software engineering mentor.

The developer has requested code for: {request_description}

These blind spots were detected in their request:
{blind_spots}

Generate exactly 3 Socratic questions about this code request.
Each question must:
1. Be specific to THIS code request (not generic)
2. Probe exactly ONE concept
3. Require thinking about THIS specific code, not generic knowledge
4. Have a correct answer that would make the code better

Question ordering:
Q1: The most critical question (if they can't answer this, shipping is risky)
Q2: A design rationale question (why this approach)
Q3: An edge case / optimization question

Format each question as:
- Ngắn gọn: 1-2 câu tiếng Việt
- Cụ thể: dẫn chiếu đến code/yêu cầu cụ thể
- Không dẫn dắt: không hint về câu trả lời trong câu hỏi

After questions, add one sentence: "Khi bạn trả lời xong, tôi sẽ giúp bạn viết code."
```

### 5.2 Question Examples by Category

**Error Handling Questions:**
```
Q: "Bạn có 3 chỗ có thể throw trong hàm này. 
    Với mỗi chỗ, caller sẽ nhận được gì — exception, null, hay error object? 
    Đây có nhất quán không?"

Q: "Nếu database connection bị timeout ở giữa chừng, 
    trạng thái của dữ liệu đang được update sẽ như thế nào?"

Q: "Catch block của bạn log error rồi trả về null. 
    Code nào sẽ gọi hàm này và sẽ xử lý null thế nào?"
```

**Concurrency Questions:**
```
Q: "Hàm này có thể được gọi đồng thời bởi nhiều request không? 
    Nếu có, shared state nào có thể bị race condition?"

Q: "User click 'Submit' hai lần nhanh. 
    Hai request cùng đến endpoint này. 
    Dữ liệu cuối cùng sẽ là gì?"

Q: "Bạn đang await 3 operations theo thứ tự. 
    Operations nào PHẢI đợi operations nào? 
    Operations nào có thể chạy song song?"
```

**Security Questions:**
```
Q: "userId ở đây đến từ đâu? 
    Có gì ngăn user A truyền vào userId của user B không?"

Q: "Input này đi thẳng vào query. 
    Giải thích cụ thể tại sao đây an toàn — hoặc tại sao nó không an toàn."

Q: "Nếu attacker kiểm soát được trường này, 
    họ có thể làm gì tệ nhất với hệ thống của bạn?"
```

**Data Structure Questions:**
```
Q: "Bạn đang tìm kiếm trong array này. 
    Với 10,000 elements, một lần tìm kiếm mất bao lâu?"

Q: "Tại sao HashMap thay vì mảng đã sort? 
    Thứ tự có quan trọng ở đây không?"

Q: "Mỗi khi cần đọc dữ liệu, bạn query lại toàn bộ. 
    Ở scale 1000 request/giây, đây có vấn đề không?"
```

---

## 6. Answer Evaluation & Progressive Unlocking

### 6.1 Understanding Score Model

```typescript
type UnderstandingLevel = 
  | 'DEEP'       // Developer demonstrates full understanding, may have insights
  | 'ADEQUATE'   // Developer understands the core issue
  | 'PARTIAL'    // Developer understands something but has a significant gap
  | 'SURFACE'    // Developer is guessing or using buzzwords without substance
  | 'MISSING'    // Developer explicitly says "I don't know" or answer is wrong
  | 'DEFLECTING' // Developer is avoiding the question ("just give me the code");

interface AnswerEvaluation {
  question: SocraticQuestion;
  developerAnswer: string;
  understandingLevel: UnderstandingLevel;
  keyInsightPresent: boolean;    // Did they identify the actual risk?
  keyInsightMissing: string;     // What they need to understand
  followUpQuestion?: string;     // If PARTIAL, the specific gap to probe
}
```

### 6.2 Unlock Decisions

```typescript
function determineUnlock(evaluations: AnswerEvaluation[]): UnlockDecision {
  
  const criticalQuestion = evaluations[0]; // Most critical question
  const designQuestion = evaluations[1];
  const edgeCaseQuestion = evaluations[2];
  
  // Critical question not understood → minimal code + must learn
  if (criticalQuestion.understandingLevel === 'MISSING' || 
      criticalQuestion.understandingLevel === 'SURFACE') {
    return {
      type: 'TEACH_FIRST',
      teachConcept: criticalQuestion.keyInsightMissing,
      giveCode: 'minimal_safe_version',
      note: `⚠️ Code này có ${criticalQuestion.question.blindSpotType} risk. 
             Tôi đã viết version an toàn nhất có thể, 
             nhưng bạn cần hiểu ${criticalQuestion.keyInsightMissing} 
             trước khi deploy lên production.`,
    };
  }
  
  // All deep → give full code + celebrate
  if (evaluations.every(e => e.understandingLevel === 'DEEP' || e.understandingLevel === 'ADEQUATE')) {
    return {
      type: 'FULL_UNLOCK',
      code: 'complete_with_annotations',
      celebration: `Bạn đã xác định được ${evaluations.map(e => e.question.blindSpotType).join(', ')}. 
                    Đây chính xác là những gì cần nghĩ đến. Code đây.`,
    };
  }
  
  // Mixed → partial code + address gaps
  return {
    type: 'PARTIAL_UNLOCK',
    code: 'core_logic_without_risky_parts',
    gaps: evaluations.filter(e => e.understandingLevel === 'PARTIAL'),
    instruction: 'Tôi đã viết phần core. Bạn cần tự thêm phần xử lý lỗi.',
  };
}
```

### 6.3 Answer Evaluation Examples

**Developer answer: "Nếu có lỗi thì catch block sẽ xử lý"**
→ UnderstandingLevel: SURFACE
→ Missing: What does "handle" mean? What does the caller receive? What state is the system in?
→ Follow-up: "Cụ thể hơn: caller của hàm này nhận được gì — exception, null, hay empty object? Họ có biết lỗi đã xảy ra không?"

**Developer answer: "Cần thêm database transaction để đảm bảo hai update cùng thành công hoặc cùng thất bại, tránh trường hợp balance bị trừ mà không tạo được bản ghi transaction"**
→ UnderstandingLevel: DEEP
→ KeyInsightPresent: true (ACID atomicity, rollback semantics)
→ Response: "Chính xác. Đây là lý do BEGIN/COMMIT/ROLLBACK tồn tại. Code đây, với transaction wrapper đã được thêm sẵn."

---

## 7. Code Annotation System

### 7.1 Annotation Types

Even when code is generated without Socratic questioning, it is annotated:

```typescript
// WHY: comments explain non-obvious decisions
const BCRYPT_ROUNDS = 12;
// WHY: 12 rounds gives ~250ms/hash — fast enough for UX,
// slow enough to make brute force economically infeasible.
// Increasing to 14 doubles the time each round.

// RISK: comments flag assumptions and dangers
const userId = jwt.verify(token, process.env.JWT_SECRET).sub;
// RISK: jwt.verify throws if token is expired or invalid.
// Make sure this is inside a try-catch or the caller handles it.
// RISK: .sub may be undefined if token was created without sub claim.

// CONSIDER: comments note trade-offs
const users = await User.findAll({ include: [{ model: Post }] });
// CONSIDER: This eager-loads ALL posts for ALL users.
// If users have many posts, this will be very slow.
// For large datasets, consider pagination or lazy loading.

// DANGER: comments for code requiring extra care
await conn.execute('BEGIN');
// DANGER: You must call COMMIT or ROLLBACK in ALL code paths.
// If an exception is thrown before COMMIT, call ROLLBACK in the catch block.
// A hanging transaction will lock rows and eventually kill your DB.
```

### 7.2 Annotation Generation Prompt

```
Review this code and add annotations at every non-obvious decision.
Use these comment formats:
// WHY: [explain why this specific approach was chosen over alternatives]
// RISK: [explain what assumption is being made and what breaks if wrong]
// CONSIDER: [note trade-offs accepted — what was given up, when to revisit]
// DANGER: [call out code that REQUIRES careful handling or will cause serious bugs]

Rules:
- Only annotate things that are non-obvious to a competent developer
- Don't state the obvious ("// WHY: returns the user from database")
- Each annotation adds CONTEXT, not just description
- Vietnamese preferred
- Maximum 1 annotation per 5-10 lines of code (don't over-annotate)
```

---

## 8. Developer Understanding Graph

### 8.1 Concept Mastery Tracking

```typescript
interface DeveloperUnderstandingGraph {
  developerId: string;
  
  // Concepts with demonstrated mastery (won't ask again)
  masteredConcepts: ConceptMastery[];
  
  // Concepts in progress (will probe gently)
  learningConcepts: ConceptInProgress[];
  
  // Concepts with known gaps (will probe seriously)
  gapConcepts: ConceptGap[];
  
  // Overall learning trajectory
  trajectory: {
    startDate: Date;
    conceptsLearnedCount: number;
    incidentsPreventedEstimate: number;  // When a question found a real bug
    totalSocraticSessions: number;
  };
}

interface ConceptMastery {
  concept: string;        // 'database-transactions', 'idempotency', 'sql-injection'
  demonstratedDate: Date;
  demonstratedIn: string; // Code context where mastery was shown
  notes: string;          // Any nuances about their understanding
}
```

### 8.2 Mastery Demonstration Events

```typescript
// Mastery can be demonstrated in two ways:

// 1. By answering Socratic questions correctly
function recordMasteryFromAnswer(
  concept: string,
  evaluatedAnswer: AnswerEvaluation
): void {
  if (evaluatedAnswer.understandingLevel === 'DEEP') {
    developerGraph.markMastered(concept, evaluatedAnswer.developerAnswer);
  }
}

// 2. By PROACTIVELY mentioning a concern before being asked
// This is the highest form of mastery
function checkForProactiveMastery(
  codeRequest: string,
  developerContext: string
): void {
  
  // Did developer mention idempotency without being asked?
  if (mentionsIdempotency(developerContext) && requestInvolvesPayment(codeRequest)) {
    speak("Tôi thấy bạn đã chủ động đề cập đến idempotency — đây là thinking level cao. Không cần hỏi thêm về vấn đề này.");
    developerGraph.markMastered('idempotency');
  }
}
```

---

## 9. Integration Architecture

### 9.1 VS Code Extension Integration

```typescript
// The extension intercepts code generation requests before they reach Claude/Copilot
vscode.commands.registerCommand('socratic.interceptCodeRequest', async () => {
  
  // Get current selection or context
  const context = getEditorContext();
  
  // Get the AI prompt the developer is about to send
  const aiPrompt = await captureAIPrompt();
  
  // Run through Socratic pipeline
  const decision = await socraticAgent.evaluate(aiPrompt, context, developerProfile);
  
  if (decision.trigger) {
    // Show Socratic questions in a side panel
    showSocraticPanel(decision.questions);
    
    // Block code generation until questions answered
    await waitForAnswers();
    
    // Evaluate answers
    const evaluation = await socraticAgent.evaluateAnswers(answers);
    
    // Generate and show code based on evaluation
    generateAndShowCode(evaluation);
  } else {
    // Let original AI tool generate, but add annotations
    const code = await letAIGenerate(aiPrompt);
    const annotated = await socraticAgent.annotateCode(code);
    showAnnotatedCode(annotated);
  }
});
```

### 9.2 CLI Wrapper Integration

```bash
# Instead of: claude "write me a payment service"
# Developer uses: socratic claude "write me a payment service"

# The wrapper intercepts, asks questions, then passes to Claude with evaluation context
```

```typescript
// cli-wrapper.ts
async function main() {
  const [, , tool, ...args] = process.argv;
  const userPrompt = args.join(' ');
  
  const decision = await socraticAgent.evaluate(userPrompt);
  
  if (decision.trigger) {
    // Interactive Socratic dialogue in terminal
    for (const question of decision.questions) {
      console.log(`\n🤔 ${question.text}\n`);
      const answer = await promptUser();
      decision.recordAnswer(question.id, answer);
    }
    
    const evaluation = await socraticAgent.evaluateAnswers(decision);
    const enrichedPrompt = buildEnrichedPrompt(userPrompt, evaluation);
    
    // Now run the actual AI tool with enriched context
    exec(`${tool} ${enrichedPrompt}`);
  } else {
    // Add annotation request to prompt, then run AI tool
    exec(`${tool} ${addAnnotationInstructions(userPrompt)}`);
  }
}
```

### 9.3 API Proxy Mode

```typescript
// For teams: proxy that sits between developer tools and AI APIs
// All requests pass through Socratic evaluation

app.post('/v1/messages', async (req, res) => {
  const userMessage = extractUserMessage(req.body);
  const decision = await socraticAgent.evaluate(userMessage);
  
  if (decision.trigger) {
    // Return Socratic questions instead of AI response
    return res.json({
      type: 'socratic_questions',
      questions: decision.questions,
      sessionId: decision.sessionId,
    });
  }
  
  // Forward to actual Anthropic API
  const anthropicResponse = await anthropicClient.post('/v1/messages', req.body);
  
  // Add annotations to code in response
  const annotated = await socraticAgent.annotateResponse(anthropicResponse.data);
  return res.json(annotated);
});
```

---

## 10. The Socratic Conversation Examples

### 10.1 Example: Payment Service Request

**Developer Request**: "Viết hàm xử lý thanh toán, nhận userId và amount, trừ balance của user và tạo transaction record"

**Agent Response (Socratic Mode)**:

```
Trước khi tôi viết code, tôi có 3 câu hỏi. Trả lời xong tôi sẽ giúp bạn:

❓ Q1 (QUAN TRỌNG NHẤT): User click "Thanh toán" hai lần liên tiếp rất nhanh 
   (hoặc client retry khi timeout). Cả hai request cùng đến hàm này với 
   userId và amount giống nhau. Điều gì xảy ra với balance của user?

❓ Q2: Nếu trừ balance thành công nhưng tạo transaction record bị lỗi, 
   tiền đã bị trừ nhưng không có bằng chứng. Bạn xử lý trường hợp này thế nào?

❓ Q3: Hàm này sẽ được gọi bởi code nào? Code đó biết thanh toán thất bại 
   thế nào — exception, error code, hay false return?

Khi bạn trả lời xong, tôi sẽ viết code.
```

**Developer Answer Q1**: "Ừ, cần idempotency key để tránh trừ tiền hai lần"

**Developer Answer Q2**: "Dùng database transaction để cả hai cùng thành công hoặc cùng rollback"

**Developer Answer Q3**: "Throw exception, caller dùng try-catch"

**Agent Evaluation**:
```
Q1: DEEP — Bạn xác định đúng idempotency risk
Q2: DEEP — Database transaction là đúng hướng
Q3: ADEQUATE — Đủ rõ ràng

Tốt lắm. Bạn đã nhận ra hai điểm quan trọng nhất: idempotency 
và transaction atomicity. Code đây với cả hai đã được implement:
```

```typescript
async function processPayment(
  userId: string,
  amount: number,
  idempotencyKey: string  // WHY: Client must generate and store this. Same key = same operation, safe to retry.
): Promise<PaymentResult> {
  
  // WHY: Check idempotency BEFORE acquiring any locks
  const existing = await PaymentRecord.findOne({ idempotencyKey });
  if (existing) {
    return existing.result;  // CONSIDER: Return same result, not error, on duplicate
  }
  
  return await db.transaction(async (trx) => {
    // DANGER: Both operations MUST be inside this transaction.
    // If save() fails after update(), transaction auto-rollbacks.
    
    const user = await User.findByIdForUpdate(userId, { transaction: trx });
    // WHY: findByIdForUpdate uses SELECT FOR UPDATE — prevents concurrent reads
    // RISK: This creates a lock. Long transactions will block other payments for this user.
    
    if (user.balance < amount) {
      throw new InsufficientFundsError(user.balance, amount);
    }
    
    await user.update({ balance: user.balance - amount }, { transaction: trx });
    
    const record = await PaymentRecord.create({
      userId,
      amount,
      idempotencyKey,
      status: 'COMPLETED',
    }, { transaction: trx });
    
    return { success: true, transactionId: record.id };
  });
}
```

### 10.2 Example: "I Don't Know" Path

**Developer Answer Q1**: "Tôi không biết... cần thêm lock gì đó?"

**Agent Response**:
```
"Không biết" là câu trả lời tốt hơn là đoán sai. Để tôi giải thích nhanh:

Idempotency trong thanh toán nghĩa là: cùng một operation chạy nhiều lần 
phải có cùng kết quả. Trừ tiền 100k hai lần KHÔNG phải idempotent — 
user bị trừ 200k.

Giải pháp: Client tạo một unique key (UUID) cho mỗi INTENT thanh toán 
(không phải mỗi request). Server kiểm tra key này trước khi xử lý — 
nếu đã thấy key này rồi, trả về kết quả cũ, không trừ tiền lần nữa.

Bạn có thể implement điều này không? Tôi sẽ cho bạn xem cách test nó.
[sau khi developer thử implement]
Code của bạn gần đúng rồi. Đây là version hoàn chỉnh hơn...
```

---

## 11. Data Flow (E2E)

### 11.1 Happy Path: Developer learns something

```
Dev request: "Write async function that fetches user, updates their score, saves to DB"

Blind spot detection:
  → Read-modify-write pattern (LOST UPDATE risk)
  → Multiple awaits (SEQUENTIAL vs PARALLEL question)
  → Error handling not mentioned (SILENT FAILURE risk)

Questions generated:
  Q1: "Nếu 2 request cùng fetch user → cùng update score → cùng save, 
       score cuối cùng là gì?"
  Q2: "Fetch user và [other independent operation] có phải chờ nhau không?"  
  Q3: "Nếu DB save thất bại, caller nhận được gì?"

Developer answers:
  Q1: "Cần optimistic locking với version field"  ← DEEP
  Q2: "Không, có thể Promise.all nếu độc lập"    ← DEEP  
  Q3: "Throw error, caller try-catch"              ← ADEQUATE

Unlock decision: FULL_UNLOCK
Code generated with:
  - Optimistic locking implementation
  - Promise.all for independent operations
  - Proper error propagation
  - WHY/RISK annotations throughout

Session update:
  + Developer demonstrates 'optimistic-locking' mastery
  + Developer demonstrates 'async-parallelism' mastery
  Won't probe these concepts again in future sessions
```

### 11.2 Emergency Override Path

```
Dev writes: "URGENT: Production is down, customers can't login, 
             need fix for auth service NOW"

Socratic evaluation: EMERGENCY DETECTED
→ Skip questioning
→ Generate fix immediately
→ Add prominent note:

// ⚠️ EMERGENCY-GENERATED CODE — Generated under time pressure
// Before next deploy, review:
// 1. Line 23: Error handling swallows exception — may hide root cause
// 2. Line 47: Token expiry not validated — security review needed  
// 3. Line 61: DB query not parameterized — SQL injection risk if user data flows here
// Schedule: 15 minutes of review with team after fire is out
```

---

## 12. Self-Learning Knowledge System

### 12.1 Concept Library Updates

```typescript
// Weekly update: new vulnerability patterns, new CS concepts to probe
const KNOWLEDGE_SOURCES = [
  'OWASP Top 10 updates',
  'CVE database for common library vulnerabilities',  
  'Martin Fowler patterns blog',
  'High Scalability blog (new system design patterns)',
  'Vietnamese tech blogs (new local context)',
];
```

### 12.2 Question Quality Learning

Track which questions led to:
- Developer discovering a real bug (highest value)
- Developer saying "I hadn't thought of that" (high value)
- Developer already knowing the answer (no value, remove from rotation)
- Developer finding the question annoying (reduce frequency)

---

## 13. Performance Targets

| Metric | Target |
|--------|--------|
| Blind spot detection latency | < 2 seconds |
| Question generation | < 3 seconds |
| Answer evaluation | < 2 seconds |
| Code generation after unlock | Same as base AI tool |
| VS Code extension overhead | < 500ms added to request |
| Questions asked that reveal real issues | ≥ 40% of Socratic sessions |
| Developer satisfaction after session | ≥ 4/5 "I learned something" |
| False positives (unnecessary Socratic) | < 20% |

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Too many questions → developer disables tool | High | Maximum 3 questions, smart filtering, emergency override |
| Questions are too generic (not code-specific) | High | Questions must reference specific line/concept in the actual request |
| Developer guesses right answer without understanding | Medium | Follow-up question if answer is suspiciously brief |
| Socratic becomes ritualistic (rote answering) | High | Vary question styles; track when concept is truly mastered |
| False positive: triggers for code developer already understands | Medium | Developer understanding graph prevents re-asking mastered concepts |
| Slows down legitimate rapid development | High | Emergency mode; time-context detection; developer can override with explanation |

---

## 15. Success Metrics

### Primary: Did developers learn?
- [ ] 60%+ of developers report "I discovered something I hadn't considered" after Socratic session
- [ ] 30%+ of Socratic sessions identify at least one real issue in the proposed code
- [ ] Developers demonstrate mastery of questioned concepts in subsequent code (tracked)

### Secondary: Did quality improve?
- [ ] Developers who use the tool write measurably fewer AI-related bugs in review
- [ ] "Confident ignorance" incidents (AI code shipped without understanding) decrease
- [ ] Code annotation quality rated ≥ 4/5 by developers

### Negative: Did we not block unnecessarily?
- [ ] < 20% false positive rate (triggered on code developer already understood)
- [ ] < 5% developer override rate (they hit "just give me the code" out of frustration, not urgency)
- [ ] < 2% tool disabling rate per month

---

*End of PROJECT-detail.md*
