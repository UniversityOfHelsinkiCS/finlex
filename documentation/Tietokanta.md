## Taulut
### Statutes
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| uuid              | UUID    |            | PRIMARY KEY                                |            | unique identifier
| title             | TEXT    |            | NOT NULL                                   |            | dokumentin otsikko
| number            | TEXT    |            | NOT NULL                                   |            | dokumentin numero
| year              | INTEGER |            | NOT NULL                                   |            | dokumentin julkaisuvuosi
| language          | TEXT    |            | NOT NULL CHECK (language IN ('fin', 'swe'))|            | dokumentin kieli
| version           | TEXT    |            |                                            |            | dokumentin versionumero
| content           | XML     |            | NOT NULL                                   |            | dokumentin sisältö
| is_empty          | BOOLEAN |            | NOT NULL                                   |            | onko dokumentti tyhjä
#### Rajoitteet
CONSTRAINT unique_act UNIQUE (number, year, language)

### Images
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| uuid              | UUID    |            | PRIMARY KEY                                |            | unique identifier
| name              | TEXT    |            | NOT NULL UNIQUE                            |            | kuvan nimi
| mime_type         | TEXT    |            | NOT NULL                                   |            | mediatyyppi
| content           | BYTEA   |            | NOT NULL                                   |            | kuvan sisältö

### Judgments
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| uuid              | UUID    |            | PRIMARY KEY                                |            | unique identifier
| level             | TEXT    |            | NOT NULL                                   |            | dokumentin otsikko
| number            | TEXT    |            | NOT NULL                                   |            | dokumentin numero
| year              | INTEGER |            | NOT NULL                                   |            | dokumentin julkaisuvuosi
| language          | TEXT    |            | NOT NULL CHECK (language IN ('fin', 'swe'))|            | dokumentin kieli
| content           | XML     |            | NOT NULL                                   |            | dokumentin sisältö
| is_empty          | BOOLEAN |            | NOT NULL                                   |            | onko dokumentti tyhjä
#### Rajoitteet
CONSTRAINT unique_judgment UNIQUE (level, number, year, language)

### Common_names
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| uuid              | UUID    |            | PRIMARY KEY                                |            | unique identifier
| common_name       | TEXT    |            | NOT NULL                                   |            | dokumentin arkinimi
| statute_uuid      | UUID    |            | references statutes(uuid) ON DELETE CASCADE|            | sanaan liittyvän lain uuid
#### Rajoitteet
CONSTRAINT unique_name UNIQUE (statute_uuid, common_name)

### Keywords_statute
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| id                | TEXT    |            | NOT NULL                                   |            | sanan id finlexistä
| keyword           | TEXT    |            | NOT NULL                                   |            | asiasana
| statute_uuid      | UUID    |            | references statutes(uuid) ON DELETE CASCADE|            | sanaan liittyvän lain uuid
| language          | TEXT    |            | NOT NULL CHECK (language IN ('fin', 'swe'))|            | asiasanan kieli
#### Rajoitteet
CONSTRAINT unique_keyword_statute UNIQUE (statute_uuid, keyword, language)

### Keywords_judgment
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| id                | TEXT    |            | NOT NULL                                   |            | sanan id finlexistä
| keyword           | TEXT    |            | NOT NULL                                   |            | asiasana
| judgment_uuid     | UUID    |            | references judgments(uuid) ON DELETE CASCADE|           | sanaan liittyvän lain uuid
| language          | TEXT    |            | NOT NULL CHECK (language IN ('fin', 'swe'))|            | asiasanan kieli
#### Rajoitteet
CONSTRAINT unique_keyword_judgment UNIQUE (judgment_uuid, keyword, language)

### Map_image_statute
| nimi              | tyyppi  | oletusarvo | rajoitteet                                 | viitteet   | kuvaus                              |
|-------------------|---------|------------|--------------------------------------------|------------|-------------------------------------|
| statute_uuid      | UUID    |            | references statutes(uuid) ON DELETE CASCADE|            | sanaan liittyvän lain uuid
| image_uuid        | UUID    |            | references images(uuid) ON DELETE RESTRICT |            | sanaan liittyvän lain uuid
|                   |         |            | PRIMARY KEY (statute_uuid, image_uuid)     |            | 
