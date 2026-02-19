import { SyncResult } from "../search.js";

export function printSyncSummary(results: SyncResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('TYPESENSE INDEXING SUMMARY');
  console.log('='.repeat(80));
  
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailures = 0;
  let hasAnyFailures = false;

  const statuteResults = results.filter(r => r.type === 'statutes');
  const judgmentResults = results.filter(r => r.type === 'judgments');

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

  console.log('\n' + '='.repeat(80));
  console.log('OVERALL TOTALS:');
  console.log(`  Total Documents Processed: ${totalProcessed}`);
  console.log(`  Successfully Indexed: ${totalSuccess}`);
  console.log(`  Failed to Index: ${totalFailures}`);
  
  const successRate = totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(2) : '0.00';
  console.log(`  Success Rate: ${successRate}%`);
  
  console.log('='.repeat(80));

  if (hasAnyFailures) {
    console.log('WARNING: Some documents failed to index. Review the detailed logs above.');
    console.log('Failed documents have been logged with full details for investigation.\n');
  } else {
    console.log('\n✓ ALL DOCUMENTS SUCCESSFULLY INDEXED!\n');
  }
}