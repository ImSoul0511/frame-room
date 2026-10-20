# FrameRoom: Quy tắc kỹ thuật và quy ước làm việc

Tài liệu này áp dụng cho mọi thành viên. Quy tắc nào cần thay đổi thì mở PR sửa file này và thông báo trên Discord `#dev`.

**Nguyên tắc chung:** CI kiểm tra được thì tự động hoá (lint, format, commitlint). Phần còn lại dựa vào review.

---

## 1. Git workflow

### 1.1 Nhánh

| Nhánh | Mục đích | Quy tắc |
|---|---|---|
| `main` | Bản ổn định, dùng để demo/nộp | Bảo vệ; chỉ merge từ `dev` bằng PR vào cuối sprint |
| `dev` | Tích hợp, deploy staging | Bảo vệ; không push trực tiếp |
| `feature/FR-<số>-<mô-tả-ngắn>` | Tính năng | Tạo từ `dev` |
| `fix/FR-<số>-<mô-tả-ngắn>` | Sửa lỗi | Tạo từ `dev` |
| `hotfix/FR-<số>-<mô-tả-ngắn>` | Sửa lỗi gấp trên `main` | Merge vào cả `main` và `dev` |
| `chore/FR-<số>-<mô-tả-ngắn>` | Hạ tầng, tài liệu, refactor | Tạo từ `dev` |

Ví dụ: `feature/FR-24-portfolio-upload`, `fix/FR-57-booking-status`.

- Dùng chữ thường, nối bằng dấu gạch ngang, không dấu tiếng Việt.
- Mỗi nhánh gắn với **một** issue Jira.
- Nhánh sống ngắn (tối đa vài ngày); nhánh lâu thì rebase `dev` thường xuyên.
- Xoá nhánh sau khi merge.

### 1.2 Commit message (Conventional Commits)

Định dạng:

```
<type>(<scope>): <mô tả ngắn> [FR-123]

<nội dung chi tiết, tuỳ chọn>

<footer, tuỳ chọn>
```

**Type:**

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng |
| `fix` | Sửa lỗi |
| `docs` | Thay đổi tài liệu |
| `style` | Định dạng, không đổi logic |
| `refactor` | Cấu trúc lại code, không đổi hành vi |
| `perf` | Cải thiện hiệu năng |
| `test` | Thêm/sửa test |
| `build` | Hệ thống build, phụ thuộc |
| `ci` | Cấu hình CI/CD |
| `chore` | Việc vặt khác |
| `revert` | Hoàn tác commit |

**Scope** (một trong): `web`, `api`, `ai`, `db`, `shared`, `ci`, `docs`, `deps`.

**Quy tắc:**
- Viết ở thể mệnh lệnh, chữ thường, **không** kết thúc bằng dấu chấm, dòng đầu tối đa 72 ký tự.
- Viết bằng tiếng Anh cho dòng đầu (để nhất quán với tên type); phần mô tả chi tiết có thể dùng tiếng Việt.
- Mỗi commit làm **một việc**, build được và không phá test.
- Luôn kèm Jira key `[FR-123]`.
- Thay đổi gây phá vỡ tương thích: thêm `!` sau scope (`feat(api)!: ...`) và đoạn `BREAKING CHANGE:` trong footer.

**Ví dụ tốt:**

```
feat(api): add portfolio create endpoint [FR-24]
fix(web): prevent double submit on booking form [FR-57]
feat(db): add studio_members table with RLS [FR-31]
docs: add ERD v1 notes [FR-12]
ci: run migrations on staging after merge [FR-18]
```

**Ví dụ không chấp nhận:**

```
update code
fix bug
Final version
```

### 1.3 Pull request

- PR vào `dev`, tiêu đề theo định dạng commit: `feat(api): add portfolio create endpoint [FR-24]`.
- Dùng mẫu PR (`.github/pull_request_template.md`), gồm: mô tả, issue liên quan, ảnh chụp (nếu có UI), cách kiểm thử, checklist.
- Kích thước PR: **tối đa khoảng 400 dòng thay đổi** (không tính file sinh tự động). PR lớn hơn thì tách.
- Tối thiểu **1 reviewer** (ưu tiên người hỗ trợ của vai trò đó); migration DB cần **Ly hoặc Khải** duyệt.
- CI phải xanh trước khi merge.
- **Squash merge** vào `dev`; tiêu đề squash theo định dạng commit.
- Không tự merge PR của mình khi chưa có approve (trừ lỗi hạ tầng khẩn cấp, phải báo trên Discord).
- Review trong vòng **1 ngày làm việc**; người chờ review nhắn nhắc trên `#dev` nếu quá hạn.

