# Giao diện Nola2Hand — đợt nâng cấp

## Hướng thiết kế

Sàn đồ cũ dễ tìm, dễ kiểm tra tình trạng, dễ trao đổi. Giữ màu xanh nhận diện, dùng ảnh sản phẩm thật làm trọng tâm thay vì biểu tượng lớn và banner chữ. Tham khảo tổ chức tìm kiếm/danh mục của [eBay](https://www.ebay.com/d/homepage), [typography](https://playbook.ebay.com/foundations/typography) và [theming tokens](https://playbook.ebay.com/design-system/tokens/theming-tokens) của eBay Playbook; trải nghiệm mua bán đồ đã qua sử dụng của [Carousell](https://www.carousell.sg/). Áp dụng nguyên tắc phân cấp chữ và màu theo vai trò, không sao chép font độc quyền, logo hay nội dung quảng cáo của các sàn.

## Hệ thống

- Màu: xanh Nola `#087f5b`, xanh đậm `#065f46`, nền `#f5f7f9`, chữ `#182b26`, đường viền `#e1e7e5`, điểm nhấn vàng `#f4cf58`.
- Chữ: Be Vietnam Pro, hỗ trợ tiếng Việt; tiêu đề 24–42px, nội dung 12–16px, chú thích nhỏ hơn theo mật độ màn hình. Trường nhập mobile 16px để tránh tự phóng khi gõ trên iOS. Dự phòng system-ui nếu font mạng không tải.
- Bố cục: căn trái, khung tối đa 1280px; tìm kiếm nổi bật; banner ảnh sản phẩm + thông điệp ngắn; danh mục ngay dưới; bộ lọc cạnh lưới sản phẩm. Admin dùng sidebar và vùng làm việc riêng, seller có điều hướng rõ.
- Thành phần: icon nét đồng nhất, nút chính xanh, nút phụ viền, trạng thái có chữ, bảng dễ quét, trường nhập 44px; góc bo 8–20px theo chức năng, giảm bóng đổ.
- Mobile: hai sản phẩm mỗi hàng, khu vực tìm kiếm riêng, điều hướng dưới màn hình, bộ lọc thu gọn, bảng cuộn bên trong; hỗ trợ focus bàn phím và giảm chuyển động.

```text
Logo       Tìm sản phẩm                  Lưu / Chat / Giỏ
Danh mục         Gian hàng       Theo dõi       Bán đồ
┌ Thông điệp + nút mua ──────────┬ Ảnh sản phẩm thật ┐
└───────────────────────────────┴───────────────────┘
Danh mục     Danh mục     Danh mục     Danh mục
Bộ lọc       Sản phẩm     Sản phẩm     Sản phẩm
```

## Phạm vi

Header/footer, trang chủ, danh mục/tìm kiếm, thẻ và chi tiết sản phẩm, shop, đăng nhập/đăng ký, hồ sơ, ví, đơn hàng/trả hàng, chat/thông báo, so sánh, kênh seller và admin. Giữ API và các bước nghiệp vụ hiện có. Không thêm khuyến mãi, giá cũ, đánh giá, số đơn hay nhãn kiểm định giả để trang trông đông hơn.

Ưu tiên một banner ảnh có chủ đích; các màn quản lý giữ nền trung tính để đọc số liệu. Không dùng gradient trang trí đại trà hoặc cỡ chữ nhỏ để nhồi dữ liệu.

## Kết quả triển khai và kiểm tra

1. Header/footer và wordmark mới; font Be Vietnam Pro, bảng màu xanh ngọc, icon SVG nét đồng nhất. Banner dùng sản phẩm ACTIVE và giá thật từ API; kết quả tìm kiếm có tiêu đề riêng, bỏ banner khám phá và gợi ý ngoài bộ lọc.
2. Danh mục/thẻ sản phẩm/chi tiết/shop/so sánh cùng hệ thống; thông tin tình trạng và giá dễ quét. Chi tiết dẫn tới hồ sơ uy tín thay vì lặp số liệu cached. Trên điện thoại có menu dưới, bộ lọc thu gọn; thanh so sánh nằm trên menu, toast mới thay toast cũ và không đè thanh so sánh.
3. Hồ sơ/ví/đơn/trả hàng có thanh điều hướng tài khoản; chat, form, trạng thái và bảng được đồng bộ. Seller có sidebar riêng, KPI trước biểu đồ. Buyer mở kênh seller thấy màn bắt đầu bán, khách chưa đăng nhập tới login. Không tự cấp role khi chỉ xem màn.
4. Admin tài chính/nội dung có sidebar sáng, icon và bảng dễ đọc. Hộp thoại có nút đóng, role dialog, nhãn trường nhập, focus ban đầu, chặn Tab ra ngoài và Escape để đóng; giảm chuyển động theo thiết lập hệ thống.
5. `npm test`: 46 ca trong 5 file đạt, gồm 5 ca mới cho bộ lọc mobile, menu active, escape dữ liệu thẻ sản phẩm, onboarding seller và kết quả tìm kiếm. Kiểm tra cú pháp các file frontend/test đã sửa đạt. Không sửa schema/database hoặc thực hiện giao dịch tiền trong lượt nâng cấp này.

Browser Chromium: 51 lượt trang mua sắm/tài khoản ở 390/768/1440px; 36 lượt seller/admin ở 390/1440px; 9 lượt login/register/forgot ở 390/768/1440px. Chờ render/API hoàn tất trước đo; cả 96 lượt không tràn ngang trang hoặc hiện lỗi tải. Xem thêm ảnh thực tế ở `artifacts/ui-home-desktop.png` và `artifacts/ui-home-mobile.png`.

Kiểm tra tương tác: tìm kiếm qua header, lọc địa điểm qua form, chọn tối đa 3 món, đăng nhập bằng form, menu tài khoản, onboarding seller, focus đầu vào trong hộp thoại; hai cạnh vòng Tab và Escape kiểm bằng DOM KeyboardEvent. Công cụ phát phím native không tạo được thao tác ổn định nên không coi là bằng chứng keyboard E2E trên thiết bị thật. Console ở lượt cuối không có lỗi; font Be Vietnam Pro đã tải thành công.

Giới hạn: chưa kiểm Safari/iPhone/Android thật hoặc trình đọc màn hình; font Google Fonts cần mạng và có system-ui dự phòng. Các lời nhắc xác nhận/trường nhập native đã có ở một số thao tác quản trị vẫn dùng hộp thoại của trình duyệt. Không sao chép giao diện hoặc font độc quyền của sàn tham khảo; giữ các HTML mẫu bên ngoài để đối chiếu.
