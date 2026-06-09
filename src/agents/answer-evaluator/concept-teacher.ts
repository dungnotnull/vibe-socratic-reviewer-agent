import { llmClient } from '../../tools/llm-client';
import * as fs from 'fs';
import * as path from 'path';

export class ConceptTeacher {
  async teach(conceptName: string, questionText: string, requestDescription: string): Promise<string> {
    if (process.env.ANTHROPIC_API_KEY) {
      return this.teachWithLLM(conceptName, questionText, requestDescription);
    }

    return this.teachFromKnowledge(conceptName);
  }

  private async teachWithLLM(conceptName: string, questionText: string, requestDescription: string): Promise<string> {
    const teachingPrompt = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prompts', 'concept-teaching-prompt.md'),
      'utf8'
    );

    const filled = teachingPrompt
      .replace('{concept_name}', conceptName)
      .replace('{question_text}', questionText)
      .replace('{request_description}', requestDescription);

    const response = await llmClient.complete(filled, 'Teach concept');
    return response.text;
  }

  private teachFromKnowledge(conceptName: string): string {
    const knowledgeBase: Record<string, string> = {
      'database-transactions': `Database transaction đảm bảo nhiều operations cùng thành công hoặc cùng thất bại (ACID - Atomicity).

Ví dụ: Khi chuyển tiền giữa 2 tài khoản, cần 2 writes (trừ tiền A, cộng tiền B). Nếu dùng transaction, cả 2 cùng thành công hoặc cùng rollback — không thể xảy ra trường hợp tiền bị trừ khỏi A nhưng không đến được B.

Cách dùng: BEGIN → thực hiện các writes → COMMIT nếu tất cả thành công / ROLLBACK nếu bất kỳ cái nào thất bại.

Bạn có muốn thử implement không?`,

      'idempotency': `Idempotency nghĩa là gọi cùng một operation nhiều lần chỉ có hiệu lực một lần. Rất quan trọng cho payment/order.

Ví dụ: User click "Thanh toán" → request gửi đi → timeout → user không biết thành công hay chưa → click lại. Nếu server không có idempotency, user bị charge 2 lần.

Cách làm: Client tạo idempotency key (UUID) cho mỗi "intent" thanh toán. Server kiểm tra: nếu key đã tồn tại → trả về kết quả cũ, không xử lý lại.

Bạn có muốn thử implement không?`,

      'sql-injection': `SQL injection xảy ra khi user input được ghép trực tiếp vào query string mà không qua sanitization hoặc parameterization.

Ví dụ: SELECT * FROM users WHERE name = ' + userInput. Nếu user nhập '; DROP TABLE users; --, toàn bộ bảng users bị xóa.

Cách phòng tránh: Dùng parameterized queries (\`SELECT * FROM users WHERE name = ?\`) hoặc ORM. Không bao giờ ghép string trực tiếp.

Bạn có muốn thử implement không?`,

      'race-condition': `Race condition xảy ra khi 2+ tiến trình cùng đọc và ghi shared data, và kết quả phụ thuộc vào thứ tự thực thi.

Ví dụ: Request A đọc count=5, Request B đọc count=5. A ghi count=6, B ghi count=6. Đúng ra phải là 7 (lost update).

Cách phòng tránh: optimistic locking (version field), pessimistic locking (SELECT FOR UPDATE), hoặc atomic operations (UPDATE ... SET count = count + 1).

Bạn có muốn thử implement không?`,

      'error-propagation': `Error propagation là cách error được truyền từ nơi xảy ra đến nơi xử lý. Pattern sai phổ biến: catch rồi log rồi trả về null — caller không biết có lỗi.

Đúng: Throw exception với context đầy đủ (loại lỗi, operation nào fail, retry được không). Caller dùng try-catch để quyết định retry, fallback, hay báo lỗi cho user.

Bạn có muốn thử implement không?`,

      'authorization': `Authentication xác nhận "bạn là ai" (login). Authorization xác nhận "bạn được phép làm gì" (permission).

Lỗi phổ biến: API nhận userId từ JWT (authentication OK) nhưng dùng documentId từ URL parameter để fetch document. Không kiểm tra user này có quyền xem document này không → User A có thể xem document của User B (IDOR - Insecure Direct Object Reference).

Cách fix: Luôn kiểm tra document.userId === authenticatedUserId trước khi trả về.

Bạn có muốn thử implement không?`,

      'async-parallelism': `Nhiều async operations không phụ thuộc vào kết quả của nhau có thể chạy song song thay vì tuần tự.

Ví dụ: await getUser(), await getSettings(), await getPosts() — 3 cái này độc lập. Nếu mỗi cái 100ms: tuần tự mất 300ms, song song (Promise.all) chỉ mất 100ms.

Bạn có muốn thử implement không?`,

      'data-structure-selection': `Chọn sai data structure ảnh hưởng performance. Array.find() là O(n), Map.get() là O(1).

Ví dụ: Tìm user theo id trong array 10,000 items → mỗi lookup duyệt 5,000 items trung bình. Với Map dùng id làm key, mỗi lookup là O(1) constant time.

Bạn có muốn thử implement không?`,
    };

    return knowledgeBase[conceptName] ??
      `\`${conceptName}\` là một concept quan trọng trong software engineering. Khi có LLM connected, tôi sẽ giải thích chi tiết hơn trong context của code request này. Bạn có thể hỏi tôi câu hỏi cụ thể hơn về concept này không?`;
  }
}
