import * as Sentry from '@sentry/node';
import { Pool, QueryResult } from 'pg';
import { listStatutesByYear, listJudgmentsByYear, parseFinlexUrl, parseJudgmentUrl, setSingleStatute, buildFinlexUrl, buildJudgmentUrl, setSingleJudgment } from './load.js';
import { getStatuteCountByYear, getStatutesByYear } from './models/statute.js';
import { getJudgmentCountByYear, getJudgmentsByYear } from './models/judgment.js';
import { StatuteKey } from '../types/statute.js';
import { JudgmentKey } from '../types/judgment.js';
import { syncJudgments, syncStatutes } from '../search.js';
import { yearFrom, yearTo } from '../util/config.js';

let pool: Pool;

async function setPool(uri: string) {
  pool = new Pool({
    connectionString: uri
  });
}

async function fillDb(statutes: StatuteKey[], judgments: JudgmentKey[]): Promise<void> {
  console.log('FILLING DB')
  try {
    let i = 0;
    for (const key of statutes) {
      ++i;
      const { uri } = buildFinlexUrl(key)
      await setSingleStatute(buildFinlexUrl(key));
      if (i % 50 === 0) {
        console.log(`Inserted ${i} statutes (${statutes.length})`)
      }
    }
    console.log(`Finshed inserting ${i} statutes`);

    i = 0;
    for (const key of judgments) {
      ++i;
      await setSingleJudgment(buildJudgmentUrl(key));
      if (i % 100 === 0) {
        console.log(`Inserted ${i} judgments (${judgments.length})`);
      }
    }
    console.log(`Finshed inserting ${i} judgments`);

    console.log("Database is filled")
  } catch (error) {
    console.error('Error filling database:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function dbIsReady(): Promise<boolean> {
  try {
    const client = await pool.connect();
    let result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'images');")
    const imagesExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'statutes');")
    const statutesExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'judgments');")
    const judgmentsExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'common_names');")
    const commonNamesExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'keywords_statute');")
    const keywordsStatuteExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'keywords_judgment');")
    const keywordsJudgmentExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'map_image_statute');")
    const mapImageStatuteExists = result.rows[0].exists;

    result = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'status');")
    const statusExists = result.rows[0].exists;

    client.release();
    return imagesExists && statutesExists && judgmentsExists && commonNamesExists && keywordsStatuteExists && keywordsJudgmentExists && mapImageStatuteExists && statusExists;


  } catch (error) {
    console.error('Error checking database readiness:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function dbIsUpToDate(startYear?: number): Promise<{upToDate: boolean, statutes: StatuteKey[], judgments: JudgmentKey[]}> {
  console.log('Checking if database is up to date...');

  async function compareStatuteCount(year: number): Promise<boolean> {
    const expectedFin = await listStatutesByYear(year, 'fin');
    const expectedSwe = await listStatutesByYear(year, 'swe');
    const expectedCount = expectedFin.length + expectedSwe.length;
    if (expectedCount === 0) {
      return true;
    }

    const existingCount = await getStatuteCountByYear(year);
    if (existingCount > expectedCount) {
      console.warn(`In DB too many statutes for year ${year}: ${existingCount}, expected ${expectedCount}.`);
    } else if (existingCount < expectedCount) {
      console.log(`In DB too few statutes for year ${year}: ${existingCount}, expected ${expectedCount}.`);
    } else {
      console.debug(`In DB correct number of statutes for year ${year}: ${existingCount}`);
    }

    return existingCount === expectedCount;
  }

  async function compareJudgmentCount(year: number): Promise<boolean> {
    const expectedFinKKO = await listJudgmentsByYear(year, 'fin', 'kko');
    const expectedSweKKO = await listJudgmentsByYear(year, 'swe', 'kko');
    const expectedFinKHO = await listJudgmentsByYear(year, 'fin', 'kho');
    const expectedSweKHO = await listJudgmentsByYear(year, 'swe', 'kho');
    const expectedCount = expectedFinKKO.length + expectedSweKKO.length + expectedFinKHO.length + expectedSweKHO.length;
    if (expectedCount === 0) {
      return true;
    }
    const existingCount = await getJudgmentCountByYear(year);
    if (existingCount > expectedCount) {
      console.warn(`In DB too many judgments for year ${year}: ${existingCount}, expected ${expectedCount}.`);
    } else if (existingCount < expectedCount) {
      console.log(`In DB too few judgments for year ${year}: ${existingCount}, expected ${expectedCount}.`);
    } else {
      console.debug(`In DB correct number of judgments for year ${year}: ${existingCount}`);
    }
    return existingCount === expectedCount;
  }

  async function findMissingStatutes(year: number): Promise<StatuteKey[]> {
    const expectedFin = await listStatutesByYear(year, 'fin');
    const expectedSwe = await listStatutesByYear(year, 'swe');
    const expectedStatutes = []

    for (const statuteUrl of [...expectedFin, ...expectedSwe]) {
      const statute = parseFinlexUrl(statuteUrl);
      expectedStatutes.push({ number: statute.docNumber, year: statute.docYear, language: statute.docLanguage, version: statute.docVersion });
    }

    const existingStatutesFin = await getStatutesByYear(year, 'fin');
    const existingStatutesSwe = await getStatutesByYear(year, 'swe');
    const existingStatutes: StatuteKey[] = [];

    for (const statute of existingStatutesFin) {
      existingStatutes.push({ number: statute.docNumber, year: statute.docYear, language: 'fin', version: statute.docVersion });
    }

    for (const statute of existingStatutesSwe) {
      existingStatutes.push({ number: statute.docNumber, year: statute.docYear, language: 'swe', version: statute.docVersion });
    }

    const missingStatutes: StatuteKey[] = [];
    for (const statute of expectedStatutes) {
      if (!existingStatutes.some(existing =>
        existing.number === statute.number &&
        existing.year === statute.year &&
        existing.language === statute.language &&
        existing.version === statute.version
      )) {
        missingStatutes.push(statute);
      }
    }

    if (missingStatutes.length > 0) {
      //console.log(existingStatutesFin)
      //console.log('missingStatutes', missingStatutes, missingStatutes.length)
    }


    return missingStatutes;
  }

  async function findMissingJudgments(year: number): Promise<JudgmentKey[]> {
    const expectedFinKKO = await listJudgmentsByYear(year, 'fin', 'kko');
    const expectedSweKKO = await listJudgmentsByYear(year, 'swe', 'kko');
    const expectedFinKHO = await listJudgmentsByYear(year, 'fin', 'kho');
    const expectedSweKHO = await listJudgmentsByYear(year, 'swe', 'kho');
    const expectedJudgments: JudgmentKey[] = [];

    for (const judgmentUrl of [...expectedFinKKO, ...expectedSweKKO, ...expectedFinKHO, ...expectedSweKHO]) {
      const judgment = parseJudgmentUrl(judgmentUrl);
      expectedJudgments.push({ number: judgment.number, year: judgment.year, language: judgment.language, level: judgment.level });
    }

    const existingJudgmentsFin = await getJudgmentsByYear(year, 'fin', 'any');
    const existingJudgmentsSwe = await getJudgmentsByYear(year, 'swe', 'any');
    const existingJudgments: JudgmentKey[] = [];
    for (const judgment of existingJudgmentsFin) {
      existingJudgments.push({ number: judgment.docNumber, year: judgment.docYear, language: 'fin', level: judgment.docLevel });
    }
    for (const judgment of existingJudgmentsSwe) {
      existingJudgments.push({ number: judgment.docNumber, year: judgment.docYear, language: 'swe', level: judgment.docLevel });
    }

    const missingJudgments: JudgmentKey[] = [];

    for (const judgment of expectedJudgments) {
      if (!existingJudgments.some(existing =>
        existing.number === judgment.number &&
        existing.year === judgment.year &&
        existing.language === judgment.language &&
        existing.level === judgment.level
      )) {
        missingJudgments.push(judgment);
      }
    }

    if (missingJudgments.length > 0) {
      //console.log('missingJudgments', missingJudgments, missingJudgments.length)
    }

    return missingJudgments;
  }

  try {
    const statutes: StatuteKey[] = [];
    const judgments: JudgmentKey[] = [];
    let upToDate = true;
    const currentYear = yearTo()
    const start = startYear ?? yearFrom()
    for (let year = start; year <= currentYear + 1; year++) {

      if (!await compareStatuteCount(year)) {
        console.log(`Statutes for year ${year} are not up to date`);
        statutes.push(...await findMissingStatutes(year));
        upToDate = false;
      }

      if (!await compareJudgmentCount(year)) {
        console.log(`Judgments for year ${year} are not up to date`);
        judgments.push(...await findMissingJudgments(year));
        upToDate = false;
      }
    }

    return { upToDate, statutes, judgments };

  } catch (error) {
    console.error('Error checking if database is up to date:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        uuid UUID PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        content BYTEA NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS statutes (
        uuid UUID PRIMARY KEY,
        title TEXT NOT NULL,
        number TEXT NOT NULL,
        year INTEGER NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        version TEXT,
        content XML NOT NULL,
        is_empty BOOLEAN NOT NULL,
        CONSTRAINT unique_act UNIQUE (number, year, language)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS common_names (
        uuid UUID PRIMARY KEY,
        common_name TEXT NOT NULL,
        statute_uuid UUID references statutes(uuid) ON DELETE CASCADE,
        CONSTRAINT unique_name UNIQUE (statute_uuid, common_name)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS judgments (
        uuid UUID PRIMARY KEY,
        level TEXT NOT NULL,
        number TEXT NOT NULL,
        year INTEGER NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        content TEXT NOT NULL,
        is_empty BOOLEAN NOT NULL,
        CONSTRAINT unique_judgment UNIQUE (level, number, year, language)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords_statute (
        id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        statute_uuid UUID references statutes(uuid) ON DELETE CASCADE,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        CONSTRAINT unique_keyword_statute UNIQUE (statute_uuid, keyword, language)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords_judgment (
        id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        judgment_uuid UUID references judgments(uuid) ON DELETE CASCADE,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        CONSTRAINT unique_keyword_judgment UNIQUE (judgment_uuid, keyword, language)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS status (
        id SERIAL PRIMARY KEY,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data JSONB NOT NULL,
        updating BOOLEAN DEFAULT FALSE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_image_statute (
        statute_uuid UUID references statutes(uuid) ON DELETE CASCADE,
        image_uuid UUID references images(uuid) ON DELETE RESTRICT,
        PRIMARY KEY (statute_uuid, image_uuid)
      )`)
    client.release();
  }
  catch (error) {
    console.error('Error creating tables:', error);
    Sentry.captureException(error);
    throw error;
  }
  console.log('Tables created successfully');
}

async function dropTables(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query("DROP TABLE IF EXISTS map_image_statute");
    await client.query("DROP TABLE IF EXISTS images");
    await client.query("DROP TABLE IF EXISTS common_names");
    await client.query("DROP TABLE IF EXISTS keywords_statute");
    await client.query("DROP TABLE IF EXISTS keywords_judgment");
    await client.query("DROP TABLE IF EXISTS judgments");
    await client.query("DROP TABLE IF EXISTS statutes");
    client.release();
  } catch (error) {
    console.error('Error dropping tables:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function dropJudgmentsTables(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query("DROP TABLE IF EXISTS keywords_judgment");
    await client.query("DROP TABLE IF EXISTS judgments");
    client.release();
  } catch (error) {
    console.error('Error dropping judgments tables:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function createJudgmentsTables(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS judgments (
        uuid UUID PRIMARY KEY,
        level TEXT NOT NULL,
        number TEXT NOT NULL,
        year INTEGER NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        content TEXT NOT NULL,
        is_empty BOOLEAN NOT NULL,
        CONSTRAINT unique_judgment UNIQUE (level, number, year, language)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS keywords_judgment (
        id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        judgment_uuid UUID references judgments(uuid) ON DELETE CASCADE,
        language TEXT NOT NULL CHECK (language IN ('fin', 'swe')),
        CONSTRAINT unique_keyword_judgment UNIQUE (judgment_uuid, keyword, language)
      )
    `);
    client.release();
  } catch (error) {
    console.error('Error creating judgments tables:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  try {
    const client = await pool.connect();
    const result = await client.query(text, params);
    client.release();
    return result;
  } catch (error) {
    console.error(`Error executing query '${text}': '${error}'`);
    Sentry.captureException(error);
    throw error;
  }
}

async function clearStatusRows(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM status');
    client.release();
  } catch (error) {
    console.error('Error clearing status rows:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function closePool() {
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing database connection:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function setupTestDatabase(): Promise<void> {
  await createTables();
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/9/fin@", uriOld: ''})
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/9/swe@", uriOld: ''})
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/4/fin@", uriOld: ''})
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/4/swe@", uriOld: ''})
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/5/fin@", uriOld: ''})
  await setSingleStatute({ uri: "https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/2023/5/swe@", uriOld: ''})
  await setSingleJudgment("https://www.finlex.fi/fi/oikeuskaytanto/korkein-hallinto-oikeus/ennakkopaatokset/2005/13")
  await setSingleJudgment("https://www.finlex.fi/sv/rattspraxis/hogsta-forvaltningsdomstolen/prejudikat/2005/13")
  await setSingleJudgment("https://www.finlex.fi/fi/oikeuskaytanto/korkein-oikeus/ennakkopaatokset/2023/5")
  await setSingleJudgment("https://www.finlex.fi/sv/rattspraxis/hogsta-domstolen/prejudikat/2023/5")
  await setSingleJudgment("https://www.finlex.fi/fi/oikeuskaytanto/korkein-oikeus/ennakkopaatokset/1990/10")
  await setSingleJudgment("https://www.finlex.fi/sv/rattspraxis/hogsta-domstolen/prejudikat/1990/10")
  await setSingleJudgment("https://www.finlex.fi/fi/oikeuskaytanto/korkein-oikeus/ennakkopaatokset/1975/II-16")
  await setSingleJudgment("https://www.finlex.fi/sv/rattspraxis/hogsta-domstolen/prejudikat/1975/II-16")
  await syncStatutes('fin');
  await syncStatutes('swe');
  await syncJudgments('fin');
  await syncJudgments('swe');
  console.log('Test database setup complete');
}

async function addStatusRow(data: object, updating: boolean = false): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query(
      'INSERT INTO status (data, updating) VALUES ($1, $2)',
      [JSON.stringify(data), updating]
    );
    client.release();
  } catch (error) {
    console.error('Error adding status row:', error);
    Sentry.captureException(error);
    throw error;
  }
}

export { query, setPool, closePool, createTables, dropTables, dbIsReady, fillDb, dbIsUpToDate, setupTestDatabase, clearStatusRows, addStatusRow, dropJudgmentsTables, createJudgmentsTables };
