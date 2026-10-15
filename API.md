# Nola2Hand API — Tài liệu endpoints

Base URL: `http://localhost:4000/api/v1`
Auth: header `Authorization: Bearer <token>` (trừ các endpoint ghi `public`).

Ký hiệu quyền: 🟢 public · 🔵 cần đăng nhập · 🟠 SELLER · 🟣 ADMIN_FINANCE · 🟡 ADMIN_CONTENT

## Auth — `/auth`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | 🟢 | Đăng ký (tự gán role BUYER) |
| POST | `/auth/login` | 🟢 | Đăng nhập, trả JWT |
| GET | `/auth/me` | 🔵 | Thông tin tôi |
| POST | `/auth/forgot-password` | 🟢 | Gửi link đặt lại qua kênh email đã cấu hình (không trả token trong API) |
| POST | `/auth/reset-password` | 🟢 | Đặt lại mật khẩu bằng token một lần nhận qua email |

| POST | `/auth/google` | 🔵 | Đăng nhập bằng Google (`idToken` từ Google Sign-In; cần `GOOGLE_CLIENT_ID` trong .env — tự tạo hoặc liên kết tài khoản theo email) |

## Users — `/users`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/users/me/profile` | 🔵 | Hồ sơ đầy đủ |
| PATCH | `/users/me` | 🔵 | Cập nhật hồ sơ |
| POST | `/users/me/become-seller` | 🔵 | Mở kênh người bán (`shopName`) |
| GET/POST | `/users/me/addresses` | 🔵 | Sổ địa chỉ |
| DELETE | `/users/me/addresses/:id` | 🔵 | Xoá địa chỉ |
| GET | `/users/:id` | 🟢 | Trang cá nhân công khai + đánh giá |

## Categories — `/categories`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/categories` | 🟢 | Cây danh mục |
| POST | `/categories` | 🟡 | Thêm danh mục |
| PATCH/DELETE | `/categories/:id` | 🟡 | Sửa / xoá (chặn nếu còn tin đăng) |

## Listings — `/listings`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/listings?q=&categoryId=&condition=&minPrice=&maxPrice=&isFree=&sort=` | 🟢 | Tìm kiếm, lọc, phân trang |
| GET | `/listings/:id` | 🟢 | Chi tiết (tự tăng views) |
| POST | `/listings` | 🟠 | Đăng tin (ảnh, giá, tình trạng...) → chờ duyệt |
| PATCH | `/listings/:id` | 🟠 | Sửa tin của mình (duyệt lại) |
| PATCH | `/listings/:id/visibility` | 🟠 | Ẩn / hiện tin (`ACTIVE`/`HIDDEN`) |
| POST | `/listings/:id/boost` | 🟠 | Đẩy tin 24h (trừ phí ví) |
| DELETE | `/listings/:id` | 🟠 | Xoá mềm |
| POST | `/listings/:id/favorite` | 🔵 | Lưu / bỏ lưu tin |
| GET | `/listings/me/favorites` | 🔵 | Tin đã lưu |
| GET | `/listings/admin/pending` | 🟡 | Tin chờ kiểm duyệt |
| PATCH | `/listings/admin/:id/moderate` | 🟡 | Duyệt (`APPROVE`) / từ chối (`REJECT` + lý do) |

| GET | `/listings/recommended` | 🔵/public | ✨ Gợi ý theo sở thích (dựa vào danh mục đã lưu; khách vãng lai → xem nhiều nhất) |
| GET | `/listings/:id/related` | public | 💡 "Có thể bạn cũng thích": cùng danh mục, giá tương đương |

## Shops (gian hàng) — `/shops` public
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/shops/search?q=` | 🔍 Tìm kiếm gian hàng theo tên shop / tên người bán |
| GET | `/shops/:id` | Trang shop: thông tin, tin đang bán, đánh giá mới nhất |

## Offers (trả giá) — `/offers`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/listings/:id/offers` | 🔵 | Gửi đề xuất giá (hiệu lực 24h) |
| GET | `/offers/mine` | 🔵 | Yêu cầu tôi đã gửi |
| GET | `/offers/inbox` | 🟠 | Yêu cầu gửi tới shop tôi |
| PATCH | `/offers/:id` | 🔵 | `{action: ACCEPT/REJECT}` (seller) / `{action: CANCEL}` (buyer) |

