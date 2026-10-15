# Đợt hoàn thiện 2 — 15/10/2026

Không commit/push theo yêu cầu trước đó. Chỉ đánh dấu hoàn tất sau khi có backend, frontend và kiểm tra phù hợp.

## Sửa 5 điểm ưu tiên

- [x] Phân quyền cấp role riêng; chặn tự nâng quyền và bảo vệ tài khoản admin.
- [x] Hoàn escrow đọc lại số tiền sau khi khóa đơn; kiểm thử chạy đồng thời.
- [x] Thu hồi phiên cũ khi đổi/reset mật khẩu và đăng xuất.
- [x] Rút tiền chờ duyệt, giữ tiền, chuyển có chứng từ, thất bại hoàn giữ.
- [x] Hạn mức đơn chưa cọc và chống spam theo tài khoản; chặn người nhắn.

## Ba tính năng được chọn

- [x] Trả hàng: yêu cầu → duyệt → gửi trả → nhận lại → hoàn tiền; giới hạn 7 ngày.
- [x] Hồ sơ uy tín shop: đơn hoàn tất, tỷ lệ hủy, phản hồi thực tế, huy hiệu email/danh tính riêng.
- [x] So sánh tối đa 3 sản phẩm: giá, tình trạng, thông số, vị trí và lịch sử giá.

## Phạm vi và quy tắc

Các thay đổi đi qua schema/migrations, auth/middleware, orders/escrow/wallet/chat/listings/reports, shop API và frontend. Thêm kiểm thử tiền, quyền, nonce, chuyển trạng thái và giới hạn; kiểm tra trên browser/PostgreSQL khi khả dụng. Không dùng khóa dịch vụ bên ngoài hoặc đổi số dư của tài khoản hiện có để thử nghiệm.

Trả hàng sau COMPLETED cần giữ đủ khoản hoàn từ ví seller trước khi duyệt; phí sàn đã thu không tự hoàn. Trả hàng khi escrow HELD giữ nguyên tiền cho tới lúc hoàn. COD hoàn ngoài ví có xác nhận seller và buyer, không cộng giả vào ví. Chứng từ chuyển khoản do admin xác nhận; không tích hợp chuyển ngân hàng tự động trong đợt này.

## Kết quả kiểm tra thực tế

1. `npm test`: 41 ca trong 5 file đạt; bao phủ tiền, quyền, chuyển trạng thái, giới hạn và frontend so sánh/logout. Node hiện tại báo kết quả theo 5 file chạy thành công.
2. PostgreSQL thật: kiểm tra qua HTTP của ứng dụng gồm tự nâng quyền bị chặn, email một lần, đổi/reset/logout thu hồi token; rút tiền retry không giữ hai lần, duyệt/chứng từ/ghi sổ/từ chối; hoàn đủ tiền khi thanh toán và hoàn chạy đồng thời.
3. PostgreSQL thật: trả hàng khi còn escrow, sau giải ngân (thiếu/đủ tiền seller), COD cần buyer xác nhận, không bỏ bước/hoàn hai lần; tối đa 3 đơn chờ cọc, chặn chat, uy tín đo từ dữ liệu và giới hạn API so sánh. Ảnh riêng trả 401/403 cho người không có quyền và 200 cho bên liên quan.
4. Browser desktop 1440px/mobile 390px: bảng so sánh, giới hạn chọn 3, shop, trả hàng admin, rút tiền admin, phân quyền có chọn sẵn role, form đổi mật khẩu và số dư đang giữ. Ảnh riêng hiển thị bằng blob sau khi sửa CSP; không tràn ngang trang. Thông số chưa nhập được ghi rõ thay vì bịa dữ liệu.
5. Prisma Client đã generate; `npx prisma migrate status` xác nhận đủ 7 migrations, database đồng bộ. Kiểm thử tích hợp nằm ở `scripts/check-secure-workflows.cjs` (`npm run test:phase3`), chỉ chạy chủ động trên localhost development có LOCAL_OUTBOX.

Kiểm thử tích hợp tạo tài khoản/tin/đơn mang tiền tố QA trên database development. Tài khoản QA đã khóa, tin QA xóa mềm; giữ yêu cầu, ledger và audit để đối soát, không đổi số dư tài khoản demo hiện có. Không thực hiện chuyển ngân hàng thật, gửi email thật hoặc đăng nhập Google thật.

## Mở các màn mới

- Người mua/người bán: `#/returns`, hoặc mở đơn đã giao → “Yêu cầu trả hàng”.
- Admin tài chính: `#/admin/returns`, `#/admin/withdrawals`; quản lý được cấp quyền riêng mới thấy `#/admin/permissions`.
- Shop: `#/shop/2`; so sánh: nút “⇄ So sánh” trên thẻ hoặc `#/compare?ids=1,2,3`.
- Ví và bảo mật: `#/wallet`, `#/profile`; chặn/bỏ chặn trong `#/chat`.

Ảnh bằng chứng upload mới dùng `.local/evidence/` có kiểm tra quyền, cần giữ thư mục khi triển khai. URL ảnh công khai cũ hoặc URL bên ngoài vẫn công khai; đợt này không di chuyển dữ liệu ảnh cũ. Chỉ số phản hồi dùng tối đa 10.000 tin trong 90 ngày; chưa có tin thì hiển thị “Chưa có dữ liệu”. Tỷ lệ hủy gồm cả hai bên/hết hạn cọc, không quy lỗi cho seller. Những mục còn lại trong báo cáo đề xuất cũ chưa nằm trong đợt này.
