import express from 'express';
import path from 'path';
import * as Sentry from '@sentry/node';
import jwt from 'jsonwebtoken';
import mediaRouter from './controllers/media.js';
import statuteRouter from './controllers/statute.js';
import judgmentRouter from './controllers/judgment.js';
import keywordRouter from './controllers/keyword.js';
import { fileURLToPath } from 'url';
import { runSetup } from './dbSetup.js';
import { getLatestStatusEntry, getAllStatusEntries, clearAllStatusEntries } from './db/models/status.js';
import { addStatusRow, createTables, dropTables, dropJudgmentsTables, createJudgmentsTables } from './db/db.js';
import { yearFrom, yearTo } from './util/config.js';
import { getRecentLogs, pushLog } from './util/logBuffer.js';
import { deleteCollection, syncStatutes, syncJudgments } from './search.js';

const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: unknown[]) => {
  pushLog('log', args);
  originalLog(...args);
};
console.info = (...args: unknown[]) => {
  pushLog('info', args);
  originalInfo(...args);
};
console.warn = (...args: unknown[]) => {
  pushLog('warn', args);
  originalWarn(...args);
};
console.error = (...args: unknown[]) => {
  pushLog('error', args);
  originalError(...args);
};


app.use(express.json());

// Admin authentication
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const verifyAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/api/admin/login', (req: express.Request, res: express.Response): void => {
  const { password } = req.body;
  
  if (!password) {
    res.status(400).json({ error: 'Password required' });
    return;
  }

  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

app.get('/api/admin/verify', verifyAdminToken, (req: express.Request, res: express.Response): void => {
  res.json({ authenticated: true });
});

app.get('/api/check-db-status', async (req: express.Request, res: express.Response): Promise<void> => {
  const latestStatus = await getLatestStatusEntry();
  if (!latestStatus || !latestStatus.updating) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({
      error: 'Service Unavailable: Database is not ready',
      status: 'updating'
    });
  }
});

app.get('/api/ping', async (req, res) => {
  res.send({ data: 'pong' })
})

app.get('/api/config', (req, res) => {
  try {
    res.status(200).json({ startYear: yearFrom(), endYear: yearTo() });
  } catch (error) {
    console.error('Config endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to get config' });
  }
})

app.post('/api/setup', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    res.status(200).json({ status: 'started', message: 'Database update started in background' });
    setImmediate(async () => {
      try {
        console.info('Database setup started');
        const body: any = req.body || {}
        const startYear = body.startYear !== undefined ? parseInt(body.startYear as any, 10) : undefined
        await runSetup(startYear);
        console.info('Database setup completed');
      } catch (error) {
        console.error('[SETUP] Setup failed with error:', error);
        Sentry.captureException(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        try {
          await addStatusRow(
            { 
              message: 'setup_failed', 
              error: errorMessage,
              timestamp: new Date().toISOString()
            }, 
            false
          );
          console.log('[SETUP] Wrote error status to database');
        } catch (dbError) {
          console.error('[SETUP] Failed to write error status to database:', dbError);
          Sentry.captureException(dbError);
        }
      }
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[SETUP] Setup endpoint error:', error);
    res.status(500).json({ error: 'Failed to start setup' });
  }
});

app.get('/api/status', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const entries = await getAllStatusEntries(Math.min(limit, 100)); // Cap at 100
    res.status(200).json(entries);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Status endpoint error:', error);
    res.status(500).json({ error: 'Failed to get status entries' });
  }
});

app.get('/api/status/latest', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const entry = await getLatestStatusEntry();
    if (entry) {
      res.status(200).json(entry);
    } else {
      res.status(404).json({ message: 'No status entries found' });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Latest status endpoint error:', error);
    res.status(500).json({ error: 'Failed to get latest status entry' });
  }
});

// Return recent application logs (from in-memory buffer)
app.get('/api/logs', (req: express.Request, res: express.Response): void => {
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const logs = getRecentLogs(limitParam);
  res.status(200).json(logs);
});

