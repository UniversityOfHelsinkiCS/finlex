import { format } from 'util';

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const MAX_LOGS = 500;
const buffer: LogEntry[] = [];

export function pushLog(level: LogLevel, args: unknown[]): void {
  const message = format(...(args as []));
  buffer.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
  if (buffer.length > MAX_LOGS) {
    buffer.shift();
  }
}

export function getRecentLogs(limit = 20): LogEntry[] {
  const safeLimit = Math.max(1, Math.min(limit, MAX_LOGS));
  return buffer.slice(-safeLimit).reverse();
}
