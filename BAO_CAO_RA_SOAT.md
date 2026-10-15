# Rà soát Nola2Hand — 14/10/2026

## Cập nhật ngày 15/10/2026

Đã triển khai 10 nhóm cải thiện đã được chấp thuận; xem `TIEN_DO_HOAN_THIEN.md` để phân biệt phần đã kiểm tra với phần cần khóa dịch vụ hoặc E2E. Migration mới đã khôi phục; Prisma báo database cập nhật và API đọc các cột/bảng mới thành công. Có 25 ca kiểm thử trong 3 file, các màn seller/admin mới mở trên database thật. Những nhận xét phía dưới là kết quả rà soát ban đầu, không phải toàn bộ việc còn thiếu hiện tại.

## Trạng thái sau sửa và cấu hình database

- **Cập nhật giao diện:** đã áp dụng header tìm kiếm có chọn danh mục, hero/thẻ danh mục/thẻ sản phẩm từ mẫu user và shell sidebar/topbar từ mẫu admin vào `frontend/`. Các URL `#/category/dien-tu-cu`, `#/category/noi-that`, `#/category/do-gia-dung` (và các danh mục còn lại từ API) có trang riêng, bộ lọc giá/tình trạng/từ khóa, sắp xếp, phân trang và trạng thái rỗng. Bộ lọc nằm trong URL nên giữ khi tải lại hoặc điều hướng lịch sử.
- **Kiểm tra giao diện với DB thật:** Điện tử cũ có 4 tin; lọc giá 1–6 triệu trả 2 tin. Nội thất/Đồ gia dụng chưa có tin trong dữ liệu hiện tại nhưng trang vẫn hiển thị đầy đủ. Đã kiểm tra shell admin tài chính/nội dung bằng tài khoản demo, viewport desktop 1440px và mobile 390px, không tràn ngang ở các màn được kiểm tra. Test điều hướng danh mục mới và test nghiệp vụ hiện có đều pass. Ảnh seed dùng URL demo không truy cập được; chưa kiểm thử toàn bộ thao tác của từng màn admin hoặc quy trình mua bán sau thay đổi giao diện.
- Theo kết quả người dùng gửi: tất cả migration đã áp dụng thành công và đã chạy Prisma generate. Lỗi thiếu DATABASE_URL, xác thực role nola và quyền migration đã được xử lý.
- Kiểm tra lại trong workspace: `npm test` pass (1 file regression), `npx prisma validate` pass. Đây chưa phải kiểm thử tích hợp PostgreSQL hoặc E2E trên trình duyệt.
- Đã sửa: phân biệt access token/reset token, reset dùng một lần và lưu hash; giữ món khi tạo đơn; cập nhật số dư ví nguyên tử; hủy/hoàn cọc; giới hạn giải ngân ở số tiền escrow thực thu; một số chuyển trạng thái có điều kiện; giới hạn visibility; các contract UI về dashboard, khóa user, ẩn tin, phí và giao dịch tài chính. Thanh toán ngoài chưa xác minh đã bị chặn; nạp tiền demo bị chặn trong production.

### Toàn bộ việc còn lại đã xác định trong lần rà soát

