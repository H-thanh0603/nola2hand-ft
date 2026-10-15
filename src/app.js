// Nola2Hand Backend — Express API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware');

const app = express();

app.use(
  helmet({
    // Google GSI dùng popup trả credential: COOP same-origin làm popup trắng trang,
    // callback không bao giờ chạy. CORP same-origin cũng chặn avatar Google (lh3...).
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://accounts.google.com'],
        'script-src-attr': ["'unsafe-inline'"],
        'frame-src': ["'self'", 'https://accounts.google.com'],
        'connect-src': ["'self'", 'https://accounts.google.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      },
    },
  })
);
app.use(cors({ origin: true, credentials: true })); // demo: cho phép mọi origin (kể cả qua tunnel)
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads'), { dotfiles: 'deny', setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));
// Giao diện web (frontend) — mở http://localhost:4000 là thấy
app.use(express.static(require('path').join(__dirname, '..', 'frontend')));
app.use(morgan('dev'));

// Chống spam login
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'nola2hand-backend', time: new Date() }));

// Routes
const v1 = '/api/v1';
app.use(`${v1}/auth`, require('./routes/auth'));
app.use(`${v1}/users`, require('./routes/users'));
app.use(`${v1}/categories`, require('./routes/categories'));
app.use(`${v1}/listings`, require('./routes/listings'));
app.use(`${v1}/shops`, require('./routes/shops'));
app.use(`${v1}/offers`, require('./routes/offers'));
app.use(`${v1}/orders`, require('./routes/orders'));
app.use(`${v1}/cart`, require('./routes/cart'));
app.use(`${v1}/escrow`, require('./routes/escrow'));
app.use(`${v1}/wallet`, require('./routes/wallet'));
app.use(`${v1}/reviews`, require('./routes/reviews'));
app.use(`${v1}/posts`, require('./routes/posts'));
app.use(`${v1}/promos`, require('./routes/promos'));
app.use(`${v1}/banners`, require('./routes/banners'));
app.use(`${v1}/reports`, require('./routes/reports'));
app.use(`${v1}/disputes`, require('./routes/disputes'));
app.use(`${v1}/admin/finance`, require('./routes/finance'));
app.use(`${v1}/admin/users`, require('./routes/admin-users'));
app.use(`${v1}/chat`, require('./routes/chat'));
app.use(`${v1}/notifications`, require('./routes/notifications'));
app.use(`${v1}/saved-searches`, require('./routes/saved-searches'));
app.use(`${v1}/assistant`, require('./routes/assistant'));
app.use(`${v1}/admin/audit`, require('./routes/audit'));
app.use(`${v1}/seller`, require('./routes/seller'));
app.use(`${v1}/upload`, require('./routes/upload'));
app.use(`${v1}/returns`, require('./routes/returns'));

// (Trang chủ '/' do frontend phục vụ)

// 404
app.use((req, res) => res.status(404).json({ message: 'Endpoint không tồn tại. Kiểm tra lại đường dẫn, mọi API đều bắt đầu bằng /api/v1/...' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const reservationTimer = setInterval(() => {
  require('./services/reservations').expireReservations().catch(err => console.error('Reservation cleanup:', err.code || err.message));
}, 60_000);
reservationTimer.unref();
app.listen(PORT, () => console.log(`🚀 Nola2Hand API chạy tại http://localhost:${PORT}`));

module.exports = app;
