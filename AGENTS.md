# Hướng dẫn cho agent

Đọc file này trước khi sửa repo. `README.md` mô tả sản phẩm và cách chạy; `docs/contributing.md` là nguồn quy định chi tiết cho Git, review, coding, bảo mật, database và kiểm thử. Nếu hướng dẫn trong file này và tài liệu chuyên biệt khác nhau, ưu tiên yêu cầu cụ thể mới nhất của người dùng; sau đó cập nhật tài liệu bị lệch để giữ một nguồn thông tin nhất quán.

## Bắt đầu phiên làm việc

1. Kiểm tra đúng thư mục gốc repo và chạy `git status --short --branch`. Đọc kỹ nhánh hiện tại, thay đổi chưa commit và các commit có sẵn trước khi chỉnh sửa.
2. Chạy `git fetch origin --prune` để lấy refs mới nhất. Nếu không fetch được, báo rõ và không khẳng định refs local là mới nhất.
3. Giữ nguyên thay đổi có sẵn của người dùng và agent khác. Không tự ý `reset --hard`, xoá file, checkout đè, stash hoặc sửa commit của họ.
4. Tuân theo nhánh task trong [quy tắc đóng góp](docs/contributing.md#1-git-workflow). Không commit trực tiếp lên `main` hoặc `dev`, và tuyệt đối không push trực tiếp lên `main`/`dev`. Thay đổi được đưa qua PR theo quy trình review. Nếu môi trường đã cấp task branch/worktree, tiếp tục làm trên đó.
5. Chỉ đồng bộ/rebase task branch khi working tree sạch và không có nguy cơ ghi đè công việc đang có. Không force-push nếu chưa được yêu cầu rõ ràng.

## Quy tắc làm việc và coding

- Trước khi làm, đọc README và tài liệu liên quan đến phần được giao. Tìm kiếm trong code/docs để kiểm tra cách triển khai hiện có trước khi thêm quy ước hoặc abstraction mới.
- Thực hiện đúng các quy tắc chi tiết trong [`docs/contributing.md`](docs/contributing.md): định dạng Conventional Commit và Jira key, PR/review, TypeScript strict và tránh `any`, quy ước đặt tên, phân tầng frontend/backend, migrations/RLS, bảo mật, logging và kiểm thử.
- Giữ code, tên biến, comment kỹ thuật và commit bằng tiếng Anh; tài liệu trong `docs/` viết tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh.
- API contract, shared schemas và database phải khớp nhau. Khi đổi hành vi/API/schema, cập nhật các tài liệu liên quan cùng thay đổi; schema DB có migration làm nguồn sự thật, không sửa trực tiếp trên dashboard Supabase.
- Kiểm tra thay đổi bằng lệnh phù hợp với phạm vi (format/lint/typecheck/test/build hoặc kiểm tra tài liệu). Nêu rõ lệnh đã chạy và kết quả; không tuyên bố đã kiểm tra nếu chưa chạy.
- Không thêm dependency, thay đổi kiến trúc hoặc mở rộng phạm vi nếu không cần cho yêu cầu. Không commit secrets, dữ liệu nhạy cảm, model lớn hoặc artifacts sinh tự động.

## Tài liệu cần theo dõi

| Tài liệu | Nội dung / khi cần đọc |
|---|---|
| [`README.md`](README.md) | Mục tiêu, stack, cách cài/chạy và cấu trúc repo. |
| [`docs/contributing.md`](docs/contributing.md) | Git workflow, commit/PR, coding rules, bảo mật, DB, AI service, kiểm thử và Definition of Done. |
| [`docs/api/contract_v0.md`](docs/api/contract_v0.md) | API contract hiện tại: endpoint, payload, trạng thái, quyền và quy tắc nghiệp vụ. |
| [`docs/db/erd_v0.md`](docs/db/erd_v0.md) | Mô hình dữ liệu, quan hệ, constraint và ghi chú thiết kế DB. |
| [`docs/db/erd_v0.mmd`](docs/db/erd_v0.mmd) | Sơ đồ Mermaid tương ứng với ERD; cập nhật cùng `erd_v0.md`. |
| [`plans/week1.md`](plans/week1.md) | Kế hoạch/công việc tuần đầu của project. |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Các bước CI thực tế; tham khảo khi sửa lệnh build, lint hoặc kiểm tra tự động. |

`docs/contributing.md` có nhắc tới một số tài liệu dự kiến như `docs/ai/evaluation.md`, `docs/test/` và mẫu PR `.github/pull_request_template.md`, nhưng các file/thư mục này hiện chưa có trong repo. Đừng coi chúng là tài liệu hiện hành; nếu task cần thì tạo/cập nhật theo phạm vi được giao.

## Trách nhiệm từng thư mục

| Đường dẫn | Nội dung nên đặt ở đây |
|---|---|
| `apps/web/` | Ứng dụng giao diện React/Vite: routes/pages, UI, hooks và tích hợp API. Không đặt secret hoặc logic phân quyền chỉ chạy ở client. |
| `apps/api/` | Backend Fastify: routes, validation, nghiệp vụ, xác thực/phân quyền và truy cập dữ liệu. Route giữ mỏng; nghiệp vụ ở service theo contributing rules. |
| `apps/ai-service/` | Dịch vụ Python/FastAPI cho chức năng AI; schema Pydantic, type hints và cấu hình lint/type-check theo contributing rules. Không dùng đây làm nguồn schema DB. |
| `packages/shared/` | Kiểu dữ liệu, enum và Zod schemas dùng chung giữa web/API; giữ đồng bộ với API contract và ERD. |
| `supabase/migrations/` | Migrations SQL là nguồn sự thật của schema, constraint, index, trigger và RLS; thêm migration mới thay vì sửa migration đã merge. |
| `supabase/functions/` | Hàm phía Supabase/DB được gọi trực tiếp khi phù hợp với kiến trúc; ghi rõ quyền và cập nhật migration/tài liệu liên quan. |
| `supabase/seed.sql` | Dữ liệu seed phục vụ phát triển/demo; chỉ dùng dữ liệu giả, không chứa thông tin cá nhân thật hay secrets. |
| `scripts/` | Script hỗ trợ phát triển, CI, seed/import hoặc tác vụ vận hành; không biến script thành nơi chứa nghiệp vụ chính của ứng dụng. |
| `docs/api/` | API contract và tài liệu tích hợp API. |
| `docs/db/` | ERD, thiết kế schema và tài liệu liên quan RLS/database. |
| `docs/` | Tài liệu dự án theo chủ đề; thêm vào thư mục con phù hợp và liên kết từ bảng tài liệu ở trên khi cần. |
| `plans/` | Kế hoạch và ghi chú thực hiện theo tuần/sprint. |
| `.github/workflows/` | CI/CD workflow của GitHub Actions. |
| Thư mục gốc | Cấu hình workspace, package manager, TypeScript và tài liệu giới thiệu cấp repo; chỉ đặt file cấp repo tại đây. |

Không chỉnh sửa hoặc commit thư mục sinh tự động/phụ thuộc như `node_modules/`, `.venv/`, `dist/`, `build/`, `__pycache__/` trừ khi task yêu cầu trực tiếp.