1. **Chức năng tài khoản và tích hợp:** gửi email xác nhận đăng ký và luồng xác nhận; gửi email reset (token không còn trả ra API nhưng chưa có dịch vụ gửi); cấu hình Google ở frontend và backend; upload ảnh thật; thanh toán sandbox với webhook xác minh và chống ghi nhận trùng. Cần làm rõ cách thu/đối soát phần tiền còn lại sau cọc.
2. **UI theo Excel:** hoàn thiện admin quản lý user/sản phẩm/đơn theo từng role; seller sửa tin và xử lý offer; phân trang lịch sử mua; đánh giá PRODUCT kèm kiểm tra listing thuộc đơn; báo cáo shop/user và form gửi báo cáo. Hoàn thiện sửa phí nếu giữ thao tác này trong thiết kế. Lọc giá và trang danh mục đã được bổ sung; bố cục chung từ hai HTML đã được đưa vào frontend đang nối API. Cần tiếp tục áp dụng chi tiết thiết kế cho các màn nghiệp vụ còn lại và kiểm tra mobile/accessibility trên toàn bộ màn.
3. **Nghiệp vụ còn cần sửa hoặc xác minh:** hết hạn offer ở bước accept; tự hết hạn giữ món chờ cọc; chống request cạnh tranh xuyên suốt cọc/hoàn/giải ngân/tranh chấp bằng PostgreSQL thật; checkout khi món đổi giá hoặc bán hết; thống kê giá trị đơn so với doanh thu thực thu; validate khoảng ngày và timezone; khóa user có thời hạn; xử lý REMOVE_CONTENT khi báo cáo thiếu targetUserId; thứ tự mới nhất bị ưu tiên tin đẩy.
4. **Chức năng bổ sung/chưa làm:** chatbot AI, lịch sử giá, phân tích cảm xúc; section bán chạy/xem nhiều nhất riêng trên trang chủ. Các mục xuất Excel/PDF, Facebook và logistics trong HTML là nội dung mẫu, chưa có tích hợp tương ứng. Chỉ triển khai theo phạm vi đề tài đã chọn.
5. **Kiểm thử và dữ liệu demo:** chạy ứng dụng thật với 4 role, desktop/mobile và các luồng mua–cọc–hủy–hoàn–hoàn tất–tranh chấp; test số dư không đủ, mua cùng món và request lặp trên PostgreSQL; rà dependency sau cảnh báo npm audit. Seed hiện có mật khẩu demo yếu, URL ảnh mẫu, ngày promo/banner cố định và có nguy cơ tạo trùng FeeConfig khi chạy lại; không chạy seed lặp để sửa lỗi database.

Chạy ứng dụng: `npm run dev`, mặc định mở `http://localhost:4000`. Chỉ seed database demo nếu chưa có dữ liệu và đã xem giới hạn ở mục 5. Không cần chạy lại migrate/generate khi không có thay đổi schema/client.

## Bản rà soát ban đầu — trước khi sửa

Các bảng bên dưới ghi nhận trạng thái ở thời điểm rà soát ban đầu; các lỗi đã sửa được liệt kê ở phần trạng thái phía trên. Những câu như “chưa có test”, “không sửa mã” và các script tái hiện lỗi bên dưới thuộc lần rà soát ban đầu, không phải kết quả kiểm tra sau sửa.

**Kết luận: chưa thể xác nhận dự án đã hoàn tất hoặc sẵn sàng demo toàn bộ yêu cầu Excel. Hai HTML mới phù hợp làm mẫu bố cục, chưa phù hợp để thay giao diện đang chạy trực tiếp.**

Nguồn yêu cầu: `Danh sách chức năng đề tài cuối kỳ - Trang tính1.xlsx`, sheet1, cột C. Đã đọc toàn bộ các dòng chức năng: 13 bắt buộc, 10 tự chọn, 3 bổ sung, 4 mục làm thêm khi dư thời gian. Excel ghi bắt buộc + tự chọn tối đa 8 điểm, bổ sung 2 điểm; báo cáo không suy đoán điểm đạt được.

## Phạm vi và bằng chứng

Đã đọc mã khởi tạo server, middleware, helpers, schema, các routes, giao diện `frontend/` và hai HTML mới. Không sửa mã nghiệp vụ, không chạy migration/seed, không dùng tài khoản hay dữ liệu thật.

| Kiểm tra | Kết quả |
|---|---|
| Cú pháp JavaScript | 28 file (`src/`, `frontend/app.js`, `prisma/seed.js`) qua `node --check` |
| Script trong HTML mới | 3 script admin + 2 script user qua kiểm tra cú pháp |
| Kiểm tra hành vi có mục tiêu | 9 kiểm tra chạy mã hiện tại với dependencies/DB/DOM giả lập đã tái hiện các lỗi bên dưới |
| Backend thật + PostgreSQL | Chưa chạy: workspace không có `node_modules`; sandbox không cho mở socket |
| Trình duyệt, ảnh chụp, mobile | Chưa xác minh trực quan: công cụ trình duyệt không có browser khả dụng; kết luận bố cục dựa trên HTML/CSS |