### 1.4 Review: đánh giá những gì

- Đúng yêu cầu và Acceptance Criteria của issue.
- Dễ đọc, đặt tên rõ, không lặp lại code.
- Xử lý lỗi và trường hợp biên.
- Phân quyền và bảo mật (xem mục 7).
- Có test cho logic quan trọng.
- Không có secret, log thừa, code chết.

Nhận xét cụ thể, lịch sự, tập trung vào code. Dùng tiền tố `nit:` cho góp ý nhỏ không bắt buộc.

---

## 2. Quy ước code chung (TypeScript)

Áp dụng cho `apps/web`, `apps/api`, `packages/shared`.

### 2.1 Công cụ bắt buộc

- **ESLint + Prettier** dùng cấu hình chung trong repo; **không** tắt rule trừ khi có lý do và comment giải thích.
- **husky + lint-staged**: lint và format file đã stage trước mỗi commit.
- **commitlint**: kiểm tra commit message.
- **TypeScript `strict: true`**. Cấm `any` (dùng `unknown` rồi thu hẹp kiểu); cần `any` phải có comment `// eslint-disable-next-line ... -- lý do`.

### 2.2 Định dạng (Prettier)

- Dấu nháy đơn, có dấu chấm phẩy, thụt lề 2 dấu cách, độ rộng dòng 100, trailing comma `all`.
- Cuối file có một dòng trống; xuống dòng kiểu LF.

### 2.3 Đặt tên

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Biến, hàm | `camelCase` | `getBookingById` |
| Hằng số cấp module | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE` |
| Kiểu, interface, class, component React | `PascalCase` | `BookingStatus`, `PortfolioCard` |
| File React component | `PascalCase.tsx` | `PortfolioCard.tsx` |
| File khác (hook, util, module) | `kebab-case.ts` | `use-auth.ts`, `booking-service.ts` |
| Hook | bắt đầu bằng `use` | `usePortfolio` |
| Biến boolean | tiền tố `is/has/can/should` | `isLoading`, `hasAccess` |
| Enum, giá trị trạng thái | `snake_case` chuỗi | `'brief_agreed'` |

- Dùng tên đầy đủ, có nghĩa; tránh viết tắt không phổ biến.
- Hàm làm **một việc**, ngắn gọn; tránh lồng điều kiện quá 3 cấp (dùng early return).
- Ưu tiên `const`; không dùng `var`.
- Không để code bị comment; không để `console.log` (dùng logger).
- Comment giải thích **vì sao**, không lặp lại **cái gì** code đã nói.
- Dùng `import` có đường dẫn tuyệt đối theo alias (`@/…` trong `web`, `@frameroom/shared` cho gói chung); sắp xếp import theo nhóm (thư viện ngoài, gói nội bộ, tương đối).
- Không dùng `default export` cho code ngoài file route/page (ưu tiên named export để dễ tìm kiếm).

### 2.4 Ngôn ngữ

- Code, tên biến, comment kỹ thuật, commit: **tiếng Anh**.
- Nội dung hiển thị cho người dùng: tiếng Việt, đặt trong file chuỗi/hằng riêng (không rải khắp component) để dễ đa ngôn ngữ về sau.
- Tài liệu (`docs/`): tiếng Việt, thuật ngữ kỹ thuật giữ nguyên tiếng Anh.

---

## 3. Frontend (`apps/web`)

- **React 19 + Vite, function component + hooks**; không dùng class component.
- **Astryx** là design system cốt lõi: dùng component có sẵn trước khi tự viết; không ghi đè style tuỳ tiện, chỉnh qua theme/token.
- Cấu trúc thư mục theo tính năng:

  ```
  src/
  ├─ features/portfolio/   # components, hooks, api của tính năng
  ├─ components/           # component dùng chung
  ├─ pages/ (hoặc routes/) # trang
  ├─ lib/                  # supabase client, api client, tiện ích
  └─ styles/
  ```
- Dữ liệu từ server dùng **TanStack Query**; không lưu dữ liệu server trong state cục bộ.
- Form: validate bằng **Zod** (schema lấy từ `packages/shared` khi dùng chung với BE).
- Mỗi component một file, tối đa khoảng 200 dòng; vượt thì tách.
- Mọi màn hình xử lý đủ **3 trạng thái**: đang tải, lỗi, rỗng.
- **Responsive** (điện thoại và máy tính) ngay từ đầu; kiểm tra tối thiểu 375px và 1280px.
- **Accessibility cơ bản:** nhãn cho input, `alt` cho ảnh, điều hướng bằng bàn phím được.
- Không để khoá `service_role` hay secret trong code FE; chỉ dùng `VITE_SUPABASE_ANON_KEY`.
- Ảnh tải lên phải kiểm tra loại và kích thước phía client **và** phía server.

---

## 4. Backend (`apps/api`)

- **Node.js + TypeScript + Fastify + Zod**.
- Cấu trúc theo module:

  ```
  src/
  ├─ modules/booking/   # routes, service, repository, schema
  ├─ plugins/           # auth, error handler, swagger
  ├─ lib/
  └─ config/            # đọc và kiểm tra biến môi trường
  ```
- **Route chỉ nhận request và trả response**; logic nghiệp vụ ở `service`, truy cập dữ liệu ở `repository`.
- **Mọi input** (body, query, params) validate bằng Zod; schema đặt trong `packages/shared` nếu FE cũng dùng.
- **REST:**
  - Tài nguyên dùng danh từ số nhiều, `kebab-case`: `/studios`, `/bookings/:id/brief`.
  - Phương thức: `GET` đọc, `POST` tạo, `PATCH` sửa một phần, `DELETE` xoá.
  - Mã trạng thái đúng nghĩa: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503.
  - Phân trang: `?page=1&pageSize=20`; phản hồi gồm `data` và `meta`.
- **Định dạng lỗi thống nhất:**

  ```json
  { "error": { "code": "CONFLICT", "message": "Không thể xác nhận lịch", "details": [{ "reason": "slot_overlap", "message": "Photographer đã có lịch trong khoảng thời gian này" }] } }
  ```

  - `code` thuộc bộ mã chung theo mã HTTP (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`); không tự đặt mã riêng theo tính năng.
  - `details` **luôn là mảng**; mỗi phần tử có thể có `field`, `reason` (mã nguyên nhân cho máy xử lý, ví dụ `slot_overlap`, `already_exists`) và `message` (nội dung cho người dùng). FE không dùng `message` làm điều kiện logic.
