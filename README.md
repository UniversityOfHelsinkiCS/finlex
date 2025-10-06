# SEB-yhteensopiva_finlex-lukija

Projektin dokumentaatio löytyy [Wikistä](https://github.com/ohjelmistotuotantoprojekti/SEB-yhteensopiva_finlex-lukija/wiki)


## Local dev

```
docker compose up
npm --prefix ./backend run dev
npm --prefix ./front run dev
```

## Tietokannan päivitys/synkronointi

```mermaid
sequenceDiagram
  participant index
  participant dbSetup
  participant db
  participant statute
  participant load
  participant search
  participant psql
  participant ts
  participant finlex

  index ->> dbSetup: runSetup
  activate dbSetup
  dbSetup ->> dbSetup: initDatabase
    activate dbSetup
    dbSetup ->> db: DbReady
    dbSetup ->>+ db: dbIsUpToDate
    Note right of db: for each year
      activate db
      db ->> db: compareStatuteCount(year)
        activate db
        db ->> load: listStatutesByYear(year)
        load ->> finlex: HTTP GET
        db ->> statute: getStatuteCountByYear(year)
        statute ->> psql: query DB
        deactivate db
      db ->> db: findMissingStatutes(year)
        activate db
        db ->> load : listStatutesByYear(year)
        db ->> statute: getStatutesByYear(year)
        statute ->> psql: query
        load ->> finlex: HTTP GET
        deactivate db
      db -->> dbSetup: (updated, statutes, judgements)
      deactivate db
    Note left of db: if not updated
    dbSetup ->> db: fillDb
    Note right of db: for each statute
    db ->> load: setSingleStatute(statute_url)
    load ->> load: parseXML
    load ->> statute: setStatute(parsed_statute)
    statute ->> psql: update DB
    deactivate dbSetup
  dbSetup ->> search: deleteCollection
  search ->> ts: collection_delete
  dbSetup ->> search: syncStatutes
    activate search
    search ->> ts: collection_create
    Note right of search: for each year
    search ->> psql: query DB (statutes of year)
    search ->> search: upsertWithRetry
    search ->> ts: entries_create
    deactivate search
  deactivate dbSetup
```
