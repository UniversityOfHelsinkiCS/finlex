import { setPool, dbIsReady, fillDb, createTables, dbIsUpToDate, setupTestDatabase, addStatusRow, clearStatusRows } from "./db/db.js";
import { stopFinlexLimiterLogging, startFinlexLimiterLogging } from "./db/load.js";
import * as Sentry from '@sentry/node';
import './util/config.js';
import { exit } from 'process';
import { syncStatutes, deleteCollection, syncJudgments } from "./search.js";
import { yearFrom, yearTo } from "./util/config.js";

setPool(process.env.PG_URI ?? '');

async function initDatabase(startYear?: number) {
  try {
    console.log('[DB] Checking if database is ready...');
    if (!await dbIsReady()) {
      console.log('[DB] Database is not ready, creating tables...');
      await createTables();
      console.log('[DB] Tables created successfully.');
    } else {
      console.log('[DB] Database is ready.');
    }

    await clearStatusRows();
    const from = startYear ?? yearFrom();
    const to = yearTo();
    await addStatusRow({ message: 'updating', from, to }, true);
    console.log('[DB] Checking if database is up to date...');
    const { upToDate, statutes, judgments } = await dbIsUpToDate(from);

    if (!upToDate) {
      console.log('[DB] Database is not up to date, filling database...');
      await fillDb(statutes, judgments);
      console.log('[DB] Database is now up to date.');
    } else {
      console.log('[DB] Database is up to date.');
    }

  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    Sentry.captureException(error);
    throw error;
  }
}

export const runSetup = async (startYear?: number) => {
  const setupStartTime = Date.now();
  
  startFinlexLimiterLogging();
  
  try {
    if (process.env.NODE_ENV === 'test') {
      console.log('[SETUP] Running in test mode...');
      await setupTestDatabase();
    } else {
      console.log('[SETUP] Running in production mode...');
      
      const step1Start = Date.now();
      console.log('[SETUP] Step 1: Initialize database...');
      await initDatabase(startYear);
      console.log(`[SETUP] Step 1 completed in ${Date.now() - step1Start}ms`);
      
      const step2Start = Date.now();
      console.log('[SETUP] Step 2: Clear and sync Typesense collections...');
      await deleteCollection('statutes', 'fin');
      await deleteCollection('statutes', 'swe');
      await deleteCollection('judgments', 'fin');
      await deleteCollection('judgments', 'swe');
      console.log(`[SETUP] Step 2 completed in ${Date.now() - step2Start}ms`);
      
      const step3Start = Date.now();
      console.log('[SETUP] Step 3: Sync statutes to Typesense...');
      await syncStatutes('fin');
      await syncStatutes('swe');
      console.log(`[SETUP] Step 3 completed in ${Date.now() - step3Start}ms`);
      
      const step4Start = Date.now();
      console.log('[SETUP] Step 4: Sync judgments to Typesense...');
      await syncJudgments('fin');
      await syncJudgments('swe');
      console.log(`[SETUP] Step 4 completed in ${Date.now() - step4Start}ms`);

      const step5Start = Date.now();
      console.log('[SETUP] Step 5: Write completion status...');
      const from = startYear ?? yearFrom();
      const to = yearTo();
      await addStatusRow({ message: 'updated', from, to, timestamp: new Date().toISOString() }, false);
      console.log(`[SETUP] Step 5 completed in ${Date.now() - step5Start}ms`);
    }
    const totalDuration = Date.now() - setupStartTime;
    const minutes = Math.floor(totalDuration / 60000);
    const seconds = Math.floor((totalDuration % 60000) / 1000);
    console.log(`[SETUP] Database setup completed in ${minutes}m ${seconds}s (${totalDuration}ms)`);
  } catch (error) {
    const errorDuration = Date.now() - setupStartTime;
    Sentry.captureException(error);
    console.error(`[SETUP] Setup failed after ${errorDuration}ms:`, error);
    throw error;
  } finally {
    stopFinlexLimiterLogging();
  }
}