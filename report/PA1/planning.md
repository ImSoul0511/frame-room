# FrameRoom - Kế hoạch Sprint 2 trước hạn PA2

**Thời gian:** Sprint 2 bắt đầu 17/10/2026 theo PA1; **mốc nộp PA2 là 24/10/2026** theo cập nhật của nhóm. Mọi hạn trong file này đều không muộn hơn mốc nộp.  
**Mục tiêu trước PA2:** có bản ERD và API Contract đã rà các điểm chính, công cụ thu thập ảnh chạy thử được, CI cơ bản hoạt động và phương án CD staging rõ ràng. Các phần chưa hoàn thiện được ghi thành Jira follow-up.  
**Cách dùng:** tạo một Jira issue cho mỗi mã `FR-...` bên dưới, điền key sau khi Jira cấp. Story point được cả nhóm ước lượng trong planning; tài liệu không tự gán điểm.

Khôi Nguyên tham gia cộng tác trong **cả năm issue** để điều phối và kết nối kết quả; ở issue CI/CD, Nguyên đồng thời là assignee. Đây là mốc bàn giao PA2, chưa phải thời điểm freeze toàn bộ thiết kế hoặc triển khai đầy đủ.

## Kết quả cần đạt

- Ly cập nhật phần ERD ưu tiên và sơ đồ Mermaid; các điểm chưa chốt được liệt kê với người xử lý.
- Khải cập nhật API Contract ở các luồng ưu tiên; Khoa rà yêu cầu dữ liệu phía frontend; các khác biệt với ERD được ghi rõ.
- Quỳnh Anh cài công cụ và chạy thử một lô ảnh rất nhỏ từ nguồn được phép, kèm metadata nguồn/giấy phép.
- Khôi Nguyên bổ sung các kiểm tra CI khả thi lên workflow hiện tại và mô tả cách triển khai staging cùng các điều kiện còn thiếu.
- Trước 24/10, mỗi issue có sản phẩm xem được và danh sách việc tiếp nối để cập nhật Jira.

## Phân công nhanh

| Thành viên | Issue chính | Kết quả chịu trách nhiệm |
|---|---|---|
| Hà Thảo Ly | `FR-<tạo mới>` - Rà ERD ưu tiên | Bản ERD và Mermaid cập nhật các quan hệ chính; danh sách điểm mở. |
| Lê Quốc Khải | `FR-<tạo mới>` - Rà API Contract ưu tiên | Contract cho các luồng chính và danh sách khác biệt với ERD. |
| Phan Lê Đăng Khoa | `FR-<tạo mới>` - Rà Contract từ góc nhìn frontend | Danh sách field/endpoint cần cho UI và các gap ưu tiên. |
| Đào Thị Quỳnh Anh | `FR-<tạo mới>` - Cài công cụ thu thập ảnh demo | Hướng dẫn cài/chạy và lô ảnh thử có metadata nguồn/giấy phép. |
| Nguyễn Đặng Khôi Nguyên | `FR-<tạo mới>` - CI/CD cơ bản cho PA2 | CI trên PR và phương án CD staging hoặc blocker có owner. |

## Jira issues đề xuất

### 1. Rà ERD ưu tiên và đồng bộ sơ đồ

- **Loại:** Task; **Assignee:** Hà Thảo Ly; **Cộng tác:** Nguyễn Đặng Khôi Nguyên, Lê Quốc Khải, Đào Thị Quỳnh Anh; **Review:** Lê Quốc Khải
- **Labels:** `DB`, `Docs`; **Ưu tiên:** Highest
- **Hạn đề xuất:** 23/10/2026
- **Phụ thuộc:** review song song với Contract draft; các điểm chưa chốt chuyển sang issue sau PA2.

**Mô tả Jira:** Là nhóm phát triển, chúng ta cần bản ERD đã rà các quan hệ và ràng buộc quan trọng để đối chiếu với API Contract trước khi nộp PA2.

**Acceptance Criteria:**

- [ ] `docs/db/erd_v0.md` và `docs/db/erd_v0.mmd` đồng bộ ở các phần được chỉnh trong PA2; phần chưa rà được đánh dấu rõ.
- [ ] Làm rõ quan hệ photographer–studio, gồm việc một photographer có thể lập nhiều studio hoặc là thành viên của nhiều studio; quyền quản lý thể hiện qua membership.
- [ ] Làm rõ role được tự tạo, studio được tạo như thế nào, và cách lưu `user_name` duy nhất cùng UUIDv7 theo quyết định thiết kế hiện hành.
- [ ] Các trường trạng thái/kiểm tra AI dùng tập giá trị có kiểm soát (ENUM hoặc kiểu tương ứng đã thống nhất), không để thành chuỗi tự do.
- [ ] Booking và các bảng liên quan được rà ở mức quan hệ/trạng thái chính; ràng buộc chi tiết chưa kịp chốt có Jira follow-up.
- [ ] Khải rà nghiệp vụ/backend; Quỳnh Anh rà các luồng use case; Nguyên tổng hợp điểm còn mở và link issue theo dõi.
- [ ] Có bản ERD để review trước PA2; chưa yêu cầu schema freeze hoặc migration hoàn chỉnh ở mốc này.

