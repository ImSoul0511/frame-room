# FrameRoom: Báo cáo chia việc và checklist tuần 1

**Giai đoạn:** Sprint 0  

---

## 1. Mục tiêu

1. **Thiết lập repo và công cụ:** repo, CI, Supabase local và staging chạy ổn; cả nhóm clone về chạy được.
2. **Review và thống nhất API Contract MVP v1:** sử dụng `contract_v0.md` hiện có làm đầu vào; Khải, Khoa và Ly đọc, feedback và thống nhất nội dung v1 để FE/BE có cơ sở triển khai. Contract phải bao phủ **toàn bộ phạm trù trong MVP**.
3. **Hoàn thiện ERD v1 (schema freeze):** Ly chủ trì, Khải hỗ trợ rà nghiệp vụ/backend và Quỳnh Anh (QA) rà độ bao phủ use case. Ly căn cứ trên contract đã thống nhất để hoàn thiện ERD và migration trên Supabase.
4. Dựng khung `apps/web` và `apps/api`, kiểm tra thử Astryx.
5. AI Search/CV **chưa triển khai logic**. Chỉ chốt hình dạng contract của `/search`, ghi nhận thuật ngữ nhẹ và chừa khả năng mở rộng trong schema.

**Nguyên tắc thứ tự:** nhóm có thể thống nhất nội dung dự thảo Contract v1 trước để làm cơ sở cho FE/BE; nhưng **chỉ freeze chính thức sau khi Ly đối chiếu contract với ERD** và các bên review xác nhận không còn sai lệch quan trọng.

---

## 2. Phân công vai trò

| Thành viên | Vai trò chính | Hỗ trợ |
|---|---|---|
| Nguyễn Đặng Khôi Nguyên | DevOps/CI-CD, Docs | Frontend, AI/QA docs |
| Phan Lê Đăng Khoa | Frontend | DevOps, review contract phía FE |
| Hà Thảo Ly | Database, chủ trì ERD và migration | Review API Contract |
| Lê Quốc Khải | Backend | Review API Contract, hỗ trợ ERD |
| Đào Thị Quỳnh Anh | QA, SRS/use case, AI Search/CV | Docs, review độ bao phủ ERD/contract |

**Trọng tâm:**
- **Nguyên:** repo, CI, Supabase và môi trường phát triển.
- **Khải + Khoa + Ly:** đọc `contract_v0.md`, feedback và thống nhất nội dung Contract v1 để FE/BE sử dụng.
- **Ly + Khải + Quỳnh Anh (QA):** hoàn thiện và review ERD v1; Ly chủ trì cập nhật ERD và làm migration trên Supabase dựa trên contract đã thống nhất.

---

## 3. Thứ tự phụ thuộc

```text
Giai đoạn 1: Nền tảng (chạy song song với review tài liệu)
  Nguyên: repo + workspace
        │
        ├──> Khoa: khởi tạo web ──┐
        └──> Khải: khởi tạo api ──┴──> Nguyên: CI cho web + api

Giai đoạn 2: Review contract_v0.md và làm rõ nghiệp vụ
  Khải + Khoa + Ly: đọc contract_v0.md, feedback từ góc nhìn BE/FE/DB
  Quỳnh Anh: SRS, use case và checklist QA cho các luồng chính
        │
        └──> Thống nhất nội dung dự thảo Contract v1 làm cơ sở cho FE/BE

Giai đoạn 3: Hoàn thiện ERD
  Ly: chủ trì hoàn thiện ERD dựa trên contract đã thống nhất
        │
        ├──> Khải: rà nghiệp vụ, booking, studio/photographer, trạng thái
        └──> Quỳnh Anh: rà độ bao phủ use case và các trường hợp thiếu

Giai đoạn 4: Đối chiếu, hoàn thiện và freeze
  Ly: đối chiếu contract ↔ ERD, cập nhật schema và hoàn thiện migration
        │
        ├──> Cả nhóm review ERD và Contract
        ├──> Ly: ma trận RLS, migration trên Supabase local
        ├──> Nguyên: Supabase staging, job migration trong CI
        └──> Khải: Zod schema đầu tiên trong packages/shared từ contract

  Freeze ERD v1 + Contract MVP v1 sau khi review và đối chiếu xong
```

