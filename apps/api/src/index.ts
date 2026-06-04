import express from 'express';
import activityRouter from './routes/activity';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Activity routes: manual entry anti-cheat (MOV-08)
app.use('/activity', activityRouter);

export default app;