## Orders — `/orders`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/orders` | 🔵 | Tạo đơn (từ offer đã duyệt hoặc mua ngay + mã promo) |
| GET | `/orders/mine` | 🔵 | Đơn tôi mua |
| GET | `/orders/sales` | 🟠 | Đơn tôi bán |
| GET | `/orders/:id` | 🔵 | Chi tiết đơn |
| PATCH | `/orders/:id/status` | 🔵 | Chuyển trạng thái: seller `CONFIRMED→SHIPPING→DELIVERED`, buyer `COMPLETED`, cả hai `CANCELLED`. `COMPLETED` tự giải ngân escrow |
| GET | `/orders/admin/all` | 🟣🟡 | Admin: tất cả đơn hàng (lọc trạng thái, tìm mã đơn) |

## Cart (giỏ hàng) — `/cart` 🔵
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/cart` | Giỏ hàng của tôi (+ tổng tiền) |
| POST | `/cart` | Thêm tin vào giỏ (`listingId`) |
| DELETE | `/cart/:listingId` | Xoá 1 món |
| DELETE | `/cart` | Xoá toàn bộ giỏ |
| POST | `/cart/checkout` | Đặt hàng từ giỏ: mỗi tin tạo 1 đơn riêng (khác người bán), tự xoá khỏi giỏ |

## Escrow (SafePay ký quỹ) — `/escrow`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/escrow/orders/:id/deposit` | 🔵 | Đặt cọc (mặc định 20%, tối thiểu 10%) → tiền HELD |
| POST | `/escrow/:id/refund` | 🟣/seller | Hoàn cọc về ví buyer |
| GET | `/escrow/mine` | 🔵 | Các khoản ký quỹ của tôi |

## Wallet — `/wallet`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/wallet` | 🔵 | Số dư |
| GET | `/wallet/transactions` | 🔵 | Lịch sử giao dịch (lọc loại, thời gian) |
| POST | `/wallet/topup` | 🔵 | Nạp tiền (demo cộng ngay) |
| POST | `/wallet/withdraw` | 🔵 | Rút tiền về ngân hàng (áp phí cấu hình) |
| GET/POST | `/wallet/banks` | 🔵 | Tài khoản ngân hàng liên kết |
| DELETE | `/wallet/banks/:id` | 🔵 | Xoá TK ngân hàng |

## Reviews — `/reviews`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/reviews/orders/:id/reviews` | 🔵 | Đánh giá sau khi đơn COMPLETED (1 lần/đơn) |
| POST | `/reviews/:id/reply` | 🟠 | Shop phản hồi đánh giá |
| GET | `/reviews/users/:userId` | 🟢 | Đánh giá về 1 người + thống kê sao |
| GET | `/reviews/mine/pending` | 🔵 | Đơn chờ tôi đánh giá |

## Posts (bài viết) — `/posts`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/posts` | 🟢 | Bài đã xuất bản |
| GET | `/posts/:slug` | 🟢 | Chi tiết |
| POST | `/posts` | 🟠 | Tạo bài |
| GET | `/posts/me/all` | 🟠 | Bài của tôi |
| PATCH/DELETE | `/posts/:id` | 🟠 | Sửa / xoá bài của mình |

## Promos — `/promos`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/promos` | 🟢 | Khuyến mãi đang chạy |
| POST | `/promos/validate` | 🔵 | Kiểm tra mã trước khi đặt hàng |
| GET | `/promos/admin/all` | 🟡 | Tất cả (lọc trạng thái/loại) |
| POST/PATCH/DELETE | `/promos/admin...` | 🟡 | Tạo / sửa / xoá |

## Banners — `/banners`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/banners?position=` | 🟢 | Banner đang chạy theo vị trí |
| GET/POST/PATCH/DELETE | `/banners/admin...` | 🟡 | Quản lý banner |

## Reports (báo cáo vi phạm) — `/reports`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/reports` | 🔵 | Gửi báo cáo |
| GET | `/reports/admin/all` | 🟡 | Danh sách (lọc `status`=NEW/REVIEWING/RESOLVED/DISMISSED, `targetType`) |
| GET | `/reports/admin/stats` | 🟡 | 4 thẻ thống kê |
| PATCH | `/reports/admin/:id` | 🟡 | Xử lý: `WARN_USER` / `BAN_7_DAYS` / `BAN_PERMANENT` / `REMOVE_CONTENT` |

## Disputes (tranh chấp) — `/disputes`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/disputes/orders/:id/disputes` | 🔵 | Người mua mở tranh chấp (+ ảnh bằng chứng) |
| GET | `/disputes/mine` | 🔵 | Tranh chấp của tôi |
| GET | `/disputes/admin/all` | 🟣 | Danh sách |
| PATCH | `/disputes/admin/:id/resolve` | 🟣 | `BUYER_WINS` (hoàn cọc) / `SELLER_WINS` (trừ phí 1 lần) / `SPLIT` (chia 50/50) / `REFUND_BUYER` / `REJECT` |

