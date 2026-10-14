# FrameRoom: API Contract MVP (bản nháp v0)

**Vị trí trong repo:** `docs/api/CONTRACT_v0.md` (khi chốt v1 có thể tách theo nhóm: một file quy ước chung, mỗi nhóm một file)
**Nguồn sự thật cuối cùng:** Zod schema trong `packages/shared`. Khi code lệch tài liệu, sửa một trong hai ngay trong PR đó.

> Mục có dấu **[?]** là điểm còn bỏ ngỏ, tổng hợp ở mục 20.
> Nhóm đánh dấu **[Should]** chỉ chốt ở mức khung (endpoint, quyền, trường chính); chi tiết bổ sung theo quy tắc "thêm, không phá vỡ" ở mục 21.

---

## 1. Phạm vi

Contract gồm các endpoint **nghiệp vụ** của toàn bộ MVP (Must và Should trong README).

| Nhóm | Mục | Mức |
|---|---|---|
| Hồ sơ cá nhân | 4 | Must |
| Photographer | 5 | Must |
| Portfolio và ảnh portfolio | 6, 7 | Must |
| Explore và Tag | 8 | Must |
| Studio (hồ sơ, đội ngũ, lời mời) | 9 | Must |
| Dịch vụ và add-on | 10 | Must |
| Lịch và tài nguyên | 11 | Should |
| Booking và Shoot Brief | 12 | Must |
| Shoot Room (tin nhắn, decision log, milestone) | 13 | Must |
| Chọn ảnh (proofing) | 14 | Must |
| Bàn giao | 15 | Must |
| Review | 16 | Must |
| Báo cáo nội dung và quản trị | 17 | Should |
| AI Search | 18 | Must (chốt hình dạng; logic xếp hạng làm sau) |
| Dashboard studio, timeline | 19 | Should (khung) |

**Không nằm trong contract này:**
- Đăng ký, đăng nhập, đăng xuất, đặt lại mật khẩu: **FE gọi thẳng Supabase Auth**.
- Upload file: **FE upload thẳng lên Supabase Storage**, sau đó gọi API để ghi nhận (mục 2.6).
- Nhận tin nhắn thời gian thực: **FE đăng ký Supabase Realtime** (mục 2.7). Gửi tin vẫn qua API.
- Thanh toán tích hợp, lưu trữ RAW, AI Concept Studio, Community Rooms, thông báo đẩy/email **[?]**: ngoài MVP.

---

## 2. Quy ước chung

### 2.1 Cơ bản

| Mục | Quy ước |
|---|---|
| Base URL | `/v1` |
| Định dạng | JSON, `Content-Type: application/json` |
| Xác thực | Header `Authorization: Bearer <access_token của Supabase>` |
| ID | UUID (chuỗi) |
| Ngày giờ | ISO 8601, UTC, ví dụ `2026-10-15T09:30:00Z`. Khoảng thời gian là nửa mở `[start, end)` |
| Tên trường | `camelCase` trong JSON (cột DB là `snake_case`, BE tự chuyển) |
| Giá trị enum | `snake_case` chuỗi |
| Tiền tệ | số nguyên VND, ví dụ `1500000`. MVP không có thanh toán; mọi con số tiền chỉ để tham khảo/thoả thuận |
| Chuỗi rỗng | Không dùng; trường không có giá trị thì `null` |
| Sắp xếp | Mặc định mới nhất trước. Endpoint nào cho đổi thì ghi rõ tham số `sort` (ví dụ `sort=-createdAt`) |

### 2.2 Kiểu phản hồi

Thành công, một đối tượng:

```json
{ "data": { } }
```

Thành công, danh sách có phân trang theo trang:

```json
{
  "data": [ ],
  "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 }
}
```

Phân trang: `?page=1&pageSize=20` (mặc định `page=1`, `pageSize=20`, tối đa `pageSize=50`; nơi nào khác sẽ ghi rõ).

Danh sách theo con trỏ (chỉ dùng cho tin nhắn Shoot Room, vì dữ liệu tăng liên tục):

```json
{
  "data": [ ],
  "meta": { "limit": 30, "hasMore": true, "nextCursor": "<id tin cũ nhất đã trả>" }
}
```

Tham số: `?limit=30&before=<messageId>` (mặc định `limit=30`, tối đa 100).