- Đổi trạng thái booking chỉ qua **state machine** trong service; không cập nhật trực tiếp cột trạng thái ở nơi khác.
- Hoạt động ghi nhiều bước dùng **transaction** (hoặc hàm SQL).
- Ghi log có cấu trúc (JSON), không log mật khẩu, token, dữ liệu cá nhân.
- Tài liệu API (Swagger/OpenAPI) cập nhật cùng PR thay đổi endpoint.
- Phiên bản API ở tiền tố `/v1`.
- Contract API nằm ở `docs/api/`; nguồn sự thật cuối cùng là Zod schema trong `packages/shared`. PR đổi API gắn nhãn `API`: thay đổi **thêm** cần một người rà, thay đổi **phá vỡ** (đổi tên/kiểu trường, bỏ endpoint, đổi quyền hoặc bảng trạng thái) cần Khải và Khoa cùng đồng ý, thêm Ly nếu chạm schema.

---

## 5. Database (`supabase/`)

### 5.1 Migration

- **SQL migration là nguồn sự thật duy nhất của schema.** Không sửa trực tiếp trên dashboard Supabase.
- Tạo bằng `supabase migration new <ten_thay_doi>`; tên mô tả rõ (`add_studio_members`).
- Mỗi migration **nhỏ, một mục đích**; không sửa migration đã merge, viết migration mới để chỉnh.
- Thử bằng `supabase db reset` trên máy trước khi mở PR.
- Sau khi đổi schema: chạy `supabase gen types typescript --local > packages/shared/src/db.types.ts` và commit.
- Thay đổi DB cần **Ly hoặc Khải** duyệt.

### 5.2 Đặt tên