## Finance admin — `/admin/finance` 🟣
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/overview` | 4 KPI + giao dịch/tranh chấp gần đây |
| GET | `/transactions` | Danh sách giao dịch (tìm kiếm, lọc trạng thái/ngày) |
| GET | `/revenue?months=6` | Doanh thu theo tháng + theo danh mục |
| GET | `/charts/revenue?from=&to=` | 📊 Biểu đồ cột: doanh thu theo ngày (khoảng ngày tuỳ chọn) |
| GET | `/charts/order-status` | 🥧 Biểu đồ tròn: đơn hàng theo trạng thái |
| GET/POST/PATCH/DELETE | `/fees` | Cấu hình phí (sàn / rút tiền / phạt) |

## Admin users — `/admin/users` 🟣🟡
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/` | Danh sách user (tìm kiếm, lọc trạng thái/role) |
| GET | `/stats` | Tổng / hoạt động / chờ xác minh / bị khóa |
| PATCH | `/:id/lock` | Khóa + lý do |
| PATCH | `/:id/unlock` | Mở khóa + lý do |
| PATCH | `/:id/verify` | Duyệt xác minh danh tính |
| PATCH | `/:id/roles` | Gán role |

## Seller — `/seller` 🟠
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/dashboard` | KPI, trạng thái tin, đơn gần đây, top sản phẩm |
| GET | `/listings` | Tin đăng của tôi (lọc trạng thái) |
| GET | `/charts/revenue?from=&to=` | 📊 Biểu đồ cột: doanh thu shop theo ngày (khoảng ngày tuỳ chọn) |

## Chat — `/chat` 🔵 · Notifications — `/notifications` 🔵
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/chat/conversations` | Danh sách hội thoại + tin chưa đọc |
| GET | `/chat/with/:userId?listingId=` | Lịch sử chat (tự đánh dấu đã đọc) |
| POST | `/chat/messages` | Gửi tin nhắn |
| GET | `/notifications` | Thông báo (phân trang, `?unread=true`) |
| PATCH | `/notifications/:id/read`, `/notifications/read-all` | Đánh dấu đã đọc |

## Upload — `/upload` 🔵
`POST /upload` — body `{mimeType, base64, purpose?}`; nhận JPEG/PNG/WebP hợp lệ tối đa 5MB, trả `{url}`. `purpose=PRODUCT` (mặc định) lưu công khai trong `uploads/`. `purpose=EVIDENCE` lưu riêng trong `.local/evidence/`; tải qua GET `/upload/evidence/:name` với Bearer token. Chỉ chủ ảnh, admin tài chính hoặc bên tham gia đơn/tranh chấp đã đính kèm được xem. Giới hạn 50 ảnh/giờ theo tài khoản và IP; cache ảnh riêng `private, no-store`. Không tự biến URL ngoài/ảnh công khai cũ thành riêng tư.

## Tính năng bổ sung

| API | Quyền | Hành vi |
|---|---|---|
| GET `/auth/config` | Công khai | Google client ID công khai và chế độ email; không trả khóa dịch vụ |
| POST `/auth/verify-email` | Công khai | `{token}` một lần, lưu hash ở database, hết hạn 24 giờ |
| POST `/auth/resend-verification` | Công khai | `{email}` gửi lại xác nhận; development có hộp thư `.local/mail/` |
| GET `/categories/specifications` | Công khai | Danh sách nhãn thông số theo slug danh mục |
| GET `/listings/:id/price-history` | Công khai | 300 lần đổi giá gần nhất, thứ tự tăng dần; chỉ tin ACTIVE |
| GET `/seller/listings/:id` | Seller sở hữu tin | Xem trước tin chưa duyệt/ẩn; thông tin và ảnh |
| POST `/escrow/orders/:id/pay-remainder` | Buyer của đơn | Trừ ví phần còn lại, cộng escrow HELD, chuyển phương thức còn lại sang WALLET |
| POST `/orders/:id/confirm-cod` | Seller của đơn | Đơn DELIVERED, phương thức COD; ghi nhận seller đã thu tiền ngoài ví |
| GET/POST `/saved-searches` | Đăng nhập | Xem/lưu `{name, filters}`, tối đa 20; bộ lọc giống `/listings` |
| PATCH/DELETE `/saved-searches/:id` | Chủ tìm kiếm | `{enabled}` bật/tắt hoặc xóa |
| POST `/assistant` | Công khai | `{message}` 2–500 ký tự; `{mode,filters,items,message,note}`, tối đa 8 tin ACTIVE thật |
| GET `/reviews/insights` | Seller/Admin | Seller chỉ thấy đánh giá của mình; admin toàn sàn hoặc `userId`, tối đa 500 đánh giá mới nhất |
| GET `/admin/audit` | Admin | Nhật ký phân trang, `q`, `from`, `to` |

