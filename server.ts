import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Orchestrator } from './src/server/orchestrator.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const orchestrator = new Orchestrator();
  orchestrator.start();

  // Initially setup one dummy deployment so it is not completely empty
  orchestrator.applyDeployment('web-frontend', 'nginx:latest', 2);

  app.get('/api/state', (req, res) => {
    res.json({
        deployments: orchestrator.getDeployments(),
        containers: orchestrator.docker.getContainers(),
        events: orchestrator.getEvents() // First is newest
    });
  });

  app.post('/api/deploy', (req, res) => {
    const { name, image, replicas } = req.body;
    if (!name || !image || typeof replicas !== 'number') {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    orchestrator.applyDeployment(name, image, replicas);
    res.json({ success: true });
  });

  app.post('/api/delete', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    orchestrator.deleteDeployment(name);
    res.json({ success: true });
  });

  app.post('/api/crash', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    orchestrator.docker.crashContainer(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
