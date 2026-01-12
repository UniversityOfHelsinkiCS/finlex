import express from 'express';
import { getImageByName } from '../db/models/image.js';
const mediaRouter = express.Router();

mediaRouter.get('/:filename', async (request: express.Request, response: express.Response): Promise<void> => {
  const filename = request.params.filename as string;
  try{
    let result;
    try {
      result = await getImageByName(filename);
    } catch {
      response.status(500).json({ error: 'Internal server error' });
      return;
    }
    if (result === null) {
      response.status(404).json({ error: 'Not found' });
      return;
    }
    const {content, mimeType} = result;
    response.setHeader('Content-Type', mimeType);
    response.send(content);
  } catch {
    response.status(404).json({ error: 'Not found' });
    return;
  }
})

export default mediaRouter