Script tái hiện: `/tmp/nola2hand-review/check.cjs`; chạy lại bằng `node /tmp/nola2hand-review/check.cjs`. Script chỉ đọc mã dự án; assert xác nhận lỗi đang tồn tại, không phải chứng nhận chức năng đã đạt. Kiểm tra cạnh tranh ví giả lập việc hai thao tác cùng đọc một số dư; cần test tích hợp PostgreSQL để xác nhận hành vi thực tế dưới tải.

## 1. Lỗi cần sửa trước khi demo

| Ưu tiên | Vị trí | Nguyên nhân, ảnh hưởng và hướng sửa |
|---|---|---|
| P0 — tài khoản | `src/routes/auth.js:180`, `src/middleware.js:14` | API quên mật khẩu public trả `resetToken` cho người biết email; token được ký cùng secret với access token. Middleware không phân biệt `purpose`, nên payload reset hợp lệ được chấp nhận để đăng nhập vào tài khoản, kể cả admin. Token cũng cho phép đổi mật khẩu trực tiếp. Sửa: gửi link qua email; không trả token ra response; phân biệt mục đích token và reset dùng một lần. Đã tái hiện middleware chấp nhận payload `purpose=reset` với JWT verify giả lập. |
| P0 — giải ngân | `src/routes/orders.js:208`, `src/routes/disputes.js:128`, `src/routes/escrow.js:38` | Hoàn tất đơn hoặc xử seller thắng cộng toàn bộ `priceAgreed`, trong khi escrow chỉ chứa 10–20% tiền cọc và không có bước thu số tiền còn lại. Đã tái hiện đơn 500.000đ, cọc 100.000đ, phí 25.000đ nhưng seller được cộng ròng 475.000đ. Sửa: chỉ giải ngân số tiền thực thu; có bước thu/đối soát phần còn lại trước khi kết thúc đơn. Nếu phần còn lại trả COD bên ngoài, không cộng lại phần đó vào ví. |
| P0 — thanh toán mô phỏng | `src/routes/escrow.js:38`, `src/routes/wallet.js:36` | MoMo/Bank/NAPAS đặt cọc được ghi nhận thành công ngay theo request, không xác minh giao dịch; nạp ví cũng cộng ngay. Đây là demo được README ghi rõ, chưa phải thanh toán online thật theo C9. Sửa: tích hợp sandbox cổng thanh toán với callback/webhook được xác minh, chống ghi nhận trùng. |
| P1 — hủy và hoàn tiền | `src/routes/orders.js:165`, `src/routes/orders.js:200`, `frontend/app.js:452` | UI có nút hủy đơn `PENDING_DEPOSIT` nhưng backend không cho chuyển trạng thái này. Hủy đơn `DEPOSITED`/`CONFIRMED` chỉ đổi status, không hoàn cọc; endpoint hoàn tiền riêng chỉ cho seller/admin và UI chưa nối luồng đó. Đã tái hiện hủy chờ cọc trả 400 và hủy đã cọc không xử lý escrow. Sửa: bổ sung chuyển trạng thái, hoàn cọc trong cùng transaction, thể hiện thao tác hợp lệ cho buyer/seller. |
| P1 — kiểm duyệt | `src/routes/listings.js:227` | API visibility chỉ kiểm tra chủ tin, không kiểm tra trạng thái nguồn; seller có thể bật tin `REJECTED`, `PENDING_REVIEW`, `DELETED` hoặc `SOLD_OUT` thành `ACTIVE`. Đã tái hiện `REJECTED → ACTIVE`. Sửa: chỉ cho ẩn/hiện tin đã được duyệt và không cho hồi sinh tin bị gỡ/bán hết. |

### Tính nhất quán đơn hàng và ví

