# FrameRoom

> Cộng đồng nhiếp ảnh và nền tảng cộng tác: khám phá tác phẩm, tìm photographer/studio bằng AI, đặt lịch, cộng tác trong Shoot Room, duyệt ảnh và review.

Đồ án môn **Nhập môn Công nghệ phần mềm** (ĐH Khoa học Tự nhiên, ĐHQG-HCM). Dự án phục vụ học tập, **không public rộng rãi**.

---

## 1. Tổng quan

FrameRoom kết nối khách hàng với photographer/studio thông qua portfolio thực tế và quy trình cộng tác thống nhất: tìm kiếm → chốt Shoot Brief → booking → trao đổi → proofing → bàn giao → review.

### Vai trò hệ thống

| Role | Mô tả |
|---|---|
| `user` | Khách hàng: tìm kiếm, đặt lịch, chọn ảnh, review |
| `photographer` | Cung cấp dịch vụ nhiếp ảnh độc lập; đăng portfolio và nhận booking; có thể thuộc nhiều studio |
| `studio_manager` | Vận hành studio như một bên cung cấp độc lập: quản lý hồ sơ, portfolio, dịch vụ, booking, lịch/tài nguyên, đội ngũ và báo cáo kinh doanh; có thể mời photographer đã có tài khoản tham gia studio. Không bắt buộc phải có hồ sơ photographer |
| `system_admin` | Xử lý báo cáo nội dung, kiểm tra dữ liệu tín nhiệm |

> Một tài khoản có thể đồng thời là `photographer` và `studio_manager`. Studio có thể sở hữu portfolio, cung cấp dịch vụ và nhận booking dưới danh nghĩa studio. Quyền quản lý từng studio xác định qua bảng `studio_members`. Role "ekip" đã bỏ khỏi MVP.

### Vai trò chuyên môn trên hồ sơ

Các giá trị như `retoucher` và `art_director` là **vai trò chuyên môn dùng để hiển thị trên hồ sơ photographer**, không phải role hệ thống. Chúng không cấp quyền truy cập và không tham gia quy trình phân công công việc hoặc booking. Một photographer có thể khai báo nhiều vai trò chuyên môn qua trường `professionalRoles`.

### Phạm vi MVP

**Must:** Auth + phân quyền · Portfolio · **AI Search (NLP + CV)** · Dịch vụ & Booking (Shoot Brief) · Studio (hồ sơ, dịch vụ, đội ngũ, booking) · Shoot Room cơ bản · Chọn ảnh & bàn giao · Review

**Should:** Lịch và tài nguyên studio · Dashboard kinh doanh studio · Timeline/deadline · Admin moderation

**Could:** AI Concept Studio · Community Rooms

**Won't (giai đoạn này):** Thanh toán tích hợp · Lưu trữ RAW · Bản desktop Tauri (hướng mở rộng)

---

## 2. Tech stack

Theo đề xuất dự án PA00, bổ sung phần AI Search.

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19 + TypeScript (Vite, SPA), **Astryx** (design system của Meta), React Router, TanStack Query |
| Backend | Node.js + TypeScript (Fastify + Zod), xác thực JWT của Supabase |
| Dữ liệu | **Supabase**: PostgreSQL (+ `pgvector`), Auth, Storage, Realtime; bảo vệ dữ liệu riêng bằng **RLS** |
| AI service *(bổ sung)* | Python + FastAPI, CLIP đa ngôn ngữ (sentence-transformers); LLM API để phân tích truy vấn |
| Quản lý gói | **pnpm workspace** (FE/BE dùng chung) |
| Làm việc nhóm | Git/GitHub (PR review), Jira, Discord |
| CI/CD *(bổ sung)* | GitHub Actions, Supabase CLI (migration), Docker cho AI service |

> Chọn Vite SPA thay vì Next.js để dễ đóng gói sang **Tauri** sau này (Tauri nạp bản build tĩnh của FE).

---

## 3. Cấu trúc repo

