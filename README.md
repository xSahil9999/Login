# Login & Registrierung

Kleines Frontend fuer Login/Registrierung. Laeuft komplett im Browser (LocalStorage). Optional einfacher Node-Server mit Datei-Store.

## Start ohne Server
- Datei `public/index.html` im Browser oeffnen.
- Nutzer anlegen, danach einloggen. Alles bleibt nur lokal.

## Mit Node-Server
- In `public/app.js` `const USE_API = false;` auf `true` setzen.
- `node server.js` starten und `http://localhost:8080` oeffnen.
- Daten landen in `data/users.json`.

DB/Session/JWT, Rate-Limits usw. ergaenzen.
