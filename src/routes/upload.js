const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { asyncHandler, auth, validate } = require('../middleware');
const router = express.Router();
const uploadDirectory = path.join(__dirname, '../../uploads');
const evidence = require('../services/evidence');
function decodeImage(base64, mimeType) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw Object.assign(new Error('Dữ liệu ảnh không hợp lệ'), { status: 400 });
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== base64)
    throw Object.assign(new Error('Ảnh phải hợp lệ và không vượt quá 5MB'), { status: 400 });
  const valid = mimeType === 'image/jpeg' ? bytes.length >= 4 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) && bytes.subarray(-2).equals(Buffer.from([255, 217]))
    : mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw Object.assign(new Error('Nội dung ảnh không khớp loại JPEG/PNG/WebP'), { status: 400 });
  return bytes;
}
router.post('/', auth, require('../services/guards').accountLimit('UPLOAD_IMAGE', 50, 3600000), rateLimit({ windowMs: 60 * 60 * 1000, max: 50 }), validate(z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']), base64: z.string().max(7_000_000),
  purpose: z.enum(['PRODUCT','EVIDENCE']).default('PRODUCT'),
})), asyncHandler(async (req, res) => {
  const bytes = decodeImage(req.body.base64, req.body.mimeType);
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.body.mimeType];
  const privateFile=req.body.purpose==='EVIDENCE';
  const name = `${privateFile?req.user.id+'-':''}${crypto.randomUUID()}.${extension}`;
  const directory=privateFile?evidence.evidenceDirectory:uploadDirectory;
  await fs.mkdir(directory, { recursive: true, mode:privateFile?0o700:0o755 });
  await fs.writeFile(path.join(directory, name), bytes, { flag: 'wx', mode: privateFile?0o600:0o644 });
  const origin = (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  res.status(201).json({ message: 'Đã lưu ảnh', url: `${origin}/${privateFile?'api/v1/upload/evidence':'uploads'}/${name}` });
}));
router.get('/evidence/:name',auth,asyncHandler(async(req,res)=>{
  const name=req.params.name;
  if(name.length>100||!evidence.namePattern.test(name))return res.status(404).json({message:'Không tìm thấy bằng chứng'});
  const url=`${evidence.origin()}/api/v1/upload/evidence/${name}`;
  if(!await evidence.mayReadEvidence(require('../prisma'),req.user,url))return res.status(403).json({message:'Không có quyền xem bằng chứng'});
  res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
  res.sendFile(path.join(evidence.evidenceDirectory,name),err=>{if(err&&!res.headersSent)res.status(404).json({message:'Không tìm thấy bằng chứng'});});
}));
module.exports = router;
module.exports.decodeImage = decodeImage;
