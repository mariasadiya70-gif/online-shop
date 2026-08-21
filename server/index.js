import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Product, Order } from './models.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigin = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(morgan('tiny'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }));
app.use('/api/payments', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 }));
app.use(express.static('.'));

const sign = user => jwt.sign({ sub: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
function auth(req, res, next) { const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' }); try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Invalid or expired token' }); } }
function admin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' }); next(); }

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'ShopHub API' }));

const registerSchema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(6).max(100) });
app.post('/api/auth/register', async (req, res) => { try { const data = registerSchema.parse(req.body); const email = data.email.toLowerCase(); if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' }); const passwordHash = await bcrypt.hash(data.password, 12); const user = await User.create({ name: data.name, email, passwordHash }); res.status(201).json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }); } catch (e) { res.status(400).json({ error: e.issues?.[0]?.message || 'Invalid registration data' }); } });

app.post('/api/auth/login', async (req, res) => { try { const email = String(req.body.email || '').toLowerCase(); const user = await User.findOne({ email }); if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' }); res.json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } }); } catch { res.status(500).json({ error: 'Login failed' }); } });
app.get('/api/auth/me', auth, async (req, res) => { const u = await User.findById(req.user.sub).select('-passwordHash'); if (!u) return res.status(404).json({ error: 'User not found' }); res.json({ user: u }); });

app.get('/api/products', async (req, res) => { const q = String(req.query.q || '').trim(); const category = String(req.query.category || '').trim(); const filter = { active: true, ...(category ? { category } : {}), ...(q ? { $or: [{ name: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }] } : {}) }; res.json(await Product.find(filter).sort({ createdAt: -1 })); });
app.get('/api/products/:id', async (req, res) => { const p = await Product.findOne({ _id: req.params.id, active: true }); if (!p) return res.status(404).json({ error: 'Product not found' }); res.json(p); });

app.post('/api/wishlist/:productId', auth, async (req, res) => { const user = await User.findById(req.user.sub); if (!user) return res.status(404).json({ error: 'User not found' }); const id = req.params.productId; const exists = user.wishlist.some(x => x.toString() === id); user.wishlist = exists ? user.wishlist.filter(x => x.toString() !== id) : [...user.wishlist, id]; await user.save(); res.json({ wishlist: user.wishlist }); });
app.get('/api/wishlist', auth, async (req, res) => { const user = await User.findById(req.user.sub).populate('wishlist'); res.json(user.wishlist); });

app.post('/api/orders', auth, async (req, res) => { try { const schema = z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(50) })).min(1), shipping: z.object({ name: z.string().min(2), phone: z.string().min(8), address: z.string().min(5) }), paymentMethod: z.enum(['bkash', 'nagad', 'cod']) }); const data = schema.parse(req.body); const ids = data.items.map(i => i.productId); const products = await Product.find({ _id: { $in: ids }, active: true }); if (products.length !== ids.length) return res.status(400).json({ error: 'One or more products are unavailable' }); const items = data.items.map(i => { const p = products.find(x => x._id.toString() === i.productId); if (p.stock < i.quantity) throw new Error(`${p.name} is out of stock`); return { product: p._id, name: p.name, price: p.price, quantity: i.quantity }; }); const total = items.reduce((s, i) => s + i.price * i.quantity, 0); const order = await Order.create({ user: req.user.sub, items, total, shipping: data.shipping, paymentMethod: data.paymentMethod }); res.status(201).json({ order }); } catch (e) { res.status(400).json({ error: e.issues?.[0]?.message || e.message || 'Could not create order' }); } });
app.get('/api/orders/my', auth, async (req, res) => res.json(await Order.find({ user: req.user.sub }).sort({ createdAt: -1 })));

// Payment adapter boundary. Real provider credentials/endpoints must come from the merchant's official bKash/Nagad onboarding.
app.post('/api/payments/:provider/create', auth, async (req, res) => { const provider = req.params.provider.toLowerCase(); if (!['bkash', 'nagad'].includes(provider)) return res.status(400).json({ error: 'Unsupported payment provider' }); const order = await Order.findOne({ _id: req.body.orderId, user: req.user.sub }); if (!order) return res.status(404).json({ error: 'Order not found' }); if (order.paymentMethod !== provider) return res.status(400).json({ error: 'Payment provider does not match order' }); if (!process.env[provider === 'bkash' ? 'BKASH_BASE_URL' : 'NAGAD_BASE_URL']) return res.status(503).json({ error: `${provider} gateway is not configured. Add official merchant credentials to server environment.` }); return res.status(501).json({ error: `${provider} gateway adapter is ready for official merchant API credentials and callback contract.` }); });

app.get('/api/admin/stats', auth, admin, async (_, res) => { const [products, users, orders, paid] = await Promise.all([Product.countDocuments(), User.countDocuments(), Order.countDocuments(), Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }])]); res.json({ products, users, orders, paidRevenue: paid[0]?.total || 0 }); });
app.get('/api/admin/orders', auth, admin, async (_, res) => res.json(await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(100)));
app.post('/api/admin/products', auth, admin, async (req, res) => { try { const p = await Product.create(req.body); res.status(201).json(p); } catch (e) { res.status(400).json({ error: e.message }); } });
app.patch('/api/admin/products/:id', auth, admin, async (req, res) => { const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!p) return res.status(404).json({ error: 'Product not found' }); res.json(p); });
app.delete('/api/admin/products/:id', auth, admin, async (req, res) => { const p = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true }); if (!p) return res.status(404).json({ error: 'Product not found' }); res.json({ ok: true }); });
app.patch('/api/admin/orders/:id/status', auth, admin, async (req, res) => { const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']; if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' }); const o = await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.status }, { new: true }); if (!o) return res.status(404).json({ error: 'Order not found' }); res.json(o); });

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

async function boot() { if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required'); await mongoose.connect(process.env.MONGODB_URI); console.log('MongoDB connected'); app.listen(PORT, () => console.log(`ShopHub API running on port ${PORT}`)); }
boot().catch(err => { console.error(err); process.exit(1); });