**Quy tắc:**
- `contract_v0.md` là đầu vào có sẵn; nhóm review, chỉnh sửa và bổ sung để tạo Contract v1, không viết lại từ đầu nếu nội dung hiện tại vẫn phù hợp.
- Contract có thể được thống nhất ở mức dự thảo trước để FE/BE bắt đầu chuẩn bị, nhưng **không freeze chính thức trước khi đối chiếu với ERD**.
- Mỗi lần ERD đổi bảng/cột/quan hệ, người phụ trách contract rà lại các endpoint liên quan. Nếu thay đổi contract ảnh hưởng schema, Ly phải rà lại ERD/migration tương ứng.

---

## 4. Việc của từng người

Số trong ngoặc là story points ước lượng (thang 1, 2, 3, 5, 8). Việc liệt kê theo thứ tự nên làm; một số việc có thể triển khai song song.

### Nguyên (DevOps, Docs)

| Việc | SP |
|---|---:|
| Tạo GitHub repo; bảo vệ `main`/`dev`; mẫu PR và issue (mẫu PR có ô "Có ảnh hưởng API contract không?"); mời thành viên | 2 |
| Dựng Discord: kênh, webhook GitHub | 1 |
| pnpm workspace; `tsconfig`, ESLint, Prettier dùng chung; Husky + Commitlint; `.env.example`; đưa README và file quy tắc vào repo | 3 |
| Dựng khung `docs/api/` (mẫu mô tả endpoint, mục lục theo nhóm), thêm nhãn `API` cho PR/issue | 2 |
| GitHub Actions: install, lint, typecheck, build trên PR | 3 |
| Tạo project Supabase staging; `supabase init`; hướng dẫn chạy local; job chạy migration trong CI | 3 |
| Hosting preview cho `web` cùng Khoa | 2 |
| Rà soát để cả nhóm clone và chạy được | 1 |
| Docs: khung SRS, ma trận role v0 cùng Quỳnh Anh | 2 |

### Khoa (Frontend, hỗ trợ DevOps)

| Việc | SP |
|---|---:|
| Khởi tạo `apps/web` (React 19, Vite, TypeScript, Astryx), có một trang chạy được | 2 |
| Thêm job build `web` vào CI cùng Nguyên | 2 |
| Đọc `contract_v0.md` cùng Khải và Ly; feedback từ góc nhìn FE và thống nhất nội dung Contract v1 | 3 |
| Tham gia review ERD, kiểm tra schema đủ cho các màn hình | 1 |
| Review contract phía FE: đủ dữ liệu, phân trang, trạng thái loading/lỗi, luồng upload; rà phần Shoot Room, chọn ảnh và bàn giao cùng Khải | 3 |
| Liệt kê màn hình và dữ liệu cần để đối chiếu với contract | 1 |
| Layout chung, routing; nối hosting preview cùng Nguyên | 3 |
| Dựng dữ liệu giả (mock) từ ví dụ JSON trong contract cho nhóm endpoint Sprint 1 | 2 |

### Khải (Backend, hỗ trợ Database)

| Việc | SP |
|---|---:|
| Đọc `contract_v0.md` cùng Khoa và Ly; feedback từ góc nhìn BE, đề xuất chỉnh sửa và thống nhất nội dung Contract v1 | 3 |
| Phối hợp với Ly hoàn thiện ERD; rà kỹ trạng thái booking, quan hệ studio/photographer, phân công photographer và quyền truy cập | 3 |
| Khởi tạo `apps/api` (Fastify, TypeScript, Zod): kiểm tra biến môi trường, logger, định dạng lỗi chung, `/health` | 3 |
| Review tính khả thi BE của toàn bộ contract; rà phần Studio, dịch vụ/gói, lịch/tài nguyên, Booking và Shoot Brief (gồm bảng chuyển trạng thái booking) | 5 |
| Job build/test `api` trong CI; middleware xác thực JWT Supabase; `/me` | 3 |
| `packages/shared` với Zod schema đầu tiên (lấy từ Contract v1); khung Swagger | 2 |