`GET /listings` thêm `city`, `deliveryMethod=MEETUP|DELIVERY`, `verified=true`, `sort=newest`. Giá 0 là bộ lọc hợp lệ. `POST/PATCH /listings` thêm `city`, `deliveryMethod=ANY|MEETUP|DELIVERY` và `specifications` (giá trị chuỗi, khóa hợp lệ theo danh mục). Thay đổi giá được ghi lịch sử; chỉnh sửa gửi duyệt lại, không sửa/xóa tin RESERVED/SOLD_OUT.

`POST /orders` thêm `settlementMethod=COD|WALLET`, mặc định COD; giữ món 30 phút. Hoàn tất yêu cầu `remainingAmount=0`. Phí chỉ khấu trừ một lần khỏi tiền escrow thực thu. Xử tranh chấp hoàn/chia tiền chỉ tác động khoản SafePay đã giữ; tiền COD ngoài ví cần xử lý bên ngoài. Tin hoàn tiền do tranh chấp chuyển HIDDEN để seller kiểm tra hàng trước khi hiện lại.

Admin danh sách tin chờ duyệt, người dùng, báo cáo, tranh chấp, giao dịch và audit có `q`, `page`, `limit`; báo cáo/tranh chấp có `status`. Biểu đồ `/seller/charts/revenue` trả thu ròng ví; `/admin/finance/charts/revenue` trả phí sàn đã thu, ngày UTC và `basis` để phân biệt số liệu.

## Đợt 2 — quyền, phiên và giới hạn

POST `/auth/change-password`: `{currentPassword,newPassword}`, mật khẩu mới 8–72 ký tự; POST `/auth/logout`: thu hồi mọi access token hiện tại của tài khoản. Reset/đổi mật khẩu, đổi role và khóa tài khoản tăng `sessionVersion`, token cũ trả 401. Logout khi token đã hết hiệu lực vẫn xóa phiên trình duyệt.

PATCH `/admin/users/:id/roles`: `{roles}` cần ADMIN_FINANCE và `canManageRoles=true`; cấm tự sửa, bảo vệ admin tài chính/người quản lý cuối cùng. ADMIN_CONTENT không được gán quyền hoặc khóa admin qua báo cáo. Xác minh danh tính của admin không đồng nghĩa xác nhận email.

