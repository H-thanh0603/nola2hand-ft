// Seed dữ liệu demo khớp với prototype (user/seller/admin trong Figma)
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');
const productPhotos = require('../frontend/assets/products/sources.json');

async function main() {
  console.log('🌱 Seeding Nola2Hand...');

  // Roles
  const roleNames = [
    ['BUYER', 'Người mua'],
    ['SELLER', 'Người bán'],
    ['ADMIN_FINANCE', 'Admin tài chính'],
    ['ADMIN_CONTENT', 'Admin nội dung'],
  ];
  for (const [name, description] of roleNames)
    await prisma.role.upsert({ where: { name }, update: {}, create: { name, description } });
  const role = async (n) => (await prisma.role.findUnique({ where: { name: n } })).id;
  const hash = await bcrypt.hash('123456', 10);

  // Users
  const mkUser = async (email, fullName, phone, roleList, extra = {}) => {
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email, fullName, phone, passwordHash: hash,
          wallet: { create: {} },
          ...extra,
        },
      });
    }
    for (const r of roleList) {
      const roleId = await role(r);
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId } },
        update: {}, create: { userId: u.id, roleId },
      });
    }
    return u;
  };

  const buyer = await mkUser('buyer@nola2hand.vn', 'Nguyễn Văn Tuấn', '0987654321', ['BUYER'], { isVerified: true, emailVerifiedAt: new Date() });
  const seller = await mkUser('seller@nola2hand.vn', 'Trần Thái Hòa', '0912345678', ['BUYER', 'SELLER'], { isVerified: true, idVerified: true, emailVerifiedAt: new Date() });
  const finAdmin = await mkUser('finance@nola2hand.vn', 'Minh Anh', '0901112222', ['ADMIN_FINANCE'], { canManageRoles: true });
  const contentAdmin = await mkUser('content@nola2hand.vn', 'Thu Hà', '0903334444', ['ADMIN_CONTENT']);
  await mkUser('lan.nguyen@gmail.com', 'Lan Nguyễn', '0905556666', ['BUYER']);
  await mkUser('duc.anh@gmail.com', 'Đức Anh', '0907778888', ['BUYER', 'SELLER']);

  await prisma.sellerProfile.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, shopName: 'Shop Trần Thái Hòa', rating: 5.0, totalReviews: 42, responseRate: 100, totalOrders: 128 },
  });

  // Categories
  const cats = [
    ['Điện tử cũ', 'dien-tu-cu', '📱', 5],
    ['Xe cộ', 'xe-co', '🛵', 5],
    ['Thời trang 2Hand', 'thoi-trang-2hand', '👕', 5],
    ['Nội thất', 'noi-that', '🛋️', 5],
    ['Đồ gia dụng', 'do-gia-dung', '🍳', 5],
    ['Cho tặng 0đ', 'cho-tang-0d', '🎁', 0],
  ];
  for (const [name, slug, icon, feePct] of cats)
    await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug, icon, feePct } });
  const dienTu = await prisma.category.findUnique({ where: { slug: 'dien-tu-cu' } });

  // Listings
  const listings = [
    ['Bàn phím cơ AULA WIN 60 HE MAX Keycap Limited', 'Switch từ tính Hall Effect, Rapid Trigger 0.01ms, polling 8000Hz. Mới 99%, fullbox.', 500000, 650000, 'LIKE_NEW'],
    ['iPhone 14 Pro Max 128GB Tím', 'Máy chưa sửa chữa, pin 89%, đầy đủ hộp.', 10500000, 12000000, 'USED_GOOD'],
    ['Laptop Dell Latitude Core i7 16GB', 'Mỏng nhẹ, phù hợp văn phòng.', 5600000, 7000000, 'USED_GOOD'],
    ['Tai nghe Sony WH-1000XM4', 'Chống ồn, chính hãng, fullbox.', 3200000, 4500000, 'LIKE_NEW'],
  ];
  for (const [title, description, price, originalPrice, condition] of listings) {
    const photo = productPhotos.find(p => p.title === title);
    const origin = (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
    const ex = await prisma.listing.findFirst({ where: { title, sellerId: seller.id } });
    if (!ex)
      await prisma.listing.create({
        data: {
          sellerId: seller.id, categoryId: dienTu.id, title, description, price, originalPrice,
          condition, status: 'ACTIVE', isVerified: true, views: Math.floor(Math.random() * 1200),
          images: { create: [{ url: `${origin}/assets/products/${photo.file}`, sortOrder: 0 }] },
        },
      });
  }

  // Fee configs
  const fees = [
    ['PLATFORM_TXN', 'Phí sàn chung', 5, null, 5000, 'Áp dụng mọi danh mục'],
    ['PLATFORM_TXN', 'Phí sàn - Điện tử', 3, null, 15000, 'Điện thoại, Laptop, Máy ảnh'],
    ['PLATFORM_TXN', 'Phí đẩy tin', null, 10000, null, 'Đẩy tin nổi bật 24h'],
    ['WITHDRAW', 'Phí rút tiền tiêu chuẩn', null, 0, null, 'Xử lý trong 1-2 ngày làm việc'],
    ['WITHDRAW', 'Phí rút tiền nhanh', null, 10000, null, 'Xử lý trong 30 phút'],
    ['PENALTY', 'Phí đặt cọc (phạt huỷ)', 2, null, null, 'Seller mất cọc nếu huỷ sau xác nhận'],
    ['PENALTY', 'Phạt giao hàng trễ hạn', null, 10000, null, 'Quá thời gian cam kết'],
  ];
  for (const [kind, name, percent, amount, minAmount, condition] of fees)
    await prisma.feeConfig.upsert({
      where: { id: 0 }, update: {},
      create: { kind, name, percent, amount, minAmount, condition },
    }).catch(async () => {
      const ex = await prisma.feeConfig.findFirst({ where: { kind, name } });
      if (!ex) await prisma.feeConfig.create({ data: { kind, name, percent, amount, minAmount, condition } });
    });

  // Promos
  const promos = [
    ['Giảm phí sàn tháng 9', 'PLATFORM_FEE_DISCOUNT', null, 'PERCENT', 2, null, 0, null, '2026-09-01', '2026-09-30'],
    ['Freeship đơn đầu tiên', 'FREESHIP', 'FREESHIP01', 'AMOUNT', 20000, 20000, 100000, 2000, '2026-09-01', '2026-10-15'],
    ['Sinh viên mới - ưu đãi đăng bán', 'BOOST', 'SVMOI2026', 'AMOUNT', 0, null, 0, 1000, '2026-09-10', '2026-09-30'],
  ];
  for (const [name, type, code, discountType, discountValue, maxDiscount, minOrder, usageLimit, s, e] of promos)
    await prisma.promo.upsert({
      where: { code: code || `NOP-${name}` }, update: {},
      create: {
        name, type, code, discountType, discountValue, maxDiscount, minOrder, usageLimit,
        startsAt: new Date(s), endsAt: new Date(e), status: 'ACTIVE',
      },
    }).catch(() => {});

  // Banners
  const banners = [
    ['Banner Back to School', 'HOME_HERO', '2026-08-20', '2026-09-15'],
    ['Banner Freeship đơn đầu tiên', 'HOME_SECONDARY', '2026-09-01', '2026-10-15'],
    ['Banner Tháng 11 - Ưu đãi cuối năm', 'HOME_HERO', '2026-11-01', '2026-11-30'],
  ];
  for (const [title, position, s, e] of banners) {
    const ex = await prisma.banner.findFirst({ where: { title } });
    if (!ex)
      await prisma.banner.create({
        data: {
          title, position, imageUrl: 'https://cdn.nola2hand.vn/banners/demo.jpg',
          startsAt: new Date(s), endsAt: new Date(e),
          status: new Date(s) <= new Date() ? 'ACTIVE' : 'DRAFT',
        },
      });
  }

  // Order mẫu + escrow (khớp màn hình đặt cọc trong Figma)
  const listing = await prisma.listing.findFirst({ where: { sellerId: seller.id } });
  let order = await prisma.order.findFirst({ where: { code: 'NL2H-88291' } });
  if (!order && listing) {
    order = await prisma.order.create({
      data: {
        code: 'NL2H-88291', buyerId: buyer.id, sellerId: seller.id, listingId: listing.id,
        priceAgreed: 450000, depositAmount: 90000, remainingAmount: 360000,
        shippingFee: 15000, totalAmount: 465000, platformFee: 22500,
        paymentMethod: 'MOMO_QR', status: 'DEPOSITED',
        shipName: 'Nguyễn Văn Tuấn', shipPhone: '0987654321',
        shipAddress: 'Căn A12.04 Green Park, Dĩ An, Bình Dương',
        escrow: { create: { amount: 90000, status: 'HELD' } },
        timeline: { create: [{ status: 'PENDING_DEPOSIT', note: 'Đơn được tạo' }, { status: 'DEPOSITED', note: 'Đã cọc 90.000đ qua SafePay' }] },
      },
    });
  }

  // Wallet buyer có số dư
  const w = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
  if (w && w.balance === 0) {
    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({ where: { id: w.id }, data: { balance: 320000 } });
      await tx.walletTransaction.create({
        data: { walletId: w.id, type: 'TOPUP', amount: 320000, balanceAfter: 320000, reference: 'TOPUP', note: 'Nạp tiền demo' },
      });
    });
  }

  // Report mẫu
  const ducAnh = await prisma.user.findUnique({ where: { email: 'duc.anh@gmail.com' } });
  const lan = await prisma.user.findUnique({ where: { email: 'lan.nguyen@gmail.com' } });
  if (ducAnh && lan) {
    const ex = await prisma.report.findFirst({ where: { reporterId: lan.id, targetUserId: ducAnh.id } });
    if (!ex)
      await prisma.report.create({
        data: {
          reporterId: lan.id, targetType: 'COMMENT', targetId: 1, targetUserId: ducAnh.id,
          reason: 'Ngôn từ phản cảm', description: 'Bình luận khiếm nhã trên bài đăng Xe đạp Giant',
        },
      });
  }

  console.log('✅ Seed xong!');
  console.log('   buyer@nola2hand.vn / seller@nola2hand.vn / finance@nola2hand.vn / content@nola2hand.vn');
  console.log('   Mật khẩu chung: 123456');
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
