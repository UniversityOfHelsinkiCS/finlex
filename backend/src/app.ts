import express from 'express';
import path from 'path';
import * as Sentry from '@sentry/node';
import jwt from 'jsonwebtoken';
import mediaRouter from './controllers/media.js';
import statuteRouter from './controllers/statute.js';
import judgmentRouter from './controllers/judgment.js';
import keywordRouter from './controllers/keyword.js';
import judgmentKeywordRouter from './controllers/judgmentKeyword.js';
import { fileURLToPath } from 'url';
import { runSetup } from './dbSetup.js';
import { getLatestStatusEntry, getAllStatusEntries, clearAllStatusEntries } from './db/models/status.js';
import { addStatusRow, createTables, dropTables, dropJudgmentsTables, createJudgmentsTables, deleteStatutesByYear } from './db/db.js';
import { VALID_LANGUAGES, yearFrom, yearTo } from './util/config.js';
import { buildFinlexUrl, buildJudgmentUrl, listStatutesByYear, setSingleJudgment, setSingleStatute } from './db/load.js';
import type { JudgmentKey } from './types/judgment.js';
import type { StatuteKey } from './types/statute.js';
import { getRecentLogs, pushLog } from './util/logBuffer.js';
import { deleteCollection, syncStatutes, syncJudgments, upsertJudgmentByUuid, upsertStatuteByUuid } from './search.js';
import { query } from './db/db.js';

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

app.post('/api/admin/add-statute', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { year, number, language } = req.body || {};
    const yearNum = parseInt(String(year), 10);
    const numberStr = String(number || '').trim();
    const languageStr = String(language || '').trim();

    if (!yearNum || !numberStr || !VALID_LANGUAGES.includes(languageStr)) {
      res.status(400).json({ error: 'Invalid statute parameters' });
      return;
    }

    const statuteKey: StatuteKey = {
      year: yearNum,
      number: numberStr,
      language: languageStr,
      version: null
    };

    const uris = await listStatutesByYear(yearNum, languageStr);
    const matchPrefix = `/${yearNum}/${numberStr}/${languageStr}@`;
    const matchPrefixFallback = `/${yearNum}/${numberStr}/${languageStr}`;
    const statuteUri = uris.find(uri => uri.includes(matchPrefix))
      ?? uris.find(uri => uri.includes(matchPrefixFallback));

    if (!statuteUri) {
      res.status(404).json({ error: 'Statute not found in Finlex list' });
      return;
    }

    await setSingleStatute({ uri: statuteUri, uriOld: statuteUri });

    const statuteResult = await query(
      'SELECT uuid FROM statutes WHERE number = $1 AND year = $2 AND language = $3 ORDER BY version DESC NULLS LAST LIMIT 1',
      [numberStr, yearNum, languageStr]
    );
    const statuteUuid = statuteResult.rows[0]?.uuid;
    if (statuteUuid) {
      await upsertStatuteByUuid(languageStr, statuteUuid);
    }

    res.status(200).json({ message: 'Statute added', statute: statuteKey, uri: statuteUri });
  } catch (error) {
    console.error('Add statute endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to add statute' });
  }
});

app.post('/api/admin/add-judgment', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { year, number, language, level } = req.body || {};
    const yearNum = parseInt(String(year), 10);
    const numberStr = String(number || '').trim();
    const languageStr = String(language || '').trim();
    const levelStr = String(level || '').trim();

    if (!yearNum || !numberStr || !VALID_LANGUAGES.includes(languageStr) || (levelStr !== 'kko' && levelStr !== 'kho')) {
      res.status(400).json({ error: 'Invalid judgment parameters' });
      return;
    }

    const judgmentKey: JudgmentKey = {
      year: yearNum,
      number: numberStr,
      language: languageStr,
      level: levelStr as 'kho' | 'kko'
    };

    await setSingleJudgment(buildJudgmentUrl(judgmentKey));

    const judgmentResult = await query(
      'SELECT uuid FROM judgments WHERE number = $1 AND year = $2 AND language = $3 AND level = $4 LIMIT 1',
      [numberStr, yearNum, languageStr, levelStr]
    );
    const judgmentUuid = judgmentResult.rows[0]?.uuid;
    if (judgmentUuid) {
      await upsertJudgmentByUuid(languageStr, judgmentUuid);
    }

    res.status(200).json({ message: 'Judgment added', judgment: judgmentKey });
  } catch (error) {
    console.error('Add judgment endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to add judgment' });
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

app.delete('/api/statute/delete-year/:year', verifyAdminToken, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const yearNum = parseInt(req.params.year as string, 10);
    if (!yearNum) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }

    const deletedCount = await deleteStatutesByYear(yearNum);
    res.status(200).json({ message: 'Statutes deleted', year: yearNum, deletedCount });
  } catch (error) {
    console.error('Delete statutes by year endpoint error:', error);
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to delete statutes by year' });
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

        const getYearBounds = async (tableName: 'statutes' | 'judgments') => {
          const { rows } = await query(`SELECT MIN(year) AS min_year, MAX(year) AS max_year FROM ${tableName}`);
          const minYear = rows[0]?.min_year ? parseInt(rows[0].min_year, 10) : null;
          const maxYear = rows[0]?.max_year ? parseInt(rows[0].max_year, 10) : null;
          if (minYear === null || maxYear === null) {
            return null;
          }
          return { startYear: minYear, endYear: maxYear };
        };

        // Delete and recreate collections for both languages
        await deleteCollection('statutes', 'fin');
        await deleteCollection('statutes', 'swe');
        await deleteCollection('judgments', 'fin');
        await deleteCollection('judgments', 'swe');
        console.log('Old Typesense collections deleted');

        // Rebuild indexes from database
        const statuteBounds = await getYearBounds('statutes');
        const judgmentBounds = await getYearBounds('judgments');

        await syncStatutes('fin', statuteBounds ?? undefined);
        await syncStatutes('swe', statuteBounds ?? undefined);
        await syncJudgments('fin', judgmentBounds ?? undefined);
        await syncJudgments('swe', judgmentBounds ?? undefined);
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
app.use('/api/judgment/keyword', judgmentKeywordRouter);
app.use('/api/statute', statuteRouter)
app.use('/api/judgment', judgmentRouter);


app.get("*params", async (request: express.Request, response: express.Response): Promise<void> => {
  response.sendFile(path.join(__dirname, 'frontend', 'index.html'))
})

export default app
