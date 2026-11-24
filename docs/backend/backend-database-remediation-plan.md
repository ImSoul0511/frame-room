# Kế hoạch cập nhật database và backend sau rà soát Cloud

Ngày lập 24/11/2026. Phạm vi gồm đồng bộ schema Supabase Cloud, sửa các lỗi backend đã phát hiện, kiểm tra dữ liệu cũ và xác minh lại các API. Nguồn hiện trạng là [báo cáo rà soát endpoint](endpoint-schema-audit.md). Tiến độ thực tế được ghi ở phần dưới.

## Tiến độ thực hiện ngày 24/11/2026

- [x] Theo yêu cầu kiểm tra chỉ đọc trên Cloud, đã chạy 26 kiểm tra HTTP bằng Fastify injection với kết nối database `READ ONLY`, dùng danh tính giả lập từ profile hiện có. Cả 26 trả status mong đợi. Đã kiểm tra thêm 7 biến thể query động cho discovery và portfolio, tất cả đạt. Danh tính giả lập không xác minh đăng nhập Supabase Auth thật.
- [x] Đã kiểm tra RLS đọc với role `anon` và `authenticated`: 37 portfolio và 1.335 ảnh công khai đọc được. Anonymous bị từ chối truy cập các bảng conversation, notification, add-on và feedback. Các bảng booking và hội thoại hiện không có dữ liệu, nên chưa kiểm tra được cách ly giữa các user trên bản ghi thực. Các bảng liên quan đã bật RLS.
- [x] Bucket `portfolio-images` đang public và một ảnh đã trả HTTP 200 với HEAD; ba bucket `conversation-files`, `gallery-previews`, `deliveries` đang private. Chưa kiểm tra được quyền truy cập Storage private theo user vì thiếu dữ liệu phù hợp.
- [x] Đã chạy lại toàn bộ Vitest cục bộ, 266/266 kiểm thử đạt. Các kiểm tra này dùng mock hoặc dữ liệu cục bộ.
- [ ] Theo chỉ đạo mới, không thực hiện các kiểm thử ghi, cập nhật hoặc xóa trên database Cloud. Những trường hợp này và backfill sau khi phát hành chỉ có thể hoàn tất khi có môi trường được phép ghi hoặc chỉ đạo mới. Mục AI Search được loại khỏi đợt thực hiện này.
- [ ] Repo hiện không có cấu hình hosting hoặc triển khai đang hoạt động. Backend/frontend đã build nhưng chưa được triển khai lên môi trường phục vụ; cần xác định đích triển khai trước khi thực hiện.
- [x] Đã áp dụng Cloud các migration `20261120000100`–`20261120000400`, `20261120000700`, `20261124000200` và `20261124000300` trong một transaction, kèm ghi nhận lịch sử. Foreign key studio đã trỏ tới `profiles` và năm bảng còn thiếu đã xuất hiện.
- [x] Kiểm tra trước triển khai ghi nhận 0 booking, 0 message, 0 delivery và 1.335 ảnh portfolio. Cả tám migration tháng 11 đã chạy thử trong transaction và rollback trên Cloud. PostgreSQL cục bộ đã replay các migration với thành phần thay thế cho Supabase và vector.
- [x] Đã sửa các truy vấn genre, mảng enum, cập nhật null, dữ liệu add-on, validation response của các route bị ảnh hưởng và kiểm tra role photographer. Đã chạy 265 Vitest, typecheck, lint phần sửa và các luồng kiểm tra PostgreSQL cục bộ. Ba GET discovery có genre trả 200 qua backend kết nối Cloud.
- [x] Theo lựa chọn của người dùng, giữ bucket `portfolio-images` public. Đã áp dụng `20261120000500`, `20261120000600`, `20261120000800` cùng `20261124000400` trong một transaction và xác nhận bucket public sau commit.
- [x] Đã tạo DB types từ schema Cloud và đồng bộ bốn giá trị genre có sẵn trên Cloud qua migration `20261124000500`, shared schema và nhãn giao diện.
- [x] Sau cập nhật Cloud, 270 câu SQL tĩnh chuẩn bị thành công, không có lỗi, 3 câu SQL động chưa được kiểm tra bằng phương pháp này. Một portfolio Cloud thực tế trước đó lỗi do genre `drink` đã trả 200 sau sửa. Bộ workflow PostgreSQL cục bộ qua 22 kiểm tra, có Auth, Storage, pgmq và vector thay thế.
- [ ] Chưa có dự án Supabase test riêng để kiểm tra RLS, Storage và workflow ghi dữ liệu. Chưa triển khai backend/frontend.

## Mục tiêu và trạng thái

