const mongoose = require('mongoose')
;(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27117/emazao')
  const db = mongoose.connection.db
  const reels = await db.collection('reels').find({}, { projection: { commentCount: 1, caption: 1 } }).toArray()
  for (const r of reels) {
    const all = await db.collection('comments').countDocuments({ reelId: r._id })
    const top = await db.collection('comments').countDocuments({ reelId: r._id, parentId: null })
    if (all || r.commentCount) console.log(String(r._id).slice(-6), 'stored', r.commentCount, '| actual all', all, 'top', top)
  }
  process.exit(0)
})()
