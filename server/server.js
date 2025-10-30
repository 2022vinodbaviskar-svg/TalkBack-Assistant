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
  path: "/ws/socket.io/",
  // ⚠️ CRITICAL: Ensure we use the best transport (WebSocket) and handle binary data efficiently
  allowEIO3: true,
  transports: ['websocket', 'polling'] 
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Assuming index.html is in a 'public' subdirectory
app.use(express.static(path.join(__dirname, 'public'))); 

// Store connected clients and devices
const clients = new Map();
// ⚠️ Store *only* the socket object directly, using the ID as the key for easy lookup.
const androidDevices = new Map(); 
let activeAudioStream = null; // Currently active audio source (socket object)

// Serve the web client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve socket.io.js (needed if not relying on CDN)
app.get('/socket.io/socket.io.js', (req, res) => {
  try {
      res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
  } catch (error) {
      console.error("Error serving socket.io.js. Ensure 'socket.io' is installed in node_modules.", error);
      res.status(404).send("Socket.IO client library not found. Run 'npm install socket.io'.");
  }
});

// Helper function to get clean device info for web clients
function getDeviceListForClient() {
    const list = [];
    androidDevices.forEach((deviceData) => {
        // ⚠️ CRITICAL: Only include serializable data (no raw socket object)
        list.push({
            id: deviceData.id,
            name: deviceData.name,
            version: deviceData.version,
            timestamp: deviceData.timestamp,
            isStreaming: deviceData.isStreaming,
        });
    });
    return list;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connesso: ${socket.id}`);
  
  // Android device connected
  socket.on('android_connected', (data) => {
    console.log('Dispositivo Android connesso:', data);
    
    // 1. Create the full device object (including the socket for server use)
    const fullDeviceInfo = {
      id: socket.id,
      name: data.deviceName || `Android Device ${socket.id.substring(0, 4)}`,
      version: data.androidVersion || 'Unknown',
      timestamp: data.timestamp || Date.now(),
      isStreaming: false,
      socket: socket // 🚨 We store the raw socket here for internal use
    };
    
    // 2. Store the full object in the internal map
    androidDevices.set(socket.id, fullDeviceInfo);
    
    // 3. Notify all web clients using the clean list
    io.emit('android_devices_updated', getDeviceListForClient());
  });
  
  // Web client connected
  socket.on('web_client_connected', (data) => {
    console.log('Client Web connesso:', data);
    clients.set(socket.id, { type: 'web', socket: socket });
    // Send current list of Android devices immediately
    socket.emit('android_devices_updated', getDeviceListForClient());
  });
  
  // Audio data from Android
  // ⚠️ CRITICAL: Expects and relays raw binary data (Buffer)
  socket.on('audio_data', (audioBuffer) => { 
    // Only relay data from the currently active stream
    if (activeAudioStream && activeAudioStream.id === socket.id) {
      // Broadcast raw binary audio to all web clients
      clients.forEach((client) => {
        if (client.type === 'web' && client.socket.connected) {
          client.socket.emit('audio_data', audioBuffer); 
        }
      });
    }
  });
  
  // Start listening request from web client
  socket.on('start_listening', (deviceId) => {
    const device = androidDevices.get(deviceId);
    if (!device) {
      socket.emit('listening_started', { success: false, error: 'Dispositivo Android non trovato.' });
      return;
    }
    
    // Set this device as the active stream
    activeAudioStream = device.socket;
    
    // Send command to Android device to start capture
    device.socket.emit('start_recording', { webClientId: socket.id });
    
    // Update internal state and notify web clients
    device.isStreaming = true;
    socket.emit('listening_started', { success: true, deviceId: deviceId });
    io.emit('android_devices_updated', getDeviceListForClient());
  });
  
  // Stop listening request from web client
  socket.on('stop_listening', (deviceId) => {
    const device = androidDevices.get(deviceId);
    if (!device) {
      socket.emit('listening_stopped', { success: false, error: 'Dispositivo Android non trovato.' });
      return;
    }
    
    // Send command to Android device to stop capture
    device.socket.emit('stop_recording', { webClientId: socket.id });
    
    // Update internal state and notify web clients
    device.isStreaming = false;
    if (activeAudioStream && activeAudioStream.id === deviceId) {
      activeAudioStream = null;
    }
    socket.emit('listening_stopped', { success: true, deviceId: deviceId });
    io.emit('android_devices_updated', getDeviceListForClient());
  });
  
  // Get list of connected Android devices (requested by web client on connect)
  socket.on('get_android_devices', () => {
    socket.emit('android_devices_updated', getDeviceListForClient());
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnesso: ${socket.id}`);
    
    if (androidDevices.has(socket.id)) {
      androidDevices.delete(socket.id);
      console.log('Dispositivo Android disconnesso:', socket.id);
      
      // If this was the active stream, reset it
      if (activeAudioStream && activeAudioStream.id === socket.id) {
        activeAudioStream = null;
      }
      
      // Notify all web clients about device removal
      io.emit('android_devices_updated', getDeviceListForClient());
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
