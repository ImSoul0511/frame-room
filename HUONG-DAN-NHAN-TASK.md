# Hướng dẫn đọc tài liệu khi nhận task FrameRoom

Mỗi thành viên bắt đầu từ phần đọc chung, sau đó chọn nhóm công việc mình được giao.
Các bảng bên dưới chỉ rõ thứ tự đọc và thông tin cần lấy ra trước khi viết code hoặc chạy script.

## 1. Nắm bối cảnh trước khi bắt đầu

Dự án đang xây dựng lại MVP trên `dev`. Branch `feature/MVP-001-ai-focused-workflow`
được dùng để tham khảo hành vi, mã nguồn và script đã có. Đăng Khoa phụ trách bàn giao
Frontend và shared contract theo manifest. Backend, Database và AI được triển khai
theo các kế hoạch riêng, hướng tới mốc 15/11/2026, với AI Search là ưu tiên cao nhất của AI.

Kế hoạch phân công cần được đối chiếu với trạng thái task và PR thực tế khi bắt đầu làm.
Các mục ghi đề xuất hoặc chờ quyết định cần có kết luận trong task trước khi triển khai
phần phụ thuộc vào chúng.

| Thứ tự | File cần đọc                                                    | Cần hiểu sau khi đọc                                                                         |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1      | [README.md](README.md)                                          | Sản phẩm, cấu trúc monorepo, cách cài và chạy workspace.                                     |
| 2      | [Product brief](docs/product/brief.md)                          | Người dùng, vai trò và luồng khám phá → brief → booking → cộng tác → giao ảnh.               |
| 3      | [Architecture overview](docs/architecture/overview.md)          | Ranh giới giữa Web, Fastify, shared package, Supabase và AI.                                 |
| 4      | [Contribution rules](docs/contributing.md)                      | Coding convention, branch, commit, hook, review và điều kiện hoàn thành.                     |
| 5      | [Target environment](docs/infrastructure/target-environment.md) | Web/API/AI chạy local, Supabase dùng Cloud, cách phân biệt biến môi trường public và secret. |
| 6      | Task được giao trong `plans/tasks/<TASK-ID>.md`                 | Owner, phạm vi, dependency, tiêu chí nghiệm thu và quyết định còn mở.                        |

Nếu task chưa có file, dùng [task template](agents/templates/task.md) để ghi lại phạm vi
và tiêu chí nghiệm thu trước khi triển khai. Dùng mã task đã được phân công trong các
kế hoạch bên dưới, hoặc thống nhất mã mới với người giao việc.

## 2. Chọn tài liệu theo công việc

### Frontend — Đăng Khoa

| Thứ tự | File cần đọc                                                                      | Mục đích                                                                                   |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1      | [Frontend shared push manifest](docs/transition/frontend-shared-push-manifest.md) | Chọn đúng file Web/shared để chuyển sang branch từ `dev`, kiểm tra dependency và bàn giao. |
| 2      | [Feature inventory](docs/frontend/feature-inventory.md)                           | Nắm các màn hình và tính năng của UI tham khảo.                                            |
| 3      | [Frontend data flow](docs/frontend/frontend-data-flow.md)                         | Hiểu luồng Auth, API, server state, upload và dữ liệu màn hình.                            |
| 4      | [Frontend API requirements](docs/frontend/api-requirements.md)                    | Biết mỗi luồng UI cần endpoint và response nào, đang phụ thuộc phần nào.                   |
| 5      | [Backend API contract](docs/backend/api-contract.md)                              | Đồng bộ request, response, lỗi, phân trang và quyền truy cập với Backend.                  |
| 6      | [Frontend agent guide](agents/frontend.md) và [shared guide](agents/shared.md)    | Cách tổ chức UI, dùng Astryx, validation và shared contract.                               |

Khi bàn giao, ghi rõ các luồng đã tích hợp được với API và trạng thái chờ Backend/Database/AI
của từng tính năng còn lại. Các thay đổi wire contract cần phối hợp với người phụ trách Backend.

