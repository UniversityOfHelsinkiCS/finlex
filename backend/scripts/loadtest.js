#!/usr/bin/env node
/**
 * Load testing script for Finlex API
 * 
 * Usage:
 *   node backend/scripts/loadtest.js
 *   node backend/scripts/loadtest.js --url https://custom-url.fi --concurrent 50 --duration 60
 */

import axios from 'axios';

// Configuration
const CONFIG = {
  baseUrl: 'https://finlex.ext.ocp-prod-0.k8s.it.helsinki.fi',
  concurrentRequests: 20,
  durationSeconds: 30,
  requestTimeout: 5000,
};

// Sample search queries (mix of different types)
const SEARCH_QUERIES = [
  { q: 'luonnonsuojelulaki', language: 'fin', type: 'statute' },
  { q: 'tupakka', language: 'fin', type: 'statute' },
  { q: 'työaika', language: 'fin', type: 'statute' },
  { q: 'perintökaari', language: 'fin', type: 'statute' },
  { q: 'rikoslaki', language: 'fin', type: 'statute' },
  { q: '1996/734', language: 'fin', type: 'statute' },
  { q: '2023/527', language: 'fin', type: 'statute' },
  { q: 'vakuutus', language: 'swe', type: 'statute' },
  { q: 'arbete', language: 'swe', type: 'statute' },
  { q: 'vahingonkorvaus', language: 'fin', type: 'judgment' },
  { q: 'työsopimus', language: 'fin', type: 'judgment' },
  { q: 'kiinteistö', language: 'fin', type: 'judgment' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url') config.baseUrl = args[++i];
    else if (arg === '--concurrent') config.concurrentRequests = parseInt(args[++i]);
    else if (arg === '--duration') config.durationSeconds = parseInt(args[++i]);
    else if (arg === '--timeout') config.requestTimeout = parseInt(args[++i]);
    else if (arg === '--help') {
      console.log(`
Load Testing Script for Finlex API

Usage:
  node backend/scripts/loadtest.js [options]

Options:
  --url <url>          Base URL (default: ${CONFIG.baseUrl})
  --concurrent <n>     Concurrent requests (default: ${CONFIG.concurrentRequests})
  --duration <sec>     Test duration in seconds (default: ${CONFIG.durationSeconds})
  --timeout <ms>       Request timeout in ms (default: ${CONFIG.requestTimeout})
  --help              Show this help message

Examples:
  node backend/scripts/loadtest.js
  node backend/scripts/loadtest.js --concurrent 50 --duration 60
  node backend/scripts/loadtest.js --url https://finlex.ext.ocp-prod-0.k8s.it.helsinki.fi
      `);
      process.exit(0);
    }
  }
  
  return config;
}

function buildUrl(base, query) {
  const { q, language, type, level } = query;
  const params = new URLSearchParams({ q, language });
  if (level) params.append('level', level);
  return `${base}/api/${type}/search?${params.toString()}`;
}

function getRandomQuery() {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
}

