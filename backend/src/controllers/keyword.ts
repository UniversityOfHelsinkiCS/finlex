import express from 'express';
import '../util/config.js';
import { getKeywords, getStatutesByKeywordID } from '../db/models/keyword.js';
const keywordRouter = express.Router();

keywordRouter.get('/:language/:keyword_id', async (request: express.Request, response: express.Response): Promise<void> => {
  const keyword_id = request.params.keyword_id
  const language = request.params.language
  let statutes;
  try {
    statutes = await getStatutesByKeywordID(language, keyword_id)
  } catch (error) {
    console.error("Error finding statutes", error)
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
  const language = request.params.language
  let words;
  try {
    words = await getKeywords(language)
  } catch (error) {
    console.error("Error finding keywords", error)
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
