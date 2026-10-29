const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to serve Firebase config from environment variables (if set)
app.get('/api/config', (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  };

  // Check if at least apiKey and projectId are present
  const isConfigured = Boolean(config.apiKey && config.projectId);

  res.json({
    configured: isConfigured,
    config: isConfigured ? config : null
  });
});

// Fallback route to serve index.html for SPA behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 Firebase Chat Web App is running!`);
  console.log(`📡 Local server: http://localhost:${PORT}`);
  console.log(`⚙️  Make sure to configure your Firebase credentials`);
  console.log('========================================================');
});
