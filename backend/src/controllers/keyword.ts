import express from 'express';
import * as Sentry from '@sentry/node';
import '../util/config.js';
import { getStatuteKeywords, getStatutesByKeywordID } from '../db/models/keyword.js';
const keywordRouter = express.Router();

keywordRouter.get('/:language/:keyword_id', async (request: express.Request, response: express.Response): Promise<void> => {
  const keyword_id = request.params.keyword_id as string
  const language = request.params.language as string
  let statutes;
  try {
    statutes = await getStatutesByKeywordID(language, keyword_id)
  } catch (error) {
    console.error("Error finding statutes", error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (statutes === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  } else {
    response.json(statutes)
  }
})

keywordRouter.get('/:language', async (request: express.Request, response: express.Response): Promise<void> => {
  const language = request.params.language as string
  let words;
  try {
    words = await getStatuteKeywords(language)
  } catch (error) {
    console.error("Error finding keywords", error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (words === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  } else {
    response.json(words)
  }
})

export default keywordRouter;
