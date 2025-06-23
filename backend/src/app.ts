import express from 'express';
import path from 'path';
import mediaRouter from './controllers/media.js';
import statuteRouter from './controllers/statute.js';
import judgmentRouter from './controllers/judgment.js';
import keywordRouter from './controllers/keyword.js';
import { fileURLToPath } from 'url';

const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let databaseStatus = 'notready';
process.on('message', (message) => {
  if (message === 'db-ready') {
    databaseStatus = 'ready';
    console.log('Database status is set to ready');
  } else if (message === 'db-notready') {
    databaseStatus = 'notready';
    console.log('Database status is set to notready');
  } else {
    console.error('Unknown message received:', message);
  }
});


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

app.get('/favicon.ico', (request: express.Request, response: express.Response): void => {
  response.status(204).end();
})

app.use(express.static(path.join(__dirname, 'frontend')))
app.use('/media', mediaRouter)
app.use('/api/statute/keyword', keywordRouter);
app.use('/api/statute', statuteRouter)
app.use('/api/judgment', judgmentRouter);


// Kaikki muut ohjataan frontendille
app.get("*params", async (request: express.Request, response: express.Response): Promise<void> => {
  response.sendFile(path.join(__dirname, 'frontend', 'index.html'))
})

export default app
