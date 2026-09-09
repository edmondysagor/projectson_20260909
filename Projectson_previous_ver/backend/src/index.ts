import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import meetingsRouter from './routes/meetings';
import tasksRouter from './routes/tasks';
import bottlenecksRouter from './routes/bottlenecks';
import knowledgeRouter from './routes/knowledge';
import agentRouter from './routes/agent';
import proposalsRouter from './routes/proposals';
import workspacesRouter from './routes/workspaces';
import membersRouter from './routes/members';
import productsRouter from './routes/products';
import projectsRouter from './routes/projects';
import templatesRouter from './routes/templates';
import uploadRouter from './routes/upload';
import { query } from './config/database';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/meetings', meetingsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/bottlenecks', bottlenecksRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/agent', agentRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/products', productsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/members', membersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/upload', uploadRouter);



// Root check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(port, () => {
  console.log(`[Project 神 Backend] Server is running on port ${port}`);
});
