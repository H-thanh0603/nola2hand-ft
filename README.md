# Nola2Hand Backend

Giao diện đã nâng cấp đồng bộ cho mua sắm, tài khoản, seller và admin. Chạy `npm run dev`, mở `http://localhost:4000` và nhấn `Ctrl + Shift + R`. Hướng thiết kế, nguồn tham khảo và phạm vi kiểm tra: [THIET_KE_GIAO_DIEN.md](THIET_KE_GIAO_DIEN.md).

REST API cho sàn thương mại điện tử đồ cũ **Nola2Hand** (đồ án TMDT – Nhóm 2).
Stack: **Node.js + Express + Prisma + PostgreSQL + JWT**.

Phân quyền 4 vai trò: `BUYER` (người mua) · `SELLER` (người bán) · `ADMIN_FINANCE` (admin tài chính) · `ADMIN_CONTENT` (admin nội dung).

## 1. Cài đặt

Đợt 15/10/2026 đã hoàn thành 5 sửa lỗi ưu tiên và 3 tính năng mới. Xem phạm vi, đường dẫn màn hình và bằng chứng kiểm thử tại [TIEN_DO_DOT_2.md](TIEN_DO_DOT_2.md).

```bash
# 1. Cài dependencies
npm install

# 2. Tạo database PostgreSQL rồi copy env
createdb nola2hand
cp .env.example .env
# -> sửa DATABASE_URL và JWT_SECRET trong .env

# 3. Migrate + seed dữ liệu demo (khớp với màn hình Figma)
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed

# 4. Chạy
npm run dev   # mở http://localhost:4000 → giao diện web; API ở /api/v1
```

Tài khoản demo (mật khẩu chung: `123456`):

| Email | Vai trò |
|---|---|
| `buyer@nola2hand.vn` | Người mua (Nguyễn Văn Tuấn) |
| `seller@nola2hand.vn` | Người bán (Trần Thái Hòa) |
| `finance@nola2hand.vn` | Admin tài chính |
| `content@nola2hand.vn` | Admin nội dung |

## 2. Cấu trúc

```
prisma/
  schema.prisma   # toàn bộ data model
  seed.js         # dữ liệu demo
src/
  app.js          # khởi tạo Express, mount routes
  prisma.js       # Prisma client singleton
  middleware.js   # auth (JWT), requireRole, validate (zod), errorHandler
  utils.js        # phân trang, tính phí sàn, escrow, ví, thông báo
  routes/         # 1 file / 1 module nghiệp vụ
    auth.js users.js categories.js listings.js offers.js
    orders.js escrow.js wallet.js reviews.js posts.js
    promos.js banners.js reports.js disputes.js
    finance.js admin-users.js seller.js chat.js notifications.js upload.js
API.md            # tài liệu chi tiết từng endpoint
```

## 3. Luồng nghiệp vụ chính

```
Đăng tin (PENDING_REVIEW) → Admin duyệt → ACTIVE
Trả giá (24h) → Seller đồng ý → Tạo đơn (PENDING_DEPOSIT)
Đặt cọc SafePay (tối thiểu 10%) → tiền vào ký quỹ HELD
Seller xác nhận → giao hàng → Buyer xác nhận đã nhận
→ escrow RELEASED → seller nhận tiền (trừ phí sàn)
Tranh chấp → admin tài chính hoàn tiền / từ chối
```

## 4. Ghi chú khi demo / phát triển tiếp

- Upload ảnh (`POST /upload`) lưu JPEG/PNG/WebP thật trong `uploads/`, tối đa 5MB/ảnh. Giữ thư mục này khi triển khai và đặt `APP_URL` đúng địa chỉ website.
- Nạp tiền trực tiếp chỉ có ở môi trường development để demo. Đặt cọc hiện chỉ nhận từ ví SafePay; tích hợp MoMo/VietQR cần payment link + webhook xác minh trước khi bật lại.
- Chat đang dùng **polling** (`GET /chat/with/:userId`) — muốn realtime thì gắn Socket.IO.
- Chạy `npx prisma studio` để xem/sửa dữ liệu trực quan.

## 5. Tính năng bổ sung và cấu hình

Các trang danh mục có URL riêng (`#/category/dien-tu-cu`, `#/category/noi-that`, `#/category/do-gia-dung`), bộ lọc địa điểm/giao nhận/xác minh, thẻ gỡ lọc và nhớ vị trí cuộn khi quay lại. Chi tiết tin có thông số tình trạng theo danh mục và tối đa 300 lần đổi giá gần nhất.

Kênh seller có sửa/xem trước tin, inbox trả giá, phân trang tin/đơn và phân tích đánh giá. Sửa tin gửi duyệt lại; tin đang được giữ hoặc đã bán không thể sửa/xóa. Admin có tìm kiếm/phân trang, ảnh bằng chứng, lý do xử lý và nhật ký quản trị.