app.delete('/api/status', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const deletedCount = await clearAllStatusEntries();
    res.status(200).json({
      message: 'Status entries cleared',
      deletedCount
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Clear status endpoint error:', error);
    res.status(500).json({ error: 'Failed to clear status entries' });
  }
});


app.delete('/api/delete-database', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const started = Date.now();
    await addStatusRow({ action: 'db_clear_start', startedAt: new Date().toISOString() }, true);

    await dropTables();
    console.log('All tables dropped');
    await createTables();
    console.log('Schema recreated');
    const deletedCount = await clearAllStatusEntries();

    const ms = Date.now() - started;
    await addStatusRow({ action: 'db_clear_complete', durationMs: ms, completedAt: new Date().toISOString() }, false);
    res.status(200).json({ message: 'Database cleared and schema recreated', deletedStatusEntries: deletedCount, durationMs: ms });
  } catch (error) {
    console.error('Clear database endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
});

// Drop and recreate only judgments-related tables
app.delete('/api/judgment/drop-table', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const started = Date.now();
    await addStatusRow({ action: 'judgments_clear_start', startedAt: new Date().toISOString() }, true);

    await dropJudgmentsTables();
    console.log('Judgments tables dropped');
    await createJudgmentsTables();
    console.log('Judgments schema recreated');

    const ms = Date.now() - started;
    await addStatusRow({ action: 'judgments_clear_complete', durationMs: ms, completedAt: new Date().toISOString() }, false);
    res.status(200).json({ message: 'Judgments tables cleared and schema recreated', durationMs: ms });
  } catch (error) {
    console.error('Clear judgments tables endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to clear judgments tables' });
  }
});

app.post('/api/rebuild-typesense', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    res.status(200).json({ status: 'started', message: 'Typesense rebuild started in background' });
    setImmediate(async () => {
      try {
        console.info('Typesense rebuild started');
        await addStatusRow({ action: 'typesense_rebuild_start', startedAt: new Date().toISOString() }, true);

        // Delete and recreate collections for both languages
        await deleteCollection('statutes', 'fin');
        await deleteCollection('statutes', 'swe');
        await deleteCollection('judgments', 'fin');
        await deleteCollection('judgments', 'swe');
        console.log('Old Typesense collections deleted');

        // Rebuild indexes from database
        await syncStatutes('fin');
        await syncStatutes('swe');
        await syncJudgments('fin');
        await syncJudgments('swe');
        console.log('Typesense collections rebuilt');

        await addStatusRow({ action: 'typesense_rebuild_complete', completedAt: new Date().toISOString() }, false);
        console.info('Typesense rebuild completed');
      } catch (error) {
        console.error('[REBUILD] Typesense rebuild failed with error:', error);
        Sentry.captureException(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        try {
          await addStatusRow(
            { 
              message: 'typesense_rebuild_failed', 
              error: errorMessage,
              timestamp: new Date().toISOString()
            }, 
            false
          );
          console.log('[REBUILD] Wrote error status to database');
        } catch (dbError) {
          console.error('[REBUILD] Failed to write error status to database:', dbError);
          Sentry.captureException(dbError);
        }
      }
    });
  } catch (error) {
    console.error('[REBUILD] Rebuild endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to start typesense rebuild' });
  }
});

app.get('/favicon.ico', (request: express.Request, response: express.Response): void => {
  response.status(204).end();
})

app.use(express.static(path.join(__dirname, 'frontend')))
app.use('/media', mediaRouter)
app.use('/api/statute/keyword', keywordRouter);
app.use('/api/statute', statuteRouter)
app.use('/api/judgment', judgmentRouter);


app.get("*params", async (request: express.Request, response: express.Response): Promise<void> => {
  response.sendFile(path.join(__dirname, 'frontend', 'index.html'))
})

export default app
