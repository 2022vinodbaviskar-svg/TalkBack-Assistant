package com.talkback.assistant

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    
    private lateinit var settingsButton: Button
    
    companion object {
        private const val PERMISSION_REQUEST_CODE = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        initViews()
        setupButtons()
        checkPermissions()
        // Non avviare automaticamente il servizio per Android 14
        // startBackgroundService()
    }
    
    private fun initViews() {
        settingsButton = findViewById(R.id.settingsButton)
    }
    
    private fun setupButtons() {
        settingsButton.setOnClickListener {
            openTalkBackSettings()
        }
    }
    
    private fun openTalkBackSettings() {
        try {
            // Apri le impostazioni TalkBack di Android
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
        } catch (e: Exception) {
            // Fallback alle impostazioni generali
            val intent = Intent(Settings.ACTION_SETTINGS)
            startActivity(intent)
        }
    }
    
    private fun checkPermissions(): Boolean {
        val permissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.INTERNET,
            Manifest.permission.FOREGROUND_SERVICE,
            Manifest.permission.WAKE_LOCK,
            Manifest.permission.RECEIVE_BOOT_COMPLETED
        )
        
        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        
        return if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missingPermissions.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
            false
        } else {
            true
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            if (allGranted) {
                startBackgroundService()
            } else {
                // Se i permessi vengono negati, mostra un messaggio e riprova
                checkPermissions()
            }
        }
    }
    
    private fun startBackgroundService() {
        // Avvia sempre il servizio in background
        val intent = Intent(this, AudioCaptureService::class.java)
        startForegroundService(intent)
    }
    
    override fun onResume() {
        super.onResume()
        // Non avviare automaticamente il servizio per Android 14
        // startBackgroundService()
    }
}
