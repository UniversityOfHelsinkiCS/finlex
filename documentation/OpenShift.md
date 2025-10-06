## OpenShift-manifestien ympäristömuuttujat
Sekä staging- että production-ympäristöjen manifesteista löytyy ConfigMap-manifesti finlex-lukija-config tiedostonimellä. Tämä määrittelee seuraavat ympäristömuuttujat sekä itse sovelluksen, että Typesense hakukoneen podille.  
```SECRET_PG_URI / PG_URI``` = TIKEn possu-tietokannan URI, tuotantotietokanta tuotantopuolella, testitietokanta stagingissa.  
```SECRET_TYPESENSE_API_KEY``` = Sovelluksen ja Typesense-podin välisen kommunikaation varmistava API-avain. Molemmat podit lukevat avaimen tästä tiedostosta, joten arvo voi olla mitä vain.  

## Build and push (to DockerHub) - Workflow
Repositorion staging ja main brancheihin on setupattu aina uuden mergen yhteydessä ajettava build and push-action, joka rakentaa uusimmasta versiosta Docker imagen ja lataa sen yhden ryhmäläisen DockerHubiin, josta OpenShiftin podit saavat sen pullattua. DockerHubin kirjautumiskredentiaalit ovat tallennettu repon Secrets and variables > Actions kohtaan.  
```DOCKERHUBTOKEN``` = DockerHubin salasana  
```DOCKERHUB_USERNAME``` = DockerHubin käyttäjänimi  

## Ohjeita, linkkejä ja usein käytettyjä komentoja
Luukkaisen ohjeet: https://github.com/HY-TKTL/TKT20007-Ohjelmistotuotantoprojekti/tree/master/openshift  
Login-komento testiklusterille: https://console-openshift-console.apps.ocp-test-0.k8s.it.helsinki.fi/  
Login-komento tuotantoklusterille: https://console-openshift-console.apps.ocp-prod-0.k8s.it.helsinki.fi/  
Käynnistä uudelleen: ```oc rollout restart deployment finlex-lukija-dep```  
Pakota imagen päivitys: ```oc import-image finlex-lukija:```[```staging``` jos testiympäristö, ```production``` jos tuotanto]  
Tuotanto-ympäristö: https://finlex-lukija-ohtuprojekti-staging.ext.ocp-prod-0.k8s.it.helsinki.fi  
Testi-ympäristö: https://finlex-lukija-ohtuprojekti-staging.ext.ocp-test-0.k8s.it.helsinki.fi  