Đơn mới giữ món 30 phút chờ cọc. Tiến trình server kiểm tra hết hạn mỗi 60 giây và khi tạo đơn mới. Cọc mặc định 20%, tối thiểu 10% **tổng tiền gồm giảm giá và giao hàng**. Người mua trả phần còn lại qua ví hoặc người bán xác nhận thu COD sau khi giao; người mua xác nhận hoàn tất trước khi giải ngân. Ví chỉ ghi tiền thật đã giữ trong escrow; COD ngoài ví không được cộng lại. Dashboard/biểu đồ seller dùng thu ròng ví; admin tài chính dùng phí sàn đã thu; ngày biểu đồ tính theo UTC.

1. Email: đặt `RESEND_API_KEY`, `MAIL_FROM` và `APP_URL` trong `.env`. Domain gửi cần được xác minh với [Resend](https://resend.com/docs/api-reference/emails/send-email). Khi development chưa cấu hình, thư chứa link một lần nằm trong `.local/mail/`, không gửi tới hộp thư thật. Production yêu cầu cấu hình email thật.
2. Google: đặt `GOOGLE_CLIENT_ID` ở backend, thêm origin của website vào OAuth Client. Frontend đọc cấu hình công khai từ `/auth/config`.
3. AI: đặt `OPENAI_API_KEY` và `OPENAI_MODEL` hỗ trợ [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create). Bật `AI_REVIEW_ANALYSIS=true` nếu muốn gửi nội dung/điểm đánh giá tới OpenAI. Không bật thì dùng quy tắc cục bộ, giữ nguyên nhận xét gốc.
4. Theo dõi tìm kiếm: đăng nhập, chọn “Theo dõi tìm kiếm này” tại danh mục. Tối đa 20 tìm kiếm; thông báo trong ứng dụng khi tin phù hợp được duyệt. Tin đã có lúc lưu không được báo lại.
5. Kiểm tra: `npm test` và `npx prisma validate`. Xem phạm vi kiểm tra thực tế trong `TIEN_DO_HOAN_THIEN.md`.

Nếu migration lỗi `must be owner of table`, sửa owner bằng tài khoản PostgreSQL quản trị trước khi dùng `migrate resolve --rolled-back` và chạy lại `migrate deploy`. Không dùng `migrate reset` để xử lý database đang có dữ liệu.

## 6. Trả hàng, rút tiền và bảo mật

Trả hàng trong 7 ngày từ khi giao: buyer yêu cầu → seller/admin duyệt → buyer gửi trả → seller/admin nhận lại → admin tài chính hoàn SafePay. Đơn tạm dừng giải ngân trong tiến trình. Nếu đã giải ngân, seller phải có đủ số dư cho toàn bộ khoản hoàn; phí sàn đã thu không tự hoàn. COD hoàn ngoài ví phải được seller ghi chứng từ và buyer xác nhận thực nhận, không được cộng giả vào ví. Mỗi đơn có một yêu cầu trả hàng; không dùng song song với tranh chấp.

Rút tiền dùng mã UUID để retry không giữ hai lần. Tiền và phí chuyển sang số dư đang giữ; admin duyệt rồi ghi nhận chứng từ chuyển khoản, lúc đó mới ghi giao dịch thành công. Từ chối/hủy/chuyển thất bại trả lại khoản giữ. Admin không xử lý yêu cầu của chính mình; chưa kết nối chuyển ngân hàng tự động.

Phân quyền cần `canManageRoles` và ADMIN_FINANCE, không cho sửa role của chính mình hoặc loại bỏ người quản lý cuối cùng. Migration/seed cấp quyền này cho tài khoản finance demo. Đổi/reset mật khẩu, đăng xuất, đổi role hoặc khóa tài khoản thu hồi phiên cũ. Tạo đơn/đăng tin yêu cầu xác nhận email hoặc danh tính; mỗi buyer tối đa 3 đơn chờ cọc. Chat có chặn/bỏ chặn, hạn mức theo tài khoản được ghi trong API.md.

Ảnh sản phẩm vẫn công khai trong `uploads/`. Ảnh upload từ màn bằng chứng dùng `purpose=EVIDENCE`, lưu riêng tại `.local/evidence/`; chỉ chủ ảnh, bên tham gia đơn/tranh chấp đã đính kèm và admin tài chính được xem. Giữ cả hai thư mục khi triển khai. Ảnh công khai cũ/URL ngoài chưa được chuyển thành riêng tư.

Kiểm tra cục bộ: `npm test`, `npm run schema:check`, `npx prisma migrate status`. Tích hợp chủ động: chạy server development rồi `npm run test:phase3`; yêu cầu tài khoản seed demo và email LOCAL_OUTBOX. Script tạo dữ liệu QA, giữ lịch sử tiền/audit, khóa tài khoản thử và xóa mềm tin thử sau chạy; không chạy trên dữ liệu production. Không cần reseed database hiện có để nhận các thay đổi.
