# Nghiên cứu tính năng mới cho Nola2Hand (đối chiếu Chợ Tốt, Carousell, Vinted, Depop, Poshmark, eBay pre-loved, Facebook Marketplace)

Ngày: 15/10/2026. Phạm vi đọc trước khi đề xuất: `README.md`, `API.md`, `DE_XUAT_CAI_THIEN.md`, `TIEN_DO_HOAN_THIEN.md`, `frontend/app.js`, `src/routes/` (26 route), `src/services/`. Không sửa code, chỉ viết báo cáo.

## 1. Bảng so sánh (tính năng | nền tảng có + nguồn | Nola2Hand)

| # | Tính năng | Nền tảng có (nguồn chính thức) | Nola2Hand |
|---|---|---|---|
| 1 | Đăng tin + kiểm duyệt admin | Chợ Tốt (quy trình đăng/kiểm duyệt tin, cửa hàng xác thực): https://trogiup.chotot.com/nguoi-ban/cua-hang-xac-thuc/ | ĐÃ CÓ (`POST /listings`, `/listings/admin/pending`, `PATCH /listings/admin/:id/moderate`) |
| 2 | Trả giá / Best Offer 24h | eBay Best Offer + Offer to buyers (Seller Center): https://www.ebay.com/sellercenter/growth/seller-hub-discounts/offers-to-buyers-best-offer ; Depop offer (help): xem dòng 5 | ĐÃ CÓ (`POST /listings/:id/offers`, `/offers/inbox`, 24h) |
| 3 | Ký quỹ / Buyer Protection + hoàn tiền | Vinted Buyer Protection fee (Help Center): https://www.vinted.com/help/342-buyer-protection-fee-on-vinted ; FB Purchase Protection: https://www.facebook.com/help/228307904608701 ; Carousell Buy button + Protection: https://www.carousell.sg/changes-to-list-with-buy-button/l | ĐÃ CÓ (SafePay escrow HELD/RELEASED, disputes, returns) |
| 4 | COD | FB Marketplace ship + thanh toán khi nhận (Help): https://www.facebook.com/help/2203975773467109 | ĐÃ CÓ (`settlementMethod=COD`, `confirm-cod`, `pay-remainder`) |
| 5 | Tranh chấp / khiếu nại có chứng cứ ảnh | FB quy trình claim 3–7 ngày + ảnh/video: https://www.facebook.com/help/2203975773467109 | ĐÃ CÓ (`/disputes`, `/returns`, evidence riêng tư) |
| 6 | Ví + rút tiền có duyệt | Vinted Wallet + KYC qua Adyen (Help): https://www.vinted.com/help/15/111-why-you-may-be-asked-for-your-id | ĐÃ CÓ (`/wallet`, withdrawals PENDING→APPROVED→PAID) |
| 7 | Chat mua bán (polling) | Carousell mô hình chat-led mua bán (OneCart tổng hợp Help Centre): https://www.getonecart.com/how-to-sell-on-carousell | ĐÃ CÓ polling (`/chat`), block; CHƯA realtime (ghi rõ trong README) |
| 8 | Đánh giá + thống kê sao | FB Marketplace ratings (Help): https://www.facebook.com/help/915385548593204 | ĐÃ CÓ (`/reviews`, reply, insights + sentiment AI) |
| 9 | Theo dõi tìm kiếm / báo tin mới | eBay Saved Search là chuẩn (Seller/Help); Nola2Hand đã tự làm tương đương | ĐÃ CÓ (`/saved-searches`, tối đa 20, notif nội bộ) |
| 10 | So sánh sản phẩm | eBay compare/specs; Nola2Hand tự làm compare 3 món | ĐÃ CÓ (`GET /listings/compare?ids=1,2,3`, price-history 300) |
| 11 | Trợ lý tìm đồ / gợi ý | Poshmark Trends/Trends collections (Blog chính thức): https://blog.poshmark.com/2026/01/25/your-complete-guide-to-poshmarks-features-tools | ĐÃ CÓ (`POST /assistant`, `/listings/recommended`, `/listings/:id/related`) |
| 12 | Yêu thích / Giỏ hàng / Promo / Banner / Google login / 4 roles | Poshmark Like + Offer to Likers (Blog chính thức, xem trên) | ĐÃ CÓ (favorites, cart/checkout, promos, banners, Google, 4 roles) |
| 13 | Đẩy tin trả phí (Boost/Bump 24h) | Carousell Bumps (Blog chính thức): https://blog.carousell.ph/pro-tips/carousell-bumps ; Depop Boosted Listings Policy (Help): https://depophelp.zendesk.com/hc/en-gb/articles/9253129255569-Boosted-Listings-Policy ; Chợ Tốt Tin Ưu Tiên: https://trogiup.chotot.com/nguoi-ban/tin-uu-tien-la-gi ; Đẩy tin thông minh: https://trogiup.chotot.com/nguoi-ban/day-tin-thong-minh | ĐÃ CÓ bản gọn (`POST /listings/:id/boost`, 24h trừ ví). Chưa có Tin Ưu Tiên nhiều gói 1/2/3/5/7 ngày như Chợ Tốt, chưa có Smart Bump theo giờ cao điểm |
| 14 | **Bundle mua nhiều món cùng shop + giảm giá bundle (CHƯA)** | Poshmark Posh Bundle + Seller Discount (Blog chính thức): https://blog.poshmark.com/2026/01/25/your-complete-guide-to-poshmarks-features-tools ; Vinted bundle discounts (Help/blog sellers, đối chiếu Help Center): https://www.vinted.com/help | CHƯA. Cart hiện tách mỗi tin 1 đơn riêng (`POST /cart/checkout`), chưa gộp 1 đơn nhiều món, chưa có % giảm theo số món |
| 15 | **Offer to Likers — seller chủ động chào giá người đã thích (CHƯA)** | Poshmark Offer to Likers, Closet Clear Out, Make a Deal Days (Blog chính thức, nguồn trên); eBay Offer to buyers (Seller Center): https://www.ebay.com/sellercenter/growth/seller-hub-discounts/offers-to-buyers-best-offer | CHƯA. Offer hiện chỉ buyer→seller (`/offers`); chưa có chiều seller→likers kèm giảm 10% + freeship, hết hạn 24h |
| 16 | **Kiểm định hàng hiệu / Item Verification (CHƯA)** | eBay Authenticity Guarantee thời trang (Pressroom): https://www.ebayinc.com/stories/press-room/uk/ebay-launches-authenticity-guarantee-for-apparel ; Handbags $500+ (eBay): https://ebay.com/authenticity-guarantee/handbags ; Vinted Item Verification designer (Help): https://www.vinted.com/help/1147-item-verification-for-designer-items | CHƯA. Chỉ có duyệt tin + tranh chấp + evidence; chưa có cờ `verificationRequired`, luồng hub kiểm định, phí buyer trả |
| 17 | **Gợi ý giá khi đăng tin từ dữ liệu thật (CHƯA)** | eBay Pricing items + price guidance sports cards 2 năm dữ liệu (Help): https://www.ebay.com/help/selling/selling/pricing-items?id=4133 ; eBay Product Research trong Seller Hub (Export guide): https://export.ebay.com/en/first-steps/how-to-price-your-items | CHƯA. Đã có price-history 300 lần (`GET /listings/:id/price-history`) nhưng chỉ xem, chưa gợi ý khoảng giá lúc `POST /listings` |
| 18 | **Theo dõi shop + feed tin mới (CHƯA)** | Poshmark follow/share closet + Posh Markets (Blog chính thức, nguồn trên); Carousell Custom Collections cho shop (Help): https://support.carousell.com/hc/en-us/articles/360061023654--Singapore-CarouBiz-tools-Custom-Collections | CHƯA. Đã có `/shops/search`, `/shops/:id` + reputation, nhưng chưa có follow/unfollow, feed, collections |
| 19 | **Lịch hẹn gặp + mã bàn giao QR (CHƯA, trùng DE_XUAT #2 chưa làm)** | Carousell meetup vs delivery + Buy button (nguồn trên); FB bán local + delivery (Help): https://www.facebook.com/help/796066857221106 | CHƯA. `deliveryMethod=ANY/MEETUP/DELIVERY` và `city` mới là field lọc; đơn MEETUP vẫn cộng ship 15.000đ và đi luồng ship thường (đúng như DE_XUAT_CAI_THIEN mục 2.2 đã nêu) |
| 20 | **Chat realtime + đã xem/đang nhập (CHƯA)** | Carousell chat-led (nguồn trên); FB Messenger-bản chất realtime; Nola2Hand README tự ghi polling | CHƯA. `GET /chat/with/:userId` lấy 100 tin đầu (DE_XUAT 2.3 đã nêu sẽ mất tin mới), chưa cursor, chưa socket |
| 21 | **Freeship / seller trả ship cho bundle (CHƯA sâu)** | Poshmark discounted shipping trong Bundle/Offer (Blog chính thức, nguồn trên); Carousell Protection delivery + tracking (MHA tóm tắt Carousell Help): https://www.mha.gov.sg/e-commerce-marketplace-transaction-safety-ratings/carousell | CHƯA SÂU. Promo có loại FREESHIP nhưng DE_XUAT 2.1 ghi áp sai (giảm 20k vào giá món trong khi ship 15k); chưa có seller-funded freeship theo shop/bundle |
| 22 | **Sự kiện săn đồ theo chủ đề / Posh Party + Live bán đồ cũ (CHƯA)** | Poshmark Parties 4/ngày + Live Shows/P Tosh Shows (Blog chính thức nguồn trên + Posh live: https://poshmark.com/live); bối cảnh live resale (CNBC): https://www.cnbc.com/2023/03/24/depop-poshmark-secondhand-resale-cutthroat.html ; So sánh Posh live vs Depop chưa có live (Vendoo): https://blog.vendoo.co/selling-on-poshmark-vs.-selling-on-depop | CHƯA. Banner/promos hiện tĩnh (`/banners`, `/promos`); chưa có event theo khung giờ, chưa live |
| 23 | **Huy hiệu bền vững / thống kê tái sử dụng (CHƯA)** | Vinted/Carousell sứ mệnh secondhand-first-choice; Carousell Group profile: https://sg.linkedin.com/company/carousellgroup ; Vinted Help Center Trust & Safety: https://www.vinted.com/help | CHƯA. Chưa có số kg CO2 tiết kiệm, huy hiệu seller xanh, bộ lọc eco |

## 2. Top 9 đề xuất (xếp theo giá trị demo đồ án / độ khó)

### 1. Bundle nhiều món cùng shop + giảm giá theo mốc (2/3/5 món)
Mô tả: Buyer gom nhiều tin cùng seller vào 1 bundle, chat riêng trong bundle, 1 lần ship. Seller cấu hình % giảm theo mốc số món (kiểu Poshmark My Seller Discounts / Vinted bundle tiers). Checkout tạo 1 đơn bundle thay vì N đơn lẻ, escrow giữ 1 khoản, phí sàn tính 1 lần. Demo rất "chợ đồ cũ" mà trường chưa có.
Backend: thêm `Bundle` + `BundleItem` (prisma/schema.prisma), `BundleDiscountRule` theo seller; `POST /bundles`, `POST /bundles/:id/offer`, `POST /bundles/checkout` tái dùng `src/routes/orders.js` + `src/routes/cart.js` + `src/services/reservations.js`; migration mới. Frontend: nút "Thêm vào bundle" ở chi tiết tin + trang bundle trong `frontend/app.js` (gần giỏ hàng), tái dùng UI cart.
Độ khó: M.

### 2. Offer to Likers — seller chào giá chủ động cho người đã thích
Mô tả: Từ danh sách likers của 1 tin, seller gửi offer riêng giảm ≥10% + tùy chọn freeship, hiệu lực 24h, buyer chốt 1 chạm. Kèm Closet Clear Out: giảm giá hàng loạt là tự gửi offer + notif. Đây là động cơ mua mạnh nhất của Poshmark/eBay mà Nola2Hand thiếu (hiện offer 1 chiều buyer→seller).
Backend: thêm bảng `LikerOffer` hoặc mở rộng `src/routes/offers.js` + `src/routes/listings.js` (lấy likers từ favorite), `POST /listings/:id/offers-to-likers`, worker hết hạn 24h tái dùng logic offer hiện tại, notif qua `src/routes/notifications.js`. Frontend: nút "Chào giá người đã thích" trong seller inbox + trang tin (`frontend/app.js`, `frontend/marketplace.js`).
Độ khó: M.

### 3. Lịch hẹn gặp trực tiếp + mã bàn giao QR (lấp đúng lỗ hổng DE_XUAT 2.2)
Mô tả: Đơn MEETUP không cộng ship 15.000đ, buyer/seller chốt địa điểm + khung giờ trong app, sinh mã QR 1 lần. Seller quét/xác nhận khi giao, buyer xác nhận đã nhận thì escrow giải ngân. Ẩn địa chỉ chi tiết tới khi cả hai đồng ý, có log audit. Demo phân biệt MEETUP vs DELIVERY rõ ràng, giám khảo thích.
Backend: mở rộng `src/routes/orders.js` (bỏ ship khi MEETUP, state `MEETUP_SCHEDULED`), bảng `MeetupAppointment`, `POST /orders/:id/meetup`, `POST /orders/:id/handover-code`; dùng `src/services/reservations.js` + `src/routes/escrow.js`. Frontend: picker địa điểm/giờ + màn hình QR trong chi tiết đơn (`frontend/app.js`).
Độ khó: M.

### 4. Gợi ý giá khi đăng tin từ dữ liệu sàn thật
Mô tả: Lúc seller nhập giá + danh mục + tình trạng, hiện khoảng giá đề xuất (trung vị, min–max) từ tin ACTIVE/SOLD cùng danh mục + lịch sử giá, cảnh báo giá cao hơn 30% so với thị trường. Kiểu eBay Product Research/pricing guidance nhưng làm gọn bằng dữ liệu nội bộ. Tăng chất lượng tin, chống ngáo giá.
Backend: `GET /listings/price-suggestion?categoryId=&condition=` trong `src/routes/listings.js`, truy vấn aggregate trên `Listing` + `PriceHistory` (+ `Order` COMPLETED nếu muốn giá khớp thật); cache nhẹ. Frontend: tooltip gợi ý ngay form đăng tin trong `frontend/app.js`.
Độ khó: S (M nếu thêm biểu đồ phân phối giá).

### 5. Theo dõi shop + feed + bộ sưu tập của shop
Mô tả: Buyer follow shop, nhận notif khi shop ra tin mới/giảm giá; shop gom tin vào collections (Hàng mới về, Sale, Đồng giá). Kiểu Poshmark follow/share + Carousell Custom Collections. Tận dụng sẵn `/shops/:id` + saved-searches notif.
Backend: bảng `ShopFollow`, `ShopCollection` + `CollectionItem`; `POST /shops/:id/follow`, `GET /feed/following`, CRUD collections trong `src/routes/shops.js`, hook notif vào `src/services/saved-searches.js` + `src/routes/notifications.js`. Frontend: nút Theo dõi ở trang shop + tab "Đang theo dõi" + UI collections (`frontend/app.js`).
Độ khó: S.

### 6. Kiểm định hàng hiệu cho tin giá trị cao (bản demo nhẹ)
Mô tả: Tin thuộc danh mục/ngưỡng giá (ví dụ túi/giày ≥2 triệu) gắn huy hiệu kim cương "Đủ điều kiện kiểm định" kiểu Vinted/eBay; buyer tick chọn kiểm định khi checkout, phí kiểm định cộng vào tổng; đơn đi qua trạng thái `IN_VERIFICATION` trước khi ship cho buyer, fail thì trả seller + hoàn buyer. Bản đồ án: làm cờ + luồng trạng thái + phí, chưa cần hub thật.
Backend: thêm field `verificationRequired/verificationStatus` (schema.prisma), `POST /orders/:id/verification` trong `src/routes/orders.js` (+ nhánh phí trong `src/utils.js` tính phí sàn), admin duyệt trong `src/routes/finance.js` hoặc `admin-users.js`. Frontend: huy hiệu + checkbox ở chi tiết tin/checkout (`frontend/app.js`, `frontend/marketplace.js`).
Độ khó: M (bản demo cờ + trạng thái); L nếu hub + đối tác thật — không nên.

### 7. Chat realtime + đã xem/đang nhập + phân trang cursor (sửa đúng DE_XUAT 2.3)
Mô tả: Gắn Socket.IO cho chat 1-1 theo cặp (user, listingId), typing indicator, đã xem tới messageId, tải thêm lịch sử bằng cursor thay vì 100 tin đầu. Giữ nguyên chặn user + rate limit 30/phút. Demo realtime luôn gây ấn tượng, và sửa bug mất tin mới hiện tại.
Backend: thêm Socket.IO vào `src/app.js`, auth socket bằng JWT hiện tại (`src/middleware.js`), sửa `src/routes/chat.js` (cursor `beforeId`, đánh dấu đọc theo `listingId`). Frontend: socket client + vùng chat trong `frontend/app.js`.
Độ khó: M.

### 8. Sự kiện săn đồ theo chủ đề (Posh Party bản tĩnh — demo vui, rẻ)
Mô tả: Admin tạo event theo khung giờ + chủ đề (/component Vinted/Posh Trends: "Túi hiệu dưới 500k", "Đồ denim"), seller share tin vào event, buyer lọc/săn trong trang event, chốt bằng luồng đơn hiện tại. Chưa cần livestream; live để dành nếu còn thời gian (dùng sẵn upload + chat). Tái dùng banner/promo.
Backend: bảng `Event` + `EventListing`; CRUD admin trong `src/routes/banners.js` hoặc file mới `src/routes/events.js`, `POST /events/:id/share`, `GET /events/:id/listings`. Frontend: trang event + nút "Chia sẻ vào sự kiện" (`frontend/app.js`).
Độ khó: S (bản tĩnh); L nếu thêm live — không nên cho đồ án.

### 9. Freeship do shop tài trợ + huy hiệu bền vững (gộp 2 việc nhỏ, demo tốt)
Mô tả: (a) Seller bật "Miễn ship cho bundle/tin này", phí ship trừ vào thu hộ seller thay vì buyer, hiển thị nhãn Freeship ở tin/bundle — sửa đúng lỗi FREESHIP trừ nhầm vào giá món (DE_XUAT 2.1). (b) Hồ sơ buyer/seller hiện "Đã cứu X món khỏi bãi rác ≈ Y kg CO2", huy hiệu seller xanh khi bán lại >N món — kiểu sứ mệnh secondhand-first của Carousell/Vinted, chi phí gần 0.
Backend: (a) tách `shippingFee/shopShippingSupport` trong `src/utils.js` + `src/routes/orders.js`/`promos.js`; (b) aggregate đơn COMPLETED trong `src/routes/users.js` hoặc `src/services/reputation.js`. Frontend: nhãn Freeship + card tác động xanh ở trang shop/profile (`frontend/app.js`, `frontend/marketplace.js`).
Độ khó: S.

## 3. Không đề xuất (đã có hoặc quá sức đồ án)
- Bump/boost nâng cao nhiều gói ngày + Smart Bump: đã có boost 24h; Chợ Tốt/Carousell làm phức tạp (slot đấu giá theo chuyên mục/tỉnh) — để sau.
- Livestream bán hàng (Posh Shows): giá trị cao nhưng cần WebRTC/SFU, kiểm duyệt live — vượt scope; làm event tĩnh (#8) trước.
- Vận chuyển tích hợp + prepaid label + tracking hãng (FB/Carousell Protection): cần hợp đồng GHTK/GHN + webhook — đồ án chỉ nên dừng ở freeship tài trợ (#9) + trackingCode tay đã có ở returns.
- Ví đa tiền tệ / thanh toán quốc tế (Adyen/Vinted KYC full): đã có ví nội bộ + KYC demo; không mở rộng.
- Đổi đồ / trade-in (swap): ít nền tảng làm chuẩn, dễ kẹt định giá 2 chiều + tranh chấp kép.
- Đấu giá (eBay Auction): xung đột luồng giữ món 30 phút + escrow hiện tại.

## 4. Nguồn chính (đã kiểm chứng)
- Poshmark tính năng & công cụ (Bundle, Offer to Likers, Parties, Vacation Hold, Sales/Inventory Report — blog chính thức): https://blog.poshmark.com/2026/01/25/your-complete-guide-to-poshmarks-features-tools
- Vinted Buyer Protection fee (Help): https://www.vinted.com/help/342-buyer-protection-fee-on-vinted
- Vinted Item Verification designer (Help): https://www.vinted.com/help/1147-item-verification-for-designer-items
- Vinted KYC/ID qua Adyen (Help): https://www.vinted.com/help/15/111-why-you-may-be-asked-for-your-id
- Vinted Help Center (mục Buying/Selling/Trust): https://www.vinted.com/help
- eBay Authenticity Guarantee thời trang (Pressroom): https://www.ebayinc.com/stories/press-room/uk/ebay-launches-authenticity-guarantee-for-apparel
- eBay Authenticity túi (eBay): https://ebay.com/authenticity-guarantee/handbags
- eBay Best Offer + Offer to buyers (Seller Center): https://www.ebay.com/sellercenter/growth/seller-hub-discounts/offers-to-buyers-best-offer
- eBay định giá + Product Research (Help/Export guide): https://www.ebay.com/help/selling/selling/pricing-items?id=4133 ; https://export.ebay.com/en/first-steps/how-to-price-your-items
- Facebook Marketplace shipping + Purchase Protection + claim 3–7 ngày (Help): https://www.facebook.com/help/2203975773467109 ; https://www.facebook.com/help/228307904608701 ; https://www.facebook.com/help/876687301860562
- Facebook ratings buyer/seller (Help): https://www.facebook.com/help/915385548593204
- Facebook delivery (Help): https://www.facebook.com/help/796066857221106
- Chợ Tốt Tin Ưu Tiên (Trợ giúp): https://trogiup.chotot.com/nguoi-ban/tin-uu-tien-la-gi
- Chợ Tốt Đẩy tin thông minh (Trợ giúp): https://trogiup.chotot.com/nguoi-ban/day-tin-thong-minh
- Carousell Bumps (Blog chính thức): https://blog.carousell.ph/pro-tips/carousell-bumps
- Carousell Buy button + Protection: https://www.carousell.sg/changes-to-list-with-buy-button/l
- Carousell Custom Collections (Help): https://support.carousell.com/hc/en-us/articles/360061023654--Singapore-CarouBiz-tools-Custom-Collections
- Carousell Group secondhand-first + Cho Tot (LinkedIn): https://sg.linkedin.com/company/carousellgroup
- An toàn giao dịch Carousell (MHA tóm tắt Carousell Safety Policy): https://www.mha.gov.sg/e-commerce-marketplace-transaction-safety-ratings/carousell
- Depop Boosted Listings Policy (Help/Zendesk): https://depophelp.zendesk.com/hc/en-gb/articles/9253129255569-Boosted-Listings-Policy
- Posh live/bundle so với Depop (Vendoo so sánh + CNBC bối cảnh live resale): https://blog.vendoo.co/selling-on-poshmark-vs.-selling-on-depop ; https://www.cnbc.com/2023/03/24/depop-poshmark-secondhand-resale-cutthroat.html
- Poshmark Live: https://poshmark.com/live
