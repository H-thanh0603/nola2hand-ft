const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
async function sendAccountEmail(to, purpose, token, otp) {
  const origin = (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  const link = `${origin}/#/${purpose === 'verify' ? 'verify' : 'reset'}/${encodeURIComponent(token)}`;
  const subject = purpose === 'verify' ? 'Xác nhận email Nola2Hand' : 'Đặt lại mật khẩu Nola2Hand';
  // OTP 6 số là cách chính; giữ link cũ để tương thích.
  const text = `${subject}\n\nMã OTP của bạn: ${otp} (hiệu lực 10 phút, tối đa 5 lần nhập sai)\n\nHoặc mở liên kết sau: ${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này.`;
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.createHash('sha256').update(`${purpose}:${token}`).digest('hex') },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!response.ok) throw Object.assign(new Error('Dịch vụ email chưa gửi được thư'), { status: 503 });
    return 'EMAIL';
  }
  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('Chưa cấu hình dịch vụ email'), { status: 503 });
  const directory = path.join(__dirname, '../../.local/mail');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(directory, `${crypto.randomUUID()}.json`), JSON.stringify({ to, subject, text, createdAt: new Date() }), { mode: 0o600 });
  return 'LOCAL_OUTBOX';
}
module.exports = { sendAccountEmail };
