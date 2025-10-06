# Sovelluksen tarkoitus
Sovellus tarjoaa yksinkertaisen hakukäyttöliittymän rajattuun valikoimaan Suomen lainsäädäntöä ja oikeuskäytäntöä.
Lähteenä käytetään Finlexiä.

Safe Exam Browserilla valikoimaa voidaan entisestään rajata URL-osoitteen perusteella, siten, että pääsy sallitaan vain lainsäädäntöön tai oikeuskäytäntöön.

# Sovelluksen rakenne
Sovellus koostuu neljästä pääkomponentista:
* Backend, joka tarjoaa frontendille REST-API rajapinnan dokumenttien hakemiseen
* Postgres-tietokanta, joka säilöö dokumentit oheistietoineen
* Typesense-palvelu, joka pitää indeksoidun tiedon välimuistissa ja tarjoaa ripeän haun
* Frontend, joka tarjoaa käyttäjälle graafisen käyttöliittymän web-sivustona

Lisäksi backendin yhteydessä käynnistetään taustalle tietokannan päivitys-prosessi, joka suorittaa tietokannan täyttämisen ja noutaa Finlexistä säännöllisin väliajoin muuttuneet tai uudet dokumentit.