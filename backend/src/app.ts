import express from 'express';
import path from 'path';
import mediaRouter from './controllers/media.js';
import statuteRouter from './controllers/statute.js';
import judgmentRouter from './controllers/judgment.js';
import keywordRouter from './controllers/keyword.js';
import { fileURLToPath } from 'url';
import { runSetup } from './dbSetup.js';
import { getLatestStatusEntry, getAllStatusEntries, clearAllStatusEntries } from './db/models/status.js';

const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(express.json());
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

app.get('/api/ping', (req, res) => {
  res.send({ data: 'pong' })
})

app.get('/api/setup', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    res.status(200).json({ status: 'started', message: 'Database update started in background' });

    setImmediate(async () => {
      try {
        await runSetup();
        console.log('Setup completed successfully');
      } catch (error) {
        console.error('Setup failed:', error);
      }
    });
  } catch (error) {
    console.error('Setup endpoint error:', error);
    res.status(500).json({ error: 'Failed to start setup' });
  }
});

app.get('/api/status', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const entries = await getAllStatusEntries(Math.min(limit, 100)); // Cap at 100
    res.status(200).json(entries);
  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({ error: 'Failed to get status entries' });
  }
});

app.get('/api/status/latest', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const entry = await getLatestStatusEntry();
    if (entry) {
      res.status(200).json(entry);
    } else {
      res.status(404).json({ message: 'No status entries found' });
    }
  } catch (error) {
    console.error('Latest status endpoint error:', error);
    res.status(500).json({ error: 'Failed to get latest status entry' });
  }
});

app.delete('/api/status', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const deletedCount = await clearAllStatusEntries();
    res.status(200).json({
      message: 'Status entries cleared',
      deletedCount
    });
  } catch (error) {
    console.error('Clear status endpoint error:', error);
    res.status(500).json({ error: 'Failed to clear status entries' });
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
