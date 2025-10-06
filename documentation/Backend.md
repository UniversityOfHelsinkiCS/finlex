# Toimintaperiaate
Backend tarjoaa frontendille REST-API rajapinnan lainsäädännön ja oikeuskäytännön hakemiselle.

Lähteenä backend käyttää Finlexiä, josta tiedot noudetaan tietokantaan ja indeksoidaan hakua varten Typesense-palveluun.

## Finlex lähteenä
Lainsäädännöstä sovellus tarjoaa vain osan Finlexin valikoimasta, eli ajantasaiset lait ja asetukset.
Oikeuskäytännöstä tarjotaan korkeimman oikeuden ja korkeimman hallinto-oikeuden ennakkopäätökset.

Finlex tarjoaa lainsäädännön avoimen rajapinnan kautta, mutta oikeuskäytäntöä sieltä ei saa.
Oikeuskäytäntö on jouduttu raapimaan kasaan Finlexin graafisen käyttöliittymän kautta, mistä johtuen backend tarjoilee dokumentteja kahdessa eri muodossa: lainsäädäntö XML-muodossa ja oikeuskäytäntö HTML-muodossa.

Sovellus ja kaikki sisältö ovat saatavilla suomeksi ja ruotsiksi, pitkälti sellaisena kuin se Finlexissäkin on.

# Endpointit

## Tilan tarkistus
- Metodi: GET
- Polku: /api/check-db-status
- Vastaus 200:
```json
{
    "status": "ready"
}
```
- Vastaus 503:
```json
{
    "error": "Service Unavailable: Database is not ready",
    "status": "notready"
}
```

## Hae lakeja
- Metodi: GET
- Polku: /api/statute/search?q=<query>&language=<language>
- Parametrit:
  - query: hakutermi
  - language: kieli ('fin' tai 'swe')
- Vastaus:
```json
[
    {
        "docYear": 2024,
        "docNumber": 244,
        "docTitle": "Laki jolla on nimi"
    },
    {
        "docYear": 2024,
        "docNumber": 245,
        "docTitle": "Laki jolla on toinen nimi"
    }
]
```
- Vastaus 400:
```json
{ 
    "error": error viesti
}
```
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```
- Vastaus 500:
```json
{ 
    "error": "Internal server error" 
}
```

## Näytä tietty laki
- Metodi: GET
- Polku: /api/statute/id/:year/:number/:language
- Parametrit:
  - year: vuosiluku
  - number: dokumentin numero
  - language: kieli ('fin' tai 'swe')
- Vastaus: [XML-dokumentti](https://data.finlex.fi/assets/tieliikennelaki.xml)
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```


## Näytä tietyn lain rakenne
- Metodi: GET
- Polku: /api/statute/structure/id/:year/:number/:language
- Parametrit:
  - year: lain vuosiluku
  - number: dokumentin numero
  - language: kieli ('fin' tai 'swe')
- Vastaus:
```json
[
    {
        "name": "1 luku - Yleiset säännökset",
        "id": "chp_1__heading",
        "content": [
            {
                "name": "1 § - Lain tavoite",
                "id": "chp_1__sec_1__heading",
                "content": []
            },
            {
                "name": "2 § - Lain soveltamisala",
                "id": "chp_1__sec_2__heading",
                "content": []
            },
            {
                "name": "3 § - Määritelmät",
                "id": "chp_1__sec_3__heading",
                "content": []
            },
            {
                "name": "4 § - Kansainväliset sopimukset",
                "id": "chp_1__sec_4__heading",
                "content": []
            },
            {
                "name": "5 § - Euroopan unionin direktiivit",
                "id": "chp_1__sec_5__heading",
                "content": []
            },
            {
                "name": "6 § - Saamelaiskulttuurin suoja",
                "id": "chp_1__sec_6__heading",
                "content": []
            },
            {
                "name": "7 § - Varovaisuusperiaate",
                "id": "chp_1__sec_7__heading",
                "content": []
            },
            {
                "name": "8 § - Ympäristötietoisuuden edistäminen",
                "id": "chp_1__sec_8__heading",
                "content": []
            }
        ]
    },
    {
        "name": "2 luku - Luonnonsuojelun viranomaiset ja muut toimijat",
        "id": "chp_2__heading",
        "content": [
            {
                "name": "9 § - Luonnonsuojelun valtion viranomaiset",
                "id": "chp_2__sec_9__heading",
                "content": []
            },
            {
                "name": "10 § - Luonnonsuojelun asiantuntijaviranomaiset",
                "id": "chp_2__sec_10__heading",
                "content": []
            },
            {
                "name": "11 § - Kunta",
                "id": "chp_2__sec_11__heading",
                "content": []
            },
            {
                "name": "12 § - Suomen luontopaneeli",
                "id": "chp_2__sec_12__heading",
                "content": []
            }
        ]
    }
]
```
- Vastaus 500:
```json
{ 
    "error": "Internal server error"
}
```
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```

## Hae oikeuskäytännöistä  
- Metodi: GET  
- Polku: /api/judgment/search?q=<query>&language=<language>&level=<level>  
- Parametrit:  
  - query: hakutermi
  - language: kieli ('fin' tai 'swe')  
  - level: tuomioistuin ('kho', 'kko', 'any')  
    - valinnainen: parametrin puuttuessa oletetaan 'any'
- Vastaus:  
```json
[
    {
      "docYear": 2005,
      "docNumber": 13,
      "docLevel": "kho"
    }
]
```
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```

## Hae tietty oikeuskäytäntöpäätös vuodella, numerolla ja tasolla  
- Metodi: GET  
- Polku: /api/judgment/id/:year/:number/:language/:level  
- Parametrit:  
  - year: vuosiluku  
  - number: päätöksen numero
  - language: kieli ('fin' tai 'swe')  
  - level: tuomioistuin ('kho' eli korkein hallinto-oikeus tai 'kko' eli korkein oikeus)  
- Vastaus: [HTML-dokumentti](view-source:https://finlex.fi/en/case-law/supreme-administrative-court/precedents/2005/13)
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```

## Hae oikeuskäytäntöpäätösten sisällöstä 
- Metodi: GET  
- Polku: /api/judgment/keyword/:keyword/:language
- Parametrit:  
  - keyword: hakusana
  - language: kieli ('fin' tai 'swe')  
- Vastaus:  
```json
[
    {
      "docYear": 2005,
      "docNumber": 13,
      "docLevel": "kho"
    }
]
```
- Vastaus 404:
```json
{ 
    "error": "Not found" 
}
```

## Hae asiasanat
- Metodi: GET
- Polku: /api/statute/keyword/:language
- Parametrit:
   - language: haettavien asiasanojen kieli ('fin' tai 'swe')
- Vastaus:
```json
[
    {
        "id": 1234,
        "keyword": "asiasana1"
    },
    {
        "id": 5678,
        "keyword": "asiasana2"
    }
]
```
- Vastaus 404:
```json
{
    "error": "Not found"
}
```

## Hae asiasanaan liittyvät lait
- Metodi: GET
- Polku: /api/statute/keyword/:language/:keyword_id
- Parametrit:
   - language: kieli ('fin' tai 'swe')
   - ketword_id: asiasanan id
- Vastaus:
```json
[
    {
        "number": 27,
        "year": 2005,
        "title": "lain 27/2005 otsikko"
    },
    {
        "number": 13,
        "year": 2003,
        "title": "lain 13/2003 otsikko"
    }
]
```
- Vastaus 404:
```json
{
    "error": "Not found"
}
```