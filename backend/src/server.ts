// src/server.ts
import express from 'express';
import http from 'http';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import { connectDB } from './db';
import { storeQueue } from './queue';
import { initSocket } from './socket';

// Ensure uploads directory exists at project root
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocket(server);

// Connect to MongoDB
connectDB();

// Enable CORS
app.use(cors());

// Configure multer to use the uploads directory
const upload = multer({ dest: uploadDir });

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File not received' });
    return;
  }

  // Get the absolute path directly from multer
  const absPath = path.resolve(req.file.path);
  const { socketId } = req.body as { socketId?: string };

  console.log(`📩 Received file at path: ${absPath}`);
  console.log(`🔌 Associated socketId: ${socketId}`);

  // Verify file exists before queuing
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File does not exist at: ${absPath}`);
    res.status(500).json({ error: 'File upload failed - file not found' });
    return;
  }

  // Add a small delay to ensure file is fully written
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const job = await storeQueue.add('processStores', { path: absPath, socketId });
    console.log(`📦 Job added to queue with ID: ${job.id}, path: ${absPath}`);
    res.status(200).json({ queued: true, jobId: job.id });
  } catch (err) {
    console.error('❌ Failed to queue job:', err);
    res.status(500).json({ error: 'Failed to queue job' });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));