import express from 'express';
import dotenv from 'dotenv';
import { json } from 'body-parser';
import { handleVercelWebhook } from './webhooks/vercel';
import { createIncidentHandler, updateIncidentHandler, getStatusHandler } from './routes/incidents';

dotenv.config();

const app = express();
app.use(json());

// Webhook endpoints
app.post('/webhooks/vercel', handleVercelWebhook);

// Incidents API (simple)
app.post('/incidents', createIncidentHandler);
app.patch('/incidents/:id', updateIncidentHandler);

// Status / health
app.get('/status', getStatusHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`IT Hub listening on ${port}`);
});
