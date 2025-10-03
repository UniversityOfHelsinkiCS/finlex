import dotenv from "dotenv";
dotenv.config();

export const VALID_LANGUAGES = ['fin', 'swe'];
export const VALID_LEVELS = ['any', 'kho', 'kko'];

export const yearFrom = () => {
  return parseInt(process.env.START_YEAR || '1700', 10)
}

export const yearTo = () => {
  return new Date().getFullYear()
}
