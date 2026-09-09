import { Router, Request, Response } from 'express';
import { parseTranscript } from '../services/agentService';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

// GET chat history sandbox buffer
router.get('/chat-history', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM chat_histories ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST to parse meeting transcript/chat message and get HITL proposals
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const sessionId = session_id || 'default-session';

    // 1. Log the user's message in the sandbox buffer table
    await query(
      'INSERT INTO chat_histories (session_id, sender, message) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // 2. Parse using Agent service (Gemini or Mock Fallback)
    const proposals = await parseTranscript(message);

    // 3. Log assistant response (simple response or description of proposals)
    let aiResponse = '';
    if (proposals.length === 0) {
      aiResponse = '我分析了會議記錄，沒有發現需要新增或修改的任務或會議。';
    } else {
      aiResponse = `我已為你分析了會議記錄，並提取了 ${proposals.length} 項變更提案，請在提案卡片 (Pull Request View) 中審查！`;
    }
    
    await query(
      'INSERT INTO chat_histories (session_id, sender, message) VALUES ($1, $2, $3)',
      [sessionId, 'assistant', aiResponse]
    );

    res.json({
      proposals,
      chatMessage: {
        sender: 'assistant',
        message: aiResponse,
        created_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error in agent parsing route:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
