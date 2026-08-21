import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Product } from './models.js';

const products = [
  { name: 'Classic Hoodie', category: 'Fashion', price: 1290, oldPrice: 1590, stock: 25, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=700&q=80', description: 'Soft everyday hoodie with a comfortable modern fit.' },
  { name: 'Smart Watch', category: 'Electronics', price: 2490, oldPrice: 2990, stock: 18, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80', description: 'Stylish smart watch for fitness and notifications.' },
  { name: 'Wireless Headphones', category: 'Electronics', price: 1890, oldPrice: 2290, stock: 30, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80', description: 'Comfortable wireless headphones with immersive sound.' },
  { name: 'Beauty Essentials', category: 'Beauty', price: 990, oldPrice: 1250, stock: 20, image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=80', description: 'A curated beauty essentials set for your daily routine.' },
  { name: 'Modern Lamp', category: 'Home', price: 1490, oldPrice: 1790, stock: 12, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=80', description: 'Minimal modern lamp for a warm room.' },
  { name: 'Canvas Sneakers', category: 'Fashion', price: 1750, oldPrice: 2100, stock: 16, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80', description: 'Lightweight casual sneakers made for everyday comfort.' },
  { name: 'Skincare Set', category: 'Beauty', price: 1190, oldPrice: 1490, stock: 22, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=80', description: 'Simple skincare essentials for a fresh daily routine.' },
  { name: 'Coffee Maker', category: 'Home', price: 2990, oldPrice: 3490, stock: 9, image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f348c7?auto=format&fit=crop&w=700&q=80', description: 'Compact coffee maker for delicious coffee at home.' }
];

await mongoose.connect(process.env.MONGODB_URI);
await Product.deleteMany({});
await Product.insertMany(products);
const email = process.env.ADMIN_EMAIL?.toLowerCase();
if (email && process.env.ADMIN_PASSWORD) {
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate({ email }, { name: 'ShopHub Admin', email, passwordHash, role: 'admin' }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
console.log('Seed complete');
await mongoose.disconnect();