| Vị trí | Vấn đề | Hướng sửa |
|---|---|---|
| `src/routes/orders.js:31`, `prisma/schema.prisma` model Order | Tin đồ cũ là một món duy nhất nhưng tạo đơn không giữ/chốt tồn; đã tái hiện hai đơn liên tiếp cho cùng tin `ACTIVE`. `listingId` không có ràng buộc ngăn nhiều đơn đang mua cùng món. | Giữ món bằng cập nhật có điều kiện trong transaction; xác định lúc hết hạn giữ và lúc trả món khi hủy. |
| `src/utils.js:58` | Ví đọc số dư rồi ghi giá trị tuyệt đối. Hai lệnh có thể cùng đọc 100.000đ, mỗi lệnh rút 80.000đ và cùng ghi 20.000đ; ledger ghi tổng trừ 160.000đ. Đã tái hiện với DB giả lập. | Cập nhật số dư nguyên tử có điều kiện đủ tiền; khóa hoặc dùng isolation thích hợp, có xử lý retry. |
| `src/routes/orders.js:181`, `src/routes/escrow.js:73`, `src/routes/disputes.js:110` | Kiểm tra trạng thái trước transaction, cập nhật không kèm điều kiện trạng thái hiện tại. Có nguy cơ hoàn tiền/giải ngân lặp khi request cạnh tranh; chưa test tích hợp DB. | Chuyển trạng thái có điều kiện trong transaction; chỉ ghi ledger sau khi giành được chuyển trạng thái. |
| `src/routes/orders.js:65`, `src/routes/promos.js:26` | Voucher AMOUNT không chặn vượt giá sản phẩm; `totalAmount` có thể âm. Kiểm tra lượt promo ngoài transaction có thể vượt giới hạn khi cạnh tranh. | Chặn discount vượt phạm vi áp dụng; kiểm tra và tăng lượt nguyên tử. |
| `src/routes/orders.js:54`, `src/routes/offers.js:53` | Offer có `expiresAt` 24 giờ nhưng accept/tạo đơn không kiểm tra hết hạn; accepted offer có thể dùng tạo nhiều đơn. | Thực thi hạn và việc sử dụng offer cùng bước tạo đơn. |

## 2. Sai lệch giữa frontend hiện tại và backend

| Màn hình/thao tác | Frontend | Backend | Kết quả hiện tại |
|---|---|---|---|
| Khóa/mở khóa user | `frontend/app.js:851` đọc `isLocked` | `src/routes/admin-users.js:28` trả `status` | User `BANNED` vẫn hiện “Hoạt động”, không có nút mở khóa. Đã tái hiện. |
| Seller dashboard | `frontend/app.js:688` đọc `revenue30d`, `orders30d`, `conversionRate` | `src/routes/seller.js:48` trả `weeklyRevenue`, `activeListings`, `pendingOrders`, `totalViews` | Doanh thu thành “—”, KPI thành `undefined`, kỳ 30 ngày khác kỳ 7 ngày. Đã tái hiện. |
| Ẩn tin | `frontend/app.js:728` gửi `PAUSED` | `src/routes/listings.js:231` chỉ nhận `ACTIVE`/`HIDDEN` | Nút Ẩn bị validation 400. |
| Giao dịch tài chính | `frontend/app.js:784`, `:791` đọc `type`, `amount`, `reference` như giao dịch ví | `src/routes/finance.js:24`, `:71` trả Order | Loại giao dịch `undefined`, số tiền “—”. Cần chọn đúng mô hình giao dịch ví hoặc bảng đơn hàng. |
| Phí dịch vụ | `frontend/app.js:813` đọc `code`, `type`, `value`, `description` | FeeConfig có `kind`, `percent`, `amount`, `minAmount`, `condition` | Giá trị phí không hiển thị đúng; màn hình chỉ xem, chưa nối tạo/sửa/xóa. |

Các luồng quản lý cơ bản còn thiếu trên UI: sửa tin của seller; xử lý offer inbox cho seller; quản lý đầy đủ sản phẩm đang bán/bị gỡ cho admin. Admin nội dung chỉ có hàng chờ duyệt; admin tài chính có danh sách đơn nhưng chưa có màn quản lý người dùng trong menu dù API cho phép cả hai role. Cần định nghĩa rõ phạm vi hai admin để demo C13.

## 3. Đối chiếu Excel — bắt buộc

“Có mã” nghĩa là đã thấy API/UI tương ứng, không đồng nghĩa đã qua E2E. “Một phần” nghĩa là có thiếu sót xác định trong mã.

