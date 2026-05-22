/**
 * Demo seed — run once after MongoDB connects:
 *   npx ts-node src/config/demoSeed.ts
 *
 * Creates: 1 admin, 3 farmers, 2 buyers, 10 products, 3 requirements, 4 bids
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import { nanoid } from 'nanoid'
import * as dotenv from 'dotenv'
dotenv.config()

import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Product from '../models/Product'
import Category from '../models/Category'
import Requirement from '../models/Requirement'
import Bid from '../models/Bid'
import Wallet from '../models/Wallet'
import Reel from '../models/Reel'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('✅ Connected to MongoDB')

  // Clear existing demo data
  await Promise.all([
    User.deleteMany({ email: /@emazao\.demo$/ }),
    SellerProfile.deleteMany({}),
    Product.deleteMany({}),
    Requirement.deleteMany({}),
    Bid.deleteMany({}),
    Wallet.deleteMany({}),
    Reel.deleteMany({}),
  ])
  console.log('🗑️  Cleared old demo data')

  const hash = await bcrypt.hash('Demo1234!', 12)

  // --- Users ---
  const [admin, farmer1, farmer2, farmer3, buyer1, buyer2] = await User.insertMany([
    {
      name: 'Admin Emazao', email: 'admin@emazao.demo', username: 'admin_emazao',
      passwordHash: hash, role: 'SUPER_ADMIN', isVerified: true, verifiedType: 'ID_VERIFIED',
      country: 'Kenya', location: 'Nairobi', onboardingDone: true,
      bio: 'Platform administrator',
    },
    {
      name: 'James Kamau', email: 'james@emazao.demo', username: 'james_kamau',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Kenya', location: 'Nakuru',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      bio: 'Organic tomato and maize farmer from Nakuru. 15 years of experience.',
      onboardingDone: true,
    },
    {
      name: 'Amina Hassan', email: 'amina@emazao.demo', username: 'amina_hassan',
      passwordHash: hash, role: 'FARMER', isVerified: true, verifiedType: 'FARM_VERIFIED',
      country: 'Tanzania', location: 'Arusha',
      avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
      bio: 'Coffee and spice farmer in the foothills of Kilimanjaro.',
      onboardingDone: true,
    },
    {
      name: 'David Osei', email: 'david@emazao.demo', username: 'david_osei',
      passwordHash: hash, role: 'FARMER', isVerified: false,
      country: 'Ghana', location: 'Kumasi',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      bio: 'Cocoa and plantain farmer from Ashanti region.',
      onboardingDone: true,
    },
    {
      name: 'Sarah Njoroge', email: 'sarah@emazao.demo', username: 'sarah_njoroge',
      passwordHash: hash, role: 'BUYER', isVerified: true, verifiedType: 'ID_VERIFIED',
      country: 'Kenya', location: 'Nairobi',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
      bio: 'Procurement manager at FreshMart Supermarkets.',
      onboardingDone: true,
    },
    {
      name: 'Mohamed Ali', email: 'ali@emazao.demo', username: 'ali_trader',
      passwordHash: hash, role: 'BUSINESS_BUYER', isVerified: false,
      country: 'UAE', location: 'Dubai',
      bio: 'Agricultural commodities importer. Sourcing from East Africa.',
      onboardingDone: true,
    },
  ])
  console.log('👥 Created 6 users')

  // --- Wallets ---
  await Wallet.insertMany([
    { userId: farmer1._id, balance: 4250.00, pendingBalance: 800.00, currency: 'USD' },
    { userId: farmer2._id, balance: 1820.50, pendingBalance: 0, currency: 'USD' },
    { userId: farmer3._id, balance: 320.00, pendingBalance: 0, currency: 'USD' },
    { userId: buyer1._id, balance: 0, pendingBalance: 0, currency: 'USD' },
    { userId: buyer2._id, balance: 0, pendingBalance: 0, currency: 'USD' },
  ])

  // --- Seller Profiles ---
  await SellerProfile.insertMany([
    {
      userId: farmer1._id, farmName: 'Kamau Fresh Farms',
      farmDescription: 'KEPHIS-certified organic farm producing premium tomatoes, maize, and vegetables. Export quality produce.',
      farmSize: 12, farmLocation: 'Nakuru, Kenya',
      specializations: ['tomatoes', 'maize', 'organic', 'export'],
      deliveryRadius: 200, storeSlug: 'kamau-fresh-farms',
      rating: 4.8, ratingCount: 47, totalSales: 89, totalRevenue: 34500,
      certifications: ['KEPHIS Organic', 'GlobalG.A.P'],
      isActive: true,
    },
    {
      userId: farmer2._id, farmName: 'Kilimanjaro Spice Garden',
      farmDescription: 'Premium Arabica coffee and exotic spices from the slopes of Kilimanjaro. Fair-trade certified.',
      farmSize: 8, farmLocation: 'Arusha, Tanzania',
      specializations: ['coffee', 'spices', 'cardamom', 'vanilla'],
      deliveryRadius: 500, storeSlug: 'kilimanjaro-spice-garden',
      rating: 4.9, ratingCount: 93, totalSales: 212, totalRevenue: 78000,
      certifications: ['Fair Trade', 'Rainforest Alliance', 'Organic Tanzania'],
      isActive: true,
    },
    {
      userId: farmer3._id, farmName: 'Osei Cocoa Estate',
      farmDescription: 'Single-origin Ghanaian cocoa from Ashanti region. Premium grade.',
      farmSize: 20, farmLocation: 'Kumasi, Ghana',
      specializations: ['cocoa', 'plantain', 'palm oil'],
      deliveryRadius: 300, storeSlug: 'osei-cocoa-estate',
      rating: 4.3, ratingCount: 12, totalSales: 18, totalRevenue: 9200,
      certifications: ['COCOBOD Certified'],
      isActive: true,
    },
  ])
  console.log('🏪 Created 3 seller profiles')

  // --- Categories ---
  const categories = await Category.find()
  const fruitsVeg = categories.find(c => c.slug === 'fruits-vegetables')
  const grains = categories.find(c => c.slug === 'grains-cereals')
  const spices = categories.find(c => c.slug === 'spices-herbs')
  const coffee = categories.find(c => c.slug === 'coffee-tea')
  const legumes = categories.find(c => c.slug === 'legumes-pulses')

  // --- Products ---
  const products = await Product.insertMany([
    {
      sellerId: farmer1._id, categoryId: fruitsVeg?._id,
      title: 'Premium Organic Tomatoes', slug: 'premium-organic-tomatoes-' + nanoid(6),
      description: 'Fresh, KEPHIS-certified organic tomatoes. Harvested weekly. Ideal for supermarkets, restaurants, and export. Size: medium to large, Brix >6.',
      images: [
        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
        'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=600',
      ],
      price: 0.85, priceUnit: 'per kg', minimumOrder: 500, availableStock: 8000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['tomatoes', 'organic', 'fresh', 'export', 'kenya'],
      certifications: ['KEPHIS Organic'], status: 'ACTIVE', isBoosted: true,
      viewCount: 3420, likeCount: 187, saveCount: 94, orderCount: 23, rating: 4.8,
    },
    {
      sellerId: farmer1._id, categoryId: grains?._id,
      title: 'White Maize — Export Grade', slug: 'white-maize-export-grade-' + nanoid(6),
      description: 'Premium white maize, moisture <13.5%, aflatoxin <10ppb. Ready for bulk export. Available in 50kg bags or bulk.',
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
      ],
      price: 280, priceUnit: 'per ton', minimumOrder: 5, availableStock: 120, stockUnit: 'tons',
      condition: 'PROCESSED', isOrganic: false, origin: 'Nakuru, Kenya',
      tags: ['maize', 'white maize', 'export', 'grains', 'bulk'],
      status: 'ACTIVE', viewCount: 1840, likeCount: 62, orderCount: 8, rating: 4.7,
    },
    {
      sellerId: farmer1._id, categoryId: legumes?._id,
      title: 'French Beans — Extra Fine', slug: 'french-beans-extra-fine-' + nanoid(6),
      description: 'Air-freighted within 24h of harvest. European market specs. Calibre 4-6mm. Available year-round.',
      images: [
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600',
      ],
      price: 2.20, priceUnit: 'per kg', minimumOrder: 200, availableStock: 3000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['french beans', 'haricots', 'export', 'europe', 'organic'],
      status: 'ACTIVE', viewCount: 920, likeCount: 44, orderCount: 5, rating: 4.9,
    },
    {
      sellerId: farmer2._id, categoryId: coffee?._id,
      title: 'Kilimanjaro AA Arabica Coffee', slug: 'kilimanjaro-aa-arabica-' + nanoid(6),
      description: 'Single-origin AA-grade Arabica from 1800m altitude. Notes of blackcurrant, dark chocolate, wine. Wet-processed. SCA score 87+.',
      images: [
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
      ],
      price: 6.50, priceUnit: 'per kg', minimumOrder: 50, availableStock: 800, stockUnit: 'kg',
      condition: 'PROCESSED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['arabica', 'coffee', 'specialty', 'single-origin', 'kilimanjaro'],
      certifications: ['Fair Trade', 'Rainforest Alliance'],
      status: 'ACTIVE', isBoosted: true,
      viewCount: 5210, likeCount: 334, saveCount: 178, orderCount: 67, rating: 4.9,
    },
    {
      sellerId: farmer2._id, categoryId: spices?._id,
      title: 'Green Cardamom Pods — Grade A', slug: 'green-cardamom-pods-grade-a-' + nanoid(6),
      description: 'Plump, aromatic green cardamom from high-altitude Tanzanian farms. Eucalyptol content >42%. Moisture <10%. Hand-sorted.',
      images: [
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
      ],
      price: 28.00, priceUnit: 'per kg', minimumOrder: 10, availableStock: 250, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['cardamom', 'spices', 'organic', 'export', 'tanzania'],
      status: 'ACTIVE', viewCount: 2180, likeCount: 98, orderCount: 19, rating: 4.8,
    },
    {
      sellerId: farmer2._id, categoryId: spices?._id,
      title: 'Vanilla Beans — Grade A Bourbon', slug: 'vanilla-beans-grade-a-' + nanoid(6),
      description: 'Premium Bourbon vanilla beans, 16-18cm, moisture 30-35%. Intense aroma. Available in whole pods or split.',
      images: [
        'https://images.unsplash.com/photo-1553779913-d1f3e4ef5ca8?w=600',
      ],
      price: 120.00, priceUnit: 'per kg', minimumOrder: 1, availableStock: 40, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Arusha, Tanzania',
      tags: ['vanilla', 'bourbon vanilla', 'spices', 'premium'],
      status: 'ACTIVE', viewCount: 3890, likeCount: 215, saveCount: 130, orderCount: 28, rating: 5.0,
    },
    {
      sellerId: farmer3._id, categoryId: categories.find(c => c.slug === 'sugar-confectionery')?._id,
      title: 'Ashanti Single-Origin Cocoa Beans', slug: 'ashanti-cocoa-beans-' + nanoid(6),
      description: 'Premium fermented and dried cocoa beans from Ashanti region. Fat content >53%. Grade 1 COCOBOD certified. Ideal for craft chocolate makers.',
      images: [
        'https://images.unsplash.com/photo-1511381939415-e44015466834?w=600',
      ],
      price: 3.20, priceUnit: 'per kg', minimumOrder: 100, availableStock: 5000, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['cocoa', 'chocolate', 'ghana', 'ashanti', 'craft chocolate'],
      certifications: ['COCOBOD Grade 1'],
      status: 'ACTIVE', viewCount: 1240, likeCount: 55, orderCount: 6, rating: 4.3,
    },
    {
      sellerId: farmer1._id, categoryId: fruitsVeg?._id,
      title: 'Baby Spinach — Organic', slug: 'baby-spinach-organic-' + nanoid(6),
      description: 'Tender baby spinach leaves, washed and ready-to-eat. 200g retail packs or bulk 5kg. Air-freight available.',
      images: [
        'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600',
      ],
      price: 3.50, priceUnit: 'per kg', minimumOrder: 100, availableStock: 1500, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: true, origin: 'Nakuru, Kenya',
      tags: ['spinach', 'baby spinach', 'leafy greens', 'organic', 'salad'],
      status: 'ACTIVE', viewCount: 760, likeCount: 38, orderCount: 4, rating: 4.6,
    },
    {
      sellerId: farmer2._id, categoryId: spices?._id,
      title: 'Zanzibar Cloves — Whole', slug: 'zanzibar-cloves-whole-' + nanoid(6),
      description: 'Sun-dried whole cloves from Zanzibar. Eugenol >15%. Moisture <12%. Strong aroma. Available in 1kg, 10kg, 50kg packs.',
      images: [
        'https://images.unsplash.com/photo-1509462945800-01d29c54defd?w=600',
      ],
      price: 14.00, priceUnit: 'per kg', minimumOrder: 5, availableStock: 400, stockUnit: 'kg',
      condition: 'DRIED', isOrganic: true, origin: 'Zanzibar, Tanzania',
      tags: ['cloves', 'zanzibar', 'spices', 'whole cloves'],
      status: 'ACTIVE', viewCount: 1560, likeCount: 72, orderCount: 11, rating: 4.7,
    },
    {
      sellerId: farmer3._id, categoryId: categories.find(c => c.slug === 'roots-tubers')?._id,
      title: 'Plantain — Green, Export Grade', slug: 'plantain-green-export-' + nanoid(6),
      description: 'Fresh green plantain, size M-L, 150-300g per finger. Bunched or loose. Good export life (3-4 weeks). Available all year.',
      images: [
        'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600',
      ],
      price: 0.45, priceUnit: 'per kg', minimumOrder: 1000, availableStock: 20000, stockUnit: 'kg',
      condition: 'FRESH', isOrganic: false, origin: 'Kumasi, Ghana',
      tags: ['plantain', 'ghana', 'banana', 'tropical'],
      status: 'ACTIVE', viewCount: 880, likeCount: 31, orderCount: 3, rating: 4.2,
    },
  ])
  console.log('📦 Created 10 products')

  // --- Requirements ---
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const [req1, req2, req3] = await Requirement.insertMany([
    {
      buyerId: buyer1._id,
      title: 'Need 500kg Organic Tomatoes Weekly — Nairobi Delivery',
      description: 'We are a supermarket chain in Nairobi looking for a reliable weekly supplier of organic tomatoes. Must be KEPHIS certified. Delivery to our Westlands warehouse every Monday.',
      productType: 'Organic Tomatoes',
      categoryId: fruitsVeg?._id,
      quantityAmount: 500, quantityUnit: 'kg',
      deliveryLocation: 'Nairobi, Kenya',
      deliveryFrequency: 'weekly',
      budgetMin: 350, budgetMax: 500, budgetCurrency: 'USD',
      preferredQuality: 'KEPHIS certified organic, size medium-large',
      deadline, status: 'OPEN', isUrgent: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      bidCount: 0, viewCount: 234,
    },
    {
      buyerId: buyer2._id,
      title: 'URGENT: 2 Tonnes Arabica Coffee — Dubai Import',
      description: 'We import specialty coffee for the Middle East market. Looking for AA-grade East African Arabica, SCA 85+. FCA Nairobi or FCA Dar es Salaam terms. Need documents: phytosanitary, COO, quality cert.',
      productType: 'Arabica Coffee',
      categoryId: coffee?._id,
      quantityAmount: 2000, quantityUnit: 'kg',
      deliveryLocation: 'Dubai, UAE',
      deliveryFrequency: 'one-time',
      budgetMin: 10000, budgetMax: 15000, budgetCurrency: 'USD',
      preferredQuality: 'AA grade, SCA score 85+, wet-processed',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'OPEN', isUrgent: true,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      bidCount: 0, viewCount: 891,
    },
    {
      buyerId: buyer1._id,
      title: 'Monthly Supply of Mixed Spices — 50kg per SKU',
      description: 'Hotel & restaurant supplier seeking monthly supply of cardamom, cloves, and vanilla beans. Consistent quality essential. Can consider long-term contract (6 months+).',
      productType: 'Spices',
      categoryId: spices?._id,
      quantityAmount: 150, quantityUnit: 'kg',
      deliveryLocation: 'Nairobi, Kenya',
      deliveryFrequency: 'monthly',
      budgetMin: 2000, budgetMax: 4000, budgetCurrency: 'USD',
      preferredQuality: 'Grade A, food-grade certification required',
      deadline, status: 'OPEN', isUrgent: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      bidCount: 0, viewCount: 145,
    },
  ])
  console.log('📋 Created 3 requirements')

  // --- Bids ---
  await Bid.insertMany([
    {
      requirementId: req1._id, farmerId: farmer1._id,
      pricePerUnit: 0.80, totalPrice: 400, currency: 'USD',
      deliveryTimeline: 'Every Monday by 6am, guaranteed',
      deliveryNotes: 'We have a refrigerated van. Will deliver to Westlands warehouse.',
      message: 'Hi! We have been supplying organic tomatoes to supermarkets for 8 years. KEPHIS certified. Can start immediately.',
      certifications: ['KEPHIS Organic', 'GlobalG.A.P'],
      sampleAvailable: true, status: 'PENDING', score: 0.82,
    },
    {
      requirementId: req1._id, farmerId: farmer3._id,
      pricePerUnit: 0.75, totalPrice: 375, currency: 'USD',
      deliveryTimeline: '3-4 days after order confirmation',
      message: 'We grow tomatoes in Kumasi and can supply weekly.',
      sampleAvailable: false, status: 'PENDING', score: 0.54,
    },
    {
      requirementId: req2._id, farmerId: farmer2._id,
      pricePerUnit: 6.20, totalPrice: 12400, currency: 'USD',
      deliveryTimeline: 'Ready to ship within 2 weeks. FCA Dar es Salaam.',
      deliveryNotes: 'All export documents available: phytosanitary, COO, quality certificate, fair trade cert.',
      message: 'We produce Kilimanjaro AA Arabica with SCA score of 87. Fair Trade and Rainforest Alliance certified. We have exported to Japan, Germany and the UK.',
      certifications: ['Fair Trade', 'Rainforest Alliance', 'Organic Tanzania'],
      sampleAvailable: true, status: 'SHORTLISTED', score: 0.91,
    },
    {
      requirementId: req3._id, farmerId: farmer2._id,
      pricePerUnit: 28.00, totalPrice: 2800, currency: 'USD',
      deliveryTimeline: '5-7 business days to Nairobi',
      message: 'We can supply all three spices — cardamom, cloves, and vanilla beans. All Grade A with food-grade certification. Open to a 6-month contract.',
      certifications: ['Organic Tanzania'],
      sampleAvailable: true, status: 'PENDING', score: 0.88,
    },
  ])

  // Update bid counts
  await Requirement.findByIdAndUpdate(req1._id, { bidCount: 2 })
  await Requirement.findByIdAndUpdate(req2._id, { bidCount: 1 })
  await Requirement.findByIdAndUpdate(req3._id, { bidCount: 1 })
  console.log('💰 Created 4 bids')

  // --- Reels ---
  await Reel.insertMany([
    {
      userId: farmer1._id,
      title: 'Morning harvest at Kamau Fresh Farms',
      caption: 'Starting the week right! Fresh tomatoes ready for Nairobi market 🍅 DM for wholesale pricing #organicfarming #kenya #agriculture',
      videoUrl: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
      duration: 28, tags: ['tomatoes', 'harvest', 'kenya', 'organic', 'farming'],
      viewCount: 12400, likeCount: 890, commentCount: 67, shareCount: 145,
      status: 'PUBLISHED', productId: products[0]._id,
    },
    {
      userId: farmer2._id,
      title: 'Coffee harvest season at Kilimanjaro',
      caption: 'Harvest season is here! Our Arabica beans are ready ☕ Watch how we hand-pick only the ripest cherries #specialtycoffee #kilimanjaro',
      videoUrl: 'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400',
      duration: 45, tags: ['coffee', 'arabica', 'harvest', 'tanzania', 'kilimanjaro'],
      viewCount: 28900, likeCount: 2340, commentCount: 183, shareCount: 456,
      status: 'PUBLISHED', productId: products[3]._id,
    },
    {
      userId: farmer3._id,
      title: 'Cocoa pod opening — Ashanti farms',
      caption: 'The smell of fresh cocoa is unbeatable 🍫 Single-origin from Ashanti region. Craft chocolate makers — DM us! #cocoa #ghana #chocolate',
      videoUrl: 'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400',
      duration: 32, tags: ['cocoa', 'ghana', 'chocolate', 'ashanti'],
      viewCount: 7200, likeCount: 445, commentCount: 38, shareCount: 89,
      status: 'PUBLISHED', productId: products[6]._id,
    },
  ])
  console.log('🎬 Created 3 reels')

  console.log('\n✅ Demo seed complete!')
  console.log('─────────────────────────────────────────')
  console.log('Login credentials (password: Demo1234!):')
  console.log('  Admin:   admin@emazao.demo')
  console.log('  Farmer1: james@emazao.demo   (Kamau Fresh Farms)')
  console.log('  Farmer2: amina@emazao.demo   (Kilimanjaro Spice Garden)')
  console.log('  Farmer3: david@emazao.demo   (Osei Cocoa Estate)')
  console.log('  Buyer1:  sarah@emazao.demo   (FreshMart Supermarkets)')
  console.log('  Buyer2:  ali@emazao.demo     (Dubai Importer)')
  console.log('─────────────────────────────────────────')

  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ Seed error:', err); process.exit(1) })