```
frameroom/
├─ apps/
│  ├─ web/            # React + Vite + Astryx
│  ├─ api/            # Node.js + Fastify
│  └─ ai-service/     # FastAPI (embedding, parse truy vấn) - Python, ngoài pnpm
├─ packages/
│  └─ shared/         # Zod schema, types, hằng số dùng chung FE/BE
├─ supabase/
│  ├─ migrations/     # SQL migration (nguồn sự thật của schema, gồm RLS)
│  ├─ functions/      # SQL function (RPC) cho tìm kiếm lai
│  └─ seed.sql
├─ scripts/           # pipeline thu thập/tag/embedding dữ liệu demo
├─ docs/              # SRS, ERD, ADR, API, test, taxonomy
└─ .github/           # workflows, PR/issue templates
```

---

## 4. Bắt đầu nhanh (local)

**Yêu cầu:** Node.js 20+, pnpm 9+, Docker, Supabase CLI, Python 3.11+

```bash
git clone <repo-url> && cd frameroom
pnpm install
cp .env.example .env

supabase start                  # chạy Postgres/Auth/Storage/Realtime local bằng Docker
supabase db reset               # áp dụng migration + seed

pnpm --filter api dev           # API
pnpm --filter web dev           # Web
```

AI service:

```bash
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Biến môi trường (`.env.example`)

```
# web
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:4000

# api
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # CHỈ dùng server-side, tuyệt đối không đưa vào web
AI_SERVICE_URL=http://localhost:8001
LLM_API_KEY=
```

> Không commit `.env`. Secret dùng GitHub Secrets. `service_role` bỏ qua RLS nên backend phải tự kiểm tra quyền.

### Thay đổi database

1. `supabase migration new <ten_thay_doi>` rồi viết SQL (bảng, RLS, function).
2. `supabase db reset` để thử local.
3. Mở PR; CI chạy migration; sau khi merge mới áp dụng lên staging.
4. `supabase gen types typescript --local > packages/shared/src/db.types.ts` để cập nhật type.

Không sửa schema trực tiếp trên dashboard Supabase.

---

## 5. Quy ước làm việc

### Git

- Nhánh: `main` (ổn định) ← `dev` (staging) ← `feature/FR-123-short-desc`, `fix/FR-123-...`, `chore/FR-123-...`; `hotfix/FR-123-...` tạo từ `main` và merge vào cả `main` lẫn `dev`. Chi tiết trong `contributing.md`.
- Commit theo Conventional Commits kèm Jira key: `feat(ai): add hybrid ranking [FR-123]`
- Mỗi PR cần ít nhất 1 reviewer, CI xanh, liên kết issue Jira. Squash merge vào `dev`.

### Jira

- Project key `FR`. Workflow: `To Do → In Progress → In Review → Testing → Done`.
- Labels: `FE`, `BE`, `DB`, `AI`, `DevOps`, `Docs`.
- Story: *Là [role], tôi muốn [việc] để [lợi ích]* + Acceptance Criteria (Given/When/Then).
- Cột `Testing`: người hỗ trợ của vai trò đó (hoặc thành viên khác module) kiểm tra trên staging.

### Discord

- Kênh gợi ý: `#general`, `#dev`, `#ai-search`, `#github` (thông báo PR/CI qua webhook), `#jira` (thông báo qua Jira Automation), `#standup`, `#voice-standup`.

### Definition of Done

- [ ] Code qua review, CI xanh (lint, typecheck, test, build)
- [ ] Có test phù hợp; luồng chính có kiểm thử thủ công hoặc E2E
- [ ] Migration chạy lại được; RLS/phân quyền đã kiểm tra với từng role
- [ ] Đã deploy staging, người kiểm tra xác nhận theo Acceptance Criteria
- [ ] Cập nhật tài liệu liên quan trong `docs/`

---

## 6. Nhóm thực hiện

