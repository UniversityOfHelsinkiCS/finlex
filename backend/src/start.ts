import { Worker } from 'node:cluster';
import './util/config.js';


const REQUIRED_ENV_VARS = ['PG_URI', 'NODE_ENV', 'TYPESENSE_API_KEY', 'TYPESENSE_HOST', 'TYPESENSE_PORT'];
const VALID_NODE_ENVS = ['development', 'test', 'production'];
const WORKERS: {[key: number]: {role: string, worker: Worker}} = {}

function checkEnvVars(vars: string[]) {
  for (const v of vars) {
    if (!process.env[v]) {
      console.error(`${v} environment variable is not set. Exiting.`);
      process.exit(1);
    }
  }
}

function checkNodeEnv(envs: string[]) {
  if (!envs.includes(process.env.NODE_ENV ?? '')) {
    console.error(`NODE_ENV must be one of ${VALID_NODE_ENVS.join(', ')}. Exiting.`);
    process.exit(1);
  }
}

export async function sendStatusUpdate(success: boolean) {
  console.log(`Sending status update: ${success ? 'db-ready' : 'db-notready'}`);
  const status = success ? 'db-ready' : 'db-notready';
  for (const workerId in WORKERS) {
    if (WORKERS[workerId].role === 'app') {
      WORKERS[workerId].worker.send(status)
      console.log(`Sent status update "${status}" to worker ${workerId}`);
    }
  }
}


checkEnvVars(REQUIRED_ENV_VARS);
checkNodeEnv(VALID_NODE_ENVS);

