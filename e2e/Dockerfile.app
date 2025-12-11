FROM node:24.0.2
RUN apt update && apt install -y curl

WORKDIR /home/node/app/frontend
COPY frontend/package.json .
RUN npm install --prefer-offline --no-audit

COPY frontend/tsconfig.json .
COPY frontend/tsconfig.node.json .
COPY frontend/tsconfig.app.json .
COPY frontend/vite.config.ts .
COPY frontend/index.html .
COPY frontend/public ./public
COPY frontend/src ./src
RUN mkdir -p ../backend/src/frontend
RUN npm run build

WORKDIR /home/node/app/backend
COPY backend/package.json .
RUN npm install --prefer-offline --no-audit

COPY backend/tsconfig.json .
COPY backend/src ./src
RUN npm run build
RUN chown -R node:node /home/node/app || true
RUN chmod -R a+rX /home/node/app/backend/dist || true

USER node
WORKDIR /home/node/app/backend/dist
CMD node index.js