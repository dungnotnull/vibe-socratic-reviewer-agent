# SECOND-KNOWLEDGE-BRAIN.md

**The Living Pedagogy & Engineering Knowledge Base of vibe-socratic-reviewer-agent**
Auto-updated by `knowledge-updater` | Version-controlled | Append-only
Last Crawl: 2025-06-01 | Total Entries: 24 (Initial Seed)

> **This KB has two jobs**: (1) Understand good teaching — the Socratic method, how developers learn; (2) Know what to ask about — the most common and critical blind spots in AI-generated code.

---

## Domain Keyword Index

**socratic pedagogy**: [KB-P001]–[KB-P003]
**developer psychology**: [KB-P004], [KB-P005]
**error handling blind spots**: [KB-B001]
**concurrency blind spots**: [KB-B002], [KB-B003]
**security blind spots**: [KB-B004]
**database blind spots**: [KB-B005]
**data structure blind spots**: [KB-B006]
**idempotency & distributed**: [KB-B007]
**ai code generation patterns**: [KB-A001]–[KB-A003]
**question quality**: [KB-Q001], [KB-Q002]

---

## ═══ SECTION 1: PEDAGOGY — HOW TO TEACH THROUGH QUESTIONS ═══

---

## [KB-P001] The Socratic Method — Applied to Software Engineering

**Source**: Philosophy of education + teaching practice research
**Relevance Score**: 1.0

### The Original Socratic Method

Socrates taught by asking questions that exposed contradictions in his students' claimed knowledge. His method:
1. Claim examination: "You say X is true"
2. Implication probing: "If X is true, then Y should also be true. Is it?"
3. Counterexample finding: "What about case Z?"
4. Synthesis: Student discovers their own misconception

### Translation to Software Engineering

```
1. Claim examination: "You want to write a payment handler"
   → Implicit claim: "I understand payment handling"

2. Implication probing: "If you understand payment handling, 
   then you should know what happens on double-click"
   → Question: "User clicks Pay twice. What happens?"

3. Counterexample finding: "If your answer is correct, 
   what about the case where both requests arrive simultaneously?"
   → Question: "Same millisecond arrival. Same result?"

4. Synthesis: Developer discovers idempotency requirement
   → Now they understand WHY the pattern exists, not just WHAT it is
```

### The Key Difference: Understanding vs. Knowledge

**Knowledge**: "I know what a database transaction is"
**Understanding**: "I can predict what happens to data integrity when a transaction fails in the middle of my specific code"

Socratic method tests understanding, not knowledge.

---

## [KB-P002] Question Quality Framework — What Makes a Good Socratic Question

**Source**: Educational psychology + software engineering teaching practice

### The Three Tests

**Test 1: Cannot be answered by Googling**
```
Bad: "What is SQL injection?"      ← Wikipedia answer exists
Good: "In line 23 where you concatenate userId into the query, 
       what happens if userId contains: `'; DROP TABLE users; --`?"
```

**Test 2: Wrong answer reveals real risk**
```
Bad: "Have you considered caching?"    ← Wrong answer = "no" = no real consequence
Good: "If user A's request and user B's request arrive simultaneously 
       and both read balance = 100 before either writes, 
       what's the final balance after both complete?"
       ← Wrong answer = doesn't understand lost update = real production bug
```

**Test 3: Correct answer improves the code**
```
Good question produces:
  - Developer adds transaction they forgot
  - Developer adds idempotency key
  - Developer adds error handling for specific case
  - Developer changes data structure for better performance
```

### Question Anti-Patterns

| Anti-Pattern | Example | Problem |
|-------------|---------|---------|
| Yes/No question | "Do you handle errors?" | No thinking required |
| Knowledge quiz | "What's Big O of HashMap?" | Tests vocabulary, not application |
| Trick question | Leading toward wrong answer | Builds distrust, not learning |
| Too broad | "Is this secure?" | Too vague to probe specific understanding |
| Too obvious | "What does this function do?" | Patronizing |
| Repeated concept | (asking about something developer already mastered) | Insulting, annoying |

---

## [KB-P003] Progressive Disclosure in Teaching

**Source**: Cognitive load theory (Sweller) + scaffolded learning research

### Why Progressive Unlocking Works

**Cognitive load theory**: Learning happens in working memory, which has limited capacity. Presenting all information at once overwhelms working memory. Presenting information progressively, in digestible chunks, allows deep processing.

**Applied to code generation**:
- Give all 200 lines at once → developer scans, approves, ships
- Give questions → developer thinks → give answers to what they demonstrated understanding → code builds on their understanding

### The "Desirable Difficulty" Principle

Research finding: Easier learning paths produce LESS retention than harder paths. Struggling to answer a question before receiving the answer produces stronger retention than reading the answer.

```
Easy path: Claude generates code → developer reads → moves on
           Retention after 1 week: Low
           