### 2.3 Lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": [{ "field": "title", "message": "Tối đa 120 ký tự" }]
  }
}
```

`details` luôn là mảng. Mỗi phần tử có thể có `field` (trường không hợp lệ), `reason` (mã nguyên nhân để máy xử lý) và `message` (nội dung dễ hiểu cho người dùng). `reason` là tuỳ chọn; không dùng nội dung `message` làm mã điều kiện trong FE.

Ví dụ xung đột lịch:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Không thể xác nhận lịch",
    "details": [{
      "reason": "slot_overlap",
      "message": "Photographer đã có lịch trong khoảng thời gian này"
    }]
  }
}
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Dữ liệu sai định dạng hoặc thiếu trường bắt buộc |
| 401 | `UNAUTHENTICATED` | Thiếu hoặc hết hạn token |
| 403 | `FORBIDDEN` | Đã đăng nhập nhưng không có quyền |
| 404 | `NOT_FOUND` | Không tìm thấy tài nguyên (hoặc không được phép biết nó tồn tại) |
| 409 | `CONFLICT` | Trùng dữ liệu hoặc xung đột; dùng `details[].reason` cho mã nguyên nhân như `slot_overlap`, `already_exists` |
| 422 | `UNPROCESSABLE` | Hợp lệ về định dạng nhưng vi phạm quy tắc nghiệp vụ (ví dụ chuyển trạng thái không hợp lệ) |
| 429 | `RATE_LIMITED` | Gọi quá nhiều |
| 500 | `INTERNAL_ERROR` | Lỗi máy chủ |
| 503 | `SERVICE_UNAVAILABLE` | Dịch vụ phía sau không sẵn sàng (ví dụ AI service) |

### 2.4 Quy tắc cập nhật

- `PATCH` chỉ gửi trường cần đổi. Trường gửi `null` nghĩa là xoá giá trị (nếu cho phép null).
- Trường do server sinh (`id`, `createdAt`, `updatedAt`, `userId`, `roles`, `priceFrom`, `publishedAt`, `round`, `status` khi có endpoint chuyển trạng thái riêng) bị bỏ qua nếu client gửi lên.
- Server **không** tin vai trò hay `userId` từ client; luôn lấy từ token và dữ liệu quan hệ phía server.
- `DELETE` thành công trả 204. Chính sách xoá được phân loại rõ như sau:
  - **Xoá mềm:** portfolio, studio, service, add-on, resource và review. Với portfolio, đặt `deletedAt`; ẩn ngay khỏi mọi API thông thường, giữ bản ghi và file liên quan 30 ngày, sau đó script dọn dẹp xoá vĩnh viễn portfolio, bản ghi ảnh, ảnh chính và thumbnail. MVP không có API/giao diện khôi phục.
  - **Xoá cứng:** ảnh portfolio bị xoá riêng lẻ (gồm bản ghi, ảnh chính và thumbnail trong Storage), gallery preview (gồm ảnh chính và thumbnail), image note, milestone, schedule block, file bàn giao và bản ghi thành viên studio khi thành viên rời studio/bị loại.
  - **Booking:** giữ lại lịch sử; huỷ booking bằng trạng thái `cancelled`, không xoá booking để thay cho huỷ.
  - **Portfolio bị admin ẩn:** dùng `status = hidden`, không dùng `deletedAt`; đây là hai trạng thái khác ý nghĩa.
- Xoá mềm studio không tự xoá lịch sử booking. Các file liên quan booking tuân theo quy tắc riêng của gallery/delivery.

### 2.5 Ký hiệu quyền

| Ký hiệu | Nghĩa |
|---|---|
| Công khai | Không cần đăng nhập |
| Đăng nhập | Có token hợp lệ |
| `photographer` | Có role `photographer` |
| Manager studio | Là thành viên studio đó với `StudioMemberRole = manager` (tra qua `studio_members`) |
| Thành viên studio | Là thành viên studio đó, mọi vai trò |
| Khách của booking | `customerId` của booking |
| Bên cung cấp của booking | Photographer là chủ hồ sơ của booking, hoặc photographer được phân công (booking của studio), hoặc manager của studio là bên cung cấp |
| Người tham gia booking | Khách của booking hoặc bên cung cấp của booking |
| `system_admin` | Có role `system_admin` |

Role trong `Profile.roles` được BE tính: `user` luôn có; `photographer` nếu tài khoản có hồ sơ photographer; `studio_manager` nếu tài khoản đang là manager của ít nhất một studio chưa soft-delete theo `studio_members`; `system_admin` là role lưu riêng và được cấp thủ công trong DB. Vai trò chuyên môn như `retoucher` và `art_director` chỉ là metadata hiển thị trên hồ sơ, không phải quyền hệ thống.

### 2.6 Upload file và Storage

FE upload file trực tiếp lên Storage rồi gọi API ghi nhận. Request gửi `storagePath` hoặc trường đường dẫn có tên cụ thể; response trả URL. BE kiểm tra bucket/đường dẫn, file tồn tại và người dùng có quyền sử dụng file. Không nhận URL tuỳ ý từ FE làm nguồn sự thật của file.

Mọi ảnh do FE tạo thumbnail đều được upload theo cặp: `{uuid}.webp` (ảnh chính, cạnh dài tối đa 1280 px) và `{uuid}_thumb.webp` (thumbnail, cạnh dài khoảng 320 px). Request API chỉ gửi đường dẫn ảnh chính; BE suy ra đường dẫn thumbnail và kiểm tra cả hai file tồn tại. Quy tắc này áp dụng cho ảnh portfolio, gallery preview và ảnh đính kèm trong Shoot Room; không áp dụng cho file bàn giao. Nếu một lần upload cặp ảnh thất bại một phần, FE phải hoàn tất upload còn thiếu hoặc dọn file đã upload dở trước khi gửi request ghi nhận.

| Bucket | Dùng cho | Đường dẫn | Truy cập đọc |
|---|---|---|---|
| `avatars` | Ảnh đại diện user, photographer, studio | `{userId}/{uuid}.webp` | Công khai; ai có URL có thể xem |
| `profile-covers` | Ảnh bìa hồ sơ photographer/studio (**bucket bổ sung đề xuất để thống nhất đường dẫn**) | `{userId}/{uuid}.webp` | Công khai; ai có URL có thể xem |
| `portfolio-images` | Ảnh portfolio | `{userId}/{portfolioId}/{uuid}.webp` và `{uuid}_thumb.webp` | Công khai, kể cả khi portfolio còn `draft`; đây là quyết định chấp nhận cho MVP, gồm cả ảnh demo seed (xem README mục 7) |
| `gallery-previews` | Ảnh preview để chọn | `{bookingId}/{uuid}.webp` và `{uuid}_thumb.webp` | Riêng tư, signed URL hết hạn |
| `brief-references` | Ảnh tham chiếu trong Shoot Brief | `{userId}/{uuid}.webp` | Riêng tư, signed URL hết hạn |
| `deliveries` | File bàn giao | `{bookingId}/{uuid}.{ext}` | Riêng tư, signed URL hết hạn |
| `room-files` | Ảnh/tệp gửi trong Shoot Room | `{roomId}/{uuid}.{ext}`; ảnh có thêm `{uuid}_thumb.webp` | Riêng tư, signed URL hết hạn |
| `search-uploads` | Ảnh tham chiếu cho AI Search | `{userId}/{uuid}.webp` | Riêng tư, xoá sau 24 giờ **[?]** |

Giới hạn ảnh portfolio và preview: WebP, cạnh dài tối đa 1280 px, tối đa 2 MB cho mỗi ảnh chính; thumbnail khoảng 320 px. Giới hạn file bàn giao và tệp Shoot Room vẫn cần chốt (mục 20). RLS Storage giới hạn quyền ghi theo người dùng và tài nguyên. URL của bucket riêng tư là signed URL có thời hạn; FE không lưu URL hết hạn lâu dài mà gọi lại API để lấy URL mới.

### 2.7 Thời gian thực (Supabase Realtime)

Ghi luôn qua API (để kiểm tra quyền và quy tắc). FE chỉ **đăng ký nghe** để nhận thay đổi; RLS quyết định ai được nghe.

| Kênh | Sự kiện | Dùng ở |
|---|---|---|
| `shoot_room:{roomId}` | Tin nhắn mới, decision mới/được phản hồi, milestone thay đổi | Shoot Room |
| `booking:{bookingId}` | Đổi trạng thái booking, có phiên bản brief mới | Chi tiết booking |

Payload là đúng đối tượng như API trả về (cùng schema). Khi mất kết nối, FE gọi lại API danh sách để đồng bộ.

---

## 3. Kiểu dữ liệu dùng chung

### 3.1 Enum

| Enum | Giá trị |
|---|---|
| `Role` | `user`, `photographer`, `studio_manager`, `system_admin` |
| `Genre` | `portrait`, `fashion`, `wedding`, `family`, `product`, `food`, `event`, `cosplay` |
| `PortfolioStatus` | `draft`, `published`, `hidden` (`hidden` chỉ do admin đặt, chủ sở hữu không tự đặt được) |
| `Provenance` | `captured` (ảnh chụp thực tế), `manipulated` (chỉnh sửa/ghép nặng), `ai_generated` (tạo sinh) |
| `ProviderType` | `photographer`, `studio` |
| `StudioMemberRole` | `manager`, `photographer` (vai trò thành viên; không dùng cho chuyên môn hiển thị) |
| `ProfessionalRole` | `retoucher`, `art_director` (vai trò chuyên môn trên hồ sơ; không cấp quyền hệ thống) |
| `InvitationStatus` | `pending`, `accepted`, `declined`, `revoked` |
| `ResourceType` | `room`, `equipment` |
| `ScheduleEntryType` | `booking`, `block` |
| `BookingStatus` | `pending`, `confirmed`, `rejected`, `cancelled`, `in_progress`, `proofing`, `delivered`, `completed` (bảng chuyển ở mục 12.4) |
| `LocationType` | `studio`, `outdoor`, `client_site` |
| `MessageType` | `text`, `image`, `system` |
| `DecisionStatus` | `proposed`, `agreed`, `rejected` |
| `MilestoneStatus` | `todo`, `done` |
| `GalleryStatus` | `draft`, `open_for_selection`, `selection_submitted`, `finalized` |
| `DeliveryStatus` | `preparing`, `delivered` |
| `ReportTargetType` | `portfolio`, `portfolio_image`, `photographer`, `studio`, `review`, `message` |
| `ReportReason` | `inappropriate`, `copyright`, `ai_unlabeled`, `spam`, `harassment`, `other` |
| `ReportStatus` | `open`, `resolved` |
| `ReportResolution` | `dismissed`, `content_hidden` |

> Danh sách `Genre` lấy từ đề cương. Phong cách/tag chi tiết (tone lạnh, film...) làm sau cùng taxonomy của Quỳnh Anh; Sprint 1 dùng `styles` dạng chuỗi tự do **[?]**. Tag chuẩn (mục 8.2) có sẵn trong contract để ảnh có thể gắn tag khi taxonomy xong. `ProfessionalRole` chỉ dùng để hiển thị chuyên môn bổ sung trên hồ sơ photographer; các giá trị này không cấp quyền và không tham gia workflow phân công.

### 3.2 Đối tượng

**Profile** (người đang đăng nhập)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | Trùng `auth.users.id` |
| email | string | Chỉ đọc |
| displayName | string | 1–60 ký tự |
| avatarUrl | string \| null | |
| roles | Role[] | BE tính từ hồ sơ photographer và `studio_members`; chỉ `system_admin` được lưu riêng |
| photographerId | uuid \| null | `null` nếu chưa có hồ sơ photographer |
| createdAt | datetime | |

**UserSummary** (hiển thị người ở nơi khác, không lộ email)

| Trường | Kiểu |
|---|---|
| id | uuid |
| displayName | string |
| avatarUrl | string \| null |

**PhotographerSummary**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | Id hồ sơ photographer |
| userId | uuid | |
| displayName | string | |
| avatarUrl | string \| null | |

**StudioSummary**

| Trường | Kiểu |
|---|---|
| id | uuid |
| name | string |
| avatarUrl | string \| null |

**ProviderSummary** (bên cung cấp, photographer hoặc studio; dùng ở Explore và AI Search)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| type | ProviderType | |
| id | uuid | Id hồ sơ photographer hoặc id studio |
| displayName | string | Với studio là tên studio |
| avatarUrl | string \| null | |

**Photographer**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| userId | uuid | Chủ hồ sơ |
| displayName | string | 1–60 ký tự |
| avatarUrl | string \| null | |
| bio | string \| null | Tối đa 1000 ký tự |
| genres | Genre[] | 1–5 thể loại |
| styles | string[] | Tối đa 10, mỗi tag tối đa 30 ký tự **[?]** |
| professionalRoles | ProfessionalRole[] | Vai trò chuyên môn bổ sung để hiển thị; không ảnh hưởng quyền hệ thống hoặc workflow |
| city | string \| null | Ví dụ "TP. Hồ Chí Minh" |
| district | string \| null | Ví dụ "Thủ Đức" |
| priceFrom | integer \| null | Chỉ đọc; giá thấp nhất của các dịch vụ đang hoạt động, `null` nếu không có |
| coverImageUrl | string \| null | Ảnh bìa hồ sơ photographer |
| portfolioCount | integer | Số portfolio đã `published` |
| ratingAvg | number \| null | 1.0–5.0, một chữ số thập phân; `null` nếu chưa có review |
| reviewCount | integer | |
| isHidden | boolean | Chỉ trả cho chủ hồ sơ và `system_admin`; hồ sơ bị ẩn không xuất hiện công khai (mục 17) |
| createdAt, updatedAt | datetime | |

**Portfolio**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| ownerType | ProviderType | `photographer` hoặc `studio` |
| photographerId | uuid \| null | Có khi `ownerType = photographer` |
| studioId | uuid \| null | Có khi `ownerType = studio` |
| title | string | 1–120 ký tự |
| genre | Genre | |
| description | string \| null | Tối đa 2000 ký tự (concept, ghi chú) |
| status | PortfolioStatus | Mặc định `draft` |
| coverImageId | uuid \| null | ID ảnh thuộc chính portfolio này; BE kiểm tra quan hệ sở hữu |
| coverImageUrl | string \| null | URL hiển thị; lấy từ ảnh bìa hoặc ảnh đầu tiên nếu chưa đặt |
| imageCount | integer | |
| images | PortfolioImage[] | Chỉ có trong response chi tiết (`GET /portfolios/:id`) |
| publishedAt | datetime \| null | Thời điểm đăng gần nhất; đặt khi `published`, đặt `null` khi về `draft`, cập nhật khi đăng lại |
| createdAt, updatedAt | datetime | |

**PortfolioImage**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| portfolioId | uuid | |
| url | string | URL hiển thị ảnh |
| thumbnailUrl | string | URL thumbnail |
| isHidden | boolean | Chỉ trả dấu trạng thái cho chủ sở hữu/admin; ảnh ẩn không có trong danh sách công khai |
| width, height | integer | Pixel |
| caption | string \| null | Tối đa 300 ký tự |
| provenance | Provenance | Mặc định `captured` |
| tags | Tag[] | Chỉ đọc ở v0.2; cách gán tag **[?]** |
| sortOrder | integer | Bắt đầu từ 0 |
| createdAt | datetime | |

---

## 4. Hồ sơ cá nhân

### GET /v1/me

**Mục đích:** Lấy thông tin người đang đăng nhập, gồm role.
**Màn hình dùng:** Mọi màn hình sau đăng nhập (khởi tạo app, quyết định menu).
**Quyền:** Đăng nhập.
**Response 200:**

```json
{
  "data": {
    "id": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11",
    "email": "an@example.com",
    "displayName": "Nguyễn An",
    "avatarUrl": null,
    "roles": ["user", "photographer"],
    "photographerId": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
    "createdAt": "2026-10-14T03:12:00Z"
  }
}
```

**Lỗi:** 401.
**Ghi chú:** Lần gọi đầu sau khi đăng ký, nếu chưa có dòng profile thì BE tạo profile; `user` là role mặc định được suy ra. Quyết định tạo profile bằng trigger DB hay tại lần gọi `/me` đầu tiên vẫn còn mở (mục 20).

### PATCH /v1/me

**Mục đích:** Cập nhật tên hiển thị và ảnh đại diện.
**Màn hình dùng:** Cài đặt tài khoản.
**Quyền:** Đăng nhập, chỉ sửa chính mình.
**Request body:**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| displayName | string | không | 1–60 ký tự |
| avatarStoragePath | string \| null | không | Đường dẫn file đã upload trong bucket `avatars`; `null` để gỡ avatar nếu cho phép |

```json
{ "displayName": "An Nguyễn" }
```

**Response 200:** `{ "data": Profile }`
**Lỗi:** 400, 401.

### GET /v1/me/studios

**Mục đích:** Danh sách studio chưa soft-delete mà mình là thành viên, kèm vai trò trong studio.
**Màn hình dùng:** Menu chuyển ngữ cảnh studio, trang quản lý studio.
**Quyền:** Đăng nhập.
**Response 200:** `{ "data": [{ "studio": StudioSummary, "role": StudioMemberRole }] }` (không phân trang).
**Lỗi:** 401.

---

## 5. Photographer

### GET /v1/photographers

**Mục đích:** Danh sách photographer công khai.
**Màn hình dùng:** Danh sách photographer, bộ lọc ở Explore.
**Quyền:** Công khai.
**Query:**

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| genre | Genre | Lọc một thể loại |
| city | string | |
| district | string | |
| studioId | uuid | Chỉ lấy thành viên của studio này |
| q | string | Tìm theo tên (khớp chuỗi, **chưa phải AI Search**) |
| page, pageSize | integer | Xem 2.2 |

**Response 200:**

```json
{
  "data": [
    {
      "id": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
      "userId": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11",
      "displayName": "An Studio",
      "avatarUrl": null,
      "bio": "Chuyên portrait tone lạnh.",
      "genres": ["portrait", "fashion"],
      "styles": ["tone lạnh", "film"],
      "professionalRoles": ["retoucher", "art_director"],
      "city": "TP. Hồ Chí Minh",
      "district": "Thủ Đức",
      "priceFrom": 1500000,
      "coverImageUrl": "https://.../cover.webp",
      "portfolioCount": 3,
      "ratingAvg": 4.8,
      "reviewCount": 12,
      "createdAt": "2026-10-14T03:12:00Z",
      "updatedAt": "2026-10-14T03:12:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

**Lỗi:** 400.

### GET /v1/photographers/:id

**Mục đích:** Chi tiết một photographer kèm các portfolio đã đăng và các studio đang tham gia.
**Màn hình dùng:** Hồ sơ photographer.
**Quyền:** Công khai.
**Response 200:** `{ "data": Photographer & { "portfolios": Portfolio[], "studios": StudioSummary[] } }` (chỉ các portfolio `published`, không có `images`).
**Lỗi:** 404.

### POST /v1/photographers/me

**Mục đích:** Người dùng tạo hồ sơ photographer cho chính mình; `photographer` trong `/me.roles` được suy ra từ hồ sơ này, không lưu trùng như role độc lập.
**Màn hình dùng:** Đăng ký làm photographer.
**Quyền:** Đăng nhập, chưa có hồ sơ photographer.
**Request body:**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| displayName | string | có | 1–60 ký tự |
| bio | string | không | Tối đa 1000 ký tự |
| genres | Genre[] | có | 1–5 phần tử |
| styles | string[] | không | Tối đa 10 |
| professionalRoles | ProfessionalRole[] | không | Vai trò chuyên môn bổ sung chỉ để hiển thị; ví dụ `retoucher`, `art_director` |
| city | string | không | |
| district | string | không | |
| avatarStoragePath | string | không | Đường dẫn trong bucket `avatars` |
| coverStoragePath | string | không | Đường dẫn trong bucket `profile-covers` |

`priceFrom` không nhận trong request; BE/DB tự tính từ giá thấp nhất của các dịch vụ đang hoạt động của photographer.

```json
{
  "displayName": "An Studio",
  "bio": "Chuyên portrait tone lạnh.",
  "genres": ["portrait", "fashion"],
  "styles": ["tone lạnh", "film"],
  "professionalRoles": ["retoucher", "art_director"],
  "city": "TP. Hồ Chí Minh",
  "district": "Thủ Đức",
  "avatarStoragePath": "user-123/avatar.webp",
  "coverStoragePath": "user-123/cover.webp"
}
```

**Response 201:** `{ "data": Photographer }`
**Lỗi:** 400, 401, 409 `CONFLICT` (đã có hồ sơ).

### PATCH /v1/photographers/me

**Mục đích:** Cập nhật hồ sơ photographer của mình.
**Màn hình dùng:** Chỉnh sửa hồ sơ photographer.
**Quyền:** `photographer`, chỉ sửa chính mình.
**Request body:** các trường editable như `POST`, đều tuỳ chọn. Nhận `avatarStoragePath` và `coverStoragePath`, không nhận URL. `priceFrom` là chỉ đọc và không nhận trong request.
**Response 200:** `{ "data": Photographer }`
**Lỗi:** 400, 401, 403, 404.

---

## 6. Portfolio

### GET /v1/portfolios

**Mục đích:** Danh sách portfolio.
**Màn hình dùng:** Portfolio của tôi, portfolio của photographer hoặc studio.
**Quyền:** Công khai cho `published`. Khi truyền `mine=true` cần đăng nhập, trả portfolio do chính người dùng sở hữu qua hồ sơ photographer hoặc studio mà họ quản lý, gồm `draft` và `hidden` (có đánh dấu); không trả portfolio đã soft-delete.
**Query:**

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| photographerId | uuid | Lọc portfolio của photographer |
| studioId | uuid | Lọc portfolio của studio |
| genre | Genre | |
| mine | boolean | `true` lấy portfolio của mình, gồm `draft` |
| status | PortfolioStatus | Chỉ dùng được với `mine=true` |
| page, pageSize | integer | |

**Response 200:** `{ "data": Portfolio[], "meta": {...} }` (không có `images`).
**Lỗi:** 400, 401 (khi `mine=true` mà chưa đăng nhập).

### GET /v1/portfolios/:id

**Mục đích:** Chi tiết portfolio kèm toàn bộ ảnh.
**Màn hình dùng:** Chi tiết portfolio.
**Quyền:** Công khai nếu `published`; `draft` và `hidden` chỉ chủ sở hữu (và admin) thấy. Portfolio đã soft-delete luôn bị loại khỏi API thông thường và trả 404.
**Response 200:**

```json
{
  "data": {
    "id": "e41d7c3a-6b2f-4c9a-b7a1-2f3d4e5a6b70",
    "ownerType": "photographer",
    "photographerId": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
    "studioId": null,
    "title": "Chân dung mùa đông",
    "genre": "portrait",
    "description": "Concept tone lạnh, ánh sáng cửa sổ.",
    "status": "published",
    "coverImageId": "a91b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    "coverImageUrl": "https://.../img1.webp",
    "imageCount": 2,
    "publishedAt": "2026-10-14T04:05:00Z",
    "images": [
      {
        "id": "a91b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        "portfolioId": "e41d7c3a-6b2f-4c9a-b7a1-2f3d4e5a6b70",
        "url": "https://.../img1.webp",
        "thumbnailUrl": "https://.../img1_thumb.webp",
        "width": 1280,
        "height": 1920,
        "caption": "Cửa sổ buổi sáng",
        "provenance": "captured",
        "tags": [],
        "sortOrder": 0,
        "isHidden": false,
        "createdAt": "2026-10-14T04:00:00Z"
      }
    ],
    "createdAt": "2026-10-14T03:50:00Z",
    "updatedAt": "2026-10-14T04:05:00Z"
  }
}
```

**Lỗi:** 404 (không tồn tại hoặc không được xem).

### POST /v1/portfolios

**Mục đích:** Tạo portfolio mới ở trạng thái `draft`.
**Màn hình dùng:** Tạo portfolio.
**Quyền:** `photographer`.
**Request body:**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| title | string | có | 1–120 ký tự |
| genre | Genre | có | |
| description | string | không | Tối đa 2000 ký tự |

```json
{ "title": "Chân dung mùa đông", "genre": "portrait", "description": "Concept tone lạnh." }
```

**Response 201:** `{ "data": Portfolio }`
**Lỗi:** 400, 401, 403.
**Ghi chú:** `ownerType = photographer`; `photographerId` lấy từ token, không nhận từ client.

### POST /v1/studios/:id/portfolios

**Mục đích:** Tạo portfolio thuộc studio, trạng thái `draft`.
**Quyền:** Manager của studio đó.
**Request body:** `title`, `genre` (bắt buộc); `description` (tuỳ chọn).
**Response 201:** `{ "data": Portfolio }` với `ownerType = "studio"`, `studioId` là ID trên URL và `photographerId = null`.
**Lỗi:** 400, 401, 403, 404.

### PATCH /v1/portfolios/:id

**Mục đích:** Sửa thông tin hoặc đổi trạng thái (đăng/gỡ).
**Màn hình dùng:** Chỉnh sửa portfolio.
**Quyền:** Chủ sở hữu portfolio (photographer sở hữu hoặc manager studio sở hữu).
**Request body:** `title`, `genre`, `description`, `status` (`draft` hoặc `published`), `coverImageId` (đều tuỳ chọn). Không nhận `coverImageUrl` hay `publishedAt` trong request. BE chỉ cho chủ sở hữu sửa; nếu portfolio thuộc studio thì người gọi phải là manager của studio đó.
**Response 200:** `{ "data": Portfolio }`
**Lỗi:** 400, 401, 403, 404, 422.
**Ghi chú:** Chuyển sang `published` yêu cầu portfolio có ít nhất 1 ảnh, nếu không trả 422. Portfolio đang `hidden` (admin ẩn) không tự chuyển lại `published` được, trả 422.

### DELETE /v1/portfolios/:id

**Mục đích:** Xoá mềm portfolio: đánh dấu `deletedAt`, ẩn ngay khỏi API thông thường và đưa vào hàng đợi dọn dẹp sau 30 ngày.
**Quyền:** Chủ sở hữu photographer hoặc manager của studio sở hữu portfolio.
**Response 204:** không có nội dung. Không có API khôi phục trong MVP.
**Lỗi:** 401, 403, 404.

---

## 7. Ảnh portfolio

**Luồng upload (FE làm):**
1. FE tạo ảnh chính WebP, cạnh dài tối đa 1280 px, tối đa 2 MB; đồng thời tạo thumbnail WebP cạnh dài khoảng 320 px.
2. FE upload cả `{userId}/{portfolioId}/{uuid}.webp` và `{userId}/{portfolioId}/{uuid}_thumb.webp` lên bucket công khai `portfolio-images`.
3. FE gọi `POST /v1/portfolios/:id/images` chỉ với `storagePath` của ảnh chính. BE suy ra tên thumbnail và kiểm tra cả hai file tồn tại.

RLS của Storage chỉ cho phép ghi vào thư mục có tên trùng `userId` của mình. Vì bucket `portfolio-images` là công khai, `isHidden`/`status` chỉ điều khiển nội dung API hiển thị; chúng không thu hồi URL Storage trực tiếp. Đây là đánh đổi đã chấp nhận cho MVP.

### POST /v1/portfolios/:id/images

**Mục đích:** Ghi nhận một ảnh đã upload vào portfolio.
**Màn hình dùng:** Tạo/chỉnh sửa portfolio.
**Quyền:** Chủ sở hữu portfolio: photographer của portfolio cá nhân hoặc manager của studio sở hữu portfolio.
**Request body:**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| storagePath | string | có | Đường dẫn trong bucket |
| width | integer | có | |
| height | integer | có | |
| caption | string | không | Tối đa 300 ký tự |
| provenance | Provenance | không | Mặc định `captured` |

```json
{
  "storagePath": "7c1e2b0e-.../e41d7c3a-.../1f2e3d4c.webp",
  "width": 1280,
  "height": 1920,
  "caption": "Cửa sổ buổi sáng",
  "provenance": "captured"
}
```

**Response 201:** `{ "data": PortfolioImage }`
**Lỗi:** 400, 401, 403, 404, 422 (file chưa tồn tại trong Storage, hoặc vượt giới hạn số ảnh **[?]**).
**Ghi chú:** BE kiểm tra `storagePath` thuộc thư mục của người dùng đang thao tác và nằm trong đúng portfolio; đồng thời kiểm tra file thumbnail tương ứng. `sortOrder` mặc định xếp cuối.

### PATCH /v1/portfolios/:id/images/:imageId

**Mục đích:** Sửa chú thích, nguồn gốc ảnh, thứ tự.
**Quyền:** Chủ sở hữu portfolio (photographer sở hữu hoặc manager studio sở hữu).
**Request body:** `caption`, `provenance`, `sortOrder` (đều tuỳ chọn).
**Response 200:** `{ "data": PortfolioImage }`
**Lỗi:** 400, 401, 403, 404.

### DELETE /v1/portfolios/:id/images/:imageId

**Mục đích:** Xoá cứng ảnh khỏi portfolio, gồm bản ghi, ảnh chính và thumbnail trong Storage.
**Quyền:** Chủ sở hữu portfolio (photographer sở hữu hoặc manager studio sở hữu).
**Response 204.**
**Lỗi:** 401, 403, 404.

---

## 8. Explore và Tag

### 8.1 GET /v1/explore

**Mục đích:** Feed khám phá các tác phẩm mới đăng, dùng ở trang chủ.
**Màn hình dùng:** Trang chủ/Explore.
**Quyền:** Công khai.
**Query:** `genre`, `page`, `pageSize` (xem 2.2).
**Response 200:**

```json
{
  "data": [
    {
      "portfolioId": "e41d7c3a-6b2f-4c9a-b7a1-2f3d4e5a6b70",
      "title": "Chân dung mùa đông",
      "genre": "portrait",
      "ownerType": "photographer",
      "coverImageUrl": "https://.../img1.webp",
      "owner": {
        "type": "photographer",
        "id": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
        "displayName": "An Nguyễn Photography",
        "avatarUrl": null
      },
      "publishedAt": "2026-10-14T04:05:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

**Lỗi:** 400.
**Ghi chú:** `owner` có kiểu `ProviderSummary` (photographer hoặc studio, theo `ownerType`). Sắp xếp mới nhất trước. Tìm kiếm bằng ngôn ngữ tự nhiên là endpoint riêng (`POST /v1/search`, mục 18), **không** làm đầy thêm tham số `q` của endpoint này.

### 8.2 Tag

**Tag**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| slug | string | Ví dụ `tone-lanh` |
| name | string | Tên hiển thị |
| kind | string | Nhóm tag theo taxonomy (ví dụ tone, bối cảnh, cảm xúc) **[?]** |

### GET /v1/tags

**Mục đích:** Danh sách tag chuẩn để lọc và gợi ý.
**Màn hình dùng:** Bộ lọc Explore/Search, chọn tag khi chỉnh sửa ảnh.
**Quyền:** Công khai.
**Query:** `kind`, `q` (khớp tên), `page`, `pageSize` (tối đa 100 ở endpoint này).
**Response 200:** `{ "data": Tag[], "meta": {...} }`
**Lỗi:** 400.

---

## 9. Studio

**Studio**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| name | string | 1–80 ký tự |
| description | string \| null | Tối đa 2000 ký tự |
| avatarUrl, coverImageUrl | string \| null | URL response để hiển thị |
| genres | Genre[] | 1–5 thể loại |
| city, district | string \| null | |
| address | string \| null | Tối đa 200 ký tự |
| priceFrom | integer \| null | Chỉ đọc; giá thấp nhất của các dịch vụ đang hoạt động, `null` nếu không có |
| memberCount | integer | |
| portfolioCount | integer | Số portfolio đã `published` thuộc studio |
| ratingAvg | number \| null | Như Photographer |
| reviewCount | integer | |
| isHidden | boolean | Chỉ trả cho chủ hồ sơ và `system_admin`; hồ sơ bị ẩn không xuất hiện công khai (mục 17) |
| createdAt, updatedAt | datetime | |

**StudioMember**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | Id dòng thành viên |
| studioId | uuid | |
| userId | uuid | |
| displayName | string | |
| avatarUrl | string \| null | |
| photographerId | uuid \| null | `null` nếu thành viên chưa có hồ sơ photographer; BE suy ra từ hồ sơ photographer của `userId` |
| role | StudioMemberRole | |
| joinedAt | datetime | |

**StudioInvitation**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| studio | StudioSummary | |
| photographer | PhotographerSummary | Người được mời |
| role | StudioMemberRole | Mặc định `photographer` |
| status | InvitationStatus | |
| createdAt, respondedAt | datetime \| null | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `GET /v1/studios` | Danh sách studio · Explore, trang studio | Công khai | Query: `genre`, `city`, `district`, `q`, `page`, `pageSize` | 200 `Studio[]` + meta · 400 |
| `GET /v1/studios/:id` | Chi tiết studio · Hồ sơ studio | Công khai | | 200 `Studio` · 404 |
| `POST /v1/studios` | Tạo studio, người tạo thành manager đầu tiên · Tạo studio | Đăng nhập | `name`, `genres` (bắt buộc); `description`, `city`, `district`, `address`, `avatarStoragePath`, `coverStoragePath` | 201 `Studio` · 400, 401 |
| `PATCH /v1/studios/:id` | Sửa hồ sơ studio · Quản lý studio | Manager studio | Các trường như POST, đều tuỳ chọn; không nhận `priceFrom` hoặc URL | 200 `Studio` · 400, 401, 403, 404 |
| `DELETE /v1/studios/:id` | Xoá studio (xoá mềm) · Quản lý studio | Manager studio | | 204 · 401, 403, 404, 422 (còn booking chưa kết thúc) |
| `GET /v1/studios/:id/members` | Đội ngũ studio · Hồ sơ studio | Công khai | | 200 `StudioMember[]` (không phân trang) · 404 |
| `PATCH /v1/studios/:id/members/:memberId` | Đổi vai trò thành viên · Quản lý đội ngũ | Manager studio | `role` | 200 `StudioMember` · 400, 401, 403, 404, 422 (không để studio hết manager; không đổi sang `photographer` khi người đó chưa có hồ sơ photographer) |
| `DELETE /v1/studios/:id/members/:memberId` | Xoá cứng quan hệ thành viên, hoặc tự rời studio · Quản lý đội ngũ | Manager studio; hoặc chính thành viên đó | | 204 · 401, 403, 404, 422 (manager cuối cùng không thể rời) |
| `GET /v1/studios/:id/invitations` | Lời mời đã gửi · Quản lý đội ngũ | Manager studio | Query: `status`, `page`, `pageSize` | 200 `StudioInvitation[]` + meta · 401, 403, 404 |
| `POST /v1/studios/:id/invitations` | Mời photographer vào studio · Quản lý đội ngũ | Manager studio | `photographerId` (bắt buộc), `role` (tuỳ chọn) | 201 `StudioInvitation` · 400, 401, 403, 404, 409 (đã là thành viên hoặc đã có lời mời chờ) |
| `DELETE /v1/studios/:id/invitations/:invitationId` | Thu hồi lời mời (không xoá bản ghi; đặt `revoked`) · Quản lý đội ngũ | Manager studio | | 204 · 401, 403, 404, 422 (đã được phản hồi) |
| `GET /v1/me/invitations` | Lời mời gửi cho mình · Thông báo lời mời | `photographer` | Query: `status`, `page`, `pageSize` | 200 `StudioInvitation[]` + meta · 401, 403 |
| `POST /v1/invitations/:id/accept` | Chấp nhận lời mời, BE tạo dòng `studio_members` · Thông báo lời mời | `photographer`, đúng người được mời | | 200 `StudioMember` · 401, 403, 404, 422 (không còn `pending`) |
| `POST /v1/invitations/:id/decline` | Từ chối lời mời · Thông báo lời mời | `photographer`, đúng người được mời | | 204 · 401, 403, 404, 422 |

**Ghi chú:**
- Một photographer có thể thuộc **nhiều studio**; một studio có thể có nhiều manager.
- Studio là bên cung cấp độc lập: ngoài quản lý thành viên/mời photographer, studio có hồ sơ, dịch vụ, portfolio công khai và booking của riêng mình. Manager không bắt buộc phải có hồ sơ photographer.
- Khi tạo studio, BE tạo dòng `studio_members` cho người tạo với `role = manager`; `studio_manager` trong `/me.roles` được suy ra từ quan hệ này với studio chưa soft-delete, không lưu trùng role.
- `priceFrom` do BE/DB tính từ các dịch vụ đang hoạt động; không nhận trong request.
- Mời bằng `photographerId` (người được mời phải có hồ sơ photographer). Mời bằng email **[?]** để sau.
- Ai phân công photographer cho booking của studio: xem mục 12 và mục 20, #8.

---

## 10. Dịch vụ và add-on

**Service**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| ownerType | ProviderType | Chủ dịch vụ là photographer hay studio |
| photographerId | uuid \| null | Có khi `ownerType = photographer` |
| studioId | uuid \| null | Có khi `ownerType = studio` |
| name | string | 1–100 ký tự |
| description | string \| null | Tối đa 1000 ký tự |
| genre | Genre | |
| durationMinutes | integer | > 0 |
| price | integer | ≥ 0, VND, giá tham khảo |
| photoCount | integer \| null | Số ảnh bàn giao dự kiến |
| retouchedCount | integer \| null | Số ảnh chỉnh sửa chi tiết |
| isActive | boolean | `false` thì không hiện công khai, không đặt mới được |
| addOns | AddOn[] | |
| createdAt, updatedAt | datetime | |

**AddOn**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| serviceId | uuid | |
| name | string | 1–100 ký tự |
| description | string \| null | Tối đa 500 ký tự |
| price | integer | ≥ 0 |
| isActive | boolean | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `GET /v1/photographers/:id/services` | Dịch vụ của photographer · Hồ sơ photographer, chọn dịch vụ khi đặt lịch | Công khai (chỉ `isActive`) | Query: `genre`, `includeInactive` (chỉ chủ hồ sơ) | 200 `Service[]` (không phân trang) · 404 |
| `GET /v1/studios/:id/services` | Dịch vụ của studio · Hồ sơ studio | Công khai (chỉ `isActive`) | Như trên; `includeInactive` chỉ manager | 200 `Service[]` · 404 |
| `GET /v1/services/:id` | Chi tiết dịch vụ · Chọn dịch vụ | Công khai nếu `isActive` | | 200 `Service` · 404 |
| `POST /v1/photographers/me/services` | Tạo dịch vụ cho photographer · Quản lý dịch vụ | `photographer` | `name`, `genre`, `durationMinutes`, `price` (bắt buộc); `description`, `photoCount`, `retouchedCount`, `isActive` | 201 `Service` · 400, 401, 403 |
| `POST /v1/studios/:id/services` | Tạo dịch vụ cho studio · Quản lý dịch vụ studio | Manager studio | Như trên | 201 `Service` · 400, 401, 403, 404 |
| `PATCH /v1/services/:id` | Sửa dịch vụ · Quản lý dịch vụ | Chủ dịch vụ (photographer, hoặc manager studio) | Các trường như POST, đều tuỳ chọn | 200 `Service` · 400, 401, 403, 404 |
| `DELETE /v1/services/:id` | Xoá dịch vụ (mềm) · Quản lý dịch vụ | Chủ dịch vụ | | 204 · 401, 403, 404 |
| `POST /v1/services/:id/add-ons` | Thêm add-on · Quản lý dịch vụ | Chủ dịch vụ | `name`, `price` (bắt buộc); `description`, `isActive` | 201 `AddOn` · 400, 401, 403, 404 |
| `PATCH /v1/services/:id/add-ons/:addOnId` | Sửa add-on | Chủ dịch vụ | Như POST, tuỳ chọn | 200 `AddOn` · 400, 401, 403, 404 |
| `DELETE /v1/services/:id/add-ons/:addOnId` | Xoá add-on (mềm) | Chủ dịch vụ | | 204 · 401, 403, 404 |

**Ghi chú:** Booking lưu **bản chụp (snapshot)** tên và giá dịch vụ/add-on lúc đặt, nên sửa hoặc xoá dịch vụ sau đó không đổi booking đã tạo.

---

## 11. Lịch và tài nguyên [Should]

Mục đích: tránh trùng lịch khi studio xác nhận booking. Chốt ở mức khung.

**Resource**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| studioId | uuid | |
| type | ResourceType | |
| name | string | 1–80 ký tự |
| description | string \| null | Tối đa 500 ký tự |
| isActive | boolean | |

**ScheduleEntry**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| type | ScheduleEntryType | `booking` (do BE tạo khi xác nhận booking) hoặc `block` (khoá thủ công) |
| bookingId | uuid \| null | Có khi `type = booking` |
| resourceId | uuid \| null | |
| photographerId | uuid \| null | |
| studioId | uuid \| null | |
| start, end | datetime | Nửa mở `[start, end)` |
| title | string \| null | Với `booking`, chỉ người tham gia booking và thành viên studio thấy tiêu đề |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `GET /v1/studios/:id/resources` | Danh sách phòng, thiết bị · Quản lý tài nguyên | Thành viên studio | Query: `type`, `includeInactive` | 200 `Resource[]` · 401, 403, 404 |
| `POST /v1/studios/:id/resources` | Thêm tài nguyên | Manager studio | `type`, `name` (bắt buộc); `description` | 201 `Resource` · 400, 401, 403, 404 |
| `PATCH /v1/studios/:id/resources/:resourceId` | Sửa tài nguyên | Manager studio | Như POST + `isActive` | 200 `Resource` · 400, 401, 403, 404 |
| `DELETE /v1/studios/:id/resources/:resourceId` | Xoá tài nguyên (mềm) | Manager studio | | 204 · 401, 403, 404, 422 (còn booking tương lai dùng) |
| `GET /v1/studios/:id/schedule` | Lịch studio · Lịch/tài nguyên | Thành viên studio | Query bắt buộc `from`, `to` (tối đa 62 ngày); tuỳ chọn `resourceId`, `photographerId` | 200 `ScheduleEntry[]` (không phân trang) · 400, 401, 403, 404 |
| `POST /v1/studios/:id/schedule/blocks` | Khoá thời gian (bảo trì, nghỉ) | Manager studio | `start`, `end` (bắt buộc), một trong `resourceId` hoặc `photographerId`, `title` | 201 `ScheduleEntry` · 400, 401, 403, 404, 409 (`CONFLICT`, `details[].reason = slot_overlap`) |
| `DELETE /v1/studios/:id/schedule/blocks/:entryId` | Xoá cứng bản ghi block, mở lại thời gian đã khoá | Manager studio | | 204 · 401, 403, 404 |
| `GET /v1/photographers/:id/availability` | Khoảng bận của photographer, **không lộ chi tiết** · Chọn lịch khi đặt | Công khai | Query bắt buộc `from`, `to` (tối đa 62 ngày) | 200 `{ "data": { "busy": [{ "start", "end" }] } }` · 400, 404 |
| `POST /v1/photographers/me/schedule/blocks` | Photographer độc lập tự khoá lịch **[?]** | `photographer` | `start`, `end`, `title` | 201 `ScheduleEntry` · 400, 401, 403, 409 (`CONFLICT`, `details[].reason = slot_overlap`) |
| `DELETE /v1/photographers/me/schedule/blocks/:entryId` | Xoá cứng bản ghi block, mở lại lịch | `photographer` | | 204 · 401, 403, 404 |

**Quy tắc chống trùng:** hai `ScheduleEntry` trùng nếu cùng `resourceId` hoặc cùng `photographerId` và khoảng thời gian giao nhau. Khi xác nhận booking (mục 12.4) BE kiểm tra; trùng thì trả 409 `CONFLICT` với `details[].reason = "slot_overlap"` và `details[].message` là câu giải thích cho người dùng.

---

## 12. Booking và Shoot Brief

### 12.1 Đối tượng

**Booking**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| customer | UserSummary | |
| providerType | ProviderType | Bên cung cấp là photographer hay studio |
| photographer | PhotographerSummary \| null | Có khi `providerType = photographer` |
| studio | StudioSummary \| null | Có khi `providerType = studio` |
| assignedPhotographer | PhotographerSummary \| null | Booking của studio: photographer được phân công (**[?]** ai phân công: mục 20, #8) |
| service | object | Snapshot: `{ id, name, price, durationMinutes }` |
| addOns | object[] | Snapshot: `[{ id, name, price }]` |
| totalPrice | integer | `service.price` + tổng add-on, BE tính. Giá tham khảo, không thanh toán trong hệ thống |
| status | BookingStatus | |
| scheduledStart, scheduledEnd | datetime \| null | Có từ khi `confirmed` |
| resourceIds | uuid[] | Phòng/thiết bị đã giữ (booking của studio) |
| currentBriefVersion | integer | Số phiên bản brief mới nhất |
| agreedBriefVersion | integer \| null | Phiên bản cả hai bên đã chấp thuận; `null` nếu chưa |
| shootRoomId | uuid \| null | Có từ khi `confirmed` |
| statusReason | string \| null | Lý do từ chối/huỷ |
| createdAt, updatedAt | datetime | |

**BriefVersion** (bất biến; sửa brief nghĩa là tạo phiên bản mới)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| version | integer | Bắt đầu từ 1 |
| createdBy | UserSummary | |
| content | BriefContent | `content.references` chứa storage path ổn định |
| referenceUrls | string[] | Chỉ trong response đọc brief; signed URL ứng với `content.references` theo cùng thứ tự |
| approvedByCustomer | boolean | |
| approvedByProvider | boolean | |
| createdAt | datetime | |

**BriefContent** (Shoot Brief)

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| genre | Genre | có | |
| concept | string | có | 1–2000 ký tự: ý tưởng, mood, yêu cầu |
| locationType | LocationType | có | |
| locationNote | string \| null | không | Địa điểm cụ thể, tối đa 300 ký tự |
| preferredStart, preferredEnd | datetime \| null | không | Khung giờ khách mong muốn |
| peopleCount | integer \| null | không | ≥ 1 |
| references | string[] | không | `storagePath` trong bucket riêng tư `brief-references`, tối đa 10; khi đọc brief BE cấp signed URL theo thứ tự tương ứng |
| revisionRounds | integer | không | Số vòng sửa thêm sau vòng đầu, số nguyên ≥ 0; mặc định 1 |
| photoCount | integer \| null | không | Số ảnh mong muốn |
| retouchedCount | integer \| null | không | Số ảnh chỉnh sửa |
| budget | integer \| null | không | VND |
| notes | string \| null | không | Tối đa 1000 ký tự |

**BookingStatusEvent**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| bookingId | uuid | |
| fromStatus | BookingStatus | Trạng thái trước chuyển đổi; event chỉ ghi các lần chuyển trạng thái |
| toStatus | BookingStatus | Trạng thái mới |
| actor | UserSummary \| null | `null` nếu do hệ thống thực hiện |
| reason | string \| null | Lý do nếu có |
| createdAt | datetime | Thời điểm sự kiện |

Mỗi lần booking chuyển trạng thái hợp lệ, BE phải cập nhật `Booking.status` và ghi `BookingStatusEvent` trong cùng transaction. Sự kiện có thể được dùng để sinh tin nhắn `system` trong Shoot Room; việc tạo tin hệ thống không được làm thay đổi lịch sử sự kiện.

### 12.2 Endpoint

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `POST /v1/bookings` | Gửi yêu cầu đặt lịch kèm Shoot Brief đầu tiên (version 1), trạng thái `pending` · Đặt lịch | Đăng nhập | Xem ví dụ dưới | 201 `Booking` · 400, 401, 404 (dịch vụ/bên cung cấp không tồn tại hoặc `isActive = false`), 422 (đặt cho chính mình, dịch vụ không thuộc bên cung cấp, bên cung cấp đang bị ẩn) |
| `GET /v1/bookings` | Danh sách booking của tôi · Booking của tôi, quản lý booking | Đăng nhập | Query: `as` (`customer` mặc định, hoặc `provider`), `status`, `studioId` (với `as=provider`, manager lấy booking của studio), `page`, `pageSize` | 200 `Booking[]` + meta · 400, 401, 403 |
| `GET /v1/bookings/:id` | Chi tiết booking · Chi tiết booking | Người tham gia booking; manager của studio nếu là booking studio | | 200 `Booking` · 401, 404 |
| `GET /v1/bookings/:id/events` | Lịch sử chuyển trạng thái booking | Người tham gia booking | | 200 `BookingStatusEvent[]` theo thời gian tăng dần · 401, 404 |
| `POST /v1/bookings/:id/transitions` | Chuyển trạng thái (bảng 12.4) · Các nút hành động trong chi tiết booking | Tuỳ bước chuyển | `{ "to": BookingStatus, ... }` | 200 `Booking` · 400, 401, 403, 404, 409 (`CONFLICT`, `details[].reason = slot_overlap`), 422 |
| `PATCH /v1/bookings/:id/assignment` | Phân công photographer cho booking của studio · Quản lý booking studio | Manager studio của booking | `assignedPhotographerId` (phải là thành viên studio) | 200 `Booking` · 400, 401, 403, 404, 422 (booking không phải của studio, hoặc đã `proofing` trở đi) |
| `GET /v1/bookings/:id/brief` | Toàn bộ các phiên bản brief · Shoot Brief | Người tham gia booking | | 200 `{ "data": { "versions": BriefVersion[], "currentVersion": integer, "agreedVersion": integer \| null } }`; BE cấp `referenceUrls` signed cho ảnh tham chiếu · 401, 404 |
| `POST /v1/bookings/:id/brief/versions` | Đề xuất phiên bản brief mới; người gửi tự động được tính là đã chấp thuận, bên kia chưa · Sửa Shoot Brief | Người tham gia booking | `BriefContent` | 201 `BriefVersion` · 400, 401, 403, 404, 422 (trạng thái không cho sửa) |
| `POST /v1/bookings/:id/brief/versions/:version/approve` | Chấp thuận một phiên bản brief. Khi cả hai bên đã chấp thuận, `agreedBriefVersion` được cập nhật · Shoot Brief | Người tham gia booking (bên chưa chấp thuận) | | 200 `BriefVersion` · 401, 403, 404, 409 (đã chấp thuận), 422 (không phải phiên bản mới nhất) |

`GET /v1/bookings?as=provider` trả: booking mà mình là photographer chủ hồ sơ; booking của studio mà mình được phân công; và, khi truyền `studioId`, toàn bộ booking của studio đó nếu mình là manager (403 nếu không phải manager). Thành viên studio khác không thấy booking không liên quan đến mình.

Brief chỉ được tạo phiên bản mới khi booking ở `pending`, `confirmed` hoặc `in_progress`; ngoài ra trả 422.

Ảnh tham chiếu phải được upload trước khi tạo booking vào bucket riêng tư `brief-references` theo `{userId}/{uuid}.webp`; request `brief.references` gửi các `storagePath`, không gửi URL. BE kiểm tra đường dẫn thuộc người gửi và file tồn tại. Khi đọc brief, chỉ người tham gia booking được nhận signed URL.

**Ví dụ `POST /v1/bookings`:**

```json
{
  "providerType": "photographer",
  "photographerId": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
  "studioId": null,
  "serviceId": "c5d6e7f8-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  "addOnIds": [],
  "brief": {
    "genre": "portrait",
    "concept": "Chân dung tone lạnh, ánh sáng cửa sổ buổi sáng.",
    "locationType": "studio",
    "locationNote": null,
    "preferredStart": "2026-11-02T02:00:00Z",
    "preferredEnd": "2026-11-02T04:00:00Z",
    "peopleCount": 1,
    "references": [],
    "photoCount": 20,
    "retouchedCount": 10,
    "budget": 2000000,
    "notes": null
  }
}
```

Quy tắc: `providerType = photographer` thì bắt buộc `photographerId`; `= studio` thì bắt buộc `studioId` (và `photographerId` phải là `null`).

### 12.3 Ví dụ `POST /v1/bookings/:id/transitions`

```json
{
  "to": "confirmed",
  "scheduledStart": "2026-11-02T02:00:00Z",
  "scheduledEnd": "2026-11-02T04:00:00Z",
  "resourceIds": ["d1e2f3a4-5b6c-4d7e-8f9a-0b1c2d3e4f5a"],
  "assignedPhotographerId": null
}
```

### 12.4 Bảng chuyển trạng thái booking

Chuyển không có trong bảng trả 422 `UNPROCESSABLE`.

| Từ | Đến | Ai chuyển | Body cần | Điều kiện và tác dụng phụ |
|---|---|---|---|---|
| `pending` | `confirmed` | Bên cung cấp | `scheduledStart`, `scheduledEnd`; `resourceIds` (tuỳ chọn); `assignedPhotographerId` (booking studio, nếu chưa phân công) | Không trùng lịch (409). Booking studio phải có photographer được phân công. BE tạo `ScheduleEntry` và Shoot Room, đặt `shootRoomId` |
| `pending` | `rejected` | Bên cung cấp | `reason` | |
| `pending` | `cancelled` | Khách | `reason` (tuỳ chọn) | |
| `confirmed` | `cancelled` | Khách hoặc bên cung cấp | `reason` | Giải phóng lịch, đóng Shoot Room. Quy định huỷ **[?]** |
| `confirmed` | `in_progress` | Bên cung cấp | | Phải có `agreedBriefVersion` (422 nếu chưa) |
| `in_progress` | `proofing` | Bên cung cấp | | Có gallery `draft` với ít nhất 1 ảnh; gallery chuyển `open_for_selection` (mục 14) |
| `in_progress` | `cancelled` | Bên cung cấp | `reason` | |
| `proofing` | `delivered` | Bên cung cấp | | Gallery phải `selection_submitted`; delivery có ít nhất 1 file. Gallery chuyển `finalized`, delivery chuyển `delivered` |
| `delivered` | `completed` | Khách | | Mở quyền viết review. Tự động hoàn tất sau một thời gian nếu khách không xác nhận **[?]** |

Booking đã `rejected`, `cancelled` hoặc `completed` là trạng thái cuối. Shoot Room của booking `cancelled` hoặc `completed` chuyển sang chỉ đọc.

Từ `proofing` trở đi không có đường huỷ trong MVP (cố ý: ảnh đã chọn/bàn giao). Trường hợp khách không phản hồi ở `proofing` hoặc `delivered` được chốt cùng chính sách tự động hoàn tất (mục 20, #9).

---

## 13. Shoot Room

Shoot Room được BE tạo tự động khi booking sang `confirmed`; `Booking.shootRoomId` cho biết id. **Người tham gia phòng:** khách và bên cung cấp của booking (photographer chủ hồ sơ hoặc được phân công, manager của studio). Thành viên studio khác không vào được **[?]** (mục 20, #11).

**ShootRoom**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| bookingId | uuid | |
| status | `open` \| `closed` | `closed` là chỉ đọc |
| participants | object[] | `[{ "user": UserSummary, "side": "customer" \| "provider" }]` |
| createdAt | datetime | |

**Message**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| roomId | uuid | |
| sender | UserSummary \| null | `null` với tin hệ thống |
| type | MessageType | |
| body | string \| null | Tối đa 2000 ký tự |
| attachments | object[] | `[{ "url", "thumbnailUrl", "width", "height" }]`; mỗi tin tối đa 5 |
| isHidden | boolean | `true` với tin bị ẩn; response phải có `body: null`, `attachments: []` |
| createdAt | datetime | |

**Decision** (nhật ký quyết định)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| roomId | uuid | |
| title | string | 1–120 ký tự |
| content | string | 1–1000 ký tự |
| status | DecisionStatus | |
| proposedBy | UserSummary | |
| respondedBy | UserSummary \| null | Người của bên còn lại đã phản hồi |
| createdAt, respondedAt | datetime \| null | |

**Milestone**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| roomId | uuid | |
| title | string | 1–120 ký tự |
| dueAt | datetime \| null | Hạn |
| status | MilestoneStatus | |
| doneAt | datetime \| null | |
| createdBy | UserSummary | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `GET /v1/shoot-rooms/:id` | Thông tin phòng · Shoot Room | Người tham gia | | 200 `ShootRoom` · 401, 404 |
| `GET /v1/shoot-rooms/:id/messages` | Lịch sử tin nhắn, phân trang theo con trỏ · Shoot Room | Người tham gia | Query: `limit`, `before` | 200 `Message[]` + meta con trỏ (xem 2.2) · 401, 404 |
| `POST /v1/shoot-rooms/:id/messages` | Gửi tin nhắn (FE nhận qua Realtime, mục 2.7) · Shoot Room | Người tham gia | `type` (`text` hoặc `image`), `body` và/hoặc `attachments: [{ storagePath, width, height }]` (bucket `room-files`; với ảnh phải upload cả ảnh chính và thumbnail) | 201 `Message` · 400, 401, 404, 422 (phòng đã `closed`) |
| `GET /v1/shoot-rooms/:id/decisions` | Nhật ký quyết định · Shoot Room | Người tham gia | Query: `status`, `page`, `pageSize` | 200 `Decision[]` + meta · 401, 404 |
| `POST /v1/shoot-rooms/:id/decisions` | Đề xuất một quyết định | Người tham gia | `title`, `content` | 201 `Decision` · 400, 401, 404, 422 |
| `POST /v1/shoot-rooms/:id/decisions/:decisionId/respond` | Phản hồi quyết định do bên kia đề xuất | Người tham gia thuộc **bên còn lại** | `{ "response": "agreed" \| "rejected" }` | 200 `Decision` · 400, 401, 403, 404, 422 (đã phản hồi) |
| `GET /v1/shoot-rooms/:id/milestones` | Danh sách milestone · Shoot Room, timeline | Người tham gia | Không phân trang; sắp theo `dueAt` | 200 `Milestone[]` · 401, 404 |
| `POST /v1/shoot-rooms/:id/milestones` | Thêm milestone | Người tham gia | `title` (bắt buộc), `dueAt` | 201 `Milestone` · 400, 401, 404, 422 |
| `PATCH /v1/shoot-rooms/:id/milestones/:milestoneId` | Sửa milestone, đánh dấu xong | Người tham gia | `title`, `dueAt`, `status` | 200 `Milestone` · 400, 401, 404, 422 |
| `DELETE /v1/shoot-rooms/:id/milestones/:milestoneId` | Xoá cứng milestone | Người tạo milestone | | 204 · 401, 403, 404, 422 |

**Ví dụ tin nhắn (đồng thời là payload Realtime):**

```json
{
  "data": {
    "id": "f0a1b2c3-d4e5-4f60-8a7b-9c8d7e6f5a4b",
    "roomId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    "sender": { "id": "7c1e2b0e-3f5a-4a52-9a3b-0c4f2a7f9d11", "displayName": "Nguyễn An", "avatarUrl": null },
    "type": "text",
    "body": "Mình muốn đổi giờ chụp sang 9h sáng được không?",
    "attachments": [],
    "isHidden": false,
    "createdAt": "2026-10-20T08:15:00Z"
  }
}
```

Mọi thao tác ghi trên phòng `closed` trả 422. Với tin nhắn bị admin ẩn, API lịch sử vẫn giữ vị trí tin nhưng trả `isHidden: true`, `body: null`, `attachments: []`; không trả nội dung gốc cho người tham gia thông thường.

---

## 14. Chọn ảnh (proofing)

**Gallery**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| bookingId | uuid | Mỗi booking một gallery |
| status | GalleryStatus | `draft` → `open_for_selection` → `selection_submitted` → `finalized` |
| selectionLimit | integer \| null | Số ảnh tối đa khách được chọn; `null` là không giới hạn |
| imageCount | integer | |
| selectedCount | integer | |
| submittedAt | datetime \| null | |
| round | integer | Bắt đầu từ 1; tăng 1 mỗi lần `selection/reopen` được chấp nhận |
| createdAt, updatedAt | datetime | |

**GalleryImage** (ảnh preview)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| galleryId | uuid | |
| previewUrl | string | Signed URL, hết hạn |
| thumbnailUrl | string | Signed URL, hết hạn |
| width, height | integer | |
| sortOrder | integer | |
| isSelected | boolean | Theo lựa chọn hiện tại của khách |
| noteCount | integer | Số ghi chú trên ảnh |

**ImageNote** (ghi chú trên ảnh)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| galleryImageId | uuid | |
| author | UserSummary | |
| body | string | 1–500 ký tự |
| x, y | number \| null | Vị trí ghim trên ảnh, tỉ lệ 0–1; `null` là ghi chú chung cho ảnh |
| createdAt | datetime | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `POST /v1/bookings/:id/gallery` | Tạo gallery `draft` khi booking `in_progress` · Quản lý gallery | Bên cung cấp | `selectionLimit` (tuỳ chọn) | 201 `Gallery` · 401, 403, 404, 409 (đã có), 422 (sai trạng thái booking) |
| `GET /v1/bookings/:id/gallery` | Xem gallery · Chọn ảnh | Người tham gia booking | | 200 `Gallery` · 401, 404 (khách chưa thấy được khi gallery còn `draft`) |
| `PATCH /v1/galleries/:id` | Đổi giới hạn chọn | Bên cung cấp | `selectionLimit` | 200 `Gallery` · 400, 401, 403, 404, 422 |
| `GET /v1/galleries/:id/images` | Danh sách ảnh preview · Chọn ảnh | Người tham gia booking | Query: `page`, `pageSize` (tối đa 100 ở endpoint này) | 200 `GalleryImage[]` + meta · 401, 404 |
| `POST /v1/galleries/:id/images` | Ghi nhận preview đã upload (bucket `gallery-previews`) | Bên cung cấp | `storagePath` ảnh chính, `width`, `height`; BE suy ra `storagePath` thumbnail và kiểm tra cả hai file | 201 `GalleryImage` · 400, 401, 403, 404, 422 |
| `DELETE /v1/galleries/:id/images/:imageId` | Xoá cứng preview, bản ghi ảnh và cả file chính/thumbnail | Bên cung cấp | | 204 · 401, 403, 404, 422 (chỉ khi `draft`) |
| `PUT /v1/galleries/:id/selection` | Lưu lựa chọn hiện tại (thay toàn bộ danh sách) · Chọn ảnh | Khách của booking | `{ "imageIds": uuid[] }` | 200 `{ "data": { "selectedCount": integer } }` · 400, 401, 403, 404, 422 (vượt `selectionLimit`, hoặc gallery không ở `open_for_selection`) |
| `POST /v1/galleries/:id/selection/submit` | Gửi lựa chọn, khoá lại · Chọn ảnh | Khách của booking | | 200 `Gallery` (`selection_submitted`) · 401, 403, 404, 422 |
| `POST /v1/galleries/:id/selection/reopen` | Mở lại cho khách chọn lại trong giới hạn vòng sửa | Bên cung cấp | | 200 `Gallery` (`open_for_selection`) · 401, 403, 404, 422 (đã hết số vòng sửa thêm) |
| `GET /v1/galleries/:id/images/:imageId/notes` | Ghi chú trên ảnh | Người tham gia booking | Không phân trang | 200 `ImageNote[]` · 401, 404 |
| `POST /v1/galleries/:id/images/:imageId/notes` | Thêm ghi chú | Người tham gia booking | `body` (bắt buộc), `x`, `y` | 201 `ImageNote` · 400, 401, 403, 404, 422 (gallery `finalized`) |
| `DELETE /v1/galleries/:id/images/:imageId/notes/:noteId` | Xoá cứng ghi chú ảnh | Tác giả ghi chú | | 204 · 401, 403, 404 |

**Ghi chú:** Gallery `finalized` do hệ thống đặt khi booking sang `delivered`; không có endpoint đặt trực tiếp. `round` khởi tạo bằng 1. Mỗi lần `selection/reopen` được chấp nhận thì tăng `round`; `selection/submit` không tăng. `revisionRounds` lấy từ brief đã được hai bên thống nhất, mặc định 1, là số lần mở lại được phép sau vòng đầu. Khi đã dùng hết số lần này, BE trả 422.

---

## 15. Bàn giao

**Delivery**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| bookingId | uuid | Mỗi booking một delivery |
| status | DeliveryStatus | |
| note | string \| null | Lời nhắn của bên cung cấp, tối đa 1000 ký tự |
| items | DeliveryItem[] | |
| deliveredAt | datetime \| null | Đặt khi booking sang `delivered` |
| expiresAt | datetime \| null | Hạn tải xuống **[?]** |

**DeliveryItem**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| fileName | string | |
| mimeType | string | Ảnh `image/jpeg`, `image/png`, `image/webp` |
| sizeBytes | integer | |
| galleryImageId | uuid \| null | Ảnh preview tương ứng, nếu có |
| createdAt | datetime | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `POST /v1/bookings/:id/delivery` | Tạo delivery `preparing` · Bàn giao | Bên cung cấp | `note` (tuỳ chọn) | 201 `Delivery` · 401, 403, 404, 409 (đã có), 422 (booking chưa `proofing`) |
| `GET /v1/bookings/:id/delivery` | Xem delivery · Bàn giao, tải ảnh | Bên cung cấp bất kỳ lúc nào; khách chỉ khi `delivered` | | 200 `Delivery` · 401, 404 |
| `POST /v1/bookings/:id/delivery/items` | Ghi nhận file đã upload vào `deliveries` | Bên cung cấp | `storagePath`, `fileName`, `mimeType`, `sizeBytes` (bắt buộc); `galleryImageId` | 201 `DeliveryItem` · 400, 401, 403, 404, 422 (không còn `preparing`, hoặc vượt giới hạn **[?]**) |
| `DELETE /v1/bookings/:id/delivery/items/:itemId` | Xoá cứng file khỏi delivery và Storage | Bên cung cấp | | 204 · 401, 403, 404, 422 (chỉ khi `preparing`) |
| `GET /v1/bookings/:id/delivery/items/:itemId/download` | Lấy đường dẫn tải về, signed URL ngắn hạn | Bên cung cấp; khách khi `delivered` | | 200 `{ "data": { "url": string, "expiresAt": datetime } }` · 401, 403, 404 |

**Ghi chú:** MVP không lưu RAW. Ảnh bàn giao là ảnh đã xử lý, giới hạn dung lượng theo mục 20, #12.

---

## 16. Review

**Review**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| bookingId | uuid | Mỗi booking một review |
| reviewer | UserSummary | |
| targetType | ProviderType | Review dành cho photographer hay studio |
| photographerId | uuid \| null | |
| studioId | uuid \| null | |
| rating | integer | 1–5 |
| comment | string \| null | Tối đa 1000 ký tự |
| createdAt, updatedAt | datetime | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `POST /v1/bookings/:id/reviews` | Viết review cho bên cung cấp của booking · Review | Khách của booking | `rating` (bắt buộc), `comment` | 201 `Review` · 400, 401, 403, 404, 409 (đã review), 422 (booking chưa `completed`) |
| `GET /v1/photographers/:id/reviews` | Review của photographer · Hồ sơ photographer | Công khai | Query: `page`, `pageSize` | 200 `Review[]` + meta · 404 |
| `GET /v1/studios/:id/reviews` | Review của studio · Hồ sơ studio | Công khai | Query: `page`, `pageSize` | 200 `Review[]` + meta · 404 |
| `PATCH /v1/reviews/:id` | Sửa review của mình **[?]** | Tác giả | `rating`, `comment` | 200 `Review` · 400, 401, 403, 404 |
| `DELETE /v1/reviews/:id` | Xoá review (mềm) | Tác giả; `system_admin` | | 204 · 401, 403, 404 |

**Ghi chú:** `ratingAvg` và `reviewCount` của photographer/studio cập nhật khi review thay đổi. Phản hồi của bên cung cấp cho review **[?]** (mục 20, #13).

---

## 17. Báo cáo nội dung và quản trị [Should]

**Report**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| reporter | UserSummary | |
| targetType | ReportTargetType | |
| targetId | uuid | |
| reason | ReportReason | |
| detail | string \| null | Tối đa 1000 ký tự |
| status | ReportStatus | |
| resolution | ReportResolution \| null | |
| adminNote | string \| null | Tối đa 1000 ký tự |
| createdAt, resolvedAt | datetime \| null | |

| Endpoint | Mục đích · màn hình | Quyền | Request | Response · Lỗi |
|---|---|---|---|---|
| `POST /v1/reports` | Báo cáo nội dung vi phạm · Nút "Báo cáo" ở portfolio, ảnh, review, tin nhắn, hồ sơ | Đăng nhập | `targetType`, `targetId`, `reason` (bắt buộc); `detail` | 201 `Report` · 400, 401, 404, 409 (mình đã báo cáo đối tượng này và còn `open`) |
| `GET /v1/admin/reports` | Hàng đợi báo cáo · Admin | `system_admin` | Query: `status`, `targetType`, `reason`, `page`, `pageSize` | 200 `Report[]` + meta · 401, 403 |
| `GET /v1/admin/reports/:id` | Chi tiết báo cáo kèm nội dung bị báo cáo | `system_admin` | | 200 `{ "data": Report & { "target": object } }` · 401, 403, 404 |
| `POST /v1/admin/reports/:id/resolve` | Xử lý báo cáo | `system_admin` | `resolution` (bắt buộc), `adminNote` | 200 `Report` · 400, 401, 403, 404, 422 (đã xử lý) |

**Ghi chú:** `content_hidden` ẩn đối tượng bị báo cáo: portfolio chuyển `hidden`; ảnh, review, tin nhắn, photographer và studio dùng cờ `isHidden` tương ứng. Portfolio/ảnh/review bị ẩn không xuất hiện trong danh sách công khai. Photographer/studio bị ẩn không xuất hiện trong danh sách công khai, Explore và AI Search, `GET` công khai trả 404 (portfolio của họ cũng không hiển thị công khai) và không nhận booking mới; booking đang có vẫn tiếp tục, chủ hồ sơ vẫn xem được hồ sơ của mình. Tin nhắn bị ẩn vẫn giữ vị trí trong lịch sử nhưng trả `isHidden: true`, `body: null`, `attachments: []`; chỉ luồng admin có quyền xem nội dung gốc phục vụ kiểm duyệt. Kiểm tra dữ liệu tín nhiệm của admin vẫn cần chốt (mục 20).

---

## 18. AI Search

Mục này chốt **hình dạng request/response** để FE dựng giao diện và mock ngay. Logic xếp hạng (NLP + CV) làm ở Sprint 1–2 và không đổi hình dạng.

### POST /v1/search

**Mục đích:** Tìm photographer hoặc studio bằng ngôn ngữ tự nhiên và/hoặc ảnh tham chiếu, kết hợp bộ lọc.
**Màn hình dùng:** Thanh tìm kiếm, trang kết quả.
**Quyền:** Công khai cho tìm bằng văn bản; tìm bằng ảnh cần đăng nhập **[?]**. Có giới hạn tốc độ (429).
**Request body:**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| query | string \| null | Một trong `query` hoặc `imageStoragePath` | Tối đa 300 ký tự, tiếng Việt hoặc tiếng Anh |
| imageStoragePath | string \| null | | Ảnh tham chiếu đã upload vào bucket `search-uploads` |
| filters | object | không | `genre`, `city`, `district`, `priceMax` (integer; so với `priceFrom` của bên cung cấp, tính từ dịch vụ đang hoạt động). Giá trị trong `filters` ghi đè giá trị đã phân tích cùng khoá |
| ignoreParsed | string[] | không | Các khoá của `parsedQuery` mà người dùng đã bỏ chip (`genres`, `styles`, `city`, `district`, `priceMax`); BE không áp dụng các điều kiện này |
| page, pageSize | integer | không | Xem 2.2 |

```json
{
  "query": "chụp chân dung tone lạnh, ánh sáng cửa sổ, ở Thủ Đức dưới 2 triệu",
  "imageStoragePath": null,
  "filters": { "genre": "portrait" },
  "ignoreParsed": [],
  "page": 1,
  "pageSize": 20
}
```

**Response 200:**

```json
{
  "data": [
    {
      "provider": {
        "type": "photographer",
        "id": "b2f8a4d1-91c3-4f7e-8d2e-5a6c0e9b7f30",
        "displayName": "An Studio",
        "avatarUrl": null
      },
      "score": 0.87,
      "matchedImages": [
        { "imageId": "a91b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", "portfolioId": "e41d7c3a-6b2f-4c9a-b7a1-2f3d4e5a6b70", "thumbnailUrl": "https://.../img1_thumb.webp" }
      ],
      "reasons": ["Thể loại: portrait", "Phong cách: tone lạnh", "Khu vực: Thủ Đức"]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 },
  "parsedQuery": {
    "genres": ["portrait"],
    "styles": ["tone lạnh", "ánh sáng cửa sổ"],
    "city": null,
    "district": "Thủ Đức",
    "priceMax": 2000000
  }
}
```

**Lỗi:** 400, 401 (tìm bằng ảnh khi chưa đăng nhập), 422 (ảnh không tồn tại trong Storage), 429, 503 (AI service không sẵn sàng).
**Ghi chú:**
- `parsedQuery` là cách hệ thống hiểu truy vấn, để FE hiển thị thành các chip có thể bỏ bớt (bỏ chip thì gửi khoá tương ứng trong `ignoreParsed`; muốn đổi giá trị thì ghi đè qua `filters`).
- `reasons` là chuỗi hiển thị cho người dùng, giải thích vì sao khớp.
- Kết quả trả về bên cung cấp (`provider`, photographer hoặc studio) kèm ảnh khớp; ảnh của portfolio studio thuộc về studio. Tìm trực tiếp theo ảnh (không gộp theo bên cung cấp) **[?]**.
- Bên cung cấp bị ẩn (`isHidden`) không xuất hiện trong kết quả.
- `score` chỉ dùng để sắp xếp và hiển thị tham khảo, giá trị 0–1.
- `filters.priceMax` lọc theo `priceFrom` của bên cung cấp (photographer hoặc studio), là giá thấp nhất trong các dịch vụ đang hoạt động (`isActive = true` và chưa soft-delete); không phải giá do khách nhập khi booking.

---

## 19. Dashboard studio và timeline [Should, mức khung]

### GET /v1/studios/:id/dashboard

**Mục đích:** Số liệu kinh doanh cơ bản của studio.
**Màn hình dùng:** Dashboard studio.
**Quyền:** Manager studio.
**Query:** `from`, `to` (bắt buộc, tối đa 366 ngày).
**Response 200:**

```json
{
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-31" },
    "bookingsByStatus": { "pending": 2, "confirmed": 3, "completed": 8, "cancelled": 1 },
    "estimatedRevenue": 24500000,
    "ratingAvg": 4.7,
    "topServices": [{ "serviceId": "c5d6e7f8-1a2b-4c3d-8e9f-0a1b2c3d4e5f", "name": "Chân dung 2 giờ", "bookingCount": 5 }],
    "bookingsPerDay": [{ "date": "2026-10-03", "count": 2 }]
  }
}
```

**Lỗi:** 400, 401, 403, 404.
**Ghi chú:** `estimatedRevenue` là tổng `totalPrice` của booking `completed` trong kỳ, **không phải doanh thu thanh toán thực** vì MVP không có thanh toán.

### GET /v1/me/timeline

**Mục đích:** Các mốc sắp tới của mình: buổi chụp và milestone ở mọi booking đang tham gia.
**Màn hình dùng:** Timeline/deadline.
**Quyền:** Đăng nhập.
**Query:** `from`, `to` (bắt buộc, tối đa 62 ngày).
**Response 200:** `{ "data": [{ "type": "shoot" | "milestone", "bookingId": uuid, "shootRoomId": uuid | null, "title": string, "at": datetime, "status": BookingStatus | MilestoneStatus }] }`
**Lỗi:** 400, 401.

---

## 20. Điểm còn bỏ ngỏ (cần chốt ở buổi review)

Các điểm đã thống nhất trong buổi rà soát hiện tại được ghi trực tiếp ở những mục tương ứng, không còn liệt kê như câu hỏi mở. Các vấn đề vẫn cần người phụ trách quyết định:

| # | Câu hỏi | Người chốt |
|---|---|---|
| 1 | Profile được tạo bằng trigger DB khi đăng ký, hay BE tạo lần gọi `/me` đầu tiên? | Ly, Khải |
| 2 | `styles` dùng chuỗi tự do hay bảng tag chuẩn ngay từ đầu? Nếu dùng bảng tag, ai gán tag ảnh và `Tag.kind` có những nhóm nào? | Bạn, Quỳnh Anh |
| 3 | Giới hạn số ảnh mỗi portfolio và dung lượng tổng mỗi tài khoản. | Cả nhóm |
| 4 | Có giữ trường credit ekip dạng chữ tự do trong portfolio không? | Bạn |
| 5 | Chỉ số uy tín ngoài `ratingAvg`/`reviewCount` (số booking, tỷ lệ đúng hạn) có cần ngay trong MVP không? | Bạn |
| 6 | Có bắt buộc FE hiển thị nhãn cho ảnh `ai_generated` không? | Bạn, Khoa |
| 7 | Cursor tin nhắn tiếp tục dựa trên `(created_at, id)` hay đổi sang UUID v7? | Khải |
| 8 | Ai phân công photographer cho booking của studio: manager chủ động hay photographer nhận việc? | Cả nhóm, Ly |
| 9 | Chính sách huỷ booking (hạn chót, phí), thời gian tự động hoàn tất khi khách không xác nhận, và cách xử lý khi khách không phản hồi ở `proofing` (hiện không có đường huỷ từ `proofing`). | Bạn, Khải |
| 10 | Mô hình chấp thuận phiên bản brief có phù hợp? Có cho phép sửa brief sau `proofing` không? | Bạn, Khoa |
| 11 | Quyền vào Shoot Room: chỉ khách + photographer/manager liên quan, hay mọi thành viên studio được xem? | Ly, Khải |
| 12 | Giới hạn dung lượng mỗi file, mỗi booking và thời hạn lưu `expiresAt` cho deliveries/room files. | Cả nhóm |
| 13 | Review có cho sửa, cho bên cung cấp phản hồi, hoặc đánh giá riêng photographer được phân công không? | Bạn |
| 14 | Photographer độc lập có tự quản lý lịch bận ở MVP hay chỉ studio? | Bạn, Khoa |
| 15 | Ngoài xử lý báo cáo, admin cần endpoint nào để xem dữ liệu tín nhiệm? | Bạn, Quỳnh Anh |
| 16 | AI Search: tìm bằng ảnh có yêu cầu đăng nhập không; có trả kết quả ở mức ảnh không; ảnh `search-uploads` giữ bao lâu? | Quỳnh Anh, Khải |
| 17 | Thông báo đẩy/email/trong app cho lời mời và thay đổi trạng thái booking có nằm trong MVP không? Hiện để ngoài. | Cả nhóm |
| 18 | Có cần bảng lịch sử từng lần chọn ảnh `gallery_selections` trong MVP, hay chỉ cần trạng thái lựa chọn hiện tại? | Bạn, Khoa |

---

## 21. Việc cần làm sau khi chốt v1

- [ ] Khải chuyển các schema trên thành Zod trong `packages/shared`, gắn vào Swagger
- [ ] Khoa dựng dữ liệu giả (mock) từ các ví dụ JSON ở trên, bắt đầu với nhóm Sprint 1
- [ ] Ly đối chiếu từng trường với cột DB và RLS; báo lại trường nào thiếu cột. Đối chiếu riêng enum và bảng chuyển trạng thái booking
- [ ] Nguyên tách file theo nhóm trong `docs/api/` nếu cần, thêm nhãn `API` cho PR
- [ ] Thêm mã màn hình (FE-xx) vào mỗi endpoint khi có wireframe
- [ ] Từ đây, mọi thay đổi qua PR gắn nhãn `API` và thông báo `#dev`:
  - **Thêm** (trường tuỳ chọn, endpoint mới): cần một người rà.
  - **Phá vỡ** (đổi tên/kiểu trường, bỏ endpoint, đổi quyền hoặc bảng trạng thái): cần Khải và Khoa cùng đồng ý, và Ly nếu chạm schema.
- [ ] Nhóm [Should] và nhóm của sprint sau được chi tiết hoá khi bắt đầu sprint đó, theo quy tắc "thêm" ở trên

---

## Lịch sử thay đổi

| Phiên bản | Ngày | Nội dung | Người sửa |
|---|---|---|---|
| v0 | 2026-10-12 | Bản nháp đầu cho Sprint 1 | [tên bạn] |
| v0.2 | 2026-10-12 | Mở rộng cho toàn bộ MVP: studio, dịch vụ, lịch/tài nguyên, booking và brief, Shoot Room, proofing, bàn giao, review, báo cáo/admin, AI Search, dashboard, timeline; bổ sung quy ước Storage, Realtime, ký hiệu quyền, mã lỗi 503; thêm `ratingAvg`/`reviewCount` và `PortfolioStatus.hidden` | [tên bạn] |
| v0.3 | 2026-10-14 | Đồng bộ các quyết định review: chính sách xoá theo loại dữ liệu và giữ portfolio 30 ngày trước cleanup; mã lỗi có `details[].reason`; chuẩn hoá upload paths và thumbnail; role chuyên môn hiển thị; portfolio thuộc photographer hoặc studio; `revisionRounds`, private brief references, booking events, `publishedAt`, xử lý nội dung ẩn và `priceFrom` suy ra từ services | Review thiết kế |
| v0.4 | 2026-10-14 | Rà soát chéo: thêm `ProviderSummary`; AI Search trả `provider` (photographer hoặc studio) và thêm `ignoreParsed`; `isHidden` cho photographer/studio; làm rõ `GET /bookings?as=provider` và việc không huỷ được từ `proofing`; sửa tham chiếu mục 20; sửa lỗi định dạng | Review thiết kế |