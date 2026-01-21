# SEB-yhteensopiva_finlex-lukija

Projektin dokumentaatio löytyy [Wikistä](https://github.com/ohjelmistotuotantoprojekti/SEB-yhteensopiva_finlex-lukija/wiki) (Osittain vanhentunut)


## Local dev

```
docker compose up
```

## To Do
P1
- Sentryn frontend-virheiden capturaaminen
- Kirjautuminen Admin-näkymään

P2
- Status-taulukon käyttäytyminen vähän jank
  - estää myös pääsyn admin-näkymään välillä mikä ei tarkoituksenmukaista
  - välillä näyttää väärää viestiä kun klikkailee päivitystä
- Parempi päivityslogiikka?
  - Jättää nyt joitain välistä, en tiedä onko 429ien takia, pitäisi parantaa lokitusta/backoffia/retryjä
  - Ylimääräisten poisto
- Oikeuskäytännön parsiminen fi/sv tällä hetkellä vaikuttaisi toimivan, mutta on vähän epätäsmällinen
  - käyttää "kielen tunnistamista", joidenkin avainsanojen perusteella
  - HTML/Flight/React dokumenttien parsiminen täsmällisemmin Finlexin puolelta jokseenkin monimutkaista

P3
- Asiasanojen korjaaminen

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
