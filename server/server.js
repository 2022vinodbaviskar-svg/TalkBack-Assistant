const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: "/ws/socket.io/"
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const clients = new Map();
const androidDevices = new Map(); // Store multiple Android devices
let activeAudioStream = null; // Currently active audio source (socket object)

// Serve the web client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve socket.io.js
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connesso: ${socket.id}`);
  
  // Android device connected
  socket.on('android_connected', (data) => {
    console.log('Dispositivo Android connesso:', data);
    const deviceInfo = {
      id: socket.id,
      name: data.deviceName || `Android Device ${androidDevices.size + 1}`,
      connected: true,
      socket: socket,
      lastSeen: new Date()
    };
    
    clients.set(socket.id, { type: 'android', socket, deviceInfo });
    androidDevices.set(socket.id, deviceInfo);
    
    // If no active stream, set this one as the default active
    if (!activeAudioStream) {
      activeAudioStream = socket;
    }
    
    // Notify all web clients about new device
    const deviceList = Array.from(androidDevices.values()).map(d => ({
        id: d.id,
        name: d.name,
        connected: d.connected,
        isStreaming: d.socket.id === (activeAudioStream ? activeAudioStream.id : null)
    }));
    
    clients.forEach((client) => {
      if (client.type === 'web' && client.socket.connected) {
        client.socket.emit('android_devices_updated', deviceList);
      }
    });
  });
  
  // Web client connected
  socket.on('web_client_connected', (data) => {
    console.log('Client web connesso:', data);
    clients.set(socket.id, { type: 'web', socket });
    
    // Send initial status to the new web client
    const deviceList = Array.from(androidDevices.values()).map(d => ({
        id: d.id,
        name: d.name,
        connected: d.connected,
        isStreaming: d.socket.id === (activeAudioStream ? activeAudioStream.id : null)
    }));
    socket.emit('android_devices_updated', deviceList);
  });
  
  // Audio data from Android
  socket.on('audio_data', (audioPacket) => {
    // Only relay data from the currently active stream
    if (activeAudioStream && activeAudioStream.id === socket.id) {
      // Broadcast audio to all web clients
      clients.forEach((client) => {
        if (client.type === 'web' && client.socket.connected) {
          // ⚠️ FIX: Emit 'audio_data' to match web client listener
          client.socket.emit('audio_data', audioPacket); 
        }
      });
    }
  });
  
  // Start listening request from web client
  socket.on('start_listening', (deviceId) => { // Expects deviceId argument
    console.log('Richiesta di avvio ascolto da:', socket.id, 'per dispositivo:', deviceId);
    
    const targetDevice = androidDevices.get(deviceId);
    
    if (targetDevice && targetDevice.socket.connected) {
      activeAudioStream = targetDevice.socket; // Set the requested device as active
      targetDevice.socket.emit('start_recording');
      socket.emit('listening_started', { success: true, deviceId: targetDevice.socket.id });
    } else {
      socket.emit('listening_started', { success: false, error: 'Dispositivo Android non trovato o disconnesso' });
    }
  });
  
  // Stop listening request from web client
  socket.on('stop_listening', (deviceId) => { // Expects deviceId argument
    console.log('Richiesta di fermo ascolto da:', socket.id, 'per dispositivo:', deviceId);
    
    const targetDevice = androidDevices.get(deviceId);
    
    if (targetDevice && targetDevice.socket.connected) {
      targetDevice.socket.emit('stop_recording');
      socket.emit('listening_stopped', { success: true });
    } else {
      socket.emit('listening_stopped', { success: false, error: 'Dispositivo Android non trovato o disconnesso' });
    }
  });
  
  // Check if Android device is connected (legacy/redundant, but kept)
  socket.on('check_android_status', () => {
    const isConnected = androidDevices.size > 0;
    const deviceList = Array.from(androidDevices.values()).map(d => ({
        id: d.id,
        name: d.name,
        connected: d.connected,
        isStreaming: d.socket.id === (activeAudioStream ? activeAudioStream.id : null)
    }));
    
    socket.emit('android_status', { 
      connected: isConnected,
      deviceId: activeAudioStream ? activeAudioStream.id : null,
      devices: deviceList
    });
  });
  
  // Get list of connected Android devices (legacy/redundant, but kept)
  socket.on('get_android_devices', () => {
    const deviceList = Array.from(androidDevices.values()).map(d => ({
        id: d.id,
        name: d.name,
        connected: d.connected,
        isStreaming: d.socket.id === (activeAudioStream ? activeAudioStream.id : null)
    }));
    socket.emit('android_devices_updated', deviceList);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnesso: ${socket.id}`);
    
    if (androidDevices.has(socket.id)) {
      androidDevices.delete(socket.id);
      console.log('Dispositivo Android disconnesso:', socket.id);
      
      // If this was the active stream, switch or clear
      if (activeAudioStream && activeAudioStream.id === socket.id) {
        activeAudioStream = null;
        // Find another connected Android device to make active
        for (let [deviceId, device] of androidDevices) {
          if (device.socket.connected) {
            activeAudioStream = device.socket;
            break;
          }
        }
      }
      
      // Notify all web clients about device removal
      const deviceList = Array.from(androidDevices.values()).map(d => ({
          id: d.id,
          name: d.name,
          connected: d.connected,
          isStreaming: d.socket.id === (activeAudioStream ? activeAudioStream.id : null)
      }));
      
      clients.forEach((client) => {
        if (client.type === 'web' && client.socket.connected) {
          client.socket.emit('android_devices_updated', deviceList);
        }
      });
    }
    
    clients.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connectedClients: clients.size,
    androidDevices: androidDevices.size,
    activeAudioStream: activeAudioStream ? activeAudioStream.id : null
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server TalkBack in ascolto sulla porta ${PORT}`);
  console.log(`📱 Interfaccia web: http://localhost:${PORT}`);
});