| Dòng Excel | Chức năng | Trạng thái từ mã hiện tại |
|---|---|---|
| C2 | Đăng ký, gửi email xác nhận | **Một phần:** tạo user + ví + JWT; không có gửi email, token xác nhận hoặc endpoint xác nhận email. |
| C3 | Đăng nhập | Có API bcrypt/JWT và form gọi API; cần sửa lỗ hổng token reset trước khi coi auth an toàn. |
| C4 | Đăng xuất | Có xóa token/user trong localStorage và đổi trang; chưa có thu hồi token phía server. |
| C5 | Lấy lại mật khẩu | **Một phần/demo:** có forgot/reset, không gửi email; token trả công khai và chưa dùng một lần. |
| C6 | Xem chi tiết sản phẩm | Có API, gallery, mô tả, seller, tăng views. Public API vẫn trả tin không ACTIVE trừ DELETED (`src/routes/listings.js:146`); cần xem lại quyền hiển thị tin chờ duyệt/ẩn. |
| C7 | Quản lý giỏ hàng | Có thêm/xóa/xóa hết/tổng tiền + UI; số lượng một món phù hợp đồ cũ. Cần kiểm tra món đổi giá/bán hết và kết quả checkout một phần. |
| C8 | Đặt hàng | Có mua ngay, từ offer, checkout giỏ; **chưa hoàn chỉnh** do không giữ món và hủy đơn chờ cọc bị chặn. |
| C9 | Thanh toán trực tuyến | **Chưa đạt tích hợp thật:** ví nội bộ có ghi ledger, MoMo/Bank/NAPAS chỉ giả lập thành công. |
| C10 | Lịch sử mua hàng | Có `/orders/mine`, UI danh sách + chi tiết/timeline; UI chưa có điều khiển phân trang nên mặc định chỉ hiển thị trang đầu. |
| C11 | Biểu đồ cột tùy chọn từ ngày/đến ngày | Có API admin/seller và Chart.js với hai ô ngày; chưa test DB, chưa validate khoảng ngày. Số liệu cộng `totalAmount` cả đơn mới cọc, cần phân biệt giá trị đơn với doanh thu thực thu. |
| C12 | Biểu đồ tròn | Có API groupBy trạng thái đơn và Chart.js pie tại admin tài chính; chưa test DB/trình duyệt. |
| C13 | Admin quản lý user, sản phẩm, đơn hàng | **Một phần:** API tồn tại; UI user khóa/mở khóa sai dữ liệu, sản phẩm chủ yếu duyệt tin chờ, không đầy đủ quản lý; đơn chủ yếu danh sách/chi tiết. |
| C14 | Seller quản lý sản phẩm, doanh thu, đơn hàng | **Một phần:** đăng/xóa/ẩn tin, dashboard, chart và đơn bán có mã; ẩn tin lỗi enum, thiếu UI sửa tin, KPI sai contract. |

## 4. Đối chiếu Excel — 10 tự chọn

| Dòng Excel | Chức năng | Trạng thái từ mã hiện tại |
|---|---|---|
| C16 | Đăng nhập Google | **Một phần:** backend verify Google idToken, tạo/liên kết user; frontend `GOOGLE_CLIENT_ID = ''` tại `frontend/app.js:5`, nút chưa hoạt động với bản hiện tại. Chưa kiểm tra cấu hình OAuth thực tế. |
| C17 | Cập nhật thông tin cá nhân | Có API và UI tên/phone/bio, sổ địa chỉ. |
| C18 | Cập nhật trạng thái đơn | Có seller xác nhận/gửi/đã giao, buyer hoàn tất; cần sửa điều kiện trạng thái, giải ngân và cạnh tranh. |
| C19 | Hủy đơn + hoàn tiền | **Chưa đạt luồng đầy đủ:** lỗi chuyển trạng thái và không tự hoàn cọc khi hủy. |
| C20 | Đánh giá sản phẩm đã mua | **Một phần:** API hỗ trợ type PRODUCT nhưng UI chỉ “đánh giá người bán”, mặc định SELLER; không gửi listingId. Backend nhận listingId tự do, chưa bắt buộc khớp món trong đơn. |
| C21 | Báo cáo gian hàng/khách hàng | **Một phần:** module hiện là báo cáo nội dung, enum không có SHOP/USER; có targetUserId phụ trợ nhưng UI người dùng chưa có form gửi report. Admin có danh sách báo cáo. |
| C22 | Lọc nhiều tiêu chí | API hỗ trợ danh mục/tình trạng/khoảng giá/cho tặng/từ khóa; UI có danh mục/tình trạng/cho tặng/từ khóa, chưa có khoảng giá. |
| C23 | Sắp xếp sản phẩm | Có giá tăng/giảm; “Mới nhất” vẫn ưu tiên boostedUntil nên không thuần mới nhất. |
| C24 | Tìm kiếm gian hàng | Có `/shops/search` và màn `#/shops`, tìm shopName/fullName; chưa test DB. |
| C25 | Sản phẩm gợi ý | Có dựa danh mục favorites, fallback popular và related cùng danh mục/khoảng giá; đây là luật đơn giản, phù hợp yêu cầu gợi ý, không phải chatbot AI. |