class LoadTester {
  constructor(config) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      responseTimes: [],
      errors: {},
      statusCodes: {},
    };
    this.startTime = null;
    this.endTime = null;
    this.isRunning = false;
  }

  async makeRequest() {
    const query = getRandomQuery();
    const url = buildUrl(this.config.baseUrl, query);
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: this.config.requestTimeout,
        validateStatus: () => true, // Accept all status codes
      });

      const responseTime = Date.now() - startTime;
      this.stats.totalRequests++;
      this.stats.totalResponseTime += responseTime;
      this.stats.responseTimes.push(responseTime);

      const statusCode = response.status;
      this.stats.statusCodes[statusCode] = (this.stats.statusCodes[statusCode] || 0) + 1;

      if (statusCode >= 200 && statusCode < 500) {
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
      }

      return { success: true, responseTime, statusCode };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.totalRequests++;
      this.stats.failedRequests++;
      this.stats.responseTimes.push(responseTime);

      const errorType = error.code || error.message || 'unknown';
      this.stats.errors[errorType] = (this.stats.errors[errorType] || 0) + 1;

      return { success: false, responseTime, error: errorType };
    }
  }

  async worker() {
    while (this.isRunning) {
      await this.makeRequest();
    }
  }

  printProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const avgResponseTime = this.stats.totalResponseTime / this.stats.totalRequests || 0;
    const requestsPerSecond = this.stats.totalRequests / elapsed;

    process.stdout.write(`\r` +
      `Time: ${elapsed.toFixed(1)}s | ` +
      `Requests: ${this.stats.totalRequests} | ` +
      `Success: ${this.stats.successfulRequests} | ` +
      `Failed: ${this.stats.failedRequests} | ` +
      `Avg: ${avgResponseTime.toFixed(0)}ms | ` +
      `RPS: ${requestsPerSecond.toFixed(1)}`
    );
  }

  printResults() {
    console.log('\n\n' + '='.repeat(60));
    console.log('LOAD TEST RESULTS');
    console.log('='.repeat(60));

    const duration = (this.endTime - this.startTime) / 1000;
    const avgResponseTime = this.stats.totalResponseTime / this.stats.totalRequests || 0;
    const requestsPerSecond = this.stats.totalRequests / duration;
    const successRate = (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2);

    // Sort response times for percentile calculations
    const sorted = this.stats.responseTimes.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const min = sorted[0] || 0;
    const max = sorted[sorted.length - 1] || 0;

    console.log(`\nGeneral:`);
    console.log(`  Duration:              ${duration.toFixed(2)}s`);
    console.log(`  Total Requests:        ${this.stats.totalRequests}`);
    console.log(`  Successful:            ${this.stats.successfulRequests}`);
    console.log(`  Failed:                ${this.stats.failedRequests}`);
    console.log(`  Success Rate:          ${successRate}%`);
    console.log(`  Requests per Second:   ${requestsPerSecond.toFixed(2)}`);

    console.log(`\nResponse Times (ms):`);
    console.log(`  Average:               ${avgResponseTime.toFixed(2)}`);
    console.log(`  Min:                   ${min}`);
    console.log(`  Max:                   ${max}`);
    console.log(`  p50 (median):          ${p50}`);
    console.log(`  p95:                   ${p95}`);
    console.log(`  p99:                   ${p99}`);

    if (Object.keys(this.stats.statusCodes).length > 0) {
      console.log(`\nStatus Codes:`);
      for (const [code, count] of Object.entries(this.stats.statusCodes).sort()) {
        console.log(`  ${code}:${' '.repeat(20 - code.length)}${count}`);
      }
    }

    if (Object.keys(this.stats.errors).length > 0) {
      console.log(`\nErrors:`);
      for (const [error, count] of Object.entries(this.stats.errors)) {
        console.log(`  ${error}:${' '.repeat(20 - error.length)}${count}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  async run() {
    console.log('Starting load test...');
    console.log(`URL: ${this.config.baseUrl}`);
    console.log(`Concurrent requests: ${this.config.concurrentRequests}`);
    console.log(`Duration: ${this.config.durationSeconds}s`);
    console.log(`Request timeout: ${this.config.requestTimeout}ms`);
    console.log(`\nRunning...\n`);

    this.isRunning = true;
    this.startTime = Date.now();

    // Start workers
    const workers = Array(this.config.concurrentRequests)
      .fill()
      .map(() => this.worker());

    // Progress updates
    const progressInterval = setInterval(() => this.printProgress(), 1000);

    // Stop after duration
    setTimeout(() => {
      this.isRunning = false;
      clearInterval(progressInterval);
    }, this.config.durationSeconds * 1000);

    // Wait for all workers to finish
    await Promise.all(workers);
    this.endTime = Date.now();

    this.printResults();
  }
}

// Main execution
(async () => {
  const config = parseArgs();
  const tester = new LoadTester(config);
  
  try {
    await tester.run();
  } catch (error) {
    console.error('\nLoad test failed:', error.message);
    process.exit(1);
  }
})();