- Bảng và cột: `snake_case`; bảng **số nhiều** (`bookings`, `studio_members`).
- Khoá chính nghiệp vụ mới: `id uuid`, sinh UUIDv7 phía server bằng hàm do migration cung cấp; không dùng `gen_random_uuid()`. `profiles.id` và FK user giữ nguyên ID do Supabase Auth cấp; không đổi PK/FK hiện có. PK ghép/PK dùng FK là ngoại lệ ghi rõ trong ERD.
- Khoá ngoại: `<bảng_số_ít>_id` (`studio_id`, `photographer_id`); khi cần nêu vai trò của quan hệ thì đặt theo vai trò (`customer_id`, `assigned_photographer_id`, `created_by`).
- Mọi bảng có `created_at`, `updated_at` (`timestamptz`, mặc định `now()`); dùng `timestamptz` cho mọi thời gian. Ngoại lệ: bảng bất biến hoặc chỉ ghi thêm (ví dụ `booking_status_events`, `user_roles`) không cần `updated_at`, và có thể dùng một cột thời điểm tương đương (ví dụ `granted_at`); ngoại lệ phải ghi rõ trong ERD.
- Boolean: `is_…`, `has_…`. Index: `idx_<bảng>_<cột>`. Ràng buộc: `chk_…`, `uq_…`, `fk_…`.
- Trạng thái dùng enum hoặc bảng tra, không dùng chuỗi tự do.
- Xoá mềm (`deleted_at`) cho `portfolios`, `studios`, `services`, `service_add_ons`, `resources`, `reviews`. Portfolio xoá mềm giữ bản ghi và file 30 ngày rồi script dọn dẹp xoá vĩnh viễn.
- **Booking không xoá**: huỷ bằng trạng thái `cancelled` để giữ lịch sử, nên bảng `bookings` không có `deleted_at`.
- Xoá cứng cho ảnh bị xoá riêng lẻ và dữ liệu con/tạm (image note, milestone, schedule block, file bàn giao, bản ghi thành viên studio). Danh sách đầy đủ theo contract mục 2.4.

### 5.3 RLS và bảo mật

- **Bật RLS cho mọi bảng** trong schema `public`; mặc định **từ chối**, sau đó mở theo chính sách.
- Mỗi bảng có chính sách ghi rõ theo role và hành động, đúng với ma trận RLS trong `docs/db/`.
- Dùng hàm hỗ trợ (`has_role()`, `is_studio_member()`) thay vì lặp logic.
- Shoot Room và gallery riêng chỉ mở cho người được cấp quyền.
- Chống trùng lịch bằng ràng buộc loại trừ (`tstzrange` + `btree_gist`).
- Index cho cột dùng để lọc/join (`*_id`, cột lọc thường dùng); cột vector dùng chỉ mục HNSW khi triển khai AI Search.
- `image_embeddings` là bảng riêng, tách khỏi bảng ảnh.

---

## 6. AI service (`apps/ai-service`, Python)

*(Áp dụng từ Sprint 1–2)*

- Python 3.11+, FastAPI, type hint đầy đủ.
- **ruff** (lint + format) và **mypy** (kiểm tra kiểu); cấu hình trong `pyproject.toml`.
- Đặt tên: `snake_case` cho hàm/biến/file, `PascalCase` cho class.
- Phụ thuộc cố định phiên bản trong `requirements.txt` (hoặc `pyproject.toml` kèm khoá).
- Model và dữ liệu lớn **không commit** vào repo; ghi cách tải/tái tạo trong README của service.
- Mọi đánh giá lưu trong `docs/ai/evaluation.md` (bộ truy vấn, chỉ số, kết luận).
- API của service dùng schema rõ ràng (Pydantic); lỗi trả mã và thông điệp thống nhất với backend.

---

## 7. Bảo mật và dữ liệu

- **Không commit secret** (`.env`, khoá API, `service_role`). `.env` nằm trong `.gitignore`; chỉ commit `.env.example` với giá trị rỗng. Secret của CI dùng GitHub Secrets.
- Nếu lỡ commit secret: **thu hồi/đổi khoá ngay**, báo trên Discord; xoá khỏi lịch sử không thay thế việc đổi khoá.
- `service_role` chỉ dùng ở backend, bỏ qua RLS, nên backend **phải tự kiểm tra quyền** trong mọi endpoint.
- Phân quyền luôn thực hiện ở server/DB, không chỉ ẩn nút trên giao diện.
- Kiểm tra file tải lên: loại, kích thước, tên.
- Áp dụng giới hạn tần suất (rate limit) cho endpoint đăng nhập và tìm kiếm.
- Không log dữ liệu cá nhân; tài khoản demo dùng dữ liệu giả.
- **Dữ liệu ảnh demo:** chỉ phục vụ đồ án, lưu nội bộ, không public sản phẩm (ảnh seed nằm ở bucket công khai `portfolio-images`, đây là rủi ro đã chấp nhận cho MVP, xem README mục 7); mỗi ảnh ghi `source`, `collected_at`, `license_note`; ưu tiên nguồn có giấy phép hoặc ảnh được photographer đồng ý; không lưu thông tin liên hệ cá nhân.

---

## 8. Kiểm thử

