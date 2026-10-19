# Nola2Hand

Sàn thương mại điện tử **đồ cũ** — người mua và người bán giao dịch trực tiếp với nhau, tiền được giữ trong ví ký quỹ (SafePay) cho tới khi đơn hoàn tất, và hai nhóm admin riêng xử lý nội dung với dòng tiền.

Điểm khác biệt so với một trang rao vặt thông thường:

- **Ký quỹ theo từng đơn**, không chỉ là số dư hiển thị: tiền đặt cọc bị giữ ở trạng thái `HELD`, chỉ giải ngân cho người bán khi người mua xác nhận đã nhận hàng, hoặc hoàn lại khi có tranh chấp/trả hàng.
- **Hai nhánh admin tách quyền**: admin nội dung duyệt tin, xử lý báo cáo; admin tài chính đối soát dòng tiền, duyệt rút tiền, hoàn tiền. Không một tài khoản nào làm được cả hai việc.
- **Mọi thay đổi tiền đều có chứng từ và nhật ký** để đối soát lại về sau.

## Chức năng chính

**Người mua**

- Tìm kiếm, lọc theo danh mục, khu vực, tình trạng, giao nhận, mức độ xác minh người bán
- Xem tin, xem gian hàng, so sánh tin, giỏ hàng, theo dõi tin
- **Trả giá** có thời hạn (mặc định 24 giờ) — người bán đồng ý thì tạo đơn
- Đặt cọc và thanh toán phần còn lại qua ví, hoặc xác nhận trả tiền mặt khi nhận hàng
- Xác nhận đã nhận hàng để giải ngân, yêu cầu trả hàng trong 7 ngày, mở tranh chấp
- Chat với người bán, đánh giá sau đơn, lưu tìm kiếm để nhận thông báo khi có tin phù hợp

**Người bán**

- Đăng tin có ảnh, thuộc tính theo danh mục; tin phải qua duyệt mới hiển thị
- Sửa tin đã đăng (bị đưa về chờ duyệt lại); tin đang giữ hàng hoặc đã bán thì không sửa/xoá được
- Quản lý hộp thư trả giá, đơn hàng, trả hàng, gian hàng, bài viết chia sẻ kinh nghiệm
- Ví, yêu cầu rút tiền, biểu đồ thu nhập ròng, thống kê đánh giá

**Admin nội dung**

- Duyệt/từ chối tin và bài viết kèm lý do, xem ảnh bằng chứng
- Xử lý báo cáo vi phạm, khoá/mở tài khoản, chat hỗ trợ
- Quản lý danh mục, banner, khuyến mãi, nhật ký quản trị

**Admin tài chính**

- Đối soát phí sàn đã thu, dòng tiền ký quỹ, tình hình ví
- Duyệt rút tiền và ghi nhận chứng từ chuyển khoản
- Xử lý tranh chấp và hoàn tiền trả hàng
- Phân quyền người dùng; không tự sửa vai trò của chính mình và không thể xoá người quản lý cuối cùng

## Luồng nghiệp vụ điển hình

```
Đăng tin → chờ duyệt → đang bán
Trả giá (24h) → người bán đồng ý → đơn chờ đặt cọc
Đặt cọc (tối thiểu 10% tổng tiền) → tiền vào ký quỹ HELD
Người bán xác nhận → giao hàng → người mua xác nhận đã nhận
→ giải ngân cho người bán, trừ phí sàn
Tranh chấp → admin tài chính hoàn tiền hoặc từ chối
```

Đơn mới giữ hàng 30 phút để chờ đặt cọc; hết hạn thì tự huỷ và nhả hàng.

## Kiến trúc và công nghệ

| Lớp | Dùng gì |
|---|---|
| Backend | Node.js (CommonJS) + Express 4 |
| Cơ sở dữ liệu | PostgreSQL qua Prisma 5 (migration + seed) |
| Xác thực | JWT, mật khẩu băm bằng bcrypt, đăng nhập Google tuỳ chọn |
| Kiểm tra dữ liệu | zod ở tầng route |
| Bảo mật | helmet, express-rate-limit (chặt hơn ở `/auth`), CORS |
| Frontend | HTML/CSS/JavaScript thuần, không framework và không có bước build; Express phục vụ tĩnh cùng cổng |
| Tích hợp tuỳ chọn | Resend (email), Google Identity, OpenAI Responses API |

Backend và frontend chạy **cùng một tiến trình**: mở `http://localhost:4000` là vào giao diện, API nằm dưới `/api/v1`.

## Cấu trúc thư mục