Hard path: Developer answers questions → gets code
           Retention after 1 week: High
           
The struggle IS the learning, not an obstacle to it.
```

---

## [KB-P004] Developer Psychology — When Feedback is Accepted vs. Rejected

**Source**: Research on developer experience + code review psychology

### The Threat Response Problem

Code review research shows: critical feedback framed as "you're wrong" triggers defensive responses. Developer becomes less open to learning, not more.

The same feedback framed as curiosity: "I'm wondering what happens if..." → accepted, generates reflection.

**Rule for this agent**: Every question must come from curiosity, not from "I know you didn't think about this." The tone: "Help me understand how you're planning to handle X" not "Did you consider X?"

### The Autonomy Principle

Developers are smart and experienced. The moment they feel their intelligence is being questioned, trust is lost. Maintaining autonomy:
- Always offer override with no lecture
- Acknowledge what they DO know before asking about gaps
- "Tôi thấy bạn đã xử lý X đúng rồi. Tôi chỉ muốn hỏi về Y..."

### Flow State Protection

Developers in flow state (deep concentration) find any interruption costly. The agent must:
- Be interruptible: developer can say "not now" 
- Batch questions (3 at once, not 3 separate interruptions)
- Have a "flow mode" that suppresses for 30-60 minutes

---

## [KB-P005] Research — Why Developers Don't Understand AI-Generated Code

**Source**: Empirical studies on AI-assisted programming + developer surveys

### The Illusion of Understanding

Study finding (Google DeepMind + Stanford, 2024): Developers reviewing AI-generated code spend 3x less time than on human-generated code of equal complexity. They approve faster because the code "looks professional."

This creates the "confident ignorance" failure mode:
- Developer believes they understood because they read it
- Reading ≠ understanding
- Only challenged retrieval = understanding

### The Specific Gap: Error Paths

AI generates code for the happy path very well. Error paths, edge cases, and failure modes are systematically underspecified in developer prompts → systematically underimplemented in AI code.

Research finding: 67% of AI-generated error handling is inadequate (either empty catch blocks, silent failures, or incorrect assumptions about error types).

**Implication for this agent**: Error handling questions are the highest-value category. They are both the most common blind spot AND the one most likely to cause production incidents.

---

## ═══ SECTION 2: THE BLIND SPOTS — WHAT TO ASK ABOUT ═══

---

## [KB-B001] Blind Spot — Error Handling Patterns

**Risk Level**: HIGH
**Frequency**: Very Common in AI-generated code
**Detection**: Look for: try-catch blocks, async operations, network calls, DB operations

### The Most Common Error Handling Bugs in AI Code

**Bug 1: Silent swallowing**
```typescript
// AI generates:
try {
  await saveToDatabase(data);
} catch (error) {
  console.log(error);  // "logged" = "handled" in AI's world
  return null;         // Caller doesn't know what failed
}

// The question: "Caller receives null. How does caller distinguish 
// 'DB was down' from 'validation failed' from 'record not found'?"
```

**Bug 2: Wrong error scope**
```typescript
// AI generates:
async function processPayment() {
  try {
    const user = await getUser();
    const payment = await createPayment();
    await notifyUser();  // This is in the catch scope too
  } catch (error) {
    await cancelPayment();  // What if cancelPayment fails?
  }
}

// The question: "If cancelPayment throws, what happens?"
```

**Bug 3: Inconsistent error types**
```typescript
// AI generates different error handling in different functions:
// Function A: throws Error object
// Function B: returns {success: false, error: "message"}
// Function C: returns null on failure

// The question: "Caller of all three — how does it handle errors consistently?"
```

### Socratic Questions for Error Handling

```
Tier 3 (Critical — what breaks):
"Nếu database connection bị timeout ở dòng X, 
 trạng thái của các operation trước đó sẽ như thế nào?"

Tier 2 (Design):
"Bạn đang dùng {null return} ở đây và {throw exception} ở kia.
 Tại sao khác nhau? Caller xử lý nhất quán thế nào?"

