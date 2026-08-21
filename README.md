# ShopHub — Online Shop

Bangladesh-focused e-commerce starter with a browser storefront and a secure Node.js/MongoDB API.

## Stack
- Frontend: HTML/CSS/JavaScript
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Authentication: bcrypt password hashing + JWT
- Security: Helmet, CORS allow-list, rate limiting, validation
- Payments: bKash/Nagad integration boundary prepared for official merchant credentials

## Local setup

1. Install Node.js 20+ and MongoDB.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a strong `JWT_SECRET`.
3. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`.
4. Install packages: `npm install`
5. Seed products/admin: `node server/seed.js`
6. Start: `npm start`
7. Open `http://localhost:5000`.

## Payment setup

The repository does **not** contain fake bKash/Nagad credentials or invented gateway URLs. Put the credentials and official gateway base URLs supplied by your merchant accounts into `.env`, then implement the provider-specific token/create/execute/callback contract in the payment adapter. Never commit `.env` or secret keys to GitHub.

For production, use HTTPS, managed MongoDB, secure secret storage, webhook/callback signature verification, idempotency for payment callbacks, and server-side order/payment reconciliation.