## 5. Bổ sung và mục dư thời gian

| Dòng Excel | Chức năng | Trạng thái |
|---|---|---|
| C27 | Chatbot AI tư vấn/tìm sản phẩm | **Chưa thấy triển khai.** Chat trong backend là tin nhắn người mua/người bán; câu trả lời tự động trong HTML chỉ là chuỗi cố định. |
| C28 | Lịch sử giá sản phẩm | **Chưa thấy triển khai.** `originalPrice` không thay thế lịch sử thay đổi giá theo thời gian. |
| C29 | Phân tích cảm xúc bình luận | **Chưa thấy triển khai.** Review/rating không có phân loại cảm xúc. |
| C33 | Trang chủ: sản phẩm bán chạy | Chưa có section/API xếp hạng bán chạy trên trang chủ; topProducts của seller đang sắp theo views. |
| C34 | Trang chủ: mới nhất | Có danh sách mặc định theo boostedUntil rồi createdAt; một phần nếu yêu cầu đúng thứ tự mới nhất. |
| C35 | Trang chủ: xem nhiều nhất | Có views trong gợi ý fallback nhưng chưa có section riêng; thứ tự vẫn ưu tiên boostedUntil. |
| C36 | Trang chủ: sản phẩm gợi ý | Có `recommendedSection()` gọi API. |

## 6. Hai HTML mới có phù hợp không?

**Phù hợp làm mẫu phong cách và tổ chức màn hình. Chưa đủ chức năng Excel, chưa tích hợp ứng dụng và chưa được xác minh hiển thị bằng trình duyệt.**

| Điểm đánh giá | User (`nola2hand-user (2).html`) | Admin (`nola2hand-admin (3).html`) |
|---|---|---|
| Bố cục từ mã | 16 màn: home/product/auth/favorites/reviews/offer/deposit/tracking/profile/seller/wallet; có header, footer, card, table | 9 màn: tài chính, giao dịch, phí, tranh chấp, doanh thu, nội dung, promo, banner, report; sidebar tách hai vai trò |
| Liên kết backend | Không fetch/axios, không lưu phiên; login/signup chỉ `go('home')`, thanh toán chỉ `go('depositsuccess')` | Không gọi API; số liệu/bảng/biểu đồ cố định; nút quản lý chủ yếu chưa gắn handler |
| Thiếu theo Excel | Màn giỏ/checkout, quên-reset mật khẩu, xác nhận email, lịch sử đơn mua dạng danh sách, tìm shop, gửi báo cáo, đánh giá PRODUCT; Google chỉ nút mẫu | Màn quản lý user, sản phẩm/kiểm duyệt, đơn hàng; bộ lọc ngày cập nhật biểu đồ, biểu đồ tròn thật |
| Navigation | `go()` chỉ tìm `s-<id>` trong cùng file. Có references admin trong shared config nhưng không có màn admin trong file; nhiều reference có thể không được render | Các đích profile/home/login/signup/favorites/seller-overview không có trong file; nút “Về trang mua sắm” và “Hồ sơ” sẽ không chuyển trang |
| Responsive/accessibility | Chỉ một breakpoint 1000px; header nhiều phần không có chuyển layout mobile; nhiều grid có inline columns, các div/span click chưa hỗ trợ keyboard, input thiếu label liên kết | Sidebar 236px không có thu gọn ở mobile, bảng overflow hidden dễ mất cột; icon/div click thiếu ngữ nghĩa nút. Đây là rủi ro từ CSS, chưa đo viewport thật |

