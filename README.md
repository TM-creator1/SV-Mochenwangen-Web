# SV Mochenwangen – Web-App

Statische, installierbare PWA mit Vereinswebsite, offiziellen FuPa-Widgets und lokalem Stadionheft. Dieses Repository enthält ausschließlich die Web-App. Es benötigt keine Zugangsdaten, API-Schlüssel oder eigene Serverdienste.

Vorbereitete Zieladresse: **https://tm-creator1.github.io/SV-Mochenwangen-Web/**

## Lokal starten und testen

Node.js ab Version 22 und npm erforderlich.

```powershell
npm ci
npx playwright install chromium webkit
npm run build
npm test
npm run test:browser
node scripts/serve.mjs --base=/SV-Mochenwangen-Web/ --port=4176
```

Vorschau: http://127.0.0.1:4176/SV-Mochenwangen-Web/

Falls Port 4173 bereits verwendet wird, vor den Browsertests `$env:PWA_TEST_PORT='4177'` setzen. Die Browsertests sperren externe Netzwerkanfragen und simulieren Anbieter, einschließlich FuPa. Sie testen Chromium und WebKit unter dem endgültigen Repositorypfad, Navigation, Fehlerzustände, die neun FuPa-Ziele, neue Tabs und das Offline-Lesen des Stadionhefts.

## Veröffentlichung – erst nach Freigabe

Die Dateien wurden zunächst nur lokal vorbereitet. Der Workflow `.github/workflows/pages.yml` wird bei einem späteren Push auf `main` automatisch ausgeführt; alternativ kann er manuell gestartet werden. Die Veröffentlichung wurde bei der Vorbereitung nicht ausgelöst.

1. Im GitHub-Repository unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** auswählen. Das wurde bei der lokalen Vorbereitung noch nicht eingerichtet.
2. Nach ausdrücklicher Freigabe den vorbereiteten Commit auf `main` pushen. Der Workflow installiert die im Lockfile fixierten Abhängigkeiten, baut und testet die App und veröffentlicht ausschließlich `dist/`.
3. Unter **Actions → Publish PWA to GitHub Pages** den erfolgreichen Build und das Deployment prüfen. Die HTTPS-Adresse wird auch in der Workflow-Zusammenfassung ausgegeben. Unter **Settings → Pages** HTTPS erzwingen, sofern auswählbar.
4. Die veröffentlichte Seite aufrufen und das Stadionheft einmal online laden. Danach offline erneut öffnen, um die Offline-Funktion auf dem tatsächlichen Gerät zu prüfen.

Offizielle Anleitung: [GitHub Pages mit eigenem Workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Manifest-ID, Start-URL und Scope sind `/SV-Mochenwangen-Web/`. Icons, Skripte, PDF und PDF.js-Ressourcen verwenden dazu passende relative URLs. Der Service Worker wird unter diesem Pfad registriert und greift ausschließlich auf den eigenen Bereich zu; er speichert keine fremden Live-Daten. Der Build erzeugt den Offline-App-Rahmen und `.nojekyll`.

## FuPa-Freischaltung

Nach der Veröffentlichung den Hostnamen **tm-creator1.github.io** in der [FuPa-Vereinsverwaltung](https://www.fupa.net/fupa/admin) für die Vereinswidgets freischalten. Das FuPa-Skript sendet `document.location.host`, also den Hostnamen ohne Repositorypfad. Die tatsächliche Freischaltung muss anschließend im Browser geprüft werden.

Bis dahin zeigt die PWA eine verständliche Meldung und **Auf FuPa öffnen** mit dem Link zur ausgewählten Mannschaft. Die offizielle Einbindung über `https://www.fupa.net/fupa/widget/fupa_widget.js` bleibt unverändert. Es gibt keinen Proxy und keine Umgehung der Domainprüfung. Eine Freischaltung der HTTPS-Domain gilt nicht automatisch für die lokale Vorschau.

## Offline-Funktion und Aktualisierung

App-Oberfläche und ein zuvor vollständig geladenes Stadionheft stehen offline zur Verfügung, solange der Browser den Cache behält. FuPa und Vereinswebsite benötigen Internet. Beim ersten Besuch muss der Service Worker erfolgreich installiert werden. Eine neue Build-Version erzeugt einen neuen Cache; die App bietet bei verfügbarem Update eine Aktualisierung an. Auf dem iPhone die HTTPS-Seite in Safari öffnen und über **Teilen → Zum Home-Bildschirm** installieren.

Stadionheft: `public/documents/stadionheft-2026-11-01.pdf`. Bei einer neuen Ausgabe Verweise in `src/config.js`, `src/app.js`, `src/magazine.js`, `scripts/build.mjs` und den Tests aktualisieren.

Nicht enthalten: Android-/iOS-Projekte, lokale Konfigurationen, Diagnoseberichte, Zugangsdaten, `node_modules` und generiertes `dist`. Der öffentliche Inhalt umfasst die bewusst mitgelieferten Vereinsicons und das Stadionheft.

Stadionheft: npm run update:magazine liest den aktuellen PDF-Link von https://sv-mochenwangen.de/ und speichert das Heft lokal fuer die Offline-Anzeige. GitHub Pages baut und veroeffentlicht bei Push auf main, manuell und alle sechs Stunden automatisch. Ein fehlender Link oder ein fehlgeschlagener Download stoppt die Veroeffentlichung; die bisherige Website bleibt bestehen. Der lokale PDF-Pfad bleibt aus Kompatibilitaetsgruenden unveraendert; Ausgabedatum und Original-Link stammen aus dem gefundenen Dateinamen.
