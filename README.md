 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
index 4449ada795f4320b2b9281fa035c7e1de5d0d5bd..b14ab173b717faa98c20488ce7e555a2ab43d084 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,35 @@
-# leader
\ No newline at end of file
+# Lederkompass 2.0
+
+Et levende og sanserikt lederdashboard som gir deg puls, prioriteringer og utviklingsverktøy i samme flate. Appen er designet for ledere som ønsker å kombinere strategisk oversikt med menneskelig nærvær – ikke ren administrasjon.
+
+## Hovedfunksjoner
+
+- **Glassmorphic lederrom** med gradienter, bakgrunnsbilder og mikroanimasjoner som gjør at dashboardet føles som et moderne kontrollrom.
+- **Interaktive tiles** for team-puls, prioriteringer, delegasjon, 1:1-planlegging, beslutningsjournal, coachingbibliotek, administrativ oversikt og en tidslinje.
+- **Modalbaserte detaljer** – hver tile åpner et modalt "rom" hvor du kan registrere data, følge opp og se historikk uten å forlate oversikten.
+- **Lokal database via IndexedDB (Dexie)** som lagrer alle data sikkert i nettleseren: pulslogg, prioriteringer, delegasjoner, 1:1-samtaler, beslutninger, admin-oppgaver, dagens fokus og favorittspørsmål.
+- **Dynamiske innsikter** med sanntidstall for puls-snittsverdi, prioriteringsprogresjon, neste 1:1 og status for administrativ ryddighet.
+- **Visualiseringer** med Chart.js som kobler sammen puls, fokus og prioritetstakt på en timeline.
+- **Coachingbibliotek** med tilfeldige spørsmål og mulighet til å lagre egne favoritter.
+
+## Teknologi
+
+- Ren HTML/CSS/JavaScript
+- [Dexie](https://dexie.org/) for å forenkle bruk av IndexedDB
+- [Chart.js](https://www.chartjs.org/) for visualisering av historikk
+
+## Kjøre prosjektet
+
+1. Åpne `index.html` i en moderne nettleser (Chrome, Edge, Firefox eller Safari). Ingen byggesteg er nødvendig.
+2. Alle data lagres lokalt i nettleseren. Du kan nullstille alt ved å tømme nettleserdata for nettstedet.
+
+## Tips til bruk
+
+- Start dagen med å angi "Dagens fokus" – dette vises også på tidslinjen.
+- Bruk team-puls til å registrere signaler og mønstre rett etter møter eller samtaler.
+- Marker prioriteringer og delegasjoner som fullført når de er levert, så oppdateres progresjonen automatisk.
+- I coachingbiblioteket kan du lagre favorittspørsmål som du vil bruke igjen.
+
+## Personvern
+
+Alle data ligger lokalt i nettleseren din og blir ikke sendt eller lagret eksternt.
 
EOF
)
