import { query } from '../db.js';
import { Image } from '../../types/image.js';

export async function setImage(image: Image) {
  const existingImageSql = 'SELECT uuid, mime_type, content FROM images WHERE name = $1';
  const existingImageResult = await query(existingImageSql, [image.name]);
  if (existingImageResult.rows.length > 0) {
    const existingImage = existingImageResult.rows[0];
    if (existingImage.mime_type === image.mime_type && existingImage.content.equals(image.content)) {
      return existingImage.uuid;
    }
  }

  const sql = 'INSERT INTO images (uuid, name, mime_type, content) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING';
  await query(sql, [image.uuid, image.name, image.mime_type, image.content]);
  return image.uuid;
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
