# Rà soát bổ sung — 15/10/2026

**Cập nhật:** 5 điểm ưu tiên ở mục 1 đã sửa và kiểm thử trên PostgreSQL trong đợt 2; thêm trả hàng, uy tín shop và so sánh. Xem [TIEN_DO_DOT_2.md](TIEN_DO_DOT_2.md). Nội dung bên dưới giữ lại phát hiện gốc; các mục khác chưa được coi là đã sửa.

Ưu tiên sửa quyền quản trị và lỗi hoàn tiền trước khi thêm chức năng. Lượt này chỉ đọc mã và mô phỏng với Prisma/JWT giả; không sửa backend/frontend, không thay quyền, số dư hoặc mật khẩu trên database thật. Các kiểm thử đã có chưa bao phủ hết tình huống dưới đây.

P0: sửa đầu tiên. P1: hoàn thiện trước khi nhận người dùng/giao dịch thật. P2: sửa để nghiệp vụ và demo chính xác hơn. Thời gian là ước lượng cho người triển khai, gồm kiểm thử, chưa tính chờ dịch vụ bên ngoài.

## 1. Quyền, tiền và tài khoản — 5 điểm ưu tiên

| Mức | Vị trí và nguyên nhân | Tác động | Cách cải thiện |
|---|---|---|---|
| P0 | `src/routes/admin-users.js:9,105`: cả ADMIN_CONTENT và ADMIN_FINANCE qua middleware; endpoint gán role không có quyền riêng hoặc chặn tự nâng quyền. | Admin nội dung có thể gán ADMIN_FINANCE cho chính mình, rồi truy cập luồng tài chính. Đã mô phỏng được. | Quy định người được cấp quyền admin, chặn tự nâng quyền, bảo vệ admin cuối cùng, ghi audit cùng giao dịch. Không chỉ ẩn nút frontend. Khoảng 2–4 giờ. |
| P1 | `src/routes/escrow.js:71,84,99`: đọc escrow trước transaction, dùng số tiền cũ sau khi khóa order. | Nếu thanh toán phần còn lại thắng trước transaction hoàn tiền, số hoàn có thể thiếu. Mô phỏng escrow 20.000đ + trả thêm 80.000đ: khoản giữ là 100.000đ nhưng chỉ hoàn 20.000đ và đánh dấu REFUNDED. | Khóa order trước, đọc lại escrow trong transaction, hoàn theo số dư đã khóa, kiểm thử hai thứ tự chạy đồng thời bằng PostgreSQL thật. Khoảng 3–6 giờ. |
| P1 | `src/routes/wallet.js:51`: rút tiền trừ ví bằng ledger SUCCESS, nhưng không có thực thể yêu cầu rút/duyệt/chuyển ngân hàng. Phí ghi amount=0, balanceAfter=0. | Yêu cầu rút bị coi là giao dịch xong dù chưa chuyển tiền; thiếu đường từ chối và hoàn số tiền giữ. Báo cáo phí rút và số dư lịch sử cũng sai. | Yêu cầu PENDING → APPROVED → PAID hoặc REJECTED/FAILED; giữ tiền trong pendingBalance, admin xử lý, chứng từ chuyển tiền và hoàn giữ khi thất bại; ledger ghi phí/số dư đúng. Khoảng 1–2 ngày. |
| P1 | `src/routes/auth.js:15,233`, `src/middleware.js:14`: JWT không có version phiên; reset chỉ đổi hash mật khẩu. | Token đăng nhập cũ vẫn có thể dùng sau khi đổi mật khẩu, tới lúc hết hạn (mặc định 7 ngày), nếu user vẫn ACTIVE. Đã mô phỏng middleware chấp nhận. | Thêm version phiên hoặc mốc thu hồi; đổi mật khẩu/đăng xuất mọi thiết bị làm token cũ hết hiệu lực; access token ngắn hạn, refresh có quản lý. Khoảng 4–8 giờ. |
| P1 | `src/app.js:34`, `src/routes/orders.js:31`, chat/report/listing create: chưa có hạn mức nghiệp vụ theo tài khoản. | Tạo nhiều đơn chưa cọc có thể giữ hàng hàng loạt 30 phút; spam tin nhắn, báo cáo hoặc tin đăng. Các rate limit hiện có chỉ phủ một số API và không thay hạn mức tài khoản. | Giới hạn đơn chờ cọc đang mở, tốc độ gửi chat/đăng tin/báo cáo; yêu cầu xác nhận phù hợp ở thao tác nhạy cảm; thêm nút chặn người nhắn. Khoảng 4–8 giờ. |