### Backend — Khải và Khôi Nguyên

| Thứ tự | File cần đọc                                                                                               | Mục đích                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1      | [Backend MVP work plan](docs/backend/mvp-rebuild-work-plan.md)                                             | Xác định task `BE-101` đến `BE-108`, owner, branch, lịch, endpoint và tiêu chí nghiệm thu. |
| 2      | [API contract](docs/backend/api-contract.md)                                                               | Nắm quy tắc request/response, mã lỗi, status và validation.                                |
| 3      | [Endpoint inventory](docs/backend/endpoint-inventory.md)                                                   | Đối chiếu method, path và schema cho endpoint được giao.                                   |
| 4      | [Service specifications](docs/backend/service-specifications.md)                                           | Xác định logic thuộc route, service, repository hay transaction/RPC.                       |
| 5      | [Authorization matrix](docs/backend/authorization-matrix.md)                                               | Biết actor nào được phép thực hiện từng nhóm thao tác.                                     |
| 6      | [Backend agent guide](agents/backend.md) và [Frontend API requirements](docs/frontend/api-requirements.md) | Kiểm tra cách triển khai Fastify và hành vi browser đang chờ.                              |

Task chạm SQL hoặc Storage cần đọc thêm phần tương ứng trong tài liệu Database.
Task search/indexing cần đọc thêm kế hoạch AI và internal service contract.

### Database — Thảo Ly, Quỳnh Anh mentor

| Thứ tự | File cần đọc                                                                                                                                  | Mục đích                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1      | [Database Cloud work guide](docs/database/mvp-cloud-work-guide.md)                                                                            | Đi theo task `DB-101` đến `DB-105`, checkpoint mentoring, setup Cloud, bàn giao `.env` và vận hành. |
| 2      | [Database overview](docs/database/database-overview.md)                                                                                       | Hiểu các nhóm bảng và những script đã có trên branch MVP.                                           |
| 3      | [ERD](docs/database/erd.md), [relationships](docs/database/relationships.md) và [table specifications](docs/database/table-specifications.md) | Đối chiếu cardinality, PK/FK, nullability, kiểu dữ liệu và quy tắc sở hữu.                          |
| 4      | [Constraints and indexes](docs/database/constraints-and-indexes.md) và [functions and triggers](docs/database/functions-and-triggers.md)      | Hiểu cách đảm bảo uniqueness, lịch chụp, transaction và xử lý cạnh tranh.                           |
| 5      | [RLS policies](docs/database/rls-policies.md) và [Storage configuration](docs/database/storage-configuration.md)                              | Thiết kế quyền đọc/ghi, bucket public/private và kiểm thử khác tài khoản.                           |
| 6      | [Supabase Cloud setup](docs/infrastructure/supabase-cloud-setup.md) và [migration workflow](docs/infrastructure/migration-workflow.md)        | Xác định project đích, thứ tự apply migration, kiểm chứng và generate types.                        |
| 7      | [Database agent guide](agents/database.md)                                                                                                    | Kiểm tra quy trình làm việc với migration, RLS và coding agent.                                     |

Khi nhận task, Ly ghi lại project ref, migration liên quan và người review.
Khi chạm vector/taxonomy, đối chiếu model fingerprint và schema với Quỳnh Anh, Khôi Nguyên.
Khi chạm booking/schedule, đối chiếu invariant và RPC với Khải.

### AI Service và AI Search — Khôi Nguyên và Quỳnh Anh

