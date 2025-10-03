import { setPool, dbIsReady, fillDb, createTables, dbIsUpToDate, setupTestDatabase, addStatusRow, clearStatusRows } from "./db/db.js";
import './util/config.js';
import { exit } from 'process';
import { syncStatutes, deleteCollection, syncJudgments } from "./search.js";
import { yearFrom, yearTo } from "./util/config.js";

setPool(process.env.PG_URI ?? '');

async function initDatabase() {
  try {
    if (!await dbIsReady()) {
      console.log('Database is not ready, creating tables...')
      await createTables()
    }

    await clearStatusRows()
    await addStatusRow({ message: 'updating', from: yearFrom(), to: yearTo() }, true)

    console.log('Database is ready.')
    const { upToDate, statutes, judgments } = await dbIsUpToDate()
    if (!upToDate) {
      console.log('Database is not up to date, filling database...')
      await fillDb(statutes, judgments)
      console.log('Database is now up to date.')
    } else {
      console.log('Database is up to date.')
    }

  } catch (error) {
    console.error('Error initializing database:', error)
    exit(1)
  }
}

export const runSetup = async () => {
  if (process.env.NODE_ENV === 'test') {
    await setupTestDatabase()
  } else {
    await initDatabase();
    await deleteCollection('statutes', 'fin');
    await deleteCollection('statutes', 'swe');
    await deleteCollection('judgments', 'fin');
    await deleteCollection('judgments', 'swe');
    await syncStatutes('fin');
    await syncStatutes('swe');
    await syncJudgments('fin');
    await syncJudgments('swe');

    await addStatusRow({ message: 'updated', from: yearFrom(), to: yearTo() }, false)
  }
  console.log('Database setup done.');
}
