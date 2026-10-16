import express from 'express';
import bodyParser from 'body-parser';
import { handleVercelWebhook } from './webhooks/vercel';
import { createIncidentHandler, updateIncidentHandler, getStatusHandler } from './routes/incidents';
import { requireAuth } from './utils/auth';

const app = express();

// Capture raw request body for webhook signature verification
app.use(bodyParser.json({
  verify: (req: any, res, buf: Buffer) => {
    req.rawBody = buf;
  }
}));

// Vercel webhook receives raw body; handler will verify signature from req.rawBody
app.post('/webhooks/vercel', handleVercelWebhook);

// Protect incident management and status endpoints
app.post('/incidents', requireAuth, createIncidentHandler);
app.patch('/incidents/:id', requireAuth, updateIncidentHandler);
app.get('/status', requireAuth, getStatusHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`IT Hub listening on ${port}`);
});
