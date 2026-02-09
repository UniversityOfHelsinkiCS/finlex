import express from 'express';
import * as Sentry from '@sentry/node';
import '../util/config.js';
import { getJudgmentKeywords, getJudgmentsByKeywordID } from '../db/models/keyword.js';

const judgmentKeywordRouter = express.Router();

judgmentKeywordRouter.get('/:language/:keyword_id', async (request: express.Request, response: express.Response): Promise<void> => {
  const keyword_id = request.params.keyword_id as string;
  const language = request.params.language as string;
  let judgments;
  try {
    judgments = await getJudgmentsByKeywordID(language, keyword_id);
  } catch (error) {
    console.error('Error finding judgments', error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (judgments === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  response.json(judgments);
});

judgmentKeywordRouter.get('/:language', async (request: express.Request, response: express.Response): Promise<void> => {
  const language = request.params.language as string;
  let words;
  try {
    words = await getJudgmentKeywords(language);
  } catch (error) {
    console.error('Error finding judgment keywords', error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (words === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  response.json(words);
});

export default judgmentKeywordRouter;