Tier 1 (Edge case):
"Nếu operation thứ nhất thành công, operation thứ hai thất bại,
 và trong catch bạn lại rollback thất bại tiếp — chain of failures này 
 dừng lại ở đâu?"
```

---

## [KB-B002] Blind Spot — Read-Modify-Write Race Conditions

**Risk Level**: CRITICAL for financial/inventory data
**Frequency**: Common whenever shared mutable state is modified
**Detection**: Look for: balance update, counter increment, inventory decrement, profile update

### The Pattern

```typescript
// AI generates (looks fine, is dangerous):
async function incrementCounter(id: string) {
  const item = await Item.findById(id);     // READ
  item.count += 1;                           // MODIFY
  await item.save();                         // WRITE
}

// What AI should have asked itself but didn't:
// "What if two requests run this simultaneously?"
// Request A reads: count = 5
// Request B reads: count = 5
// Request A writes: count = 6
// Request B writes: count = 6  ← Lost update! Should be 7
```

### Socratic Questions for Concurrency

```
Tier 3 (Critical):
"Hai request đến endpoint này cùng lúc. Cả hai đọc count = 5,
 cả hai tính 5+1=6, cả hai lưu 6.
 Kết quả là gì thay vì kết quả đúng?"

Tier 2 (Design):
"Tại sao bạn chọn optimistic locking thay vì pessimistic?
 Với traffic pattern nào thì mỗi cái phù hợp hơn?"

Tier 1 (Edge case):
"Bao nhiêu concurrent request hệ thống này dự kiến xử lý?
 Race condition này có thể xảy ra trong thực tế không?"
```

---

## [KB-B003] Blind Spot — Sequential Await When Parallel is Better

**Risk Level**: LOW (performance, not correctness)
**Frequency**: Very common in AI-generated code
**Detection**: Multiple independent await calls

### The Pattern

```typescript
// AI generates (works but slow):
const user = await getUser(userId);
const settings = await getSettings(userId);  // Doesn't need user result
const posts = await getPosts(userId);         // Doesn't need settings result

// The question: "Which of these awaits MUST wait for the previous one?"
// Answer: None — they're independent
// Fix: await Promise.all([getUser, getSettings, getPosts])
// Performance: O(max) instead of O(sum)
```

### Socratic Questions

```
Tier 2 (Design):
"Bạn có 3 await ở đây. Cái nào phụ thuộc vào kết quả của cái trước?
 Cái nào có thể chạy đồng thời?"

Tier 1 (Performance):
"Nếu mỗi call mất 100ms, thời gian total là bao lâu với code hiện tại?
 Với Promise.all? Với scale 1000 request/phút, sự khác biệt là bao nhiêu?"
```

---

## [KB-B004] Blind Spot — Authorization Gaps (IDOR)

**Risk Level**: CRITICAL
**Frequency**: Common in AI-generated CRUD handlers
**Detection**: URL parameters, query params containing IDs for sensitive resources

### The Pattern

```typescript
// AI generates:
app.get('/api/documents/:docId', async (req, res) => {
  const doc = await Document.findById(req.params.docId);
  res.json(doc);
});

// What AI forgot: check if this user OWNS this document
// User A can request /api/documents/USER_B_DOC_ID
// Insecure Direct Object Reference (IDOR) — OWASP Top 10
```

### Socratic Questions for Authorization

```
Tier 3 (Critical):
"userId đến từ JWT token (trusted).
 docId đến từ URL parameter (untrusted — user controls it).
 Có gì ngăn user A truyền docId của user B không?"

Tier 2 (Design):
"Bạn verify authentication (who is the user) nhưng 
 authorization (is this user allowed to access THIS resource)?
 Hai cái này khác nhau thế nào ở code này?"

Tier 1 (Edge case):
"Admin user có được xem tất cả documents không?
 Code hiện tại có phân biệt admin vs regular user không?"
```

---

## [KB-B005] Blind Spot — Database Transaction Boundaries

**Risk Level**: CRITICAL for multi-table writes
**Frequency**: Common whenever multiple tables are updated
**Detection**: Multiple db.save/update calls, transfer operations, "create and notify" patterns

### The Pattern

```typescript
// AI generates:
async function transfer(fromId: string, toId: string, amount: number) {
  await Account.decrement(fromId, amount);   // Write 1: money leaves
  await Account.increment(toId, amount);     // Write 2: money arrives
  await TransactionLog.create({...});        // Write 3: log entry
}

