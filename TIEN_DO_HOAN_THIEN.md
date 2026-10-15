# Hoàn thiện Nola2Hand

Cập nhật 15/10/2026: [đợt 2](TIEN_DO_DOT_2.md) bổ sung 5 sửa lỗi + 3 tính năng; tổng 41 ca kiểm thử đạt và đã chạy các luồng tiền/quyền qua HTTP với PostgreSQL thật. Các ghi chú “chưa E2E” bên dưới là trạng thái của đợt trước.

Không commit/push theo yêu cầu mới nhất. Các mục dưới chỉ được đánh dấu sau khi có mã và kiểm tra tương ứng.

- [x] 1. Đặt cọc, hết hạn giữ món, thanh toán còn lại và giải ngân đúng số tiền. Kiểm thử hết hạn/race/cọc/hoàn/phí/COD bằng mock giao dịch; chưa chạy đầy đủ luồng tiền E2E.
- [x] 2. Email xác nhận/reset, cấu hình Google và upload ảnh thật. Kiểm thử token một lần, che thông tin bí mật, chữ ký ảnh/dung lượng và request email giả lập; chưa gửi email thật/đăng nhập Google thật.
- [x] 3. Tìm kiếm địa điểm/giao nhận/xác minh, thẻ lọc, nhớ vị trí cuộn. Kiểm thử URL, điều hướng danh mục và mobile 390px.
- [x] 4. Sửa/xem trước tin, inbox trả giá, dashboard doanh thu thực thu. Các màn/API seller mở với database thật; kiểm thử chặn tin RESERVED và thu ròng ví.
- [x] 5. Tìm kiếm/phân trang admin, bằng chứng tranh chấp, nhật ký quản trị. Màn admin mở với database thật; buyer bị chặn audit (403); kiểm thử chống xử tranh chấp hai lần và phí một lần.
- [x] 6. Lịch sử giá và biểu đồ. API trả 200, biểu đồ Chart.js tạo thành công trên chi tiết tin; lấy 300 lần điều chỉnh gần nhất.
- [x] 7. Theo dõi tìm kiếm và thông báo tin phù hợp. Tạo/tắt/xóa thử trên database thật; kiểm thử chống báo trùng. Duyệt tin, audit và thông báo nằm trong cùng giao dịch.
- [x] 8. Hồ sơ tình trạng theo danh mục. Có trường cho điện tử/nội thất/gia dụng; kiểm thử khóa/số không hợp lệ; API definitions trả 200.
- [x] 9. Chatbot tìm tin thật với AI khi có cấu hình; chế độ tìm kiếm cục bộ hiển thị rõ. API trả 200/LOCAL; quy tắc cục bộ đọc ngân sách/địa điểm; request AI và fallback đã kiểm thử giả lập.
- [x] 10. Phân tích cảm xúc, tổng hợp cho seller/admin, giữ nguyên đánh giá gốc. API/màn thống kê đọc database thật; kiểm thử phân loại/fallback; đánh giá cũ dùng quy tắc cục bộ khi tổng hợp.

## Xác minh ngày 15/10/2026

Migration đã được người dùng khôi phục quyền owner; `npx prisma migrate status` báo **Database schema is up to date**. API sản phẩm đọc được các cột mới; PriceHistory và SavedSearch hoạt động trên database thật. Prisma schema validate và cú pháp JavaScript đạt.

Có 25 ca kiểm thử trong 3 file (Node 26 báo 3 file ở tổng kết `npm test`): 13 nghiệp vụ/bảo mật, 4 điều hướng, 8 dịch vụ mới. Đã mở 5 màn seller, 6 màn admin, danh mục và chi tiết tin. Các màn mobile được kiểm tra không tràn ngang. Thử nghiệm SavedSearch đã xóa dữ liệu thử sau khi kiểm tra.

## Giới hạn còn cần cấu hình hoặc kiểm tra khi triển khai

1. Email Resend, OAuth Google và OpenAI cần cấu hình `.env` của chủ dự án. Email/AI hiện đã kiểm tra bằng request giả lập; chưa xác minh bằng dịch vụ thật. Development thiếu email lưu thư riêng trong `.local/mail/`.
2. Chưa chạy E2E đầy đủ việc mua bán/cọc/thanh toán/hoàn trên database thật; các nhánh tiền và xung đột có kiểm thử mock. SafePay là ví nội bộ; MoMo/VietQR chưa tích hợp webhook, COD là seller khai báo rồi buyer xác nhận.
3. Upload lưu file tại máy chủ; cần giữ `uploads/` khi triển khai. Ngày 15/10 đã thay ảnh lỗi của 4 sản phẩm demo bằng ảnh phù hợp lưu trong `frontend/assets/products/`; nguồn và giới hạn minh họa ghi ở README tại đó. Banner demo bên ngoài chưa được thay.
4. Thông báo theo dõi nằm trong ứng dụng, không gửi email/push. Phân tích tối đa 500 đánh giá gần nhất là ước lượng, không thay thế đọc nội dung gốc.
5. Không commit/push theo yêu cầu người dùng. Không đưa khóa, `.env`, mail hay ảnh upload vào Git.