| Thứ tự | File cần đọc                                                                                                                | Mục đích                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1      | [AI Search work plan](docs/ai/ai-search-work-plan.md)                                                                       | Xác định task `AIS-101` đến `AIS-105`, phần code/data, taxonomy, nguồn ảnh, script và benchmark. |
| 2      | [Current AI capabilities](docs/ai/current-ai-capabilities.md)                                                               | Biết branch MVP đã có gì và scaffold hiện tại cần xây thêm gì.                                   |
| 3      | [Target AI architecture](docs/ai/target-ai-architecture.md)                                                                 | Nắm ranh giới Python AI service, Fastify, Cloud và worker.                                       |
| 4      | [AI service contract](docs/ai/ai-service-contract.md)                                                                       | Đồng bộ input/output nội bộ, model, dimensions, timeout và lỗi.                                  |
| 5      | [Dataset requirements](docs/ai/dataset-requirements.md)                                                                     | Chuẩn bị source/license ledger, nhãn, split và tiêu chí đánh giá.                                |
| 6      | [Backend work plan](docs/backend/mvp-rebuild-work-plan.md) và [Database Cloud guide](docs/database/mvp-cloud-work-guide.md) | Kiểm tra dependency của search adapter, Storage, vector schema và indexing.                      |

Khôi Nguyên tập trung tích hợp service/API, ranking và Cloud writes.
Quỳnh Anh tập trung nguồn dữ liệu, taxonomy, pipeline model/data và đánh giá search,
đồng thời mentor Thảo Ly theo checkpoint đã phân công.

## 3. Khi làm cùng coding agent

Cho agent đọc [agents/README.md](agents/README.md), [workflow](agents/workflow.md),
task được giao và domain guide tương ứng. Sau đó cung cấp phạm vi file, dependency,
tiêu chí nghiệm thu và các quyết định đã được thống nhất.

| Loại thay đổi                                           | Skill trong repo cần đọc khi phù hợp                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Màn hình hoặc form                                      | [frameroom-astryx-screen](agents/skills/frameroom-astryx-screen/SKILL.md)           |
| API, schema, validation, trạng thái hoặc quyền truy cập | [frameroom-contract-change](agents/skills/frameroom-contract-change/SKILL.md)       |
| SQL migration, RLS hoặc kiểm chứng schema               | [frameroom-supabase-migration](agents/skills/frameroom-supabase-migration/SKILL.md) |

Có thể dùng prompt khởi đầu sau và thay nội dung trong dấu `<...>`.

```text
Đọc agents/README.md và HUONG-DAN-NHAN-TASK.md.
Task được giao là <TASK-ID>, tài liệu task tại plans/tasks/<TASK-ID>.md.
Đọc kế hoạch phân công và các contract/schema liên quan tới task.
Kiểm tra branch và thay đổi đang có, rồi triển khai trên branch task từ dev.
Tham khảo branch feature/MVP-001-ai-focused-workflow theo phạm vi kế hoạch.
Phạm vi file được giao là <các đường dẫn hoặc module>.
Tiêu chí nghiệm thu là <các kết quả cần đạt>.
Ghi lại quyết định còn mở, chạy kiểm tra phù hợp và bàn giao kết quả thực tế.
```

## 4. Trước khi bàn giao hoặc mở PR

Đọc lại [contribution rules](docs/contributing.md), [review guide](agents/review.md)
và [PR template](.github/pull_request_template.md). Kiểm tra các mục sau.

- Branch và commit có đúng task ID, scope và format của repo.
- Diff đúng phạm vi, contract/shared/schema được cập nhật đồng bộ khi có thay đổi hành vi.
- Các kiểm tra phù hợp đã chạy, kết quả và phần còn chờ được ghi trong task.
- Các luồng cần Cloud, model hoặc dữ liệu thật có bằng chứng kiểm chứng tương ứng.
- Người review phù hợp đã được xác định theo loại thay đổi.

Dùng [verification template](agents/templates/verification.md) để ghi bằng chứng và
[handoff template](agents/templates/handoff.md) để bàn giao.
Kế hoạch phân công tổng hợp được liên kết trong [PLAN-001](plans/tasks/PLAN-001.md).

File này dùng tiếng Việt theo yêu cầu của nhóm để hướng dẫn nhận task.
Quy ước ngôn ngữ cho code, commit và các tài liệu khác được ghi trong contribution rules.