### Ly (Database, chủ trì ERD và migration)

| Việc | SP |
|---|---:|
| Đọc `contract_v0.md` cùng Khải và Khoa; feedback từ góc nhìn DB, góp ý tính đầy đủ và thống nhất nội dung Contract v1 làm cơ sở thiết kế schema | 3 |
| Hoàn thiện ERD v1 cho toàn bộ MVP dựa trên contract đã thống nhất; phối hợp Khải và Quỳnh Anh (QA) rà nghiệp vụ/use case | 8 |
| Chốt quy ước đặt tên, kiểu khóa, timestamp, soft delete, enum/bảng tra (enum dùng chung với contract) | 1 |
| Đối chiếu contract với ERD: mỗi trường có cột tương ứng, phát hiện trường thiếu cột, cột không có nhu cầu sử dụng và quan hệ còn thiếu | 3 |
| Sửa ERD theo review và **freeze v1** sau khi contract đã được đối chiếu | 2 |
| Ma trận RLS (bảng × role × hành động) cho phần lõi, đối chiếu với cột "Quyền" của contract | 3 |
| Hoàn thiện migration đầu trên Supabase local theo phạm vi Sprint 0: extension, bảng profile, `user_roles`, `has_role()`, nhóm bảng portfolio; bảo đảm reset chạy được | 3 |

### Quỳnh Anh (QA, AI Search/CV, hỗ trợ Docs)

| Việc | SP |
|---|---:|
| SRS và use case cho các luồng chính; ma trận role v0 cùng Nguyên | 5 |
| Phối hợp Ly và Khải review/hoàn thiện ERD, kiểm tra schema có bao phủ use case và các trường hợp nghiệp vụ quan trọng | 3 |
| Review contract cho `/search` (hình dạng request/response, chưa cần logic), tag, review, report nội dung và admin; nêu các yêu cầu còn thiếu | 3 |
| Ghi chú nhẹ thuật ngữ ngành khi gặp (chưa cần đầy đủ) | 1 |
| Tham gia review ERD, ghi nhận phần cần chừa khả năng mở rộng cho AI (tag, bảng embedding) | 1 |

**Chưa làm trong tuần này:** benchmark model, thu thập ảnh và triển khai logic AI Search/CV.

---

## 5. API Contract MVP

### 5.1 Phạm vi

Dùng `contract_v0.md` hiện có làm nền tảng: giữ các nội dung còn đúng, feedback các điểm chưa rõ, sau đó bổ sung/phát triển thành Contract MVP v1 bao phủ toàn bộ phạm vi MVP.

| Nhóm | Nội dung | Trạng thái |
|---|---|---|
| Quy ước chung | Base URL, định dạng, phân trang, lỗi, enum chung, quy tắc cập nhật | Có trong v0, review và thống nhất lại |
| Tài khoản | `/me`, role. Đăng ký/đăng nhập do FE gọi thẳng Supabase Auth | Có trong v0, review lại |
| Photographer, portfolio, ảnh, explore | Như v0 | Có trong v0, review lại |
| Studio | Hồ sơ, đội ngũ (`studio_members`), lời mời tham gia, phân công photographer | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Dịch vụ | Services/packages, add-ons (của photographer và studio) | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Booking | Tạo booking, Shoot Brief và các phiên bản, **bảng chuyển trạng thái** (ai được chuyển gì) | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Lịch và tài nguyên | Resources (phòng, thiết bị), slot, chống trùng lịch | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Shoot Room | Phòng, tin nhắn, decision log, milestones; ghi rõ phần nào qua API, phần nào qua Supabase Realtime | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Chọn ảnh và bàn giao | Gallery, ảnh preview, selection, ghi chú trên ảnh, delivery; luồng upload/tải xuống (Storage công khai hay signed URL) | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| Review và quản trị | Review, report nội dung, xử lý của admin | Cần kiểm tra và bổ sung nếu v0 chưa đủ |
| AI Search | `/search` (hình dạng request/response, tham số lọc kết hợp, kết quả kèm lý do khớp); logic làm sau | Chỉ thống nhất hình dạng contract |
| Dashboard studio, timeline/deadline | Chỉ cần liệt kê endpoint và số liệu cần; chi tiết bổ sung sau theo cách thêm vào | Mức khung |