- [x] Rà soát schema Cloud và xác nhận tám migration nghiệp vụ ngày 20/11 chưa có trong lịch sử Cloud.
- [x] Áp dụng và ghi nhận migration `20261124000100_portfolio_image_suggested_genres` trên Cloud.
- [x] Xác định các truy vấn backend lỗi qua kiểm tra SQL trực tiếp trên Cloud. Đây chưa phải kết quả kiểm thử toàn bộ endpoint.
- [ ] Đồng bộ schema nghiệp vụ và dữ liệu hiện có theo phương án nâng cấp được kiểm chứng.
- [ ] Sửa lỗi backend còn tồn tại sau khi đồng bộ schema.
- [ ] Kiểm tra lại endpoint, quyền truy cập, Storage và workflow, sau đó cập nhật báo cáo kết quả.

Quy ước checklist: `[ ]` chưa hoàn thành, `[x]` đã có bằng chứng. Khi thực hiện, ghi ngày, môi trường, commit hoặc phiên bản migration và đường dẫn bằng chứng cạnh từng mục hoàn thành. Mục bị chặn ghi rõ nguyên nhân và bước tiếp theo.

## Thứ tự thực hiện và phụ thuộc

| Giai đoạn                                | Phụ thuộc                                   | Kết quả cần đạt                                                           |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Khảo sát và quyết định đường nâng cấp | Kết nối Cloud và môi trường test phù hợp    | Bản đối chiếu schema, lịch sử, dữ liệu và phương án migration             |
| 2. Chuẩn bị và thử migration             | Giai đoạn 1                                 | Replay mới và nâng cấp từ bản sao dữ liệu đều có thể kiểm chứng           |
| 3. Sửa backend                           | Mapping schema và contract đã rõ            | Endpoint sử dụng đúng trường, giữ dữ liệu nhất quán và có regression test |
| 4. Kiểm thử tích hợp                     | Database test đã nâng cấp và backend đã sửa | Các luồng API, RLS, Storage và dữ liệu cũ đạt tiêu chí                    |
| 5. Áp dụng Cloud và xác minh             | Các kiểm tra liên quan đã đạt               | Lịch sử và schema Cloud khớp phương án đã chọn, API được xác minh lại     |

Các bước phân tích và sửa code độc lập có thể làm song song. Không kết luận một endpoint đã sửa chỉ vì SQL `PREPARE` thành công.

## Giai đoạn 1 · Khảo sát và chọn đường nâng cấp

- [ ] Ghi nhận project ref, môi trường, thời điểm khảo sát và phiên bản backend đang kết nối, không đưa credential vào tài liệu hoặc log.
- [ ] Lưu migration history, schema dump và thông tin khôi phục phù hợp của Cloud. Xác nhận khả năng khôi phục trước khi triển khai thay đổi dữ liệu hoặc chính sách.
- [ ] So sánh database thực tế với `supabase/migrations`, `schema.sql` và snapshot `schema (1).sql`. Kiểm tra cột, kiểu, default, constraint, foreign key, index, view, function, trigger, grants, RLS, Storage bucket và policy. Ghi riêng các bảng, cột và dữ liệu dataset chỉ có trên Cloud.
- [ ] Với từng migration `20261120000100`–`20261120000800`, lập bảng gồm object dự kiến, object hiện có, khác biệt định nghĩa, dữ liệu bị tác động, phụ thuộc và cách kiểm chứng. Kiểm tra cả nội dung migration, không suy ra trạng thái chỉ từ tên bảng hoặc migration history.
- [ ] Kiểm tra đặc biệt foreign key `studios.created_by`, `studio_members.user_id`, cột `room_milestones.updated_at` và các thay đổi đã sửa trực tiếp trong migration gốc. Xác định trạng thái thực tế trước khi viết forward migration.
- [ ] Kiểm tra ảnh hưởng backfill conversation đối với booking và message cũ, `deliveries.selection_round` đối với delivery cũ, thời điểm hoàn thành đối với booking đã `delivered`, và điều kiện publish portfolio hiện có.
- [ ] Kiểm tra tác động chuyển bucket `portfolio-images` sang private đối với URL cũ, ảnh công khai, signed URL và thời điểm phát hành backend/frontend.
- [ ] Xác định đường áp dụng cho tám migration có version cũ hơn `20261124000100` đã ghi nhận. Kiểm tra hành vi dry run và lịch sử trên bản sao. Nếu cần migration bù hoặc điều chỉnh history, thiết kế theo trạng thái từng môi trường, bảo đảm fresh replay và upgrade đều tái lập được. Chỉ ghi nhận version khi có bằng chứng các thay đổi tương ứng đã được áp dụng đầy đủ.
- [ ] Thống nhất chính sách membership: role nào cần photographer profile và API biểu diễn `photographerId` nullable thế nào. Đối chiếu contract trước khi đổi validation hoặc phân quyền.

## Giai đoạn 2 · Migration và dữ liệu cũ

