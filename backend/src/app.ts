import express from 'express';
import path from 'path';
import mediaRouter from './controllers/media.js';
import statuteRouter from './controllers/statute.js';
import judgmentRouter from './controllers/judgment.js';
import keywordRouter from './controllers/keyword.js';
import { fileURLToPath } from 'url';
import { runSetup } from './dbSetup.js';

const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const databaseStatus = 'ready';

app.use(express.json());
app.get('/api/check-db-status', (req: express.Request, res: express.Response): void => {
  if (databaseStatus === 'ready') {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({
      error: 'Service Unavailable: Database is not ready',
      status: databaseStatus
    });
  }
});

app.get('/api/setup', (req: express.Request, res: express.Response): void => {
  runSetup()
  res.status(200).json({ status: 'started' });
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
