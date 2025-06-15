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

// ensure uploads folder
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const server = http.createServer(app);
initSocket(server);
connectDB();
app.use(cors());

const upload = multer({ dest: uploadDir });
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File not received' });
    return;
  }

  const absPath = path.resolve(req.file.path);
  const { socketId, email } = req.body as { socketId?: string; email?: string };
  console.log(`📩 Received file: ${absPath}`);
  console.log(`🔌 socketId: ${socketId}`);

  if (!fs.existsSync(absPath)) {
    console.error(`❌ Missing file: ${absPath}`);
    res.status(500).json({ error: 'File not found' });
    return;
  }
  await new Promise((r) => setTimeout(r, 100));

  try {
    const job = await storeQueue.add('processStores', { path: absPath, socketId, userEmail: email });
    console.log(`📦 Job queued: ${job.id}`);
    res.json({ queued: true, jobId: job.id });
  } catch (err) {
    console.error('❌ Queue error:', err);
    res.status(500).json({ error: 'Queue failed' });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));