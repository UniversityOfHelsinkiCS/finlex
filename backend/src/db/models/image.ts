import { query } from '../db.js';
import { Image } from '../../types/image.js';

// Images are stored by file name. Finlex may publish a new version of an image under the same
// name: then the stored content is replaced and the existing uuid kept, so that the uuid
// returned always exists (it used to return a new uuid that was never inserted).
export async function setImage(image: Image): Promise<string> {
  const sql = `INSERT INTO images (uuid, name, mime_type, content) VALUES ($1, $2, $3, $4)
    ON CONFLICT (name) DO UPDATE SET mime_type = EXCLUDED.mime_type, content = EXCLUDED.content
      WHERE images.mime_type IS DISTINCT FROM EXCLUDED.mime_type OR images.content IS DISTINCT FROM EXCLUDED.content
    RETURNING uuid`;
  const result = await query(sql, [image.uuid, image.name, image.mime_type, image.content]);
  if (result.rows.length > 0) return result.rows[0].uuid;
  // unchanged image: DO UPDATE ... WHERE skipped the row, read its uuid
  const existing = await query('SELECT uuid FROM images WHERE name = $1', [image.name]);
  return existing.rows[0].uuid;
}

export async function getImageByName(name: string): Promise<{content: Buffer, mimeType: string}| null> {
  const sql = 'SELECT content, mime_type FROM images WHERE name = $1';
  const result = await query(sql, [name]);
  if (result.rows.length === 0) {
    return null
  }
  return {content: result.rows[0].content, mimeType: result.rows[0].mime_type};
}

export async function mapImageToStatute(statuteUuid: string, imageUuid: string) {
  const sql = 'INSERT INTO map_image_statute (statute_uuid, image_uuid) VALUES ($1, $2) ON CONFLICT DO NOTHING';
  await query(sql, [statuteUuid, imageUuid]);
}
