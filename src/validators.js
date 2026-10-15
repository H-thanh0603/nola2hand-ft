// Validators dùng chung: trim chống chuỗi trắng, SĐT VN, email chuẩn hoá, URL http(s).
const { z } = require('zod');

const emailField = z.string().trim().toLowerCase().email('Email không hợp lệ');

// SĐT Việt Nam: 0xxx hoặc +84xxx, đầu số 3/5/7/8/9, đủ 10 số (VD: 0987654321).
const phoneVN = z.string().trim().regex(/^(\+84|0)(3|5|7|8|9)\d{8}$/, 'SĐT Việt Nam chưa đúng (VD: 0987654321)');

// Mật khẩu mới: giữ min cũ, thêm chữ + số (tài khoản seed cũ không ảnh hưởng vì chỉ check lúc tạo/đổi).
const passwordField = (min, what = 'Mật khẩu') =>
  z.string()
    .min(min, `${what} tối thiểu ${min} ký tự`)
    .max(72, `${what} tối đa 72 ký tự`)
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, `${what} cần có cả chữ và số`);

const httpUrl = (what = 'URL') =>
  z.string().trim().url(`${what} chưa đúng`).refine((u) => /^https?:\/\//.test(u), 'Chỉ nhận URL HTTP/HTTPS');

const text = (min, max, what) => z.string().trim().min(min, `${what} tối thiểu ${min} ký tự`).max(max, `${what} tối đa ${max} ký tự`);

module.exports = { emailField, phoneVN, passwordField, httpUrl, text };
