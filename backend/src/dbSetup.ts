import { setPool, dbIsReady, fillDb, createTables, dbIsUpToDate, setupTestDatabase, addStatusRow, clearStatusRows } from "./db/db.js";
import './util/config.js';
import { exit } from 'process';
import { syncStatutes, deleteCollection, syncJudgments } from "./search.js";
import { yearFrom, yearTo } from "./util/config.js";

setPool(process.env.PG_URI ?? '');

async function initDatabase() {
  console.log('[DB] Creating tables if they do not exist...');
  await createTables();
  console.log('[DB] Tables created successfully.');
  try {
    console.log('[DB] Checking if database is ready...');
    if (!await dbIsReady()) {
      console.log('[DB] Database is not ready, creating tables...');
      
      console.log('[DB] Tables created successfully.');
    } else {
      console.log('[DB] Database is ready.');
    }

    await clearStatusRows();
    await addStatusRow({ message: 'updating', from: yearFrom(), to: yearTo() }, true);
    console.log('[DB] Status row inserted with updating=true');

    console.log('[DB] Checking if database is up to date...');
    const { upToDate, statutes, judgments } = await dbIsUpToDate();

    console.log('[DB] Up to date:', upToDate, 'missing statutes:', statutes.length, 'missing judgements:', judgments.length);

    if (!upToDate) {
      console.log('[DB] Database is not up to date, filling database...');
      await fillDb(statutes, judgments);
      console.log('[DB] Database is now up to date.');
    } else {
      console.log('[DB] Database is up to date.');
    }

  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error; // Re-throw so runSetup() catches it and writes error status
  }
}

export const runSetup = async () => {
  await createTables();
  try {
    if (process.env.NODE_ENV === 'test') {
      console.log('[SETUP] Running in test mode...');
      await setupTestDatabase();
    } else {
      console.log('[SETUP] Running in production mode...');
      
      console.log('[SETUP] Step 1: Initialize database...');
      await initDatabase();
      
      console.log('[SETUP] Step 2: Clear and sync Typesense collections...');
      await deleteCollection('statutes', 'fin');
      await deleteCollection('statutes', 'swe');
      await deleteCollection('judgments', 'fin');
      await deleteCollection('judgments', 'swe');
      
      console.log('[SETUP] Step 3: Sync statutes to Typesense...');
      await syncStatutes('fin');
      await syncStatutes('swe');
      
      console.log('[SETUP] Step 4: Sync judgments to Typesense...');
      await syncJudgments('fin');
      await syncJudgments('swe');

      console.log('[SETUP] Step 5: Write completion status...');
      await addStatusRow({ message: 'updated', from: yearFrom(), to: yearTo(), timestamp: new Date().toISOString() }, false);
    }
    console.log('[SETUP] Database setup done.');
  } catch (error) {
    console.error('[SETUP] Setup failed:', error);
    throw error; // Re-throw so app.ts error handler can write error status
  }
}