- [ ] Tạo bộ migration nâng cấp theo kết quả giai đoạn 1, giữ nguyên migration đã phát hành và bảo toàn các object dataset đang sử dụng. Nêu rõ thứ tự, phụ thuộc, lock, thời gian chạy dự kiến và cách khôi phục hoặc sửa tiếp nếu gián đoạn.
- [ ] Xử lý completion, conversation, agreement, catalog/proofing, moderation, access/audit, booking add-ons và index tương ứng với tám migration còn thiếu. Xác minh function, trigger, policy và grants cùng với bảng/cột.
- [ ] Thiết kế backfill `booking_add_ons` từ `bookings.service_snapshot.addOns`. Bảo toàn tên và giá tại thời điểm booking, xác định quantity và cách xử lý snapshot thiếu, sai định dạng, add-on đã xóa hoặc ID trùng. Không tự suy đoán dữ liệu thiếu. Ghi nhận các dòng cần xử lý riêng.
- [x] Bảo đảm backfill có thể chạy lại và không tạo dòng trùng. Đã chạy thử hai lần trên PostgreSQL cục bộ và áp dụng migration `20261124000300` trong transaction Cloud, nơi có 0 booking tại thời điểm triển khai.
- [x] Đối chiếu và cập nhật foreign key studio bằng migration `20261124000200`. Cloud đã xác nhận cả hai foreign key tham chiếu `profiles`; migration đã áp dụng thành công với dữ liệu hiện có.
- [ ] Kiểm tra fresh replay từ đầu và upgrade trên database test có trạng thái tương đương Cloud, gồm cả `20261124000100` và dữ liệu dataset. Kiểm tra chạy lại hoặc khôi phục sau lỗi đối với từng bước được thiết kế hỗ trợ retry.
- [ ] Chạy dry run trên dự án test, xem chính xác các migration sẽ thực thi và đối chiếu history sau chạy. So sánh schema trước/sau và số lượng hoặc tổng kiểm tra dữ liệu backfill.
- [ ] Kiểm tra RLS và grants cho anonymous, owner, client, photographer, manager, admin và người ngoài theo từng tài nguyên liên quan. Kiểm tra cả trường hợp bị từ chối, thay đổi membership và Storage/Realtime.
- [ ] Tạo lại `packages/shared/src/db.types.ts` từ schema test đã xác minh, rồi đối chiếu với các bảng, cột nullable và foreign key mới.

## Giai đoạn 3 · Sửa backend

### P1 · Discovery và kiểu mảng

- [x] Sửa các truy vấn lọc genre trên view `providers.genres` kiểu `text[]`, giữ validation genre của API. Ba GET discovery trả 200 khi backend đã sửa kết nối Cloud.
- [ ] Kiểm tra nhánh tìm ứng viên của `POST /v1/search` với AI search được bật và có genre.
- [x] Chuẩn hóa `photographers.genres` và `studios.genres` từ PostgreSQL thành mảng trong các phép đọc và `RETURNING` liên quan. GET danh sách studio, POST photographer và PATCH studio đã được kiểm tra trên PostgreSQL cục bộ.
- [ ] Kiểm tra đầy đủ các route đọc, tạo và cập nhật photographer/studio trên môi trường test Cloud.
- [x] Đưa validation response của các route ghi photographer, studio và cập nhật role thành viên bị ảnh hưởng vào transaction trước commit.
- [ ] Kiểm tra đầy đủ lỗi giữa chừng, rollback và retry để xác nhận các trường hợp response lỗi không ghi dữ liệu.

### P1 · Khôi phục các workflow phụ thuộc schema

- [ ] Đối chiếu lại toàn bộ endpoint trong báo cáo với schema sau migration. Ưu tiên profile, studio, service, portfolio, booking request, assignment, cancellation, notification, conversation, completion, workspace, proofing, delivery và moderation.
- [ ] Kiểm tra chữ ký và quyền gọi `frameroom_transition`, `frameroom_reschedule`, `frameroom_set_completion_hold` và các hàm private. Kiểm tra status code và error mapping cho thiếu quyền, trạng thái sai và version cũ.
- [ ] Kiểm tra nhánh PostgreSQL và Supabase REST theo cấu hình thực tế. Bảo đảm response schema và hành vi hiển thị phù hợp trên cả hai đường chạy.

### P2 · Dữ liệu add-on, membership và nullable

