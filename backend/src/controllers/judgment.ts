import express from 'express';
import * as Sentry from '@sentry/node';
import * as config from '../util/config.js';
import { getJudgmentByNumberYear, getJudgmentsByYear, searchJudgmentsByKeywordAndLanguage } from '../db/models/judgment.js';
import { parseHtmlHeadings } from '../util/parse.js';
const judgmentRouter = express.Router();

judgmentRouter.get('/structure/id/:year/:number/:language/:level', async (request: express.Request, response: express.Response): Promise<void> => {

  const year = parseInt(request.params.year as string)
  const language = request.params.language as string
  const number = request.params.number as string
  const level = request.params.level as string
  let content;
  try {
    content = await getJudgmentByNumberYear(number, year, language, level)
  } catch {
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (content === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  }

  if (content === null) return;
  try {
    const structure = parseHtmlHeadings(content)
    response.json(structure)
  } catch (error) {
    console.error("Error parsing HTML content", error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
})

judgmentRouter.get('/id/:year/:number/:language/:level', async (request: express.Request, response: express.Response): Promise<void> => {
  const year = parseInt(request.params.year as string)
  const language = request.params.language as string
  const number = request.params.number as string
  const level = request.params.level as string
  const content = await getJudgmentByNumberYear(number, year, language, level)
  if (content === null) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  response.setHeader('Content-Type', 'text/html')
  response.send(content)
})

judgmentRouter.get('/search', async (request: express.Request, response: express.Response): Promise<void> => {
  const query = request.query.q as string
  const language = request.query.language as string
  let level = request.query.level as string

  if (!config.VALID_LANGUAGES.includes(language)) {
    response.status(400).json({ error: 'Invalid language parameter' });
    return;
  }

  if (!query) {
    response.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  if (!level) level = 'any'
  if (!config.VALID_LEVELS.includes(level)) {
    response.status(400).send('Invalid level parameter');
    return;
  }

  if (query.match(/^(KKO|KHO):(19|20)\d\d:\d+$/i)) {
    const [docLevel, docYear, docNumber] = query.split(':');
    let result;
    try {
      result = await getJudgmentByNumberYear(docNumber, parseInt(docYear), language, docLevel.toLowerCase());
    } catch (error) {
      console.error("Error fetching judgment by number and year", error);
      Sentry.captureException(error);
      response.status(500).json({ error: 'Internal server error' });
      return;
    }
    if (result) {
      response.json({type: 'redirect', content: {
        number: docNumber,
        year: parseInt(docYear),
        level: docLevel.toUpperCase(),
        language: language,
      }})
      return;
    } else {
      response.status(404).json({ error: 'Not found' });
      return;
    }
  }

  if (query.match(/^\d{4}$/)) {
    const year = parseInt(query);
    let results;
    try {
      results = await getJudgmentsByYear(year, language, level);
    } catch (error) {
      console.error("Error fetching judgments by year", error);
      Sentry.captureException(error);
      response.status(500).json({ error: 'Internal server error' });
      return;
    }
    if (results.length > 0) {
      response.json({type: 'resultList', content: results });
      return;
    } else {
      response.status(404).json({ error: 'Not found' });
      return;
    }
  }

  let results;
  try {
    results = await searchJudgmentsByKeywordAndLanguage(query, language, level);
  } catch (error) {
    console.error("Error during judgment search:", error);
    Sentry.captureException(error);
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
  if (results.length > 0) {
    response.json({type: 'resultList', content: results });
    return;
  } else {
    response.status(404).json({ error: 'Not found' });
    return;
  }
})

export default judgmentRouter;