### 2. Rà API Contract cho các luồng ưu tiên

- **Loại:** Task; **Assignee:** Lê Quốc Khải; **Cộng tác:** Nguyễn Đặng Khôi Nguyên, Phan Lê Đăng Khoa, Đào Thị Quỳnh Anh
- **Labels:** `BE`, `Docs`; **Ưu tiên:** Highest
- **Hạn đề xuất:** 24/10/2026
- **Phụ thuộc:** dùng bản ERD cập nhật đến 23/10 để đối chiếu; các gap còn lại tạo follow-up.

**Mô tả Jira:** Là nhóm FE/BE, chúng ta cần bản API Contract đủ rõ cho các luồng ưu tiên của PA2 và có danh sách khác biệt với ERD để xử lý tiếp.

**Acceptance Criteria:**

- [ ] `docs/api/contract_v0.md` được rà và cập nhật cho các luồng ưu tiên: tài khoản/role, studio, booking và các endpoint FE cần sớm; mỗi endpoint được chỉnh có quyền, request/response và lỗi chính.
- [ ] Khải đối chiếu role, trạng thái, enum, ID và quan hệ với ERD hiện có; ghi rõ từng khác biệt chưa xử lý vào Jira thay vì coi là đã thống nhất.
- [ ] Phần booking nêu các bước đổi trạng thái và quyền thực hiện ở mức cần cho thiết kế; trường hợp biên chưa kịp phân tích được đưa vào follow-up.
- [ ] Khoa gửi danh sách field/endpoint FE cần; Khải cập nhật phần ưu tiên hoặc gắn issue follow-up có owner.
- [ ] Quỳnh Anh rà luồng chính và lỗi quan trọng; Nguyên tổng hợp link issue/PR và phần còn mở cho PA2.
- [ ] Có bản Contract để review và nộp trước 24/10; chưa yêu cầu freeze toàn bộ MVP.

### 3. Rà Contract từ góc nhìn frontend

- **Loại:** Task; **Assignee:** Phan Lê Đăng Khoa; **Cộng tác:** Nguyễn Đặng Khôi Nguyên, Lê Quốc Khải
- **Labels:** `FE`, `Docs`; **Ưu tiên:** High
- **Hạn đề xuất:** 23/10/2026
- **Phụ thuộc:** bắt đầu với API Contract draft; chuyển gap ưu tiên cho Khải trước hạn 24/10.

**Mô tả Jira:** Là frontend developer, tôi cần rà dữ liệu và quyền trong API Contract theo các màn hình/luồng MVP để có thể triển khai UI mà không phải tự đoán API.

**Acceptance Criteria:**

- [ ] Liệt kê các luồng FE ưu tiên cho PA2 và endpoint/field cần cho từng luồng.
- [ ] Kiểm tra payload ví dụ, kiểu ID, enum, trạng thái rỗng/lỗi và quyền truy cập ở các luồng ưu tiên.
- [ ] Ghi gap trong issue/PR contract; Khải phản hồi phần cần sửa trước PA2, Nguyên theo dõi các follow-up còn lại.
- [ ] Có kết luận ngắn về phần Contract đã rà và phần FE còn chờ sau PA2.

### 4. Cài và thử công cụ thu thập ảnh demo

- **Loại:** Task; **Assignee:** Đào Thị Quỳnh Anh; **Cộng tác:** Nguyễn Đặng Khôi Nguyên
- **Labels:** `AI`; **Ưu tiên:** High
- **Hạn đề xuất:** 24/10/2026
- **Phụ thuộc:** chốt nguồn ảnh được phép sử dụng và vị trí lưu dữ liệu trước khi chạy pilot.

**Mô tả Jira:** Là người phụ trách AI Search/CV, tôi cần cài và chạy thử một công cụ thu thập ảnh demo trước PA2, kèm ví dụ metadata để nhóm quyết định cách mở rộng sau đó.

**Acceptance Criteria:**

- [ ] Chọn và cài một công cụ phù hợp với nguồn được phép sử dụng; ghi cách cài, cấu hình tối thiểu và lệnh chạy thử.
- [ ] Thu thập thử 3–5 ảnh từ nguồn phù hợp với mục đích đồ án, trong giới hạn truy cập và điều kiện sử dụng của nguồn.
- [ ] Mỗi ảnh thử có `source`, `collected_at`, `license_note`; không lưu thông tin liên hệ cá nhân.
- [ ] Nguyên chạy theo hướng dẫn hoặc review log chạy thử; lỗi/việc cần làm để mở rộng pipeline được ghi thành follow-up.
- [ ] Không commit ảnh/model lớn hoặc đưa dữ liệu lên nơi public ngoài phạm vi demo nội bộ đã thống nhất.

