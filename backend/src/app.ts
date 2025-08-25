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


const databaseStatus = 'ready';
// process.on('message', (message) => {
//   if (message === 'db-ready') {
//     databaseStatus = 'ready';
//     console.log('Database status is set to ready');
//   } else if (message === 'db-notready') {
//     databaseStatus = 'ready';
//     // databaseStatus = 'notready';
//     console.log("Database status seems to not be ready but lets ignore that")
//     // console.log('Database status is set to notready');
//   } else {
//     console.error('Unknown message received:', message);
//   }
// });


app.use(express.json());
app.get('/api/check-db-status', (req: express.Request, res: express.Response): void => {
  res.json({status: 'ready 0.1'})
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