Tạo đơn/checkout/đăng tin cần email đã xác nhận hoặc danh tính đã duyệt. Buyer tối đa 3 đơn PENDING_DEPOSIT, kể cả checkout giỏ. Hạn mức theo tài khoản (cửa sổ cố định): tạo đơn 20/ngày, checkout 10/ngày, đăng tin 10/ngày, trả giá 20/giờ, báo cáo 10/ngày, chat 30/phút, rút tiền 10/ngày, yêu cầu trả hàng 5/ngày và thao tác trả hàng 30/giờ. Vượt mức trả 429 với `Retry-After`; request bị từ chối vẫn tính vào hạn mức thao tác.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/chat/blocks` | Danh sách người tôi chặn |
| POST | `/chat/blocks/:id` | Chặn liên lạc hai chiều; tối đa 20 thao tác/giờ |
| DELETE | `/chat/blocks/:id` | Gỡ chặn do mình tạo; bên kia còn chặn thì vẫn không gửi được |

## Yêu cầu rút tiền

POST `/wallet/withdraw`: `{amount,bankAccountId,requestKey}`; `amount` nguyên 50.000–1.000.000.000, `requestKey` UUID do client tạo. Response `{message,request}`; retry cùng mã/nội dung trả cùng request, khác nội dung trả 409. Chụp thông tin ngân hàng/phí tại thời điểm tạo, giữ cả tiền và phí trong `pendingBalance`. Chưa chuyển khoản chưa có ledger SUCCESS.

| Method | Endpoint | Quyền và hành vi |
|---|---|---|
| GET | `/wallet/withdrawals` | Chủ ví; `page,limit` |
| PATCH | `/wallet/withdrawals/:id/cancel` | Chủ yêu cầu PENDING, hoàn khoản giữ |
| GET | `/admin/finance/withdrawals` | ADMIN_FINANCE; `page,limit,status,q` |
| PATCH | `/admin/finance/withdrawals/:id` | ADMIN_FINANCE, không tự xử lý yêu cầu của mình; `{action,resolution,transferReference?}` |

`action`: APPROVE (PENDING→APPROVED), PAY (APPROVED→PAID, bắt buộc mã chứng từ thực tế), REJECT (PENDING/APPROVED→REJECTED), FAIL (APPROVED→FAILED). `resolution` 3–1000 ký tự. PAID mới ghi ledger tiền rút/phí; từ chối/hủy/thất bại trả toàn bộ khoản giữ, không ghi giao dịch thành công giả. Chứng từ do admin đối soát, API không chuyển ngân hàng tự động.

## Trả hàng — `/returns`

| Method | Endpoint | Quyền và dữ liệu |
|---|---|---|
| POST | `/returns/orders/:id` | Buyer của đơn; `{reason,evidences?}`, lý do 10–1000 ký tự, tối đa 5 URL HTTP/HTTPS |
| GET | `/returns` | Buyer/seller liên quan; `page,limit,status` |
| GET | `/returns/admin` | ADMIN_FINANCE; `page,limit,status` |
| PATCH | `/returns/:id` | Bên có quyền theo bước; `{action,note?,trackingCode?,codReference?}` |

Điều kiện: đơn DELIVERED/COMPLETED, trong 7 ngày từ timeline giao hàng, chưa có yêu cầu/tranh chấp. Mỗi đơn một yêu cầu; tạo yêu cầu chuyển đơn sang DISPUTED để dừng giải ngân. Ảnh riêng chỉ được đính kèm bởi chủ upload.

| action | Người thực hiện | Bước và dữ liệu |
|---|---|---|
| APPROVE / REJECT | Seller hoặc admin tài chính trung lập | REQUESTED→APPROVED/REJECTED; cần `note` |
| CANCEL | Buyer | REQUESTED→CANCELLED, trả trạng thái đơn ban đầu |
| SHIP | Buyer | APPROVED→SHIPPED; cần `trackingCode` hoặc thông tin bàn giao |
| RECEIVE | Seller hoặc admin tài chính trung lập | SHIPPED→RECEIVED; cần `note` tình trạng hàng nhận |
| REFUND | Admin tài chính không tham gia đơn | RECEIVED→REFUNDED; cần `note`; chỉ hoàn một lần |

REJECT cũng khôi phục trạng thái đơn ban đầu. Nếu escrow còn HELD, giữ đến bước REFUND. Nếu đã RELEASED, APPROVE giữ đủ khoản hoàn từ ví seller; thiếu số dư thì từ chối bước duyệt. Phí sàn đã thu không tự hoàn. `refundAmount` là SafePay thực giữ, không phải COD ngoài ví.

Khi có `codAmount`: seller gọi `COD_REFUND` tại RECEIVED với `codReference` chứng minh hoàn thực tế; buyer gọi `COD_CONFIRM` xác nhận đã nhận. Admin chỉ REFUND sau xác nhận này; COD không cộng thêm vào ví. Các action không đúng bước trả 409. Kết thúc đơn REFUNDED, tin chuyển HIDDEN để kiểm tra hàng trước khi bán lại.

## Uy tín shop và so sánh

GET `/shops/:id` public thêm `reputation`: `totalOrders,completedOrders,cancelledOrders,refundedOrders,returnedOrders,cancellationRate,rating,totalReviews,inquiries,responses,responseRate,medianResponseSeconds,emailVerified,identityVerified,responseWindowDays,messageSample`. Số đơn/đánh giá được tính từ dữ liệu thật. Hủy gồm mọi bên và hết hạn giữ hàng; không quy lỗi cho seller. Phản hồi nhóm theo khách và tin đăng, một lượt hỏi đang chờ trong mỗi chuỗi; lấy tối đa 10.000 tin gần nhất trong 90 ngày. Không có lượt hỏi trả null, không mặc định 100%.

GET `/listings/compare?ids=1,2,3` public: 1–3 ID dương khác nhau; trả `{items,unavailable}` đúng thứ tự. Chỉ tin ACTIVE và seller ACTIVE; mỗi item gồm giá, tình trạng, thông số, danh mục, giao nhận, shop và 300 lần ghi giá gần nhất tăng dần. Không có thông số hiển thị “Seller chưa cung cấp”; lịch sử là giá niêm yết, không suy ra giá giao dịch.
