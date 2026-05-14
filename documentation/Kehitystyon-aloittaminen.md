# Riippuvuudet

1. Asenna [node version manager (nvm)](https://github.com/nvm-sh/nvm)

- ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  ```

2. Asenne node

- ```bash
  nvm install 24
  ```

3. Kloonaa tämä repo koneellesi
4. Avaa terminaali repon juureen
5. Asenna riippuvuudet

- ```bash
  npm run setup
  ```

# Ympäristömuuttujat

Ympäristömuuttujat luetaan kehitystilassa `backend/.env` tiedostosta.
| Nimi | Selitys | Esimerkki | Oletusarvo |
|:-----------|:---:|:-----:|:-----:|
| PG_URI | Postgres-tietokannan osoite | postgres://postgres:postgres@localhost:5555/devdb | |
| TYPESENSE_HOST | Typesense-palvelun DNS-nimi | typesense.localdomain.invalid | localhost |
| TYPESENSE_PORT | Typesense-palvelun portti | 8108 | 8108 |
| TYPESENSE_API_KEY | Typesense-palvelun API-avain | ksjfbckeirbfinreling | |
| START_YEAR | Vuosi, josta eteenpäin haetaan tietoa Finlexistä | 2020 | 1700 |
| NODE_ENV | Suoritustilan määrittävä arvo (test, development, production) | production | |
| BASE URL | E2E testien pohjana käytettävä osoite | http://app.localdomain.invalid | http://localhost:3001 |

# Käynnistäminen

## Kehitystilassa

```bash
# Käynnistä riippuvuudet (Postgres + Typesense) ja frontend + backend
npm run dev:full

# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

Jos Postgres ja Typesense ovat jo käynnissä, voit käynnistää vain sovellukset:

```bash
npm run dev
```

Jos haluat käynnistää vain riippuvuudet:

```bash
npm run dev:deps
```

## Tuotantotilassa

```bash
npm --prefix ./frontend run build
npm --prefix ./backend run build
npm --prefix ./backend start

# Frontend ja backend: http://localhost:3001
```

# Testaus

Paikallisten testien ajamista varten tarvitset koneellesi pyörimään Postgres-tietokannan ja Typesense-palvelun. Tarvittavat Dockerfilet löydät kansiosta `e2e`.

## Yksikkötestit

```bash
npm --prefix ./backend test
npm --prefix ./frontend test
```

## End-to-End testit

```bash
npm --prefix ./backend run e2e
```

Voit ajaa E2E testit myös siten, kuin CI-pipeline ne ajaa, käyttäen Docker Composea.

```bash
docker compose -f run_e2e.yaml up --build --exit-code-from playwright
```

# Linttaus

## Näytä virheet

```bash
npm --prefix ./backend run lint
npm --prefix ./frontend run lint
```

## Korjaa virheet

```bash
npm --prefix ./backend run lint:fix
npm --prefix ./frontend run lint:fix
```