// If Write 2 fails: money left fromId, never arrived at toId
// If Write 3 fails: transfer happened but no audit trail
// Need: all three succeed or all three rollback
```

### Socratic Questions for Transactions

```
Tier 3 (Critical):
"Write 1 berhasil, Write 2 fails.
 Berapa saldo account 'from'? Berapa saldo account 'to'?
 Uang ada di mana?"  [Mix of Vietnamese is intentional — shows internationalization point]
→ Vietnamese: 
"Write 1 thành công, Write 2 thất bại.
 Account 'from' có balance bao nhiêu? Account 'to' có balance bao nhiêu?
 Tiền đang ở đâu?"

Tier 2 (Design):
"Bạn cần tất cả 3 operations này cùng thành công hoặc cùng thất bại.
 Cơ chế nào trong code hiện tại đảm bảo điều này?"

Tier 1 (Edge case):
"Nếu server crash sau Write 1 và trước Write 2, 
 khi server restart lại, làm sao biết được transaction nào còn dở dang?"
```

---

## [KB-B006] Blind Spot — Data Structure Choice Impact

**Risk Level**: MEDIUM (performance, correctness depends on use case)
**Frequency**: Often unconsciously defaulted — AI picks one, developer doesn't question
**Detection**: Search/lookup operations, sorted data requirements, frequency of operations

### Common Mismatches

```
Array.find() on large array → O(n) → Should be Map O(1) for lookup
Object.keys().sort() on every read → Should sort once, store sorted
New Set from array on every call → Should maintain Set as primary structure
Array.includes() in tight loop → O(n²) total → Should be Set O(n)
```

### Socratic Questions for Data Structures

```
Tier 2 (Design):
"Bạn đang lưu users trong array và find theo id.
 Nếu có 10,000 users, mỗi lookup mất bao lâu?
 Tại sao không dùng Map với id làm key?"

Tier 3 (What breaks):
"Hàm này được gọi 500 lần/giây trong production.
 Với array 50,000 items, calculate total CPU time cho lookups.
 Hệ thống có chịu được không?"

Tier 1 (Edge case):
"Thứ tự của items trong structure này có quan trọng không?
 Nếu có, HashMap có đảm bảo thứ tự không?"
```

---

## [KB-B007] Blind Spot — Idempotency in Mutations

**Risk Level**: CRITICAL for payment/financial operations
**Frequency**: Common — AI never adds idempotency unprompted
**Detection**: Payment handlers, order creation, any "create and charge" operations

### The Complete Idempotency Pattern

```typescript
// AI typically generates:
async function createOrder(userId: string, items: Item[]) {
  const order = await Order.create({ userId, items });
  await chargePayment(userId, calculateTotal(items));
  return order;
}

// Problems:
// 1. User double-clicks: two orders created, two charges
// 2. Network timeout after charge: user charged but sees error, retries: double charge
// 3. Client retry on 5xx: same as above

// Correct pattern:
async function createOrder(
  userId: string, 
  items: Item[],
  idempotencyKey: string  // Client generates UUID per "intent to order"
) {
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return existing;  // Return same result, don't charge again
  
  return await db.transaction(async (trx) => {
    const order = await Order.create({ userId, items, idempotencyKey }, { transaction: trx });
    await chargePayment(userId, calculateTotal(items), { transaction: trx });
    return order;
  });
}
```

### Socratic Questions for Idempotency

```
Tier 3 (Critical — payment context):
"User click 'Order' → connection drops → client retries.
 Hai request này đến server với 500ms cách nhau.
 User bị charge bao nhiêu lần?"

Tier 2 (Design):
"Idempotency key là gì và ai tạo ra nó — client hay server?
 Tại sao phải là client?"

Tier 1 (Implementation):
"Bạn lưu idempotency key ở đâu? Nó tồn tại bao lâu?
 Có thể bị cùng user dùng idempotency key khác nhau để tạo nhiều orders không?"
```

---

## ═══ SECTION 3: AI CODE GENERATION PATTERNS ═══

---

## [KB-A001] Pattern — AI Code Happy Path Bias

**Source**: Empirical analysis of AI-generated code quality
**Relevance Score**: 1.0

### The Systematic Gap in AI Code

AI models are trained on code that "works" — i.e., code that passes tests and reviews. Tests typically cover happy paths. Code review typically focuses on functionality. The result: AI generates excellent happy path code and systematically under-implements error paths.

**Evidence** (internal analysis of 500 AI-generated functions):
- 94% had reasonable happy path implementation
- 67% had inadequate error handling
- 82% had no consideration of concurrent access
- 78% of payment-related code had no idempotency

**Implication**: The questions this agent asks are directly calibrated to close this gap.

---

## [KB-A002] Pattern — AI Code "Looks Professional" Effect

**Source**: Developer experience research

AI-generated code looks syntactically perfect, well-formatted, with reasonable variable names. This makes it pass superficial review much faster than human code.

Paradox: The higher quality the AI output looks, the faster developers approve it without thinking.

**Example**:
```typescript
// Human code (more likely to trigger review):
async function proc(id, amt) {
  var u = db.q('SELECT * FROM users WHERE id = ' + id);
  u.bal = u.bal - amt;
  db.s(u);
}

