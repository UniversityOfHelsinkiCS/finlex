import app from './app.js'
import { setPool, createTables, addStatusRow } from './db/db.js'
import './util/config.js'

setPool(process.env.PG_URI ?? '')

const PORT = 3001

async function startServer() {
  try {
    await createTables()
    console.log('[STARTUP] Tables created/verified')

    await addStatusRow(
      {
        message: 'server_started',
        timestamp: new Date().toISOString()
      },
      false
    )
    console.log('[STARTUP] Initial status row inserted')
  } catch (error) {
    console.error('[STARTUP] Error initializing database:', error)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer()