Không thay `frontend/index.html` bằng nguyên HTML mẫu. Server chỉ serve thư mục `frontend/` tại `src/app.js:30`; hai file ở root không tự xuất hiện trong ứng dụng. Script inline trong hai HTML cũng bị CSP `script-src` hiện tại chặn nếu đưa vào frontend nguyên trạng; cần chuyển script ra file được phép hoặc dùng nonce/hash phù hợp.

Cách dùng phù hợp: đưa CSS/bố cục mẫu vào các màn hiện có của `frontend/app.js`, dùng dữ liệu và handlers API hiện tại sau khi sửa lỗi. Giữ chart cột/tròn có lọc ngày, form giỏ/checkout/reset và quyền backend khi đổi giao diện. Chuyển hai admin theo roles thật; nút ROLE_SWITCH trong mẫu không phải phân quyền.

Các tính năng mẫu ngoài Excel chưa có backend/UI đầy đủ: xuất Excel/PDF, Facebook login, logistics cập nhật thời gian thực. Không cần bổ sung chúng trước các lỗi cốt lõi. Các tuyên bố “đã đăng ký Bộ Công Thương”, app iOS/Android, hãng vận chuyển trong footer chỉ là nội dung mẫu, chưa được xác minh; dùng nội dung phù hợp thực tế khi demo.

## 7. Các hạn chế khác đã thấy trong mã

| Vị trí | Phát hiện |
|---|---|
| `src/routes/upload.js:9` | Upload trả URL giả, không lưu ảnh; cần cơ chế upload thật nếu demo chọn ảnh từ máy. |
| `src/routes/reports.js:91` | Khóa 7 ngày chỉ đổi BANNED và ghi lý do; không có bannedUntil/luồng tự mở theo thời gian. |
| `src/routes/reports.js:85` | REMOVE_CONTENT chỉ chạy nếu có targetUserId và chỉ xử lý targetType LISTING; báo cáo không kèm targetUserId có thể được RESOLVED nhưng nội dung không bị gỡ. |
| `src/routes/finance.js:166`, `src/routes/seller.js:79` | Date range không validate ngày hợp lệ/thứ tự/độ dài; có nguy cơ 500 hoặc vòng lặp tạo dữ liệu quá lớn. Cần test timezone khi đối chiếu ngày SQL và JavaScript. |
| `package.json` | Chưa có lệnh test/lint/build; hiện không có suite tự động trong source được cung cấp. Kiểm tra cú pháp không chứng minh luồng nghiệp vụ đúng. |

## 8. Thứ tự hoàn thiện

1. Sửa auth/reset, giữ tiền đúng số thực thu, cập nhật ví/escrow an toàn khi cạnh tranh và quyền bật tin.
2. Hoàn thiện hủy/hoàn tiền, giữ món duy nhất và thống nhất contract frontend/backend.
3. Bổ sung email xác nhận/reset, thanh toán sandbox và cấu hình Google; hoàn thiện UI đánh giá sản phẩm/báo cáo shop-user/quản lý cơ bản.
4. Áp dụng bố cục hai HTML vào frontend đã nối API; kiểm tra browser desktop/mobile và đầy đủ quyền theo tài khoản demo.
5. Chạy E2E với PostgreSQL cho buyer/seller/admin, bao gồm mua cùng món, gửi lặp, số dư không đủ, hủy/hoàn tiền và giải ngân; sau đó mới xét ba chức năng bổ sung lấy 2 điểm.

Bước tiếp theo để đọc nhanh: xem mục 1 và mục 2 (khoảng 2 phút). Chưa chạy hệ thống thật hoặc chỉnh sửa lỗi; hiện không nên dùng dữ liệu/tài khoản/thanh toán thật.