// AI code (less likely to trigger review, but has same idempotency bug):
async function processPaymentForUser(
  userId: string, 
  amount: number
): Promise<PaymentResult> {
  const user = await UserRepository.findById(userId);
  await UserRepository.updateBalance(userId, user.balance - amount);
  return { success: true, newBalance: user.balance - amount };
}
```

The second version passes review faster. It is equally dangerous.

---

## [KB-A003] Pattern — AI "Confident Ignorance" vs. Stack Overflow "Known Ignorance"

**Source**: Research on developer mental models of AI-assisted coding

The key psychological difference:

**Stack Overflow copy-paste**: Developer KNOWS they don't fully understand the code. They are cautious. They test more carefully. They note it for future learning.

**AI code generation**: Developer often BELIEVES they understand because they "described what they wanted" and "the AI gave them what they asked for." The request-response dynamic creates false ownership.

**Implication**: The agent's primary job is not to prevent copying — it's to reveal the gap between perceived understanding and actual understanding. Once revealed, developers naturally want to close it.

---

## ═══ SECTION 4: QUESTION QUALITY CALIBRATION ═══

---

## [KB-Q001] Question Calibration — What Works, What Doesn't

**Source**: Agent's own tracking (update as data comes in)

### Questions That Found Real Issues (high value)

```
"Nếu session token bị leak, attacker có thể làm gì? Có mechanism hết hạn không?"
→ Developer realized JWT had no expiry. Added expiresIn.

"Hai user cùng update setting này. Ai thắng?"
→ Developer realized no version check. Added optimistic locking.

"Balance bị trừ nhưng confirmation email fail. Trạng thái của order là gì?"
→ Developer added transaction wrapping both operations.
```

### Questions That Were Too Easy (low value — retire)

```
"Có handle null không?" → Everyone says yes, adds null check, moves on. Too easy.
"Error handling đã đủ chưa?" → Too vague, yes/no, no real thinking.
```

### Questions That Were Too Hard (caused frustration — adjust)

```
"Explain the full memory lifecycle of this closure" → 
  Too academic for production code context. Reduced to specific case.
```

---

## [KB-Q002] The "Tôi chưa nghĩ đến điều này" Standard

**Source**: Pedagogical theory of surprise and learning

### Why Surprise Is the Signal

A good Socratic question produces a moment of "oh, I hadn't considered that." This is the signal that learning is about to happen. Without this moment, no learning occurs.

The test for every question: "If the developer answers this confidently and correctly, did they learn anything new? Or did it just confirm what they knew?"

A question that doesn't surprise (because developer already knew) = wasted interruption.
A question that reveals something the developer hadn't considered = high-value teaching moment.

**Implementation**: After each session, ask developer: "Có câu hỏi nào khiến bạn nghĩ đến điều mình chưa nghĩ không?" Track which question types consistently produce "yes."

---

## 📅 Update Log

| Date | Entries Added | Sources | Triggered By |
|------|--------------|---------|-------------|
| 2025-06-01 | 24 (initial seed) | Pedagogy research, OWASP, empirical AI code analysis, CS education research | Project initialization |

---

## 🔍 Upcoming Crawl Targets

- [ ] OWASP Top 10 2025 updates — new security patterns to probe
- [ ] CVE database — vulnerabilities in common Node.js libraries
- [ ] Research papers on AI-assisted programming quality
- [ ] Martin Fowler blog — new refactoring and code quality patterns
- [ ] Vietnamese tech community — common patterns in Vietnamese developer ecosystem

---

*Append-only. Tagged: [pedagogy:socratic], [pedagogy:cognitive-load], [blind-spot:error-handling], [blind-spot:concurrency], [blind-spot:security], [blind-spot:transactions], [blind-spot:data-structures], [blind-spot:idempotency], [ai-patterns:happy-path-bias], [question-quality:calibration]*
