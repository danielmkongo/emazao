const { MongoMemoryServer } = require('mongodb-memory-server')

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27117, dbName: 'emazao' } })
  console.log('MONGO_READY_URI=' + mongod.getUri())
  // Keep the process alive so the mongod child process stays up.
  process.stdin.resume()
}

main().catch(err => {
  console.error('Failed to start local Mongo:', err)
  process.exit(1)
})
