const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, validate } = require('../middleware');
const { jsonAnswer } = require('../services/ai');
const { filterSchema, listingWhere } = require('../services/catalog');
const { localSearch } = require('../services/assistant-search');
const router = express.Router();
router.post('/', rateLimit({ windowMs: 60_000, max: 10 }), validate(z.object({ message: z.string().trim().min(2).max(500) })), asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } });
  let filters = localSearch(req.body.message), mode = 'LOCAL';
  try {
    const answer = await jsonAnswer('Extract marketplace search filters: q (short product keywords), categoryId (only IDs supplied), minPrice/maxPrice (integer VND), city, condition (NEW,LIKE_NEW,USED_GOOD,USED_FAIR,FOR_PARTS), deliveryMethod (MEETUP,DELIVERY). JSON object of filters only. Do not invent prices or IDs.', { message: req.body.message, categories });
    if (answer) {
      const parsed = filterSchema.parse(answer);
      if (parsed.categoryId && !categories.some(c => c.id === parsed.categoryId)) throw new Error('Unknown category');
      const { page, limit, sort, ...selected } = parsed;
      if (!Object.keys(selected).length) throw new Error('Empty AI filters');
      filters = selected; mode = 'AI';
    }
  } catch { mode = 'LOCAL'; }
  const items = await prisma.listing.findMany({ where: listingWhere(filters), include: { images: { take: 1 }, category: true }, take: 8, orderBy: { createdAt: 'desc' } });
  res.json({ mode, filters, items, message: items.length ? `Tìm thấy ${items.length} tin đang bán phù hợp. Giá và tình trạng lấy trực tiếp từ tin đăng.` : 'Chưa tìm thấy tin phù hợp. Thử tên sản phẩm ngắn hơn hoặc điều chỉnh ngân sách.', note: mode === 'LOCAL' ? 'Chế độ tìm kiếm từ khóa; AI chưa cấu hình hoặc đang không khả dụng.' : 'AI chuyển nhu cầu thành bộ lọc; hãy kiểm tra kỹ tin và trao đổi với người bán.' });
}));
module.exports = router;
