const { z } = require('zod');
const filterSchema = z.object({
  q: z.string().trim().max(150).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'USED_GOOD', 'USED_FAIR', 'FOR_PARTS']).optional(),
  minPrice: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  city: z.string().trim().max(100).optional(),
  deliveryMethod: z.enum(['MEETUP', 'DELIVERY']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  isFree: z.enum(['true', 'false']).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine(f => f.minPrice == null || f.maxPrice == null || f.minPrice <= f.maxPrice, { message: 'Khoảng giá không hợp lệ', path: ['maxPrice'] });
function listingWhere(filters) {
  const f = filterSchema.parse(filters);
  const where = { status: 'ACTIVE', seller: { status: 'ACTIVE' } };
  if (f.q) where.OR = [{ title: { contains: f.q, mode: 'insensitive' } }, { description: { contains: f.q, mode: 'insensitive' } }];
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.condition) where.condition = f.condition;
  if (f.minPrice != null || f.maxPrice != null) where.price = { ...(f.minPrice != null ? { gte: f.minPrice } : {}), ...(f.maxPrice != null ? { lte: f.maxPrice } : {}) };
  if (f.city) where.city = { contains: f.city, mode: 'insensitive' };
  if (f.deliveryMethod) where.deliveryMethod = { in: [f.deliveryMethod, 'ANY'] };
  if (f.verified === 'true') where.seller.idVerified = true;
  if (f.isFree === 'true') where.isFree = true;
  return where;
}
const specificationFields = {
  'dien-tu-cu': { brand: 'Thương hiệu', model: 'Model', batteryHealth: 'Sức khỏe pin (%)', repairs: 'Lịch sử sửa chữa', warranty: 'Bảo hành còn lại' },
  'noi-that': { width: 'Rộng (cm)', depth: 'Sâu (cm)', height: 'Cao (cm)', material: 'Chất liệu', defects: 'Vết xước / lỗi' },
  'do-gia-dung': { brand: 'Thương hiệu', power: 'Công suất (W)', warranty: 'Bảo hành còn lại', defects: 'Lỗi / hao mòn' },
};
function validateSpecifications(slug, values) {
  const fields = specificationFields[slug] || {};
  for (const [key, value] of Object.entries(values || {})) {
    if (!fields[key] || typeof value !== 'string' || value.length > 250) throw Object.assign(new Error('Thông số sản phẩm không hợp lệ'), { status: 400 });
    if (['batteryHealth', 'width', 'depth', 'height', 'power'].includes(key) && value && (!Number.isFinite(+value) || +value < 0 || (key === 'batteryHealth' && +value > 100))) throw Object.assign(new Error('Thông số số học không hợp lệ'), { status: 400 });
  }
}
module.exports = { filterSchema, listingWhere, specificationFields, validateSpecifications };