- [x] Khi tạo booking, ghi `booking_add_ons` trong cùng transaction với booking và snapshot. Giữ `service_snapshot.addOns` cho client hiện tại. Đã xác nhận bằng `POST /v1/bookings` trên PostgreSQL cục bộ.
- [ ] Kiểm tra `POST /v1/bookings`, `POST /v1/booking-requests` và action `request_booking` qua `POST /v1/ai-actions/:id/confirm`, gồm không có add-on, nhiều add-on, add-on không hợp lệ, thất bại giữa chừng, retry và idempotency.
- [ ] Sửa response team để phản ánh đúng quyết định membership, gồm thành viên có `photographerId` nullable nếu được hỗ trợ. Validate trước khi đổi role, kiểm tra last manager và assignment đang hoạt động.
- [x] Phân biệt trường bị bỏ qua với `null` tường minh trong `PATCH /v1/studios/:id` và `PATCH /v1/services/:id` cho `contactEmail`, `selectionQuota`, `revisionLimit`. Đã kiểm tra trường hợp xóa bằng null trên PostgreSQL cục bộ.
- [ ] Kiểm tra bổ sung trường hợp bỏ qua và thay giá trị cho các trường nullable trên.
- [ ] Cập nhật shared schema, API contract, OpenAPI và frontend khi thay đổi contract được chấp nhận. Kiểm tra dữ liệu cũ và client hiện tại.

## Giai đoạn 4 · Kiểm thử và nghiệm thu

- [ ] Thêm regression test tập trung vào các lỗi nêu trên, ưu tiên chạy với PostgreSQL thật để phát hiện enum array, constraint và transaction. Unit test với fake DB không thay thế kiểm tra này.
- [ ] Chạy API typecheck, build, test liên quan và kiểm tra tài liệu. Chạy lại Vitest trong môi trường cho phép tạo tiến trình con, ghi rõ kết quả và lỗi nếu còn.
- [ ] Chạy `pnpm test:db` trên database test được cấu hình đúng và có fixture theo [hướng dẫn Cloud](../infrastructure/supabase-cloud-preview.md#verification). Ghi kết quả và các kiểm tra chưa bao phủ.
- [ ] Kiểm thử end-to-end bằng tài khoản và dữ liệu test: tạo hồ sơ, tìm provider có genre, tạo studio/service/portfolio, tạo booking có add-on, brief, phân công, conversation, proofing, delivery, review, notification và moderation.
- [ ] Kiểm tra các ca âm: user ngoài, role không hợp lệ, RLS/Storage, version cũ, request trùng, conflict lịch, rollback khi ghi nhiều bước, dữ liệu cũ và add-on bị xóa.
- [ ] Kiểm tra bucket portfolio private, URL công khai hiện tại, URL mới qua API và quyền truy cập ảnh. Đối chiếu frontend/backend trước khi chuyển cấu hình trên môi trường dùng chung.
- [ ] Rà soát lại từng nhóm endpoint trong [báo cáo](endpoint-schema-audit.md), ghi trạng thái đã sửa/chưa sửa, điều kiện và bằng chứng HTTP hoặc SQL tương ứng. Ghi rõ các endpoint chưa kiểm tra.

## Giai đoạn 5 · Triển khai và theo dõi

- [ ] Xác nhận bản migration, backend và generated types đã được kiểm tra cùng nhau. Ghi checksum hoặc commit triển khai, đối tượng chịu trách nhiệm và trình tự áp dụng.
- [ ] Xem dry run với đúng project và lịch sử migration thực tế. Áp dụng migration theo đường nâng cấp đã kiểm chứng, theo dõi transaction, lock và kết quả backfill.
- [ ] Đối chiếu migration history, schema, grants, RLS, function, trigger và Storage sau triển khai. Chạy smoke test đọc/ghi bằng tài khoản test phù hợp, tránh tác động dữ liệu người dùng.
- [ ] Triển khai backend và frontend theo thứ tự tương thích đã kiểm chứng. Theo dõi lỗi API, transaction, job và ảnh sau triển khai, ghi lại thời điểm cùng kết quả.
- [ ] Nếu thất bại, dừng bước phụ thuộc, dùng phương án khôi phục hoặc forward fix đã kiểm tra, xác minh trạng thái dữ liệu và migration history trước khi thử lại.
- [ ] Cập nhật báo cáo cuối cùng, checklist và các vấn đề còn tồn đọng với người phụ trách, mức ưu tiên và bằng chứng.

## Điều kiện hoàn thành

- [ ] Cả fresh replay lẫn upgrade từ trạng thái Cloud đã được xác minh, dữ liệu dataset và dữ liệu người dùng hiện có được bảo toàn theo kết quả đối chiếu.
- [ ] Các API bị ảnh hưởng đã có kết quả kiểm tra phù hợp với route và vai trò. Các lỗi hoặc ca chưa chạy được ghi rõ.
- [ ] Booking mới và dữ liệu cũ có add-on nhất quán giữa snapshot và bảng liên kết theo quy tắc backfill đã thống nhất.
- [ ] Kiểm tra RLS, Storage, transaction, retry và lỗi giữa chừng đạt kết quả mong đợi trên môi trường test.
- [ ] Báo cáo phản ánh đúng schema Cloud sau triển khai, trạng thái migration và kết quả thực tế.
