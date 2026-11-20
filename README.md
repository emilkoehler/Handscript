# Handscript

Eine Web-App für Handy und Tablet, die getippten Text in deine eigene Handschrift verwandelt.

## So funktioniert es

1. **Schriftprobe erfassen:** Du schreibst jeden Buchstaben ein- bis dreimal mit Stift oder Finger in ein großes Schreibfeld. Die Striche werden als Vektoren gespeichert.
2. **Text umwandeln:** Handscript setzt deinen Text aus deinen Buchstaben zusammen und wechselt dabei zwischen den Varianten.
3. **Papier und Export** *(geplant):* liniert, kariert, blanko oder eigener Hintergrund. Export als PDF oder PNG.
4. **Teilen:** Schriften lassen sich als `.handscript.json` exportieren und auf anderen Geräten importieren.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver, im WLAN auch vom Handy erreichbar
npm test         # Unit-Tests
npm run build    # Produktions-Build nach dist/
```

Alle Daten bleiben lokal im Browser (IndexedDB). Es gibt keinen Server.