Mô phỏng chỉ chứng minh các đường xử lý trong mã. Lỗi hoàn tiền cần kiểm thử tích hợp transaction PostgreSQL khi sửa; không thử trên số dư thật của user.

## 2. Nghiệp vụ và giao diện — 5 điểm còn yếu

1. **Khuyến mãi chưa phân biệt loại.** `orders.js:50` áp mọi loại promo vào giá món, không rẽ nhánh FREESHIP/PLATFORM_FEE_DISCOUNT/BOOST. FREESHIP giảm 20.000đ nhưng phí ship cố định 15.000đ sẽ giảm thêm 5.000đ vào giá món. Tên “đơn đầu tiên” chưa có kiểm tra lịch sử mua. Nên dùng chung một hàm tính giá cho màn xem trước và checkout, tách tiền hàng/ship/phí sàn, quy định hạn mức mỗi user và cách xử lý voucher khi hủy.
2. **Giao nhận và cho tặng chưa có luồng riêng.** `orders.js:68` luôn cộng 15.000đ; phương thức MEETUP của offer và deliveryMethod của listing chưa được dùng để tính/kiểm tra nhận hàng. Tin 0đ cũng đi qua phí và cọc như món bán. Nên có lựa chọn nhận hàng hợp lệ theo tin, gặp trực tiếp không ship, đồ cho tặng có lịch nhận và xác nhận bàn giao. COD cần rõ đây là seller khai báo, chưa có xác nhận từ hãng vận chuyển.
3. **Chat dài sẽ mất phần mới trên màn hình.** `chat.js:57` lấy 100 tin đầu theo thời gian tăng dần. Khi hội thoại vượt 100 tin, các tin mới không nằm trong kết quả. Đếm/đánh dấu đã đọc cũng chưa giới hạn theo listingId của hội thoại đang mở. Nên lấy trang mới nhất, tải lịch sử cũ bằng cursor, đánh dấu đọc đúng hội thoại, rồi mới thêm realtime.
4. **Khóa 7 ngày chưa thực sự hết hạn.** `reports.js:92` xử BAN_7_DAYS giống BAN_PERMANENT, chỉ khác banReason. Không có banUntil hoặc điều kiện tự mở khóa. Nên lưu hạn khóa và hiển thị thời điểm mở lại. Report nhận targetUserId từ client (`reports.js:17`) cũng cần xác định lại chủ nội dung trên server trước khi xử phạt.
5. **Đẩy tin có thể trừ phí nhiều lần nhưng không cộng thêm thời gian.** `listings.js:273` mỗi lần trừ phí và đặt hạn thành now+24h, kể cả đang còn boost; chưa hạn chế trạng thái tin. Nên chặn tin không thể xuất hiện công khai, cho chọn gia hạn từ hạn hiện tại hoặc báo đã bật, và chống gửi lại cùng yêu cầu.

Khoảng 1–3 ngày cho cả nhóm này, tùy độ sâu giao diện và quy tắc giao nhận/cho tặng được chọn.

## 3. Dữ liệu, riêng tư và vận hành — 5 điểm cần củng cố

