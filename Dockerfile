FROM docker.io/node:24.0.2
WORKDIR /app

COPY frontend ./frontend/
COPY backend ./backend/

RUN npm --prefix ./frontend ci && \
    npm --prefix ./frontend run build

RUN npm --prefix ./backend ci
RUN rm -rf ./backend/src/frontend && mkdir -p ./backend/src/frontend && cp -r ./frontend/dist/* ./backend/src/frontend/
RUN npm --prefix ./backend run build

COPY . .

WORKDIR /app/backend
CMD ["npm", "start"]
