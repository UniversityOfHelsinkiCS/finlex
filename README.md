# SEB-yhteensopiva_finlex-lukija

Projektin dokumentaatio löytyy [Wikistä](https://github.com/ohjelmistotuotantoprojekti/SEB-yhteensopiva_finlex-lukija/wiki) (Osittain vanhentunut)


## Local dev

```
docker compose up
```

## To Do
- Kontitus [DONE]
- Cypress tms. kuormitustestaus
    - Cypress tai joku podi Openshiftiin
    - Lueskelin Cypressistä
    - Pitää tutkia myös podi-vaihtoehtoa
    - Luultavasti apua Matiakselta tarpeen
- Judgmentit ei toimi?
    - Ei vielä mitään hajua miksi, ehkä joku typesense-rajapintaongelma
    - Ongelma lokaali ja tuotantoympäristössä
    - Kuinka paljon oikeuskäytäntöä tarvitaan? Tarvitaanko esim. jo Tammikuun tenteissä?
- Finlexin rate limiting tms.
    - ~180 kyselyä minuutissa / IP-osoite (Kysyin Finlex-deviltä)
    - Ei todnäk ongelma päätietokantaa päivitellessä inkrementaalisesti
    - Tarve kuitenkin saada toimimaan, että saa tarvittaessa tyhjästä uuden tietokannan pystyyn

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
        load ->> finlex: HTTP GET
        db ->> statute: getStatutesByYear(year)
        statute ->> psql: query
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