- Logic nghiệp vụ quan trọng (state machine booking, phân quyền, chống trùng lịch, tính điểm tìm kiếm) **phải có unit/integration test**.
- Công cụ gợi ý: **Vitest** cho `web`/`api`/`shared`; **pytest** cho `ai-service`.
- Tên test mô tả hành vi: `rejects booking when time slot overlaps`.
- Khi sửa lỗi, thêm test tái hiện lỗi trước.
- Luồng chính (đăng nhập → tìm kiếm → booking → chọn ảnh → review) kiểm thử thủ công mỗi sprint theo kịch bản trong `docs/test/`; có thể tự động bằng Playwright khi đủ thời gian.
- Người kiểm thử ở cột **Testing** là người hỗ trợ của vai trò đó hoặc thành viên khác module; không tự test việc của mình.

---

## 9. Quy trình Jira

- **Mọi việc đều có issue**; không làm việc không có issue.
- Workflow: `To Do → In Progress → In Review → Testing → Done`.
  - Bắt đầu làm: chuyển **In Progress** và gán cho mình.
  - Mở PR: chuyển **In Review**.
  - Sau khi merge và deploy staging: chuyển **Testing**.
  - Người kiểm thử xác nhận theo Acceptance Criteria: chuyển **Done**.
- Mỗi người chỉ có **1–2 việc In Progress** cùng lúc.
- Việc bị chặn: bật **Flag**, ghi lý do, báo `#dev`.
- Story theo mẫu: *Là [role], tôi muốn [việc] để [lợi ích]* kèm Acceptance Criteria (Given/When/Then).
- Story trên 8 điểm thì tách nhỏ.
- Labels: `FE`, `BE`, `DB`, `AI`, `DevOps`, `Docs`.
- Cập nhật Jira **trước mỗi buổi standup**.

### Definition of Done

- [ ] Code qua review, CI xanh (lint, typecheck, test, build)
- [ ] Có test phù hợp; luồng chính đã kiểm thử
- [ ] Migration chạy lại được; RLS/phân quyền đã kiểm tra với từng role
- [ ] Đã deploy staging; người kiểm thử xác nhận theo Acceptance Criteria
- [ ] Tài liệu liên quan trong `docs/` đã cập nhật (API, ERD, ADR nếu có quyết định mới)

---

## 10. Giao tiếp và nhịp làm việc

- **Discord:** `#dev` (trao đổi kỹ thuật), `#ai-search`, `#github` (thông báo PR/CI), `#jira`, `#standup`, `#voice-standup`, `#general`.
- **Standup:** 3 buổi/tuần, 15 phút: đã làm, sẽ làm, bị chặn.
- Hỏi sớm khi bị chặn quá **nửa ngày**; không im lặng đến hạn.
- **Review và retro** cuối mỗi sprint (1 giờ).
- **Scrum Master** luân phiên mỗi sprint.

---

## 11. Danh sách kiểm tra nhanh trước khi mở PR

- [ ] Nhánh đặt tên đúng, gắn issue Jira
- [ ] Commit đúng định dạng, mỗi commit một việc
- [ ] Lint, format, typecheck, test chạy sạch trên máy
- [ ] Không có secret, `console.log`, code bị comment
- [ ] Input đã validate; quyền đã kiểm tra ở server/DB
- [ ] Màn hình có đủ trạng thái tải/lỗi/rỗng và responsive (nếu là UI)
- [ ] Migration chạy lại được; type DB đã sinh lại (nếu đổi schema)
- [ ] Tài liệu và Swagger đã cập nhật
- [ ] PR đủ mô tả, ảnh chụp, cách kiểm thử

---

## Phụ lục A: Cấu hình commitlint (gợi ý)

```js
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['web', 'api', 'ai', 'db', 'shared', 'ci', 'docs', 'deps']],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 72],
  },
};
```

## Phụ lục B: Mẫu PR (`.github/pull_request_template.md`)

```markdown
## Mô tả
<!-- Thay đổi gì và vì sao -->

## Issue liên quan
FR-

## Cách kiểm thử
<!-- Các bước để reviewer thử lại -->

## Ảnh chụp (nếu có thay đổi UI)

## Checklist
- [ ] Lint, typecheck, test chạy sạch
- [ ] Không có secret hay log thừa
- [ ] Phân quyền và validate input đã kiểm tra
- [ ] Migration/RLS đã kiểm tra (nếu đổi DB)
- [ ] Tài liệu đã cập nhật
```

## Phụ lục C: Cấu hình Prettier (gợi ý)

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```