Không đưa vào contract: Thanh toán tích hợp, lưu trữ RAW, Tauri, AI Concept Studio, Community Rooms (thuộc Could/Won't).

### 5.2 Mỗi endpoint phải có

- Mục đích và màn hình dùng.
- **Quyền** (role nào, điều kiện sở hữu, quyền trong studio qua `studio_members`).
- Request (bảng trường, ràng buộc, ví dụ JSON), response, danh sách lỗi.
- Với đối tượng có vòng đời (booking, brief, selection, delivery): bảng trạng thái và ai được chuyển.
- Ghi rõ phần nào do API xử lý, phần nào dùng Supabase trực tiếp/Realtime/Storage nếu có.

Nguồn sự thật cuối cùng vẫn là Zod schema trong `packages/shared`. Khi code lệch tài liệu, sửa một trong hai ngay trong PR đó.

### 5.3 Phân việc review và hoàn thiện

| Nhóm việc | Phụ trách chính | Phối hợp/review |
|---|---|---|
| Review toàn bộ `contract_v0.md`, feedback và thống nhất nội dung Contract v1 | Khải, Khoa, Ly | Khải rà BE; Khoa rà FE; Ly rà dữ liệu/quyền và khả năng ánh xạ sang schema |
| Studio, dịch vụ, lịch/tài nguyên, booking | Khải rà tính khả thi và luồng backend | Khoa rà dữ liệu FE cần; Ly đối chiếu ERD và quyền |
| Shoot Room, chọn ảnh, bàn giao | Khoa cùng Khải rà luồng FE/BE | Ly rà schema/quyền; Quỳnh Anh rà use case và trường hợp thiếu |
| `/search`, tag, review, report, admin | Quỳnh Anh rà contract và yêu cầu nghiệp vụ/QA | Khải rà khả thi BE; Khoa rà dữ liệu FE; Ly rà khả năng lưu trữ |
| Đối chiếu Contract v1 với ERD | Ly chủ trì | Khải, Khoa và Quỳnh Anh review theo chuyên môn |
| Mục bỏ ngỏ (cuối file) | Người phụ trách contract tổng hợp | Cả nhóm chốt ở buổi review |

**Lưu ý:** Contract v1 được thống nhất để làm cơ sở FE/BE trước; Ly dựa trên đó hoàn thiện ERD. Việc **freeze chính thức** chỉ diễn ra sau khi đã đối chiếu contract với ERD và xử lý các sai lệch quan trọng.

### 5.4 Thế nào là "freeze" contract

Giống ERD: freeze là chốt **danh sách endpoint, kiểu dữ liệu, quy ước, mã lỗi, quyền và bảng trạng thái**, không phải cấm thay đổi.

- Thay đổi **thêm** (trường tuỳ chọn, endpoint mới): qua PR gắn nhãn `API`, thông báo `#dev`, cần một người rà.
- Thay đổi **phá vỡ** (đổi tên/kiểu trường, bỏ endpoint, đổi quyền hoặc trạng thái): cần Khải và Khoa cùng đồng ý, và Ly nếu chạm schema.
- Nhóm Sprint sau (Shoot Room, delivery...) được phép chi tiết hoá thêm trường khi bắt đầu sprint của nhóm đó, theo quy tắc "thêm" ở trên.
- Nếu contract thay đổi làm ảnh hưởng bảng/cột/quan hệ, Ly cập nhật ERD và migration trong cùng chuỗi thay đổi; các endpoint liên quan phải được rà lại.

---

## 6. Danh sách thực thể ERD v1 (Ly chủ trì, Khải và Quỳnh Anh hỗ trợ review)

- **Tài khoản:** profile, `user_roles`.
- **Photographer và studio:** photographer, studio, `studio_members`, lời mời tham gia studio.
- **Dịch vụ và portfolio:** services/packages, add-ons, portfolio project, ảnh, tag, `image_tags`.
- **Booking:** booking, shoot brief, brief versions, trạng thái booking.
- **Lịch và tài nguyên:** resources (phòng chụp, thiết bị), lịch/slot (cần ràng buộc chống trùng).
- **Cộng tác:** shoot room, tin nhắn, decision log, milestones.
- **Chọn ảnh và bàn giao:** gallery, ảnh preview, selection, ghi chú trên ảnh, delivery.
- **Review và quản trị:** review, report nội dung.

**Ghi chú khi chốt:**

- `image_embeddings` là **bảng riêng**, tách khỏi bảng ảnh, vì chiều vector phụ thuộc model chưa chọn. Có thể thêm sau bằng migration, không cần triển khai embedding trong Sprint 0.
- Freeze nghĩa là chốt cấu trúc v1, không cấm thay đổi. Sau freeze vẫn thêm cột/bảng được, nhưng phải qua migration và PR có người rà.
- Điểm dễ sai cần đưa vào buổi review:
  - Một photographer thuộc nhiều studio.
  - Booking có provider là photographer hoặc studio.
  - Ai là người phân công photographer trong studio.
  - Cách lưu trạng thái booking.
  - Quyền xem Shoot Room.
  - Quan hệ giữa booking, brief và các phiên bản brief.
  - Quan hệ giữa gallery, selection, preview và delivery.
  - Quy tắc chống trùng lịch của slot/resource.
- Đồng bộ với contract: danh sách enum, tên trạng thái booking và các giới hạn độ dài phải giống nhau ở hai nơi.

---

## 7. Checklist tuần 1

### Cả nhóm

- [ ] Họp kickoff: chốt Definition of Done, quy ước nhánh/commit, giờ standup, Scrum Master luân phiên Sprint 0.
- [ ] Đọc `CONTRIBUTING.md` (quy tắc kỹ thuật).
- [ ] Mỗi người tạo tài khoản Jira, GitHub, Supabase và có quyền truy cập repo.
- [ ] Xác nhận `contract_v0.md` là tài liệu đầu vào để review, feedback và phát triển thành Contract v1.

### Jira

- [ ] Tạo site và project `FR` (Scrum, team-managed).
- [ ] Mời 5 thành viên.
- [ ] Cấu hình cột: To Do → In Progress → In Review → Testing → Done.
- [ ] Bật story points; tạo labels FE/BE/DB/AI/DevOps/Docs (thêm `API` cho thay đổi contract).
- [ ] Tạo epic (E0–E11) và Sprint 0 (12/10–25/10), Sprint 1.
- [ ] Nhập các việc tuần 1, gán người, label, story points.
- [ ] Tạo issue "Review và freeze ERD v1" và "Review và freeze API Contract MVP v1".
- [ ] Cài GitHub for Jira; kiểm tra nhánh/commit có `FR-xx` tự liên kết.
- [ ] Rule automation gửi tin về Discord `#jira`.

### Repo và CI (Nguyên)

- [ ] Repo GitHub, bảo vệ `main` và `dev`.
- [ ] Mẫu PR (có ô ảnh hưởng API contract) và mẫu issue.
- [ ] pnpm workspace, `tsconfig`/ESLint/Prettier chung.
- [ ] Husky + Commitlint hoạt động.
- [ ] `.env.example` đủ biến.
- [ ] README và `CONTRIBUTING.md` nằm trong repo.
- [ ] Khung `docs/api/` và nhãn `API`.
- [ ] GitHub Actions xanh (install, lint, typecheck, build).
- [ ] Discord có kênh và webhook GitHub.

### Supabase và Database

- [ ] Project Supabase staging, cả nhóm có quyền truy cập.
- [ ] `supabase init`, `supabase start` chạy local.
- [ ] Quy ước đặt tên và kiểu dữ liệu đã chốt.
- [ ] Khải, Khoa và Ly đã review `contract_v0.md`, ghi nhận feedback và thống nhất nội dung dự thảo Contract v1.
- [ ] Ly đã hoàn thiện ERD v1 dựa trên Contract v1; Khải review nghiệp vụ/backend, Quỳnh Anh (QA) review độ bao phủ use case.
- [ ] ERD v1 đã review và **freeze** sau khi đối chiếu với contract.
- [ ] Contract đã đối chiếu với ERD, không còn trường thiếu cột hoặc sai lệch quan trọng.
- [ ] Ma trận RLS lõi xong, đối chiếu với role/quyền trong contract.
- [ ] Migration đầu merge vào `dev`; `supabase db reset` chạy được.

### API Contract MVP

- [ ] Đã đọc và rà lại quy ước chung trong `contract_v0.md`, áp dụng cho mọi nhóm endpoint.
- [ ] Khải, Khoa và Ly đã feedback và thống nhất nội dung Contract v1 làm cơ sở triển khai FE/BE.
- [ ] Đủ các nhóm ở mục 5.1; mỗi endpoint có mục đích, quyền, request/response và lỗi.
- [ ] Bảng trạng thái cho booking, brief, selection, delivery đã được xác định, gồm quyền chuyển trạng thái.
- [ ] Hình dạng `/search` đã chốt (chưa cần logic).
- [ ] Mục bỏ ngỏ đã được chốt hoặc ghi rõ người phụ trách và thời điểm xử lý.
- [ ] Review đủ BE (Khải), FE (Khoa), DB (Ly), QA/AI/Docs (Quỳnh Anh).
- [ ] **Contract MVP v1 freeze** sau khi đối chiếu với ERD; quy tắc thay đổi sau freeze đã thông báo `#dev`.

### Frontend

- [ ] `apps/web` khởi tạo, chạy local.
- [ ] Astryx hoạt động; ADR ghi quyết định.
- [ ] Danh sách màn hình và dữ liệu cần đã đưa vào contract.
- [ ] Layout chung và routing.
- [ ] Hosting preview cho `web`.
- [ ] Mock từ ví dụ contract cho nhóm endpoint Sprint 1.

### Backend

- [ ] `apps/api` khởi tạo, `/health` chạy.
- [ ] Middleware JWT Supabase, `/me` trả đúng.
- [ ] `packages/shared` có Zod schema đầu tiên.
- [ ] Khung Swagger.

### Docs và QA

- [ ] Khung SRS và use case luồng chính.
- [ ] Ma trận role v0, khớp với cột "Quyền" của contract.
- [ ] Checklist use case được dùng để review độ bao phủ ERD và contract.
- [ ] Các thuật ngữ/nghiệp vụ cần làm rõ đã được ghi nhận; chưa benchmark model hoặc thu thập ảnh AI trong tuần này.

### Tiêu chí hoàn thành

- [ ] Cả nhóm clone repo và chạy được `web` + `api`.
- [ ] CI xanh trên PR.
- [ ] Supabase staging có; `supabase db reset` chạy local.
- [ ] **ERD v1 đã freeze**, được Ly chủ trì hoàn thiện với Khải và Quỳnh Anh (QA) review; ma trận RLS lõi xong.
- [ ] **API Contract MVP v1 đã freeze**, dựa trên `contract_v0.md` và đã được đối chiếu với ERD v1.
- [ ] Migration đầu merge vào `dev` và chạy thành công trên Supabase local.