| Thành viên | Chính | Hỗ trợ |
|---|---|---|
| Phan Lê Đăng Khoa | Frontend | DevOps |
| Nguyễn Đặng Khôi Nguyên | DevOps/CI-CD, Docs | Frontend, AI |
| Hà Thảo Ly | Database | Backend |
| Lê Quốc Khải | Backend | Database |
| Đào Thị Quỳnh Anh | AI Search/CV | Docs |

---

## 7. Dữ liệu demo và lưu ý pháp lý

- Dữ liệu ảnh/metadata chỉ phục vụ đồ án môn học, lưu nội bộ, không phân phối lại, không public sản phẩm.
- **Rủi ro đã chấp nhận:** ảnh demo được seed vào bucket công khai `portfolio-images`, nên ai có URL trực tiếp đều xem được. Chấp nhận cho MVP vì dự án không public rộng rãi; không dùng ảnh có giấy phép hạn chế vượt phạm vi này.
- Chỉ lưu trường cần thiết; không lưu thông tin liên hệ cá nhân của người trong ảnh. Ưu tiên nguồn có giấy phép (Unsplash, Pexels, Flickr CC) và ảnh do photographer đồng ý cung cấp.
- Mỗi ảnh lưu `source`, `collected_at`, `license_note` để truy vết và xoá được.
- Ảnh chính dùng WebP, cạnh dài tối đa 1280 px; với ảnh portfolio và preview, dung lượng ảnh chính tối đa 2 MB. FE tạo và upload thêm thumbnail WebP có cạnh dài khoảng 320 px, theo quy ước tên `{uuid}_thumb.webp`.
- Với ảnh portfolio, ảnh preview và ảnh đính kèm là ảnh trong Shoot Room, FE upload cả ảnh chính và thumbnail. BE suy ra đường dẫn thumbnail từ `storagePath` ảnh chính và kiểm tra cả hai file tồn tại trước khi ghi nhận. File bàn giao không cần thumbnail trong MVP.

---

## 8. Tài liệu

| Tài liệu | Vị trí |
|---|---|
| SRS / Use cases / Ma trận phân quyền | `docs/srs/` |
| API contract | `docs/api/` |
| ERD và chính sách RLS | `docs/db/` |
| Quy tắc kỹ thuật và quy ước làm việc | `contributing.md` |
| Quyết định kiến trúc (ADR) | `docs/adr/` |
| Taxonomy tag và thuật ngữ ngành ảnh | `docs/ai/taxonomy.md` |
| Đánh giá AI Search | `docs/ai/evaluation.md` |
| Test plan | `docs/test/` |
| Jira / Figma | `<link>` |

---

## 9. Chạy môi trường local trên Windows

Sau khi cài Node.js, pnpm, Python, Docker Desktop và Supabase CLI, khởi động toàn bộ môi trường bằng:

```bat
scripts\start-dev.bat
```

Launcher sẽ tạo `.env` nếu cần, cài dependency Node/AI ở lần chạy đầu tiên, chạy Supabase nếu Docker và Supabase CLI sẵn sàng, rồi mở riêng API, Web và AI service.

Các địa chỉ local:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- AI service health: `http://localhost:8001/health`

Để dừng ứng dụng, đóng ba cửa sổ console được launcher mở. Supabase chạy trong Docker nên dừng riêng bằng:

```bash
supabase stop
```

Nếu thiếu Docker hoặc Supabase CLI, launcher vẫn khởi động API, Web và AI service; các chức năng cần database local sẽ chưa hoạt động.

## 10. Roadmap

| Sprint | Tuần | Mục tiêu |
|---|---|---|
| 0 | 1–2 | Nền tảng: repo, CI, Supabase, schema v1, wireframe, nghiên cứu taxonomy |
| 1 | 3–4 | Auth/RBAC, portfolio, pipeline dữ liệu |
| 2 | 5–6 | AI Search v1, studio core |
| 3 | 7–8 | Booking + Shoot Brief, vận hành studio |
| 4 | 9–10 | Shoot Room, proofing, review, dashboard |
| 5 | 11–12 | Hardening, demo, báo cáo |

---

Dùng cho mục đích học tập nội bộ. Không cấp phép phân phối lại.