1. **Huy hiệu xác minh còn mơ hồ.** isVerified được dùng cho email và admin xác minh, trong khi idVerified đã là field riêng. UI “đã xác thực” không nói rõ loại xác thực. Nên tách “Email đã xác nhận” và “Danh tính đã duyệt”; hồ sơ uy tín lấy từ giao dịch hoàn tất, hủy đơn và phản hồi, không chỉ một cờ boolean.
2. **Upload và bằng chứng.** `upload.js:15` kiểm tra signature cơ bản, chưa giải mã ảnh để kiểm tra cấu trúc/kích thước pixel. File upload không có quota tài khoản hoặc dọn file không được dùng. `/uploads` công khai cả file bằng chứng nếu có URL. Nên xác thực/chuẩn hóa ảnh, giới hạn pixel và dung lượng lưu, xóa file bỏ trống; ảnh sản phẩm công khai nhưng bằng chứng có quyền buyer/seller liên quan và admin. Rate limit IP hiện tại không thay quota tài khoản.
3. **Phân tích cảm xúc dễ hiểu sai phủ định.** `ai.js:15` nhận “hài lòng” là tích cực ngay cả câu “Không hài lòng” và rating 1. Mô phỏng trả POSITIVE. Nên thêm kiểm thử phủ định/mỉa mai, nhãn không chắc chắn và liên kết về nhận xét gốc. Không dùng kết quả này tự khóa shop. Review hiện chỉ có một bản ghi mỗi order dù UI cho chọn SELLER hoặc PRODUCT; nếu muốn đánh giá cả hai cần quy định/schema phù hợp.
4. **Thống kê và tác vụ nền.** `finance.js:/revenue` byCategory cộng platformFee trên đơn hoàn tất, trong khi tổng tháng dùng ledger thực thu; số này có thể lệch khi giải ngân bị giới hạn hoặc xử tranh chấp. `app.js:74` hết hạn giữ món chạy trong process web; server dừng thì tác vụ dừng. Nên đối soát cùng nguồn ledger, lưu tác vụ bền vững, có retry và theo dõi lỗi.
5. **Cấu hình và phản hồi lỗi.** Token nằm trong localStorage; nếu phát sinh XSS thì dễ bị đọc. CORS đang cho mọi origin, errorHandler trả nguyên err.message cho lỗi 500, một số query/ngày/giá chưa có giới hạn phù hợp kiểu Int PostgreSQL. Nên giới hạn origin, ẩn chi tiết lỗi production, kiểm tra đầu vào, bảo vệ phiên và xác nhận lại thao tác nhạy cảm. Đây là phần gia cố; chưa chứng minh XSS hoặc lấy cắp token thực tế. Mã đơn ngẫu nhiên chỉ có 90.000 khả năng, cần mã đủ lớn và xử lý trùng khi dữ liệu tăng.

## 4. Năm tính năng mới có ích sau khi sửa các lỗi trên

| Thứ tự | Tính năng | Giá trị và phiên bản nhỏ nhất |
|---|---|---|
| 1 | Trả hàng/hoàn tiền có tiến trình | Yêu cầu → duyệt → nhận hàng trả → hoàn tiền; ảnh bằng chứng và thời hạn, phân biệt khoản SafePay với COD. Tránh hiện lại món khi chưa nhận hàng về. |
| 2 | Lịch hẹn gặp trực tiếp + mã bàn giao | Buyer/seller thống nhất địa điểm/giờ; mã một lần xác nhận nhận hàng, bảo vệ thông tin địa điểm trước khi hai bên đồng ý. |
| 3 | Hồ sơ uy tín shop | Số đơn hoàn tất, tỷ lệ hủy, thời gian phản hồi, đánh giá từ giao dịch; huy hiệu email/danh tính rõ ràng. Hiển thị cách tính, tránh điểm số khó kiểm chứng. |
| 4 | So sánh tối đa 3 sản phẩm | Giá, tình trạng, thông số, vị trí, lịch sử giá, shop; dùng lại dữ liệu đã có. Hữu ích nhất cho điện tử và gia dụng. |
| 5 | Xuất CSV/Excel và sao kê đối soát | Seller xuất đơn/doanh thu; admin xuất thu phí, hoàn tiền và yêu cầu rút theo khoảng ngày. Đảm bảo đúng quyền và dùng cùng bộ lọc trên màn hình. |

Chống spam/chặn user và sửa phân trang chat nằm trong phần cần cải thiện ở trên; realtime có thể bổ sung sau khi lịch sử và trạng thái đọc hoạt động đúng. Chưa cần thêm nhiều AI hoặc xây ứng dụng mobile để giải quyết những vấn đề đã xác định.

## 5. Phạm vi và tài liệu đối chiếu

Đã đọc backend, schema và các caller frontend liên quan. Đã mô phỏng nâng quyền, token cũ, race hoàn tiền và phủ định cảm xúc bằng dependency giả. Không gọi các API để đổi role, hoàn/rút tiền, reset mật khẩu hoặc gửi tin nhắn trên database thật; không sửa mã ứng dụng trong lượt này. Chưa pentest toàn hệ thống, stress test hoặc kiểm thử dịch vụ thanh toán bên ngoài.

Quyền tối thiểu và kiểm tra mọi request: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Thu hồi phiên sau khôi phục mật khẩu: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Hạn mức API/tài nguyên: [OWASP API4](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).