### 5. CI cơ bản và phương án CD staging

- **Loại:** Task; **Assignee:** Nguyễn Đặng Khôi Nguyên; **Cộng tác:** Nguyễn Đặng Khôi Nguyên (điều phối), Phan Lê Đăng Khoa, Lê Quốc Khải, Hà Thảo Ly, Đào Thị Quỳnh Anh
- **Labels:** `DevOps`; **Ưu tiên:** Highest
- **Hạn đề xuất:** 24/10/2026
- **Phụ thuộc:** xác định scripts thực tế của từng workspace và hosting/staging target; credentials phải được cấp qua GitHub Secrets/Environment.

**Mô tả Jira:** Là nhóm phát triển, chúng ta cần CI tối thiểu kiểm tra PR và phương án triển khai staging rõ ràng trước hạn PA2.

**Acceptance Criteria:**

- [ ] GitHub Actions chạy trên pull request và dùng lockfile (`pnpm install --frozen-lockfile`).
- [ ] Workflow hiện có vẫn chạy typecheck/build và bổ sung lint cho workspace Node có script khả dụng; lệnh chưa có được ghi vào follow-up.
- [ ] Có ít nhất một lần chạy CI trên PR hoặc bằng chứng chạy workflow tương đương; trạng thái pass/fail hiển thị rõ.
- [ ] Kiểm kê kiểm tra cần thêm cho `apps/ai-service` và migrations; tạo follow-up nếu chưa kịp cấu hình trong PA2.
- [ ] Ghi staging target, cách trigger deploy, secrets/quyền cần cấp và người phụ trách. Nếu đã có đủ hạ tầng thì thử deploy staging; nếu chưa, CD là follow-up sau PA2.
- [ ] Credentials không nằm trong repo/log; migration chỉ chạy theo quy trình được review.

## Thứ tự thực hiện và mốc review

| Mốc đề xuất | Việc cần đạt |
|---|---|
| 20–21/10 | Khải và Khoa rà API draft; Ly rà ERD; Quỳnh Anh chọn nguồn ảnh/tool; Khôi kiểm kê CI, scripts và thông tin deploy còn thiếu. |
| 22/10 | Ly chia sẻ các sửa đổi ERD ưu tiên; Khoa chuyển danh sách gap FE; Khải đối chiếu Contract với ERD; Quỳnh Anh cài tool; Khôi sửa CI. |
| 23/10 | Ly và Khoa bàn giao bản để review; Khải xử lý các điểm Contract quan trọng; Quỳnh Anh chạy lô ảnh thử; Khôi thử workflow. |
| 24/10 - hạn PA2 | Khải bàn giao Contract đã rà; Nguyên tổng hợp link tài liệu/PR, kết quả CI, hướng dẫn tool và Jira follow-up; nhóm nộp phần đã kiểm chứng. |

## Definition of Done của sprint

- [ ] ERD Markdown và Mermaid đồng bộ ở phần đã sửa; các điểm chưa chốt có issue theo dõi.
- [ ] API Contract được Khải, Khoa và Quỳnh Anh rà ở phạm vi ưu tiên; các khác biệt với ERD có owner/follow-up.
- [ ] Công cụ thu thập ảnh đã chạy thử 3–5 ảnh với metadata nguồn và giấy phép.
- [ ] CI cơ bản có kết quả kiểm tra; phương án CD staging hoặc blocker về hosting/quyền được ghi rõ trong Jira.
- [ ] Mỗi issue có link tài liệu/PR hoặc bằng chứng thử nghiệm, reviewer, trạng thái và phần việc sau PA2.

## Tham chiếu

- `report/PA1/Software_Development_Plan.pdf` - vai trò thành viên, lịch Sprint 2 và workflow quản lý dự án; hạn PA2 ngày 24/10 ở trên là cập nhật mới của nhóm.
- `report/PA1/rup_vision_sp.docx.pdf` - người dùng, phạm vi sản phẩm và yêu cầu bảo vệ workspace/gallery.
- `docs/db/erd_v0.md`, `docs/db/erd_v0.mmd`, `docs/api/contract_v0.md` - baseline thiết kế hiện tại cần được rà soát.
- `docs/contributing.md` - quy tắc Git, PR, review, migration, bảo mật và Definition of Done.
- `.github/workflows/ci.yml` - CI hiện tại; hiện workflow chạy install, typecheck và build cho workspace Node.
