FROM docker.io/node:24-alpine
WORKDIR /app

COPY frontend ./frontend/
COPY backend ./backend/

RUN npm --prefix ./frontend ci && \
    npm --prefix ./frontend run build

RUN npm --prefix ./backend ci && \
    npm --prefix ./backend run build

COPY . .

WORKDIR /app/backend
CMD ["npm", "start"]
