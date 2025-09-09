# 🎤 TalkBack Assistant

Un'app Android per l'ascolto remoto del microfono con interfaccia web e controllo multi-dispositivo.

## 🚀 Caratteristiche

- **App Android** che funziona sempre in background
- **Server remoto** su ha-cm.kozow.com:3888
- **Interfaccia Web** per l'ascolto remoto
- **Multi-dispositivo** - supporta più telefoni Android simultaneamente
- **Streaming in tempo reale** con Socket.IO
- **Autenticazione** integrata
- **Avvio automatico** all'accensione del telefono
- **Controllo remoto** - attivazione/disattivazione da web

## 📱 Interfaccia App Android

L'app mostra un'interfaccia minimale simile a TalkBack standard:

```
┌─────────────────────────────────────┐
│        [🎤 Icona TalkBack]          │
│        TalkBack Assistant           │
│    [⚙️ Apri Impostazioni TalkBack]  │
└─────────────────────────────────────┘
```

## 🛠️ Architettura

```
[App Android] ←→ [Server Socket.IO] ←→ [Client Web]
     ↓                    ↓                ↓
  Cattura Audio    Gestione Multi-      Ascolto Remoto
  (Background)     Dispositivo         (Browser)
```

## 📋 Prerequisiti

- Android Studio
- Dispositivo Android con API 24+
- Server remoto: ha-cm.kozow.com:3888

## 🚀 Installazione

### 1. App Android

1. Scarica l'APK: `TalkBack-Assistant.apk`
2. Installa sul dispositivo Android
3. Concedi i permessi richiesti:
   - Microfono
   - Internet
   - Avvio automatico
   - Servizio in background

### 2. Interfaccia Web

Apri `server-remote.html` nel browser per:
- Visualizzare dispositivi connessi
- Selezionare dispositivo da ascoltare
- Avviare/fermare l'ascolto remoto

## 🔧 Configurazione

### Server Remoto
- **URL**: ha-cm.kozow.com:3888
- **Account**: antonellomigliorelli@gmail.com
- **Password**: B@stardslave69

### Multi-Dispositivo
- **Dispositivi illimitati** possono connettersi
- **Selezione dispositivo** dal web
- **Un solo dispositivo attivo** alla volta per l'ascolto

## 📱 Utilizzo

### Flusso Normale:
1. **App Android** si avvia automaticamente all'accensione
2. **Si connette** al server remoto
3. **Dal web** seleziona dispositivo e clicca "Avvia Ascolto"
4. **Audio** viene catturato e trasmesso in tempo reale

### Controlli:
- **Avvio ascolto**: Solo da remoto (web)
- **Ferma ascolto**: Solo da remoto (web)
- **Impostazioni**: Pulsante nell'app per accedere a TalkBack Android

## 🏗️ Struttura Progetto

```
TalkBack Assistant/
├── android/                 # Progetto Android
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/        # Codice Kotlin
│   │   │   ├── res/         # Risorse (layout, icone, etc.)
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── gradle/
├── server/                  # Server Node.js
│   ├── server.js           # Server principale
│   ├── public/
│   │   └── index.html      # Interfaccia web
│   └── package.json
├── server-remote.html      # Interfaccia per server remoto
├── TalkBack-Assistant.apk  # APK compilato
└── README.md
```

## 🔒 Sicurezza

⚠️ **IMPORTANTE**: Questa app è per uso domestico/test. Per uso in produzione:

1. Aggiungi autenticazione robusta
2. Usa HTTPS/WSS
3. Implementa controlli di accesso
4. Aggiungi logging e monitoring
5. Cripta i dati audio

## 📋 Permessi Android

- `RECORD_AUDIO` - Per catturare l'audio
- `INTERNET` - Per comunicare con il server
- `FOREGROUND_SERVICE` - Per funzionare in background
- `WAKE_LOCK` - Per non andare in standby
- `RECEIVE_BOOT_COMPLETED` - Per avvio automatico

## 🎯 Caratteristiche Tecniche

- **Audio Format**: PCM 16-bit, 44.1kHz, Mono
- **Protocollo**: Socket.IO con WebSocket
- **Latenza**: ~100-200ms
- **Background**: Servizio Android persistente
- **Multi-device**: Supporto illimitato dispositivi

## 🐛 Troubleshooting

### App Android non si connette
- Verifica connessione internet
- Controlla che il server sia raggiungibile
- Verifica i permessi dell'app

### Audio non funziona
- Controlla i permessi del microfono
- Verifica che l'app sia in background
- Controlla i log del server

### Server non risponde
- Verifica che ha-cm.kozow.com:3888 sia raggiungibile
- Controlla le credenziali di accesso

## 📄 Licenza

MIT License - vedi file LICENSE per dettagli.

## 🤝 Contributi

1. Fork del progetto
2. Crea un branch per la feature
3. Commit delle modifiche
4. Push al branch
5. Apri una Pull Request

## 📞 Supporto

Per problemi o domande:
- Apri una Issue su GitHub
- Controlla i log dell'app e del server
- Verifica la configurazione di rete

---

**🎉 TalkBack Assistant - Ascolto Remoto Professionale!**