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
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const clients = new Map();
const androidDevices = new Map(); // Store multiple Android devices
let activeAudioStream = null; // Currently active audio source

// Debug: Log directory structure
console.log('🔍 DEBUG: Directory structure:');
console.log('__dirname:', __dirname);
console.log('public path:', path.join(__dirname, 'public'));
console.log('index.html path:', path.join(__dirname, 'public', 'index.html'));

// Check if files exist
const fs = require('fs');
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(__dirname, 'public', 'index.html');

console.log('📁 DEBUG: Checking directories and files:');
console.log('public directory exists:', fs.existsSync(publicDir));
console.log('index.html exists:', fs.existsSync(indexPath));

if (fs.existsSync(publicDir)) {
  console.log('📂 DEBUG: Contents of public directory:');
  try {
    const files = fs.readdirSync(publicDir);
    console.log('Files in public:', files);
  } catch (err) {
    console.log('Error reading public directory:', err.message);
  }
} else {
  console.log('❌ DEBUG: public directory does not exist!');
}

// Serve the web client
app.get('/', (req, res) => {
  console.log('🌐 DEBUG: Serving web client request');
  const filePath = path.join(__dirname, 'public', 'index.html');
  console.log('🌐 DEBUG: Attempting to serve file:', filePath);
  console.log('🌐 DEBUG: File exists:', fs.existsSync(filePath));
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ DEBUG: index.html not found!');
    return res.status(404).send('File not found');
  }
  
  res.sendFile(filePath);
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
    
    // If no active stream, make this one active
    if (!activeAudioStream) {
      activeAudioStream = socket;
    }
    
    // Notify all web clients about new device
    clients.forEach((client, clientId) => {
      if (client.type === 'web' && client.socket.connected) {
        client.socket.emit('android_devices_updated', Array.from(androidDevices.values()));
      }
    });
  });
  
  // Web client connected
  socket.on('web_client_connected', (data) => {
    console.log('Client web connesso:', data);
    clients.set(socket.id, { type: 'web', socket });
  });
  
  // Audio data from Android
  socket.on('audio_data', (audioPacket) => {
    if (activeAudioStream && activeAudioStream.id === socket.id) {
      // Broadcast audio to all web clients
      clients.forEach((client, clientId) => {
        if (client.type === 'web' && client.socket.connected) {
          client.socket.emit('audio_stream', audioPacket);
        }
      });
    }
  });
  
  // Start listening request from web client
  socket.on('start_listening', (deviceId = null) => {
    console.log('Richiesta di avvio ascolto da:', socket.id, 'per dispositivo:', deviceId);
    
    let targetDevice = activeAudioStream;
    
    // If specific device requested, use that one
    if (deviceId && androidDevices.has(deviceId)) {
      targetDevice = androidDevices.get(deviceId).socket;
      activeAudioStream = targetDevice;
    }
    
    if (targetDevice && targetDevice.connected) {
      targetDevice.emit('start_recording');
      socket.emit('listening_started', { success: true, deviceId: targetDevice.id });
    } else {
      socket.emit('listening_started', { success: false, error: 'Nessun dispositivo Android connesso' });
    }
  });
  
  // Stop listening request from web client
  socket.on('stop_listening', () => {
    console.log('Richiesta di fermo ascolto da:', socket.id);
    if (activeAudioStream && activeAudioStream.connected) {
      activeAudioStream.emit('stop_recording');
      socket.emit('listening_stopped', { success: true });
    } else {
      socket.emit('listening_stopped', { success: false, error: 'Nessun dispositivo Android connesso' });
    }
  });
  
  // Check if Android device is connected
  socket.on('check_android_status', () => {
    const isConnected = activeAudioStream && activeAudioStream.connected;
    socket.emit('android_status', { 
      connected: isConnected,
      deviceId: isConnected ? activeAudioStream.id : null,
      devices: Array.from(androidDevices.values())
    });
  });
  
  // Get list of connected Android devices
  socket.on('get_android_devices', () => {
    socket.emit('android_devices_updated', Array.from(androidDevices.values()));
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnesso: ${socket.id}`);
    
    if (androidDevices.has(socket.id)) {
      androidDevices.delete(socket.id);
      console.log('Dispositivo Android disconnesso:', socket.id);
      
      // If this was the active stream, switch to another device
      if (activeAudioStream && activeAudioStream.id === socket.id) {
        activeAudioStream = null;
        // Find another Android device
        for (let [deviceId, device] of androidDevices) {
          if (device.socket.connected) {
            activeAudioStream = device.socket;
            break;
          }
        }
      }
      
      // Notify all web clients about device removal
      clients.forEach((client, clientId) => {
        if (client.type === 'web' && client.socket.connected) {
          client.socket.emit('android_devices_updated', Array.from(androidDevices.values()));
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
