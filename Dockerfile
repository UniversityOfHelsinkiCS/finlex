FROM docker.io/node:24-alpine
WORKDIR /app

COPY frontend ./frontend/
COPY backend ./backend/

RUN npm --prefix ./frontend ci && \
    npm --prefix ./frontend run build

RUN npm --prefix ./backend ci
RUN rm -rf ./backend/src/frontend && mkdir -p ./backend/src/frontend && cp -r ./frontend/dist/* ./backend/src/frontend/
RUN npm --prefix ./backend run build

COPY . .

# set by the release workflow; shown in /api/health so the deployed version can be checked
ARG GIT_SHA=unknown
ARG RELEASE=dev
ARG BUILT_AT=unknown
ENV GIT_SHA=$GIT_SHA RELEASE=$RELEASE BUILT_AT=$BUILT_AT

WORKDIR /app/backend
CMD ["npm", "start"]
