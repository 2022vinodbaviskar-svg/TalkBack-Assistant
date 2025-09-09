package com.talkback.assistant

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "BootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_REPLACED -> {
                Log.d(TAG, "Avvio del sistema rilevato, avvio servizio TalkBack")
                
                // Avvia il servizio audio in background
                val serviceIntent = Intent(context, AudioCaptureService::class.java)
                context.startForegroundService(serviceIntent)
            }
        }
    }
}
