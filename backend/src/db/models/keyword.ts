import { query } from '../db.js';
import { StatuteKeyWord } from '../../types/statute.js';
import { JudgmentKeyWord } from '../../types/judgment.js';

export async function setStatuteKeyword(key: StatuteKeyWord) {
  const sql = 'INSERT INTO keywords_statute (id, keyword, statute_uuid, language) VALUES ($1, $2, $3, $4) ON CONFLICT ON CONSTRAINT unique_keyword_statute DO NOTHING';
  try {
    await query(sql, [key.id, key.keyword, key.statute_uuid, key.language]);
  } catch {
    console.log('FAILED INSERT INTO keywords_statute ', key)
  }
}

export async function setJudgmentKeyword(key: JudgmentKeyWord) {
  const sql = 'INSERT INTO keywords_judgment (id, keyword, judgment_uuid, language) VALUES ($1, $2, $3, $4) ON CONFLICT ON CONSTRAINT unique_keyword_judgment DO NOTHING';
  await query(sql, [key.id, key.keyword, key.judgment_uuid, key.language]);
  try {
    await query(sql, [key.id, key.keyword, key.judgment_uuid, key.language]);
  } catch {
    console.log('FAILED INSERT INTO keywords_judgment ', key)
  }
}

export async function getStatuteKeywords(language: string) {
  const sql = 'SELECT DISTINCT keyword, id FROM keywords_statute WHERE language = $1 ORDER BY keyword';
  const result = await query(sql, [language]);
  return result.rows;
}

export async function getStatutesByKeywordID(language: string, keyword_id: string) {
  const sql = 'SELECT statutes.number, statutes.year, statutes.title, keywords_statute.keyword FROM statutes JOIN keywords_statute ON statutes.uuid=keywords_statute.statute_uuid WHERE keywords_statute.language=$1 AND keywords_statute.id=$2';
  const result = await query(sql, [language, keyword_id]);
  return result.rows;
}

export async function getStatuteKeywordsByStatuteUuid(statuteUuid: string) {
  const sql = 'SELECT keyword FROM keywords_statute WHERE statute_uuid = $1';
  const result = await query(sql, [statuteUuid]);
  return result.rows.map(row => row.keyword);
}

export async function getJudgmentKeywordsByJudgmentUuid(judgmentUuid: string) {
  const sql = 'SELECT keyword FROM keywords_judgment WHERE judgment_uuid = $1';
  const result = await query(sql, [judgmentUuid]);
  return result.rows.map(row => row.keyword);
}
