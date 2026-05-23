/**
 * Demo seed — run once:  npx ts-node src/config/demoSeed.ts
 * Creates 5 farmers, 3 buyers, 25 products, 10 reels, 6 requirements, 10 bids
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import * as dotenv from 'dotenv'
dotenv.config()

import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Product from '../models/Product'
import Category from '../models/Category'
import Requirement from '../models/Requirement'
import Bid from '../models/Bid'
import Order from '../models/Order'
import Wallet from '../models/Wallet'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import Conversation from '../models/Conversation'
import Message from '../models/Message'
import Notification from '../models/Notification'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'

// ─── Cloudinary demo videos (confirmed working) ───────────────────────────────
const VIDEOS = [
  'https://res.cloudinary.com/demo/video/upload/dog.mp4',
  'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
  'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
]
const vid = (i: number) => VIDEOS[i % VIDEOS.length]

// ─── Fixed slug helper — deterministic so URLs are stable ─────────────────────
const slug = (title: string) => slugify(title, { lower: true, strict: true })

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('✅ Connected to MongoDB')

  await Promise.all([
    User.deleteMany({ email: /@emazao\.demo$/ }),
    SellerProfile.deleteMany({}),
    Product.deleteMany({}),
    Requirement.deleteMany({}),
    Bid.deleteMany({}),
    Order.deleteMany({}),
    Wallet.deleteMany({}),
    Reel.deleteMany({}),
    Comment.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
  ])
  console.log('🗑️  Cleared old demo data')

  const hash = await bcrypt.hash('Demo1234!', 12)

  // ─── 1. USERS ───────────────────────────────────────────────────────────────
  const [
    /* admin  */ , farmer1, farmer2, farmer3, farmer4, farmer5,
    buyer1, buyer2, buyer3
  ] = await User.insertMany([
    {
      name: 'Admin Emazao', email: 'admin@emazao.demo', username: 'admin_emazao',
      passwordHash: hash, role: 'SUPER_ADMIN', isVerified: true, verifiedType: 'ID_VERIFIED',
      country: 'Kenya', location: 'Nairobi', onboardingDone: true,
      bio: 'Platform administrator',
    },
    // ── Farmers ──
    {
      name: 'James Kamau', email: 'james@emazao.demo', username: 'james_kamau',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Kenya', location: 'Nakuru', region: 'Rift Valley',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      coverImage: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800',
      bio: 'Organic tomato and maize farmer from Nakuru. 15 years of experience. KEPHIS certified.',
      onboardingDone: true, followersCount: 1240, followingCount: 38,
    },
    {
      name: 'Amina Hassan', email: 'amina@emazao.demo', username: 'amina_hassan',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Tanzania', location: 'Arusha', region: 'Kilimanjaro',
      avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
      coverImage: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
      bio: 'Coffee and spice grower on the slopes of Kilimanjaro. Fair-trade certified since 2018.',
      onboardingDone: true, followersCount: 3870, followingCount: 92,
    },
    {
      name: 'David Osei', email: 'david@emazao.demo', username: 'david_osei',
      passwordHash: hash, role: 'FARMER', isVerified: false,
      country: 'Ghana', location: 'Kumasi', region: 'Ashanti',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      coverImage: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
      bio: 'Cocoa and plantain farmer from the Ashanti heartland. COCOBOD certified.',
      onboardingDone: true, followersCount: 543, followingCount: 27,
    },
    {
      name: 'Mercy Wangari', email: 'mercy@emazao.demo', username: 'mercy_wangari',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Uganda', location: 'Mbale', region: 'Eastern',
      avatar: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=150&h=150&fit=crop&crop=face',
      coverImage: 'https://images.unsplash.com/photo-1559181567-c3190ca9d8da?w=800',
      bio: 'Arabica coffee and vanilla farmer from the slopes of Mt. Elgon, Uganda.',
      onboardingDone: true, followersCount: 2100, followingCount: 56,
    },
    {
      name: 'Emmanuel Tesfaye', email: 'emmanuel@emazao.demo', username: 'emmanuel_tesfaye',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Ethiopia', location: 'Yirgacheffe', region: 'SNNPR',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
      coverImage: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
      bio: 'Yirgacheffe coffee, teff, and moringa farmer. Supplying specialty roasters worldwide.',
      onboardingDone: true, followersCount: 4500, followingCount: 120,
    },
    // ── Buyers ──
    {
      name: 'Sarah Njoroge', email: 'sarah@emazao.demo', username: 'sarah_njoroge',
      passwordHash: hash, role: 'BUYER', isVerified: true, verifiedType: 'ID_VERIFIED',
      country: 'Kenya', location: 'Nairobi',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
      bio: 'Procurement manager at FreshMart Supermarkets. Sourcing fresh produce Kenya-wide.',
      onboardingDone: true,
    },
    {
      name: 'Mohamed Ali', email: 'ali@emazao.demo', username: 'ali_trader',
      passwordHash: hash, role: 'BUSINESS_BUYER', isVerified: true, verifiedType: 'BUSINESS_VERIFIED',
      country: 'UAE', location: 'Dubai',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      bio: 'Agricultural commodities importer. Sourcing premium East African produce for Middle East markets.',
      onboardingDone: true,
    },
    {
      name: 'Fatima Al-Rashid', email: 'fatima@emazao.demo', username: 'fatima_rashid',
      passwordHash: hash, role: 'BUSINESS_BUYER', isVerified: false,
      country: 'Saudi Arabia', location: 'Riyadh',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Food import company based in Riyadh. Specialty in organic and Fair-trade products.',
      onboardingDone: true,
    },
  ])
  console.log('👥 Created 9 users (5 farmers, 3 buyers, 1 admin)')

  // ─── 2. WALLETS ─────────────────────────────────────────────────────────────
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000)
  await Wallet.insertMany([
    {
      userId: farmer1._id, balance: 4250.00, pendingBalance: 800.00, currency: 'USD',
      transactions: [
        { type: 'CREDIT', amount: 415.00, description: 'Order EM-001 released — Organic Tomatoes', status: 'completed', createdAt: daysAgo(18) },
        { type: 'CREDIT', amount: 546.00, description: 'Order EM-006 released — White Maize', status: 'completed', createdAt: daysAgo(9) },
        { type: 'WITHDRAWAL', amount: 200.00, description: 'Withdrawal to M-Pesa +254712XXXXXX', status: 'completed', createdAt: daysAgo(5) },
        { type: 'CREDIT', amount: 780.00, description: 'Order EM-009 released — French Beans export', status: 'completed', createdAt: daysAgo(2) },
        { type: 'ESCROW_HOLD', amount: 800.00, description: 'Order EM-010 held in escrow — pending delivery', status: 'completed', createdAt: daysAgo(1) },
      ],
    },
    {
      userId: farmer2._id, balance: 1820.50, pendingBalance: 320.00, currency: 'USD',
      transactions: [
        { type: 'CREDIT', amount: 480.00, description: 'Order released — Cardamom pods', status: 'completed', createdAt: daysAgo(30) },
        { type: 'CREDIT', amount: 960.00, description: 'Order released — Kilimanjaro Arabica Coffee', status: 'completed', createdAt: daysAgo(14) },
        { type: 'ESCROW_HOLD', amount: 320.00, description: 'Order EM-002 held in escrow — Coffee to Dubai', status: 'completed', createdAt: daysAgo(3) },
        { type: 'WITHDRAWAL', amount: 500.00, description: 'Withdrawal to Bank TZS account', status: 'completed', createdAt: daysAgo(7) },
      ],
    },
    {
      userId: farmer3._id, balance: 320.00, pendingBalance: 0, currency: 'USD',
      transactions: [
        { type: 'CREDIT', amount: 275.00, description: 'Order EM-004 released — Ghanaian Cocoa Beans', status: 'completed', createdAt: daysAgo(11) },
        { type: 'CREDIT', amount: 45.00, description: 'Order released — Plantain', status: 'completed', createdAt: daysAgo(20) },
      ],
    },
    {
      userId: farmer4._id, balance: 2100.00, pendingBalance: 450.00, currency: 'USD',
      transactions: [
        { type: 'CREDIT', amount: 1200.00, description: 'Order released — Vanilla Beans Uganda', status: 'completed', createdAt: daysAgo(25) },
        { type: 'CREDIT', amount: 450.00, description: 'Order released — Dried Hibiscus', status: 'completed', createdAt: daysAgo(12) },
        { type: 'ESCROW_HOLD', amount: 450.00, description: 'Order EM-005 held in escrow — Bugisu Coffee', status: 'completed', createdAt: daysAgo(2) },
        { type: 'WITHDRAWAL', amount: 150.00, description: 'Withdrawal to MTN Mobile Money', status: 'completed', createdAt: daysAgo(8) },
      ],
    },
    {
      userId: farmer5._id, balance: 5800.00, pendingBalance: 1200.00, currency: 'USD',
      transactions: [
        { type: 'CREDIT', amount: 1800.00, description: 'Order released — Yirgacheffe Coffee export', status: 'completed', createdAt: daysAgo(45) },
        { type: 'CREDIT', amount: 680.00, description: 'Order released — Moringa Powder', status: 'completed', createdAt: daysAgo(20) },
        { type: 'CREDIT', amount: 234.00, description: 'Order EM-003 released — Moringa to Riyadh', status: 'completed', createdAt: daysAgo(5) },
        { type: 'ESCROW_HOLD', amount: 1200.00, description: 'Order held in escrow — Yirgacheffe Coffee to Japan', status: 'completed', createdAt: daysAgo(1) },
        { type: 'WITHDRAWAL', amount: 1200.00, description: 'Withdrawal to CBE Bank Ethiopia', status: 'completed', createdAt: daysAgo(10) },
      ],
    },
    { userId: buyer1._id, balance: 0, pendingBalance: 0, currency: 'USD', transactions: [] },
    { userId: buyer2._id, balance: 0, pendingBalance: 0, currency: 'USD', transactions: [] },
    { userId: buyer3._id, balance: 0, pendingBalance: 0, currency: 'USD', transactions: [] },
  ])

  // ─── 3. SELLER PROFILES ─────────────────────────────────────────────────────
  await SellerProfile.insertMany([
    {
      userId: farmer1._id, farmName: 'Kamau Fresh Farms',
      farmDescription: 'KEPHIS-certified organic farm producing premium tomatoes, maize, and vegetables. Export-quality produce direct from Nakuru. 15 years in business.',
      farmSize: 12, farmLocation: 'Nakuru, Kenya',
      farmImages: [
        'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600',
        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
      ],
      specializations: ['tomatoes', 'maize', 'organic', 'export', 'french beans'],
      deliveryRadius: 200, storeSlug: 'kamau-fresh-farms',
      rating: 4.8, ratingCount: 47, totalSales: 89, totalRevenue: 34500, onTimeDelivery: 96,
      certifications: ['KEPHIS Organic', 'GlobalG.A.P'], isActive: true,
    },
    {
      userId: farmer2._id, farmName: 'Kilimanjaro Spice Garden',
      farmDescription: 'Premium Arabica coffee and exotic spices from the slopes of Kilimanjaro. Fair-trade certified. Exporting to Japan, Europe, and the Middle East since 2018.',
      farmSize: 8, farmLocation: 'Arusha, Tanzania',
      farmImages: [
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600',
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
      ],
      specializations: ['coffee', 'spices', 'cardamom', 'vanilla', 'cloves'],
      deliveryRadius: 500, storeSlug: 'kilimanjaro-spice-garden',
      rating: 4.9, ratingCount: 93, totalSales: 212, totalRevenue: 78000, onTimeDelivery: 99,
      certifications: ['Fair Trade', 'Rainforest Alliance', 'Organic Tanzania'], isActive: true,
    },
    {
      userId: farmer3._id, farmName: 'Osei Cocoa Estate',
      farmDescription: 'Single-origin Ghanaian cocoa from Ashanti region. Premium Grade 1 COCOBOD certified. Supplying craft chocolate makers in Europe and North America.',
      farmSize: 20, farmLocation: 'Kumasi, Ghana',
      farmImages: [
        'https://images.unsplash.com/photo-1511381939415-e44015466834?w=600',
        'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600',
      ],
      specializations: ['cocoa', 'plantain', 'palm oil'],
      deliveryRadius: 300, storeSlug: 'osei-cocoa-estate',
      rating: 4.3, ratingCount: 12, totalSales: 18, totalRevenue: 9200, onTimeDelivery: 88,
      certifications: ['COCOBOD Grade 1'], isActive: true,
    },
    {
      userId: farmer4._id, farmName: 'Elgon Highlands Farm',
      farmDescription: 'Coffee and vanilla from the rich volcanic soils of Mt. Elgon, Uganda. Bugisu AA Arabica with distinct berry and citrus notes.',
      farmSize: 6, farmLocation: 'Mbale, Uganda',
      farmImages: [
        'https://images.unsplash.com/photo-1559181567-c3190ca9d8da?w=600',
      ],
      specializations: ['coffee', 'vanilla', 'sesame', 'matooke'],
      deliveryRadius: 400, storeSlug: 'elgon-highlands-farm',
      rating: 4.7, ratingCount: 31, totalSales: 55, totalRevenue: 21000, onTimeDelivery: 94,
      certifications: ['UCDA Certified', 'Organic Uganda'], isActive: true,
    },
    {
      userId: farmer5._id, farmName: 'Yirgacheffe Highlands',
      farmDescription: 'World-famous Yirgacheffe coffee from Ethiopia. Also producing teff, moringa, and fenugreek. SCA scores consistently 88+.',
      farmSize: 15, farmLocation: 'Yirgacheffe, Ethiopia',
      farmImages: [
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600',
      ],
      specializations: ['coffee', 'teff', 'moringa', 'fenugreek', 'berbere'],
      deliveryRadius: 600, storeSlug: 'yirgacheffe-highlands',
      rating: 5.0, ratingCount: 128, totalSales: 340, totalRevenue: 142000, onTimeDelivery: 98,
      certifications: ['ECX Certified', 'Organic Ethiopia', 'Fair Trade'], isActive: true,
    },
  ])
  console.log('🏪 Created 5 seller profiles')

  // ─── 4. CATEGORIES ──────────────────────────────────────────────────────────
  const cats = await Category.find()
  const cat = (s: string) => cats.find(c => c.slug === s)?._id

  // ─── 5. PRODUCTS (25 with fixed slugs) ──────────────────────────────────────
  const products = await Product.insertMany([

    // ── Farmer 1 — James Kamau, Kenya ──────────────────────────────────────
    {
      sellerId: farmer1._id, categoryId: cat('fruits-vegetables'),
      title: 'Premium Organic Tomatoes', slug: slug('Premium Organic Tomatoes'),
      description: 'Fresh KEPHIS-certified organic tomatoes harvested weekly. Ideal for supermarkets, restaurants, and export. Size: medium to large, Brix >6. Available in 15kg nets or custom packing.',
      images: [
        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
        'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=600',
        'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=600',
      ],
      price: 0.85, priceUnit: 'per kg', minimumOrder: 200, availableStock: 8000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['tomatoes', 'organic', 'fresh', 'export', 'kenya', 'vegetables'],
      certifications: ['KEPHIS Organic', 'GlobalG.A.P'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 5420, likeCount: 387, saveCount: 194, orderCount: 43, rating: 4.8, ratingCount: 43,
    },
    {
      sellerId: farmer1._id, categoryId: cat('grains-cereals'),
      title: 'White Maize Export Grade', slug: slug('White Maize Export Grade'),
      description: 'Premium white maize, moisture <13.5%, aflatoxin <10ppb. Available in 50kg bags or bulk. KEBS and USDA standard. Ready for container loading.',
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
        'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600',
      ],
      price: 280, priceUnit: 'per ton', minimumOrder: 5, availableStock: 120, stockUnit: 'tons',
      condition: 'PROCESSED', isOrganic: false, origin: 'Nakuru, Kenya',
      tags: ['maize', 'white maize', 'export', 'grains', 'bulk', 'kenya'],
      certifications: ['KEBS Certified'],
      status: 'ACTIVE',
      viewCount: 2840, likeCount: 112, saveCount: 45, orderCount: 12, rating: 4.7, ratingCount: 12,
    },
    {
      sellerId: farmer1._id, categoryId: cat('legumes-pulses'),
      title: 'French Beans Extra Fine', slug: slug('French Beans Extra Fine'),
      description: 'Air-freighted within 24h of harvest. European market specs (calibre 4-6mm). GLOBALG.A.P certified. Available year-round from irrigated fields.',
      images: [
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600',
      ],
      price: 2.20, priceUnit: 'per kg', minimumOrder: 200, availableStock: 3000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['french beans', 'haricots', 'export', 'europe', 'organic', 'kenya'],
      certifications: ['GlobalG.A.P', 'KEPHIS Organic'],
      status: 'ACTIVE',
      viewCount: 1920, likeCount: 84, saveCount: 39, orderCount: 9, rating: 4.9, ratingCount: 9,
    },
    {
      sellerId: farmer1._id, categoryId: cat('fruits-vegetables'),
      title: 'Baby Spinach Organic', slug: slug('Baby Spinach Organic'),
      description: 'Tender baby spinach leaves, triple-washed, ready-to-eat. 200g retail packs or bulk 5kg bags. Shelf-life 10 days refrigerated. Air-freight available to Middle East.',
      images: [
        'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600',
        'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=600',
      ],
      price: 3.50, priceUnit: 'per kg', minimumOrder: 100, availableStock: 1500, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['spinach', 'baby spinach', 'leafy greens', 'organic', 'salad'],
      certifications: ['KEPHIS Organic'],
      status: 'ACTIVE',
      viewCount: 1260, likeCount: 68, saveCount: 28, orderCount: 6, rating: 4.6, ratingCount: 6,
    },
    {
      sellerId: farmer1._id, categoryId: cat('fruits-vegetables'),
      title: 'Sweet Peppers Mixed Colours', slug: slug('Sweet Peppers Mixed Colours'),
      description: 'Premium mixed sweet peppers (red, yellow, orange). Grade A, no blemishes. Ideal for retail and food service. Minimum order 100kg. Harvested 3x per week.',
      images: [
        'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600',
        'https://images.unsplash.com/photo-1529080236685-6b9f7d3b6b8e?w=600',
      ],
      price: 1.80, priceUnit: 'per kg', minimumOrder: 100, availableStock: 2000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['peppers', 'sweet peppers', 'organic', 'coloured peppers', 'export'],
      certifications: ['GlobalG.A.P'],
      status: 'ACTIVE',
      viewCount: 870, likeCount: 41, saveCount: 18, orderCount: 4, rating: 4.7, ratingCount: 4,
    },

    // ── Farmer 2 — Amina Hassan, Tanzania ──────────────────────────────────
    {
      sellerId: farmer2._id, categoryId: cat('coffee-tea'),
      title: 'Kilimanjaro AA Arabica Coffee', slug: slug('Kilimanjaro AA Arabica Coffee'),
      description: 'Single-origin AA-grade Arabica from 1800m altitude. Tasting notes: blackcurrant, dark chocolate, wine. Wet-processed. SCA score 87+. Available green or roasted.',
      images: [
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600',
      ],
      price: 6.50, priceUnit: 'per kg', minimumOrder: 50, availableStock: 800, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['arabica', 'coffee', 'specialty', 'single-origin', 'kilimanjaro', 'tanzania'],
      certifications: ['Fair Trade', 'Rainforest Alliance', 'Organic Tanzania'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 8210, likeCount: 534, saveCount: 278, orderCount: 97, rating: 4.9, ratingCount: 97,
    },
    {
      sellerId: farmer2._id, categoryId: cat('spices-herbs'),
      title: 'Green Cardamom Pods Grade A', slug: slug('Green Cardamom Pods Grade A'),
      description: 'Plump, aromatic green cardamom from high-altitude Tanzanian farms. Eucalyptol content >42%, moisture <10%. Hand-sorted, uniform size. Available in 1kg, 5kg, 25kg, 50kg.',
      images: [
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
      ],
      price: 28.00, priceUnit: 'per kg', minimumOrder: 5, availableStock: 250, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['cardamom', 'spices', 'organic', 'export', 'tanzania', 'green cardamom'],
      certifications: ['Organic Tanzania'],
      status: 'ACTIVE',
      viewCount: 3180, likeCount: 158, saveCount: 72, orderCount: 29, rating: 4.8, ratingCount: 29,
    },
    {
      sellerId: farmer2._id, categoryId: cat('spices-herbs'),
      title: 'Bourbon Vanilla Beans Grade A', slug: slug('Bourbon Vanilla Beans Grade A'),
      description: 'Premium Bourbon vanilla beans, 16-18cm length, moisture 30-35%. Intense aroma, high vanillin content. Available whole, split, or ground. 1kg minimum order.',
      images: [
        'https://images.unsplash.com/photo-1553779913-d1f3e4ef5ca8?w=600',
      ],
      price: 120.00, priceUnit: 'per kg', minimumOrder: 1, availableStock: 40, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['vanilla', 'bourbon vanilla', 'spices', 'premium', 'tanzania'],
      certifications: ['Organic Tanzania', 'Fair Trade'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 5890, likeCount: 415, saveCount: 230, orderCount: 48, rating: 5.0, ratingCount: 48,
    },
    {
      sellerId: farmer2._id, categoryId: cat('spices-herbs'),
      title: 'Zanzibar Cloves Whole', slug: slug('Zanzibar Cloves Whole'),
      description: 'Sun-dried whole cloves from Zanzibar. Eugenol >15%, moisture <12%. Strong, pure aroma. Packed in 1kg, 10kg, 50kg food-grade bags. FOB Dar es Salaam.',
      images: [
        'https://images.unsplash.com/photo-1509462945800-01d29c54defd?w=600',
      ],
      price: 14.00, priceUnit: 'per kg', minimumOrder: 5, availableStock: 400, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Zanzibar, Tanzania',
      tags: ['cloves', 'zanzibar', 'spices', 'whole cloves', 'tanzania'],
      certifications: ['Organic Tanzania'],
      status: 'ACTIVE',
      viewCount: 2560, likeCount: 112, saveCount: 48, orderCount: 21, rating: 4.7, ratingCount: 21,
    },
    {
      sellerId: farmer2._id, categoryId: cat('spices-herbs'),
      title: 'Tanzanian Ginger Root Fresh', slug: slug('Tanzanian Ginger Root Fresh'),
      description: 'Young fresh ginger with high gingerol content. Size Grade 1. Washed and sorted. 25kg mesh bags. Available December–May. Excellent for juice, paste, and export.',
      images: [
        'https://images.unsplash.com/photo-1615485500704-8e990f9900b5?w=600',
      ],
      price: 1.80, priceUnit: 'per kg', minimumOrder: 100, availableStock: 2000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: false, origin: 'Arusha, Tanzania',
      tags: ['ginger', 'fresh ginger', 'spices', 'tanzania', 'juice'],
      status: 'ACTIVE',
      viewCount: 1340, likeCount: 58, saveCount: 22, orderCount: 11, rating: 4.5, ratingCount: 11,
    },
    {
      sellerId: farmer2._id, categoryId: cat('spices-herbs'),
      title: 'Black Pepper Whole Dried', slug: slug('Black Pepper Whole Dried'),
      description: 'Premium Tanzanian black pepper, whole dried. Bold flavour, aromatic. 500g+ berries. Available in 1–50kg. Moisture <12%, no aflatoxin. Food-grade packaging.',
      images: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
      ],
      price: 8.50, priceUnit: 'per kg', minimumOrder: 10, availableStock: 600, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: false, origin: 'Arusha, Tanzania',
      tags: ['black pepper', 'spices', 'pepper', 'tanzania', 'dried'],
      status: 'ACTIVE',
      viewCount: 980, likeCount: 42, saveCount: 16, orderCount: 8, rating: 4.6, ratingCount: 8,
    },

    // ── Farmer 3 — David Osei, Ghana ───────────────────────────────────────
    {
      sellerId: farmer3._id, categoryId: cat('sugar-confectionery'),
      title: 'Ashanti Single-Origin Cocoa Beans', slug: slug('Ashanti Single Origin Cocoa Beans'),
      description: 'Premium fermented and dried cocoa beans from Ashanti region. Fat content >53%, Grade 1 COCOBOD certified. 7-day fermentation, solar-dried. Ideal for craft chocolate makers.',
      images: [
        'https://images.unsplash.com/photo-1511381939415-e44015466834?w=600',
        'https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=600',
      ],
      price: 3.20, priceUnit: 'per kg', minimumOrder: 100, availableStock: 5000, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['cocoa', 'chocolate', 'ghana', 'ashanti', 'craft chocolate', 'single origin'],
      certifications: ['COCOBOD Grade 1'],
      status: 'ACTIVE',
      viewCount: 2240, likeCount: 105, saveCount: 55, orderCount: 11, rating: 4.3, ratingCount: 11,
    },
    {
      sellerId: farmer3._id, categoryId: cat('roots-tubers'),
      title: 'Plantain Green Export Grade', slug: slug('Plantain Green Export Grade'),
      description: 'Fresh green plantain, size M-L (150-300g per finger). Bunched or loose. 3-4 week shelf life. Well-suited for European and Middle East markets. Available year-round.',
      images: [
        'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600',
      ],
      price: 0.45, priceUnit: 'per kg', minimumOrder: 1000, availableStock: 20000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['plantain', 'ghana', 'tropical', 'export', 'green plantain'],
      status: 'ACTIVE',
      viewCount: 1680, likeCount: 61, saveCount: 24, orderCount: 7, rating: 4.2, ratingCount: 7,
    },
    {
      sellerId: farmer3._id, categoryId: cat('oilseeds-nuts'),
      title: 'Red Palm Oil Unrefined', slug: slug('Red Palm Oil Unrefined'),
      description: 'Natural unrefined palm oil, deep red from carotenoids. Rich in vitamin A and E. 20-litre jerrycans or 200-litre drums. Food-grade. Ideal for food processing and cosmetics.',
      images: [
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600',
      ],
      price: 1.20, priceUnit: 'per litre', minimumOrder: 200, availableStock: 5000, stockUnit: 'litres',
      condition: 'PROCESSED', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['palm oil', 'red palm oil', 'ghana', 'cooking oil', 'unrefined'],
      status: 'ACTIVE',
      viewCount: 890, likeCount: 38, saveCount: 14, orderCount: 5, rating: 4.1, ratingCount: 5,
    },
    {
      sellerId: farmer3._id, categoryId: cat('oilseeds-nuts'),
      title: 'Dried Tiger Nuts', slug: slug('Dried Tiger Nuts'),
      description: 'Naturally sweet tiger nuts (chufas), dried. High in fibre, great for horchata, milk substitute, and snacking. Cleaned and graded. Available in 5kg, 25kg, 50kg bags.',
      images: [
        'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600',
      ],
      price: 2.80, priceUnit: 'per kg', minimumOrder: 50, availableStock: 800, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['tiger nuts', 'chufas', 'nuts', 'ghana', 'snack', 'horchata'],
      status: 'ACTIVE',
      viewCount: 540, likeCount: 29, saveCount: 12, orderCount: 3, rating: 4.4, ratingCount: 3,
    },

    // ── Farmer 4 — Mercy Wangari, Uganda ───────────────────────────────────
    {
      sellerId: farmer4._id, categoryId: cat('coffee-tea'),
      title: 'Bugisu AA Arabica Uganda', slug: slug('Bugisu AA Arabica Uganda'),
      description: 'Mt. Elgon Bugisu AA Arabica. Distinct notes of berry, lemon zest, and brown sugar. SCA score 86. Wet-processed. UCDA certified. Minimum 50kg green beans.',
      images: [
        'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
      ],
      price: 5.80, priceUnit: 'per kg', minimumOrder: 50, availableStock: 600, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Mbale, Uganda',
      tags: ['arabica', 'coffee', 'bugisu', 'uganda', 'single-origin', 'specialty'],
      certifications: ['UCDA Certified', 'Organic Uganda'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 3200, likeCount: 218, saveCount: 95, orderCount: 31, rating: 4.7, ratingCount: 31,
    },
    {
      sellerId: farmer4._id, categoryId: cat('spices-herbs'),
      title: 'Ugandan Vanilla Beans Premium', slug: slug('Ugandan Vanilla Beans Premium'),
      description: 'Rich vanilla beans from Mt. Elgon volcanic soils. 14-18cm, high vanillin content, dark and plump. Cured 6 months. Superior to Madagascar in opinion of many buyers.',
      images: [
        'https://images.unsplash.com/photo-1553779913-d1f3e4ef5ca8?w=600',
      ],
      price: 90.00, priceUnit: 'per kg', minimumOrder: 1, availableStock: 25, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Mbale, Uganda',
      tags: ['vanilla', 'ugandan vanilla', 'premium', 'spices', 'uganda'],
      certifications: ['Organic Uganda'],
      status: 'ACTIVE',
      viewCount: 2100, likeCount: 132, saveCount: 76, orderCount: 18, rating: 4.8, ratingCount: 18,
    },
    {
      sellerId: farmer4._id, categoryId: cat('fruits-vegetables'),
      title: 'Matooke Fresh Uganda', slug: slug('Matooke Fresh Uganda'),
      description: 'Premium green cooking bananas (Matooke). Hand-harvested. Sold in 30kg bunches or loose. Excellent for East African diaspora markets in Europe and North America.',
      images: [
        'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600',
      ],
      price: 0.60, priceUnit: 'per kg', minimumOrder: 500, availableStock: 8000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: false, origin: 'Mbale, Uganda',
      tags: ['matooke', 'cooking banana', 'uganda', 'staple food', 'diaspora'],
      status: 'ACTIVE',
      viewCount: 680, likeCount: 32, saveCount: 11, orderCount: 4, rating: 4.3, ratingCount: 4,
    },
    {
      sellerId: farmer4._id, categoryId: cat('oilseeds-nuts'),
      title: 'Sim Sim Sesame Seeds White', slug: slug('Sim Sim Sesame Seeds White'),
      description: 'High-purity white sesame seeds (Sim Sim). Oil content >52%, low moisture. No GMO. Hulled or unhulled. 50kg bags. Excellent for tahini, oil, and bakery use.',
      images: [
        'https://images.unsplash.com/photo-1548516173-3cabfa4607e9?w=600',
      ],
      price: 1.90, priceUnit: 'per kg', minimumOrder: 100, availableStock: 3000, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: false, origin: 'Mbale, Uganda',
      tags: ['sesame', 'sim sim', 'tahini', 'seeds', 'uganda', 'oilseed'],
      certifications: ['UNBS Certified'],
      status: 'ACTIVE',
      viewCount: 910, likeCount: 43, saveCount: 19, orderCount: 8, rating: 4.5, ratingCount: 8,
    },
    {
      sellerId: farmer4._id, categoryId: cat('spices-herbs'),
      title: 'Dried Hibiscus Flowers', slug: slug('Dried Hibiscus Flowers'),
      description: 'Bright red dried hibiscus calyces (Roselle). High in vitamin C and anthocyanins. Perfect for tea, juices, jam, and natural food colouring. 25kg bags.',
      images: [
        'https://images.unsplash.com/photo-1591287083773-9a5249ff4a05?w=600',
      ],
      price: 4.50, priceUnit: 'per kg', minimumOrder: 25, availableStock: 1200, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Mbale, Uganda',
      tags: ['hibiscus', 'sorrel', 'roselle', 'tea', 'natural colouring', 'uganda'],
      certifications: ['Organic Uganda'],
      status: 'ACTIVE',
      viewCount: 1480, likeCount: 91, saveCount: 44, orderCount: 14, rating: 4.9, ratingCount: 14,
    },

    // ── Farmer 5 — Emmanuel Tesfaye, Ethiopia ──────────────────────────────
    {
      sellerId: farmer5._id, categoryId: cat('coffee-tea'),
      title: 'Yirgacheffe Natural Process Coffee', slug: slug('Yirgacheffe Natural Process Coffee'),
      description: 'World-renowned Yirgacheffe G1 natural processed. Blueberry, strawberry, and jasmine notes. SCA score 89+. Micro-lot available. ECX certified. Ideal for specialty roasters.',
      images: [
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600',
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600',
      ],
      price: 8.20, priceUnit: 'per kg', minimumOrder: 30, availableStock: 1200, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Yirgacheffe, Ethiopia',
      tags: ['yirgacheffe', 'coffee', 'ethiopian', 'natural process', 'specialty', 'G1'],
      certifications: ['ECX Certified', 'Organic Ethiopia', 'Fair Trade'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 9400, likeCount: 720, saveCount: 380, orderCount: 145, rating: 5.0, ratingCount: 145,
    },
    {
      sellerId: farmer5._id, categoryId: cat('grains-cereals'),
      title: 'White Teff Grain Organic', slug: slug('White Teff Grain Organic'),
      description: 'Premium white teff from the highlands of Ethiopia. High iron, calcium, and fibre. Gluten-free. Used for injera, porridge, and health foods. 25kg and 50kg bags.',
      images: [
        'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600',
      ],
      price: 3.40, priceUnit: 'per kg', minimumOrder: 100, availableStock: 4000, stockUnit: 'kg',
      condition: 'SEEDS', isOrganic: true, origin: 'Yirgacheffe, Ethiopia',
      tags: ['teff', 'injera', 'gluten-free', 'ethiopia', 'superfood', 'grains'],
      certifications: ['Organic Ethiopia'],
      status: 'ACTIVE',
      viewCount: 2800, likeCount: 210, saveCount: 112, orderCount: 38, rating: 4.9, ratingCount: 38,
    },
    {
      sellerId: farmer5._id, categoryId: cat('spices-herbs'),
      title: 'Moringa Powder Organic', slug: slug('Moringa Powder Organic'),
      description: 'Cold-processed organic moringa leaf powder. 30% protein by dry weight, rich in iron, vitamin A and C. Brilliant green colour. 1kg and 5kg food-grade sealed bags.',
      images: [
        'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600',
      ],
      price: 12.00, priceUnit: 'per kg', minimumOrder: 10, availableStock: 500, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Yirgacheffe, Ethiopia',
      tags: ['moringa', 'superfood', 'powder', 'organic', 'ethiopia', 'health'],
      certifications: ['Organic Ethiopia'],
      status: 'ACTIVE',
      viewCount: 4200, likeCount: 318, saveCount: 165, orderCount: 62, rating: 4.8, ratingCount: 62,
    },
    {
      sellerId: farmer5._id, categoryId: cat('spices-herbs'),
      title: 'Ethiopian Berbere Spice Blend', slug: slug('Ethiopian Berbere Spice Blend'),
      description: 'Authentic berbere spice blend — chilli, fenugreek, coriander, black pepper, and more. Stone-ground in small batches. No additives. Available in 250g, 500g, 1kg, and 5kg.',
      images: [
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
      ],
      price: 9.00, priceUnit: 'per kg', minimumOrder: 5, availableStock: 300, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Yirgacheffe, Ethiopia',
      tags: ['berbere', 'ethiopian spice', 'chilli blend', 'spice mix', 'ethiopia'],
      certifications: ['Organic Ethiopia'],
      status: 'ACTIVE',
      viewCount: 1850, likeCount: 148, saveCount: 63, orderCount: 27, rating: 4.9, ratingCount: 27,
    },
    {
      sellerId: farmer5._id, categoryId: cat('spices-herbs'),
      title: 'Fenugreek Seeds Dried', slug: slug('Fenugreek Seeds Dried'),
      description: 'Premium dried fenugreek seeds. Slightly bitter, nutty flavour. Used in Ethiopian, Indian, and Middle Eastern cuisine. 50kg bags. Cleaned and sorted. Moisture <10%.',
      images: [
        'https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?w=600',
      ],
      price: 2.10, priceUnit: 'per kg', minimumOrder: 50, availableStock: 1500, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Yirgacheffe, Ethiopia',
      tags: ['fenugreek', 'seeds', 'spices', 'ethiopia', 'methi'],
      certifications: ['Organic Ethiopia'],
      status: 'ACTIVE',
      viewCount: 760, likeCount: 52, saveCount: 21, orderCount: 10, rating: 4.6, ratingCount: 10,
    },
  ])
  console.log('📦 Created 25 products')

  // ─── 6. REQUIREMENTS ────────────────────────────────────────────────────────
  const day = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

  const [req1, req2, req3, req4, req5, req6] = await Requirement.insertMany([
    {
      buyerId: buyer1._id,
      title: 'Need 500kg Organic Tomatoes Weekly — Nairobi Delivery',
      description: 'We are a supermarket chain in Nairobi looking for a reliable weekly supplier of KEPHIS-certified organic tomatoes. Delivery to our Westlands warehouse every Monday by 6am. Must pass quality inspection.',
      productType: 'Organic Tomatoes',
      categoryId: cat('fruits-vegetables'),
      quantityAmount: 500, quantityUnit: 'kg',
      deliveryLocation: 'Nairobi, Kenya',
      deliveryFrequency: 'weekly',
      budgetMin: 350, budgetMax: 500, budgetCurrency: 'USD',
      preferredQuality: 'KEPHIS certified organic, medium-large, Brix >5',
      deadline: day(14), status: 'OPEN', isUrgent: false,
      expiresAt: day(30), bidCount: 0, viewCount: 534,
    },
    {
      buyerId: buyer2._id,
      title: 'URGENT: 2 Tonnes Specialty Arabica Coffee — Dubai Import',
      description: 'We import specialty coffee for Middle East hotel chains. Seeking AA-grade East African Arabica with SCA score 85+. FCA Nairobi or FCA Dar es Salaam terms. Need: phytosanitary certificate, COO, quality cert, and fair-trade proof.',
      productType: 'Arabica Coffee',
      categoryId: cat('coffee-tea'),
      quantityAmount: 2000, quantityUnit: 'kg',
      deliveryLocation: 'Dubai, UAE',
      deliveryFrequency: 'one-time',
      budgetMin: 12000, budgetMax: 18000, budgetCurrency: 'USD',
      preferredQuality: 'AA grade, SCA score 85+, wet or natural processed',
      deadline: day(7), status: 'OPEN', isUrgent: true,
      expiresAt: day(14), bidCount: 0, viewCount: 1241,
    },
    {
      buyerId: buyer1._id,
      title: 'Monthly Supply of Mixed Spices — 50kg per SKU',
      description: 'Hotel and restaurant supply company seeking monthly supply of 3 spices: cardamom, cloves, and vanilla beans. Consistent quality essential. Open to 6-month contract with preferred supplier.',
      productType: 'Spices',
      categoryId: cat('spices-herbs'),
      quantityAmount: 150, quantityUnit: 'kg',
      deliveryLocation: 'Nairobi, Kenya',
      deliveryFrequency: 'monthly',
      budgetMin: 2500, budgetMax: 5000, budgetCurrency: 'USD',
      preferredQuality: 'Grade A, food-grade certification, consistent quality',
      deadline: day(21), status: 'OPEN', isUrgent: false,
      expiresAt: day(30), bidCount: 0, viewCount: 345,
    },
    {
      buyerId: buyer2._id,
      title: '5 Tonnes Cocoa Beans for Craft Chocolate — Monthly',
      description: 'European craft chocolate brand seeking reliable supply of single-origin West African cocoa beans. Must be fermented minimum 5 days, solar-dried, Grade 1. We pay premium for consistent quality.',
      productType: 'Cocoa Beans',
      categoryId: cat('sugar-confectionery'),
      quantityAmount: 5000, quantityUnit: 'kg',
      deliveryLocation: 'Rotterdam, Netherlands',
      deliveryFrequency: 'monthly',
      budgetMin: 14000, budgetMax: 20000, budgetCurrency: 'USD',
      preferredQuality: 'Grade 1, 5-day fermentation minimum, moisture <7%',
      deadline: day(30), status: 'OPEN', isUrgent: false,
      expiresAt: day(60), bidCount: 0, viewCount: 678,
    },
    {
      buyerId: buyer3._id,
      title: 'Moringa Powder and Teff Grain — Saudi Health Food Market',
      description: 'Launching a health food brand in Saudi Arabia. Need organic moringa powder and white teff grain for our product line. Halal certification preferred. Private labelling possible.',
      productType: 'Superfood',
      categoryId: cat('spices-herbs'),
      quantityAmount: 500, quantityUnit: 'kg',
      deliveryLocation: 'Riyadh, Saudi Arabia',
      deliveryFrequency: 'monthly',
      budgetMin: 5000, budgetMax: 8000, budgetCurrency: 'USD',
      preferredQuality: 'Organic certified, Halal preferred, food-grade packaging',
      deadline: day(21), status: 'OPEN', isUrgent: false,
      expiresAt: day(45), bidCount: 0, viewCount: 289,
    },
    {
      buyerId: buyer3._id,
      title: '10 Tonnes Green Plantain — Weekly Riyadh Market',
      description: 'We supply West African restaurants and grocery stores across Saudi Arabia. Need reliable weekly delivery of green plantain, Grade A. Must withstand 3-week sea journey.',
      productType: 'Plantain',
      categoryId: cat('roots-tubers'),
      quantityAmount: 10000, quantityUnit: 'kg',
      deliveryLocation: 'Riyadh, Saudi Arabia',
      deliveryFrequency: 'weekly',
      budgetMin: 3000, budgetMax: 6000, budgetCurrency: 'USD',
      preferredQuality: 'Grade A, green, M-L size, long shelf life',
      deadline: day(10), status: 'OPEN', isUrgent: true,
      expiresAt: day(30), bidCount: 0, viewCount: 412,
    },
  ])
  console.log('📋 Created 6 requirements')

  // ─── 7. BIDS ─────────────────────────────────────────────────────────────────
  const bidsData = [
    // req1 — Tomatoes — Nairobi
    {
      requirementId: req1._id, farmerId: farmer1._id,
      pricePerUnit: 0.80, totalPrice: 400, currency: 'USD',
      deliveryTimeline: 'Every Monday by 5am, guaranteed.',
      deliveryNotes: 'Refrigerated van. Delivery to Westlands warehouse. Have done this for Nakumatt before.',
      message: 'We have been supplying organic tomatoes to Nairobi supermarkets for 8 years. KEPHIS certified. Can start immediately next week.',
      certifications: ['KEPHIS Organic', 'GlobalG.A.P'],
      sampleAvailable: true, status: 'PENDING', score: 0.91,
    },
    {
      requirementId: req1._id, farmerId: farmer4._id,
      pricePerUnit: 0.78, totalPrice: 390, currency: 'USD',
      deliveryTimeline: '2–3 days transit from Mbale to Nairobi.',
      message: 'We grow premium tomatoes and can supply weekly. Currently supplying 3 supermarkets in Kampala.',
      sampleAvailable: true, status: 'PENDING', score: 0.62,
    },
    // req2 — Coffee — Dubai
    {
      requirementId: req2._id, farmerId: farmer2._id,
      pricePerUnit: 6.20, totalPrice: 12400, currency: 'USD',
      deliveryTimeline: 'Ready to ship within 2 weeks. FCA Dar es Salaam.',
      deliveryNotes: 'All export documents available: phytosanitary, COO, quality cert, Fair Trade cert, Rainforest Alliance cert.',
      message: 'Our Kilimanjaro AA Arabica scores 87 on SCA. We have exported to Japan, Germany and the UK. References available.',
      certifications: ['Fair Trade', 'Rainforest Alliance', 'Organic Tanzania'],
      sampleAvailable: true, status: 'SHORTLISTED', score: 0.94,
    },
    {
      requirementId: req2._id, farmerId: farmer4._id,
      pricePerUnit: 5.90, totalPrice: 11800, currency: 'USD',
      deliveryTimeline: 'Ready in 3 weeks. FCA Kampala.',
      message: 'Our Bugisu AA scores 86 SCA. Distinct flavour profile. We have all export documents. Can arrange third-party quality inspection.',
      certifications: ['UCDA Certified', 'Organic Uganda'],
      sampleAvailable: true, status: 'PENDING', score: 0.86,
    },
    {
      requirementId: req2._id, farmerId: farmer5._id,
      pricePerUnit: 8.10, totalPrice: 16200, currency: 'USD',
      deliveryTimeline: 'Ready in 10 days. FCA Addis Ababa.',
      message: 'Yirgacheffe G1 scores 89 on SCA — above your requirement. May be slightly above budget but quality is unmatched. Sample available.',
      certifications: ['ECX Certified', 'Organic Ethiopia', 'Fair Trade'],
      sampleAvailable: true, status: 'PENDING', score: 0.88,
    },
    // req3 — Spices — Nairobi
    {
      requirementId: req3._id, farmerId: farmer2._id,
      pricePerUnit: 28.00, totalPrice: 4200, currency: 'USD',
      deliveryTimeline: '5–7 business days to Nairobi by road.',
      message: 'We supply all three: cardamom ($28/kg), cloves ($14/kg), vanilla beans ($120/kg). All Grade A with Organic Tanzania certification. Open to 6-month contract with volume discount.',
      certifications: ['Organic Tanzania', 'Fair Trade'],
      sampleAvailable: true, status: 'PENDING', score: 0.92,
    },
    // req4 — Cocoa — Rotterdam
    {
      requirementId: req4._id, farmerId: farmer3._id,
      pricePerUnit: 3.20, totalPrice: 16000, currency: 'USD',
      deliveryTimeline: 'Container ready in 14 days. CIF Rotterdam.',
      message: 'Osei Cocoa Estate supplies Grade 1 COCOBOD certified cocoa. 7-day fermentation, solar-dried. Currently supplying 2 Belgian chocolate makers. Happy to provide references.',
      certifications: ['COCOBOD Grade 1'],
      sampleAvailable: true, status: 'PENDING', score: 0.79,
    },
    // req5 — Moringa/Teff — Riyadh
    {
      requirementId: req5._id, farmerId: farmer5._id,
      pricePerUnit: 12.00, totalPrice: 6000, currency: 'USD',
      deliveryTimeline: 'Ready in 7 days. FCA Addis Ababa.',
      message: 'We supply both moringa powder and white teff grain, both organic certified. Happy to arrange Halal certification. Can do private labelling. Established supplier to Europe.',
      certifications: ['Organic Ethiopia', 'Fair Trade'],
      sampleAvailable: true, status: 'PENDING', score: 0.88,
    },
    // req6 — Plantain — Riyadh
    {
      requirementId: req6._id, farmerId: farmer3._id,
      pricePerUnit: 0.45, totalPrice: 4500, currency: 'USD',
      deliveryTimeline: 'Container ready in 7 days from Tema Port.',
      message: 'We export 10–20 tonnes of green plantain weekly from Kumasi. Currently shipping to UK, Netherlands, and France. Can add Saudi Arabia to route. Grade A guaranteed.',
      certifications: ['COCOBOD Grade 1'],
      sampleAvailable: false, status: 'PENDING', score: 0.81,
    },
    {
      requirementId: req6._id, farmerId: farmer4._id,
      pricePerUnit: 0.60, totalPrice: 6000, currency: 'USD',
      deliveryTimeline: 'Weekly container from Mombasa or Dar es Salaam.',
      message: 'We grow matooke and plantain year-round. Can supply weekly. Slightly higher price but shorter transit via Mombasa. Shelf life 4+ weeks when green-harvested.',
      sampleAvailable: true, status: 'PENDING', score: 0.58,
    },
  ]

  await Bid.insertMany(bidsData)

  // Update bid counts
  await Promise.all([
    Requirement.findByIdAndUpdate(req1._id, { bidCount: 2 }),
    Requirement.findByIdAndUpdate(req2._id, { bidCount: 3 }),
    Requirement.findByIdAndUpdate(req3._id, { bidCount: 1 }),
    Requirement.findByIdAndUpdate(req4._id, { bidCount: 1 }),
    Requirement.findByIdAndUpdate(req5._id, { bidCount: 1 }),
    Requirement.findByIdAndUpdate(req6._id, { bidCount: 2 }),
  ])
  console.log('💰 Created 10 bids')

  // ─── 8. REELS (10) ───────────────────────────────────────────────────────────
  await Reel.insertMany([
    // Farmer 1 — James (3 reels)
    {
      userId: farmer1._id, productId: products[0]._id,
      title: 'Morning harvest — Kamau Fresh Farms',
      caption: 'Starting the week right! Fresh organic tomatoes ready for Nairobi market 🍅 DM for wholesale pricing. #organicfarming #kenya #agriculture #freshproduce',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=700&fit=crop',
      duration: 28, tags: ['tomatoes', 'harvest', 'kenya', 'organic', 'farming'],
      viewCount: 18400, likeCount: 1290, commentCount: 87, shareCount: 215,
      status: 'PUBLISHED',
    },
    {
      userId: farmer1._id, productId: products[1]._id,
      title: 'White maize loading — 50 ton shipment',
      caption: 'Big day at the farm! Loading 50 tons of export-grade white maize for a Mombasa-bound container 🌽 Proud of our team! #kenya #maize #export #farming',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=700&fit=crop',
      duration: 35, tags: ['maize', 'export', 'kenya', 'loading', 'logistics'],
      viewCount: 7200, likeCount: 480, commentCount: 34, shareCount: 89,
      status: 'PUBLISHED',
    },
    {
      userId: farmer1._id, productId: products[4]._id,
      title: 'Sweet pepper season is here!',
      caption: 'Red, yellow, orange — our pepper fields are stunning this season 🌶️ Available for wholesale and export. GLOBALG.A.P certified. #peppers #nakuru #farming',
      videoUrl: vid(2),
      thumbnailUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=700&fit=crop',
      duration: 22, tags: ['peppers', 'sweet peppers', 'kenya', 'harvest', 'organic'],
      viewCount: 5100, likeCount: 362, commentCount: 41, shareCount: 76,
      status: 'PUBLISHED',
    },
    // Farmer 2 — Amina (2 reels)
    {
      userId: farmer2._id, productId: products[5]._id,
      title: 'Coffee harvest season at Kilimanjaro',
      caption: 'Harvest season is here! Our Arabica cherries are ripe and ready ☕ Hand-picked at 1800m altitude for the best quality. SCA score 87+. #specialtycoffee #kilimanjaro #tanzania',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=700&fit=crop',
      duration: 45, tags: ['coffee', 'arabica', 'harvest', 'tanzania', 'kilimanjaro', 'specialty'],
      viewCount: 48900, likeCount: 3840, commentCount: 283, shareCount: 756,
      status: 'PUBLISHED',
    },
    {
      userId: farmer2._id, productId: products[7]._id,
      title: 'Vanilla bean curing process',
      caption: 'Watch how we cure our premium Bourbon vanilla beans 🌿 6-month curing process for maximum vanillin content. Order your 2025 harvest now — limited stock! #vanilla #spices #tanzania',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1553779913-d1f3e4ef5ca8?w=400&h=700&fit=crop',
      duration: 52, tags: ['vanilla', 'curing', 'spices', 'tanzania', 'premium'],
      viewCount: 22300, likeCount: 1780, commentCount: 142, shareCount: 389,
      status: 'PUBLISHED',
    },
    // Farmer 3 — David (2 reels)
    {
      userId: farmer3._id, productId: products[11]._id,
      title: 'Cocoa pod opening — Ashanti farms',
      caption: 'The smell of fresh cocoa is unbeatable 🍫 Single-origin from Ashanti region. Grade 1 COCOBOD certified. Craft chocolate makers — DM us! #cocoa #ghana #chocolate #ashanti',
      videoUrl: vid(2),
      thumbnailUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&h=700&fit=crop',
      duration: 32, tags: ['cocoa', 'ghana', 'chocolate', 'ashanti', 'harvest'],
      viewCount: 12200, likeCount: 845, commentCount: 68, shareCount: 189,
      status: 'PUBLISHED',
    },
    {
      userId: farmer3._id, productId: products[12]._id,
      title: 'Plantain harvest day in Kumasi',
      caption: 'Harvest day! Loading 20 tonnes of green plantain for UK export 🍌 Available weekly for wholesale buyers in Europe and Middle East. #plantain #ghana #export',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=700&fit=crop',
      duration: 26, tags: ['plantain', 'ghana', 'harvest', 'export', 'tropical'],
      viewCount: 6800, likeCount: 412, commentCount: 29, shareCount: 91,
      status: 'PUBLISHED',
    },
    // Farmer 4 — Mercy (2 reels)
    {
      userId: farmer4._id, productId: products[15]._id,
      title: 'Bugisu AA coffee — Mt. Elgon',
      caption: 'Our Bugisu AA Arabica is unlike anything you have tasted ☕ Harvested at 2000m from the slopes of Mt. Elgon, Uganda. Berry and citrus notes. SCA 86. #uganda #coffee #specialty',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=700&fit=crop',
      duration: 38, tags: ['coffee', 'bugisu', 'uganda', 'specialty', 'arabica'],
      viewCount: 15600, likeCount: 1120, commentCount: 93, shareCount: 241,
      status: 'PUBLISHED',
    },
    // Farmer 5 — Emmanuel (1 reel)
    {
      userId: farmer5._id, productId: products[20]._id,
      title: 'Yirgacheffe coffee — the world\'s finest',
      caption: 'Yirgacheffe G1 natural process. Blueberry and jasmine notes. SCA score 89 🌸 This is why Ethiopian coffee is world-famous. Now taking orders for 2025 harvest! #yirgacheffe #ethiopia #coffee',
      videoUrl: vid(2),
      thumbnailUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=700&fit=crop',
      duration: 58, tags: ['yirgacheffe', 'ethiopia', 'coffee', 'specialty', 'natural process'],
      viewCount: 62400, likeCount: 5100, commentCount: 412, shareCount: 1230,
      status: 'PUBLISHED',
    },
    {
      userId: farmer5._id, productId: products[22]._id,
      title: 'Organic moringa farm tour',
      caption: 'Tour of our moringa farm in the Ethiopian highlands 🌿 Cold-processed powder with 30% protein. Pure, raw, organic. Shipping to 20+ countries. #moringa #superfood #organic #ethiopia',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=400&h=700&fit=crop',
      duration: 44, tags: ['moringa', 'superfood', 'organic', 'ethiopia', 'health'],
      viewCount: 28900, likeCount: 2300, commentCount: 189, shareCount: 567,
      status: 'PUBLISHED',
    },
    // Extra reels for variety
    {
      userId: farmer1._id, productId: products[3]._id,
      title: 'French beans ready for export!',
      caption: 'Our fine French beans pass the UK supermarket grading standard every week 🇬🇧 Pre-washed, packaged, chilled — ready for airfreight. DM for contracts. #frenchbeans #kenya #export #freshproduce',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400&h=700&fit=crop',
      duration: 31, tags: ['french beans', 'export', 'kenya', 'organic', 'uk market'],
      viewCount: 9100, likeCount: 621, commentCount: 52, shareCount: 108,
      status: 'PUBLISHED',
    },
    {
      userId: farmer2._id, productId: products[6]._id,
      title: 'Cardamom harvest — Kilimanjaro highlands',
      caption: 'Green cardamom freshly harvested at 1600m 🌿 The finest in East Africa. Bold, aromatic, green-grade premium. Exporting to UAE, India & Germany. #cardamom #spices #kilimanjaro #tanzania',
      videoUrl: vid(2),
      thumbnailUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=700&fit=crop',
      duration: 40, tags: ['cardamom', 'spices', 'kilimanjaro', 'tanzania', 'export'],
      viewCount: 14200, likeCount: 985, commentCount: 71, shareCount: 203,
      status: 'PUBLISHED',
    },
    {
      userId: farmer4._id, productId: products[17]._id,
      title: 'Vanilla beans — Uganda grade A',
      caption: 'Freshly cured Tahitian vanilla from Mt. Elgon 🌸 20%+ vanillin content. Bourbon variety. Premium grade for luxury chocolate and pastry chefs worldwide. #vanilla #uganda #luxury #gourmet',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1553779913-d1f3e4ef5ca8?w=400&h=700&fit=crop',
      duration: 55, tags: ['vanilla', 'uganda', 'gourmet', 'luxury', 'baking'],
      viewCount: 31400, likeCount: 2450, commentCount: 178, shareCount: 612,
      status: 'PUBLISHED',
    },
    {
      userId: farmer3._id, productId: products[13]._id,
      title: 'Palm oil processing — traditional & pure',
      caption: 'Cold-pressed palm oil from our Ashanti estate 🌴 No chemicals, no bleaching — 100% natural red palm oil. High in beta-carotene and Vitamin E. Wholesale pricing available. #palmoil #ghana #organic #healthy',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&h=700&fit=crop',
      duration: 37, tags: ['palm oil', 'ghana', 'organic', 'traditional', 'healthy'],
      viewCount: 8700, likeCount: 534, commentCount: 43, shareCount: 97,
      status: 'PUBLISHED',
    },
    {
      userId: farmer5._id, productId: products[21]._id,
      title: 'Teff flour — ancient grain revolution',
      caption: 'Ethiopia gives the world teff 🌾 Gluten-free, high-iron, high-protein. Our stone-ground teff flour is the base of injera and gaining massive demand in Europe & USA. #teff #glutenfree #ethiopia #superfoods #injera',
      videoUrl: vid(2),
      thumbnailUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&h=700&fit=crop',
      duration: 49, tags: ['teff', 'gluten free', 'ethiopia', 'ancient grain', 'superfood'],
      viewCount: 41200, likeCount: 3180, commentCount: 241, shareCount: 890,
      status: 'PUBLISHED',
    },
    {
      userId: farmer1._id,
      title: 'Day in the life — organic farming Kenya',
      caption: 'Wake up at 5AM, walk the fields, check the drip irrigation, pack the produce. This is farming life in Nakuru 🌅 Follow for daily farm updates! #farmlife #kenya #organic #behindthescenes',
      videoUrl: vid(0),
      thumbnailUrl: 'https://images.unsplash.com/photo-1501004890684-d8cbf643f5f2?w=400&h=700&fit=crop',
      duration: 62, tags: ['farmlife', 'kenya', 'organic', 'daily', 'behind the scenes'],
      viewCount: 22100, likeCount: 1680, commentCount: 134, shareCount: 478,
      status: 'PUBLISHED',
    },
    {
      userId: farmer2._id,
      title: 'Coffee cupping session — 87+ SCA score',
      caption: 'We cup every batch before export ☕ Watch our quality team evaluate this Kilimanjaro Arabica. Caramel, citrus, floral — this is specialty coffee. Score: 87.5 SCA. #coffeecupping #specialty #quality #kilimanjaro',
      videoUrl: vid(1),
      thumbnailUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=700&fit=crop',
      duration: 70, tags: ['coffee', 'cupping', 'quality', 'specialty', 'arabica'],
      viewCount: 55600, likeCount: 4230, commentCount: 318, shareCount: 1100,
      status: 'PUBLISHED',
    },
  ])
  const reelDocs = await Reel.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).limit(6)
  await Comment.insertMany([
    { userId: buyer1._id, reelId: reelDocs[0]?._id, content: 'Amazing quality! We placed a big order last month and the produce was perfect. Highly recommend 🌟', likeCount: 24 },
    { userId: buyer2._id, reelId: reelDocs[0]?._id, content: 'What is the minimum order quantity for export?', likeCount: 3 },
    { userId: farmer3._id, reelId: reelDocs[0]?._id, content: 'Great work fellow farmer! 🤝 Solidarity from Ghana!', likeCount: 8 },
    { userId: buyer3._id, reelId: reelDocs[1]?._id, content: 'This is exactly what we are looking for in Riyadh. How do we place a bulk order?', likeCount: 5 },
    { userId: buyer1._id, reelId: reelDocs[1]?._id, content: 'The packaging looks world-class. Well done Amina!', likeCount: 12 },
    { userId: farmer1._id, reelId: reelDocs[2]?._id, content: 'Our partner farms in Uganda are doing incredible work 🙌', likeCount: 7 },
    { userId: buyer2._id, reelId: reelDocs[3]?._id, content: 'Shipped to Dubai last week — quality was exceptional! Repeat customer here.', likeCount: 31 },
    { userId: farmer5._id, reelId: reelDocs[4]?._id, content: 'Ethiopian coffee is truly in a class of its own. Proud to see this! 🇪🇹', likeCount: 45 },
  ])
  console.log('🎬 Created 18 reels + 8 comments')

  // ─── 9. ORDERS ─────────────────────────────────────────────────────────────── ───────────────────────────────────────────────────────────────
  const addr = (city: string, region: string, country: string) => ({
    street: '42 Market Lane', city, region, country,
  })

  const [order1, order2, order3, order4, order5, order6] = await Order.insertMany([
    {
      orderNumber: 'EM-TOM2401',
      buyerId: buyer1._id, sellerId: farmer1._id,
      items: [{
        productId: products[0]._id,
        title: 'Premium Organic Tomatoes',
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
        quantity: 500, unit: 'kg', unitPrice: 0.85, totalPrice: 425,
      }],
      subtotal: 425, deliveryFee: 15, platformFee: 10.63, total: 450.63, currency: 'USD',
      deliveryAddress: addr('Nairobi', 'Nairobi', 'Kenya'),
      notes: 'Deliver to Westlands warehouse gate B. Call on arrival.',
      status: 'COMPLETED',
      estimatedDelivery: daysAgo(12),
      deliveredAt: daysAgo(11),
      createdAt: daysAgo(18),
    },
    {
      orderNumber: 'EM-COF2402',
      buyerId: buyer2._id, sellerId: farmer2._id,
      items: [{
        productId: products[5]._id,
        title: 'Kilimanjaro AA Arabica Coffee',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
        quantity: 50, unit: 'kg', unitPrice: 7.50, totalPrice: 375,
      }],
      subtotal: 375, deliveryFee: 50, platformFee: 9.38, total: 434.38, currency: 'USD',
      deliveryAddress: addr('Dubai', 'Dubai', 'UAE'),
      status: 'SHIPPED',
      estimatedDelivery: day(5),
      createdAt: daysAgo(8),
    },
    {
      orderNumber: 'EM-MOR2403',
      buyerId: buyer3._id, sellerId: farmer5._id,
      items: [{
        productId: products[22]._id,
        title: 'Moringa Powder Organic',
        image: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=400',
        quantity: 20, unit: 'kg', unitPrice: 12.00, totalPrice: 240,
      }],
      subtotal: 240, deliveryFee: 30, platformFee: 6.00, total: 276.00, currency: 'USD',
      deliveryAddress: addr('Riyadh', 'Riyadh', 'Saudi Arabia'),
      status: 'PAYMENT_CONFIRMED',
      estimatedDelivery: day(12),
      createdAt: daysAgo(2),
    },
    {
      orderNumber: 'EM-COC2404',
      buyerId: buyer1._id, sellerId: farmer3._id,
      items: [{
        productId: products[10]._id,
        title: 'Ghanaian Cocoa Beans Grade 1',
        image: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400',
        quantity: 100, unit: 'kg', unitPrice: 2.80, totalPrice: 280,
      }],
      subtotal: 280, deliveryFee: 30, platformFee: 7.00, total: 317.00, currency: 'USD',
      deliveryAddress: addr('Nairobi', 'Nairobi', 'Kenya'),
      status: 'PROCESSING',
      estimatedDelivery: day(10),
      createdAt: daysAgo(5),
    },
    {
      orderNumber: 'EM-BUG2405',
      buyerId: buyer2._id, sellerId: farmer4._id,
      items: [{
        productId: products[15]._id,
        title: 'Bugisu AA Arabica Coffee',
        image: 'https://images.unsplash.com/photo-1559181567-c3190ca9d8da?w=400',
        quantity: 30, unit: 'kg', unitPrice: 6.80, totalPrice: 204,
      }],
      subtotal: 204, deliveryFee: 40, platformFee: 5.10, total: 249.10, currency: 'USD',
      deliveryAddress: addr('Dubai', 'Dubai', 'UAE'),
      status: 'PENDING',
      estimatedDelivery: day(18),
      createdAt: daysAgo(1),
    },
    {
      orderNumber: 'EM-MAI2406',
      buyerId: buyer3._id, sellerId: farmer1._id,
      items: [{
        productId: products[1]._id,
        title: 'White Maize Export Grade',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        quantity: 2, unit: 'tons', unitPrice: 280, totalPrice: 560,
      }],
      subtotal: 560, deliveryFee: 80, platformFee: 14.00, total: 654.00, currency: 'USD',
      deliveryAddress: addr('Riyadh', 'Riyadh', 'Saudi Arabia'),
      notes: 'Halal certified packing preferred.',
      status: 'COMPLETED',
      estimatedDelivery: daysAgo(4),
      deliveredAt: daysAgo(3),
      createdAt: daysAgo(14),
    },
  ])
  console.log('🛒 Created 6 orders')

  // ─── 10. CONVERSATIONS & MESSAGES ────────────────────────────────────────────
  const [conv1, conv2, conv3, conv4, conv5] = await Conversation.insertMany([
    { participants: [buyer1._id, farmer1._id], type: 'DIRECT', lastMessage: 'Thank you! The tomatoes were perfect.', lastMessageAt: daysAgo(10) },
    { participants: [buyer2._id, farmer2._id], type: 'DIRECT', lastMessage: 'Shipment confirmed. DHL tracking: 1Z999AA10123456784', lastMessageAt: daysAgo(3) },
    { participants: [buyer3._id, farmer5._id], type: 'DIRECT', lastMessage: 'Can you do Halal certification for the moringa?', lastMessageAt: daysAgo(1) },
    { participants: [buyer2._id, farmer5._id], type: 'BID_NEGOTIATION', lastMessage: 'We can do $7.90/kg for your 2 tonne order.', lastMessageAt: daysAgo(2) },
    { participants: [buyer1._id, farmer4._id], type: 'DIRECT', lastMessage: 'Do you ship to Nairobi regularly?', lastMessageAt: daysAgo(6) },
  ])

  await Message.insertMany([
    // conv1 — Sarah ↔ James (tomato order)
    { conversationId: conv1._id, senderId: buyer1._id,  content: 'Hi James! I saw your organic tomatoes on eMazao. Are you currently supplying to Nairobi?', createdAt: daysAgo(25) },
    { conversationId: conv1._id, senderId: farmer1._id, content: 'Hello Sarah! Yes, we supply to Nairobi every Monday morning. KEPHIS certified, refrigerated transport. What quantity do you need?', createdAt: daysAgo(24) },
    { conversationId: conv1._id, senderId: buyer1._id,  content: 'We need about 500kg weekly. Can you guarantee consistent quality and early morning delivery to Westlands?', createdAt: daysAgo(24) },
    { conversationId: conv1._id, senderId: farmer1._id, content: 'Absolutely. I\'ve been supplying FreshMart and Nakumatt for 8 years. Delivery by 5am every Monday. $0.85/kg for 500kg+. Shall we do a trial run next week?', createdAt: daysAgo(23) },
    { conversationId: conv1._id, senderId: buyer1._id,  content: 'Perfect! Let\'s do the trial. I\'ll place the order on the platform now.', createdAt: daysAgo(22) },
    { conversationId: conv1._id, senderId: farmer1._id, content: 'Excellent! Order received and confirmed. See you Monday!', createdAt: daysAgo(19) },
    { conversationId: conv1._id, senderId: buyer1._id,  content: 'Thank you! The tomatoes were perfect.', createdAt: daysAgo(10) },

    // conv2 — Ali ↔ Amina (coffee to Dubai)
    { conversationId: conv2._id, senderId: buyer2._id,  content: 'Hello Amina, I came across your Kilimanjaro AA coffee. We import specialty coffee for 5-star hotels in Dubai. What\'s your SCA score?', createdAt: daysAgo(15) },
    { conversationId: conv2._id, senderId: farmer2._id, content: 'Good day Mohamed! Our latest harvest scored 87.5 on SCA. Fair-trade and Rainforest Alliance certified. We\'ve exported to Japan, Germany and the UK. Can share references.', createdAt: daysAgo(14) },
    { conversationId: conv2._id, senderId: buyer2._id,  content: 'Impressive. Can you supply 50kg as a trial order? FCA Dar es Salaam terms.', createdAt: daysAgo(13) },
    { conversationId: conv2._id, senderId: farmer2._id, content: 'Yes! 50kg at $7.50/kg. All export documents included: phytosanitary, COO, quality cert, and fair-trade cert. Ready in 5 days.', createdAt: daysAgo(12) },
    { conversationId: conv2._id, senderId: buyer2._id,  content: 'Deal. I\'ll place the order now.', createdAt: daysAgo(11) },
    { conversationId: conv2._id, senderId: farmer2._id, content: 'Order received! I\'ll have it shipped by Friday. Expect tracking details shortly.', createdAt: daysAgo(8) },
    { conversationId: conv2._id, senderId: farmer2._id, content: 'Shipment confirmed. DHL tracking: 1Z999AA10123456784', createdAt: daysAgo(3) },

    // conv3 — Fatima ↔ Emmanuel (moringa)
    { conversationId: conv3._id, senderId: buyer3._id,  content: 'Hi Emmanuel, I\'m launching a health food brand in Saudi Arabia. Interested in your organic moringa powder and teff grain.', createdAt: daysAgo(8) },
    { conversationId: conv3._id, senderId: farmer5._id, content: 'Hello Fatima! Great to hear. Our moringa is cold-processed, 30% protein, brilliant green colour. Teff is white variety, gluten-free. Both organic certified by ECX. What quantities?', createdAt: daysAgo(7) },
    { conversationId: conv3._id, senderId: buyer3._id,  content: 'We\'ll start with 20kg moringa. Can you arrange private labelling?', createdAt: daysAgo(6) },
    { conversationId: conv3._id, senderId: farmer5._id, content: 'Yes! We do private labelling in 1kg food-grade sealed bags. Minimum 20kg order. I can also arrange halal certification through a local certification body.', createdAt: daysAgo(5) },
    { conversationId: conv3._id, senderId: buyer3._id,  content: 'Can you do Halal certification for the moringa?', createdAt: daysAgo(1) },

    // conv4 — Ali ↔ Emmanuel (bid negotiation)
    { conversationId: conv4._id, senderId: buyer2._id,  content: 'Emmanuel, your bid of $8.10/kg for our 2 tonne Arabica order is slightly over budget at $16,200. Can you do $7.80?', createdAt: daysAgo(5) },
    { conversationId: conv4._id, senderId: farmer5._id, content: 'Mohamed, I understand. Yirgacheffe G1 with SCA 89 commands a premium. Best I can do is $7.90 — this includes all certifications and phytosanitary. No other Ethiopian G1 beats our profile.', createdAt: daysAgo(4) },
    { conversationId: conv4._id, senderId: buyer2._id,  content: 'Fair enough. Your SCA score is indeed exceptional. Let me discuss with my team.', createdAt: daysAgo(3) },
    { conversationId: conv4._id, senderId: farmer5._id, content: 'We can do $7.90/kg for your 2 tonne order.', createdAt: daysAgo(2) },

    // conv5 — Sarah ↔ Mercy (logistics question)
    { conversationId: conv5._id, senderId: buyer1._id,  content: 'Hi Mercy, I see you have Bugisu AA coffee. We\'re expanding our selection. Do you ship to Nairobi regularly?', createdAt: daysAgo(8) },
    { conversationId: conv5._id, senderId: farmer4._id, content: 'Hello Sarah! Yes we ship to Nairobi via Malaba border crossing, usually 2-3 days. We currently supply 4 hotels in Nairobi. What quantities are you looking for?', createdAt: daysAgo(7) },
    { conversationId: conv5._id, senderId: buyer1._id,  content: 'Do you ship to Nairobi regularly?', createdAt: daysAgo(6) },
  ])
  console.log('💬 Created 5 conversations with messages')

  // ─── 11. NOTIFICATIONS ───────────────────────────────────────────────────────
  await Notification.insertMany([
    // farmer1 — James
    { userId: farmer1._id, type: 'ORDER', title: 'New order received!', body: 'Sarah Njoroge placed an order for 500kg Organic Tomatoes (EM-TOM2401).', isRead: true, readAt: daysAgo(17), createdAt: daysAgo(18) },
    { userId: farmer1._id, type: 'PAYMENT', title: 'Payment confirmed', body: 'Payment of $450.63 received for order EM-TOM2401. Funds held in escrow.', isRead: true, readAt: daysAgo(17), createdAt: daysAgo(18) },
    { userId: farmer1._id, type: 'ORDER', title: 'New order received!', body: 'Fatima Al-Rashid ordered 2 tons of White Maize Export Grade (EM-MAI2406).', isRead: true, readAt: daysAgo(13), createdAt: daysAgo(14) },
    { userId: farmer1._id, type: 'PAYMENT', title: 'Escrow released!', body: 'Order EM-TOM2401 confirmed as delivered. $415.00 credited to your wallet.', isRead: false, createdAt: daysAgo(11) },
    { userId: farmer1._id, type: 'FOLLOW', title: 'Mohamed Ali followed you', body: 'Mohamed Ali (Dubai Importer) started following Kamau Fresh Farms.', isRead: false, createdAt: daysAgo(9) },
    { userId: farmer1._id, type: 'PAYMENT', title: 'Escrow released!', body: 'Order EM-MAI2406 confirmed as delivered. $546.00 credited to your wallet.', isRead: false, createdAt: daysAgo(3) },

    // farmer2 — Amina
    { userId: farmer2._id, type: 'BID', title: 'Your bid was shortlisted!', body: 'Your bid on "URGENT: 2 Tonnes Arabica Coffee — Dubai Import" has been shortlisted.', isRead: true, readAt: daysAgo(6), createdAt: daysAgo(7) },
    { userId: farmer2._id, type: 'ORDER', title: 'New order received!', body: 'Mohamed Ali ordered 50kg Kilimanjaro AA Arabica Coffee (EM-COF2402).', isRead: true, readAt: daysAgo(7), createdAt: daysAgo(8) },
    { userId: farmer2._id, type: 'PAYMENT', title: 'Payment confirmed', body: '$434.38 received for EM-COF2402. Prepare shipment within 5 business days.', isRead: false, createdAt: daysAgo(8) },

    // farmer3 — David
    { userId: farmer3._id, type: 'ORDER', title: 'New order!', body: 'Sarah Njoroge ordered 100kg Ghanaian Cocoa Beans Grade 1 (EM-COC2404).', isRead: false, createdAt: daysAgo(5) },
    { userId: farmer3._id, type: 'SYSTEM', title: 'Get verified to unlock more buyers', body: 'Verified sellers get 3x more visibility in the marketplace. Apply for Farm Verification now.', isRead: false, createdAt: daysAgo(3) },

    // farmer4 — Mercy
    { userId: farmer4._id, type: 'ORDER', title: 'New order received!', body: 'Mohamed Ali placed an order for 30kg Bugisu AA Arabica Coffee (EM-BUG2405).', isRead: false, createdAt: daysAgo(1) },
    { userId: farmer4._id, type: 'BID', title: 'Bid submitted on your behalf', body: 'Your bid on "10 Tonnes Green Plantain — Riyadh" is now live and visible to the buyer.', isRead: true, readAt: daysAgo(20), createdAt: daysAgo(21) },

    // farmer5 — Emmanuel
    { userId: farmer5._id, type: 'ORDER', title: 'New order!', body: 'Fatima Al-Rashid ordered 20kg Moringa Powder Organic (EM-MOR2403).', isRead: false, createdAt: daysAgo(2) },
    { userId: farmer5._id, type: 'PAYMENT', title: 'Payment received', body: '$276.00 confirmed for EM-MOR2403. Now processing your order.', isRead: false, createdAt: daysAgo(2) },
    { userId: farmer5._id, type: 'LIKE', title: 'Your reel is trending!', body: 'Your Yirgacheffe coffee reel hit 62,000 views and is trending in #specialty coffee.', isRead: false, createdAt: daysAgo(1) },

    // buyer1 — Sarah
    { userId: buyer1._id, type: 'DELIVERY', title: 'Order delivered!', body: 'Your order EM-TOM2401 (500kg Organic Tomatoes) has been delivered. Please confirm receipt.', isRead: true, readAt: daysAgo(10), createdAt: daysAgo(11) },
    { userId: buyer1._id, type: 'ORDER', title: 'Order completed', body: 'Order EM-TOM2401 marked complete. Thank you for shopping with Kamau Fresh Farms!', isRead: false, createdAt: daysAgo(10) },
    { userId: buyer1._id, type: 'BID', title: 'New bid on your requirement', body: '2 farmers bid on "Need 500kg Organic Tomatoes Weekly". Review bids now.', isRead: false, createdAt: daysAgo(14) },

    // buyer2 — Ali
    { userId: buyer2._id, type: 'BID', title: '3 new bids on your requirement', body: 'Your "URGENT: 2 Tonnes Arabica Coffee" requirement has 3 bids. The top bid scores 94/100!', isRead: false, createdAt: daysAgo(6) },
    { userId: buyer2._id, type: 'ORDER', title: 'Order shipped!', body: 'Order EM-COF2402 is on its way! DHL tracking: 1Z999AA10123456784. ETA 5 days.', isRead: false, createdAt: daysAgo(3) },
    { userId: buyer2._id, type: 'MESSAGE', title: 'New message from Emmanuel Tesfaye', body: 'We can do $7.90/kg for your 2 tonne order. No other Ethiopian G1 beats our profile.', isRead: false, createdAt: daysAgo(2) },

    // buyer3 — Fatima
    { userId: buyer3._id, type: 'ORDER', title: 'Payment confirmed!', body: 'Your payment for EM-MOR2403 is confirmed. Emmanuel Tesfaye will prepare your order.', isRead: false, createdAt: daysAgo(2) },
    { userId: buyer3._id, type: 'BID', title: '1 new bid on your moringa requirement', body: 'Emmanuel Tesfaye submitted a bid on your "Moringa Powder and Teff Grain" requirement.', isRead: false, createdAt: daysAgo(3) },
    { userId: buyer3._id, type: 'DELIVERY', title: 'Order delivered!', body: 'Your order EM-MAI2406 (2 tons White Maize) was delivered successfully.', isRead: true, readAt: daysAgo(2), createdAt: daysAgo(3) },
  ])
  console.log('🔔 Created 24 notifications')

  console.log('\n✅ Demo seed complete! (9 users, 25 products, 10 reels, 6 requirements, 10 bids, 6 orders, 5 conversations, 24 notifications)')
  console.log('══════════════════════════════════════════════')
  console.log('  Login credentials (password: Demo1234!)')
  console.log('──────────────────────────────────────────────')
  console.log('  Farmers:')
  console.log('    james@emazao.demo      (Kamau Fresh Farms, Kenya)')
  console.log('    amina@emazao.demo      (Kilimanjaro Spice Garden, Tanzania)')
  console.log('    david@emazao.demo      (Osei Cocoa Estate, Ghana)')
  console.log('    mercy@emazao.demo      (Elgon Highlands Farm, Uganda)')
  console.log('    emmanuel@emazao.demo   (Yirgacheffe Highlands, Ethiopia)')
  console.log('  Buyers:')
  console.log('    sarah@emazao.demo      (FreshMart Supermarkets, Kenya)')
  console.log('    ali@emazao.demo        (Dubai Importer, UAE)')
  console.log('    fatima@emazao.demo     (Riyadh Food Co., Saudi Arabia)')
  console.log('  Admin:')
  console.log('    admin@emazao.demo')
  console.log('══════════════════════════════════════════════')

  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ Seed error:', err); process.exit(1) })