```
src/
  app.js            khởi tạo Express, mount route, phục vụ frontend tĩnh
  middleware.js     xác thực JWT, phân quyền, validate, xử lý lỗi
  prisma.js         Prisma client dùng chung
  utils.js          phân trang, phí sàn, ký quỹ, ví, thông báo
  routes/           mỗi module nghiệp vụ một file (listings, orders, escrow,
                    wallet, disputes, returns, seller, finance, admin-users, …)
  services/         logic dùng chung: ký quỹ, giữ chỗ hàng, hoàn tiền, rút tiền,
                    uy tín người bán, email, tìm kiếm, AI
prisma/
  schema.prisma     toàn bộ mô hình dữ liệu
  migrations/       lịch sử migration
  seed.js           dữ liệu mẫu để chạy thử
frontend/           giao diện tĩnh (index.html, app.js, marketplace.js, CSS)
test/               test tích hợp chạy bằng node --test
scripts/            script kiểm tra luồng nghiệp vụ end-to-end
uploads/            ảnh người dùng tải lên (không commit)
```

## Cài đặt và chạy

Yêu cầu: Node.js 18 trở lên và một cơ sở dữ liệu PostgreSQL.

```bash
# 1. Cài phụ thuộc
npm install

# 2. Tạo database và file cấu hình
createdb nola2hand
cp .env.example .env
# mở .env, sửa DATABASE_URL và JWT_SECRET

# 3. Tạo bảng và dữ liệu mẫu
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed

# 4. Chạy
npm run dev      # http://localhost:4000
```

Lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm start` | Chạy không kèm nodemon |
| `npm test` | Test tích hợp (`node --test test/*.test.cjs`) |
| `npm run schema:check` | Kiểm tra và sinh Prisma client |
| `npm run prisma:seed` | Nạp lại dữ liệu mẫu |
| `npx prisma studio` | Xem/sửa dữ liệu bằng giao diện |

## Cấu hình

Chỉ hai biến là bắt buộc: `DATABASE_URL` và `JWT_SECRET`. Các biến còn lại đều có mặc định an toàn cho phát triển cục bộ.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | có | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | có | Khoá ký token, phải đổi khi triển khai thật |
| `JWT_EXPIRES_IN` | không | Mặc định `7d` |
| `PORT` | không | Mặc định `4000` |
| `APP_URL` | không | Địa chỉ công khai, dùng cho link trong email và ảnh tải lên |
| `RESEND_API_KEY`, `MAIL_FROM` | không | Thiếu thì thư được ghi ra `.local/mail/` thay vì gửi thật |
| `GOOGLE_CLIENT_ID` | không | Bật đăng nhập Google; frontend đọc cấu hình qua `/api/v1/auth/config` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | không | Bật trợ lý tìm kiếm; thiếu thì dùng quy tắc cục bộ |
| `AI_REVIEW_ANALYSIS` | không | Đặt `true` mới gửi nội dung đánh giá tới OpenAI để phân tích cảm xúc |

## Ghi chú phát triển

- **Chat dùng polling**, chưa phải realtime. Muốn realtime thì gắn WebSocket.
- **Nạp tiền trực tiếp chỉ có ở môi trường phát triển** để tiện thử nghiệm. Cổng thanh toán (MoMo, VietQR) cần payment link và webhook xác minh trước khi bật.
- **Rút tiền chưa nối ngân hàng tự động**: admin duyệt rồi ghi nhận chứng từ chuyển khoản.
- Giữ lại thư mục `uploads/` (ảnh công khai) và `.local/` (ảnh bằng chứng riêng tư, thư nháp) khi triển khai.
- Ảnh bằng chứng dùng trong tranh chấp được lưu riêng và chỉ người liên quan cùng admin tài chính xem được.
- File `.env` đã được bỏ qua trong git, không commit khoá bí mật.

## Tài liệu

| File | Nội dung |
|---|---|
| [API.md](API.md) | Danh sách endpoint, tham số, quyền yêu cầu |
| [THIET_KE_GIAO_DIEN.md](THIET_KE_GIAO_DIEN.md) | Hướng thiết kế giao diện và nguồn tham khảo |
| [TIEN_DO_HOAN_THIEN.md](TIEN_DO_HOAN_THIEN.md) | Phạm vi hoàn thiện và phạm vi kiểm tra |
| [TIEN_DO_DOT_2.md](TIEN_DO_DOT_2.md) | Thay đổi theo từng đợt |
| [BAO_CAO_RA_SOAT.md](BAO_CAO_RA_SOAT.md) | Báo cáo rà soát lỗi và bảo mật |
| [DE_XUAT_CAI_THIEN.md](DE_XUAT_CAI_THIEN.md) | Đề xuất cải thiện tiếp |
| [NGHIEN_CUU_TINH_NANG_MOI.md](NGHIEN_CUU_TINH_NANG_MOI.md) | Nghiên cứu tính năng mới |

## Giấy phép

MIT.
