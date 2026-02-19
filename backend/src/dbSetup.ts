import { setPool, dbIsReady, fillDb, createTables, dbIsUpToDate, setupTestDatabase, addStatusRow, clearStatusRows } from "./db/db.js";
import { stopFinlexLimiterLogging } from "./db/load.js";
import * as Sentry from '@sentry/node';
import './util/config.js';
import { exit } from 'process';
import { syncStatutes, deleteCollection, syncJudgments, SyncResult } from "./search.js";
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

function printSyncSummary(results: SyncResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('TYPESENSE INDEXING SUMMARY');
  console.log('='.repeat(80));
  
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailures = 0;
  let hasAnyFailures = false;

  // Group by type
  const statuteResults = results.filter(r => r.type === 'statutes');
  const judgmentResults = results.filter(r => r.type === 'judgments');

  // Print Statutes Summary
  console.log('\n📚 STATUTES:');
  console.log('-'.repeat(80));
  statuteResults.forEach(result => {
    const status = result.failureCount === 0 ? '✓' : '⚠️';
    const statusText = result.failureCount === 0 ? 'SUCCESS' : 'PARTIAL';
    console.log(`  ${status} ${result.language.toUpperCase()}: ${statusText}`);
    console.log(`     Total: ${result.totalProcessed} | Success: ${result.successCount} | Failed: ${result.failureCount}`);
    
    totalProcessed += result.totalProcessed;
    totalSuccess += result.successCount;
    totalFailures += result.failureCount;
    
    if (result.failureCount > 0) {
      hasAnyFailures = true;
    }
  });

  // Print Judgments Summary
  console.log('\n⚖️  JUDGMENTS:');
  console.log('-'.repeat(80));
  judgmentResults.forEach(result => {
    const status = result.failureCount === 0 ? '✓' : '⚠️';
    const statusText = result.failureCount === 0 ? 'SUCCESS' : 'PARTIAL';
    console.log(`  ${status} ${result.language.toUpperCase()}: ${statusText}`);
    console.log(`     Total: ${result.totalProcessed} | Success: ${result.successCount} | Failed: ${result.failureCount}`);
    
    totalProcessed += result.totalProcessed;
    totalSuccess += result.successCount;
    totalFailures += result.failureCount;
    
    if (result.failureCount > 0) {
      hasAnyFailures = true;
    }
  });

  // Print Overall Summary
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL TOTALS:');
  console.log(`  Total Documents Processed: ${totalProcessed}`);
  console.log(`  Successfully Indexed: ${totalSuccess}`);
  console.log(`  Failed to Index: ${totalFailures}`);
  
  const successRate = totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(2) : '0.00';
  console.log(`  Success Rate: ${successRate}%`);
  
  console.log('='.repeat(80));

  if (hasAnyFailures) {
    console.log('\n⚠️  WARNING: Some documents failed to index. Review the detailed logs above.');
    console.log('Failed documents have been logged with full details for investigation.\n');
  } else {
    console.log('\n✓ ALL DOCUMENTS SUCCESSFULLY INDEXED!\n');
  }
}

export const runSetup = async (startYear?: number) => {
  const setupStartTime = Date.now();
  const syncResults: SyncResult[] = [];

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
      const statuteFinResult = await syncStatutes('fin');
      syncResults.push(statuteFinResult);
      const statuteSweResult = await syncStatutes('swe');
      syncResults.push(statuteSweResult);
      console.log(`[SETUP] Step 3 completed in ${Date.now() - step3Start}ms`);
      
      const step4Start = Date.now();
      console.log('[SETUP] Step 4: Sync judgments to Typesense...');
      const judgmentFinResult = await syncJudgments('fin');
      syncResults.push(judgmentFinResult);
      const judgmentSweResult = await syncJudgments('swe');
      syncResults.push(judgmentSweResult);
      console.log(`[SETUP] Step 4 completed in ${Date.now() - step4Start}ms`);

      const step5Start = Date.now();
      console.log('[SETUP] Step 5: Write completion status...');
      const from = startYear ?? yearFrom();
      const to = yearTo();
      await addStatusRow({ message: 'updated', from, to }, false);
      console.log(`[SETUP] Step 5 completed in ${Date.now() - step5Start}ms`);

      // Print comprehensive summary
      printSyncSummary(syncResults);
    }

    const totalTime = Date.now() - setupStartTime;
    console.log(`[SETUP] Total setup time: ${totalTime}ms (${(totalTime / 1000 / 60).toFixed(2)} minutes)`);
    
    if (process.env.NODE_ENV !== 'test') {
      stopFinlexLimiterLogging();
      exit(0);
    }
  } catch (error) {
    console.error('[SETUP] Setup failed:', error);
    Sentry.captureException(error);
    exit(1);
  }
};