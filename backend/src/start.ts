import cluster from 'node:cluster'
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


if (cluster.isPrimary) {
  const startFolder = process.argv[1].split('/').slice(0, -1).join('/');
  const fileType = process.env.NODE_ENV === 'development' ? 'ts' : 'js';
  const appFile: string = `${startFolder}/index.${fileType}`;
  const dbSetupFile: string = `${startFolder}/dbSetup.${fileType}`;
  const ROLES: {[key: string]: {exec: string, execArgv: string[], restartDelay(code: number): number, onExit(code: number): void}} = {
    app: {
      exec: appFile,
      execArgv: process.execArgv,
      restartDelay: () => {
        return 0
      },
      onExit: () => {}
    },
    dbSetup: {
      exec: dbSetupFile,
      execArgv: process.execArgv,
      restartDelay: (code: number) => {
        if (code === 0) {
          return 365 * 24 * 60 * 60 * 1000; // 1 vuosi
        } else {
          return  365 * 24 * 60 * 60 * 1000; // 1 vuosi
        }
      },
      onExit: (code: number) => {
        if (code === 0) {
          console.log("Database setup completed successfully.");
          sendStatusUpdate(true);
        } else {
          console.error("Database setup failed.");
          sendStatusUpdate(false);
        }
      }
    }
  }

  function startByRole(role: string) {
    const { exec, execArgv, restartDelay, onExit } = ROLES[role];
    cluster.setupPrimary({
      exec,
      execArgv,
    });
    const worker = cluster.fork()
    WORKERS[worker.id] = { role, worker };
    worker.on('exit', (code) => {
      console.log(`${role} process exited with code ${code}. Restarting in ${restartDelay(code)}ms...`);
      onExit(code);
      delete WORKERS[worker.id];
      setTimeout(() => {
        startByRole(role);
      }, restartDelay(code));
    });
  }

  Object.keys(ROLES).forEach(role => {
    startByRole(role);
  });

}
