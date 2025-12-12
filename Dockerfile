FROM docker.io/node:24.0.2
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
