import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET all members
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM member ORDER BY member_id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET member by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM member WHERE member_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE member
router.post('/', async (req: Request, res: Response) => {
  try {
    const { member_name, member_email, member_role, member_ad_group, member_status } = req.body;
    const result = await query(
      `INSERT INTO member (member_name, member_email, member_role, member_ad_group, member_status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        member_name || 'New Member',
        member_email || null,
        member_role || 'Collaborator',
        member_ad_group || null,
        member_status || 'Active'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE member
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { member_name, member_email, member_role, member_ad_group, member_status } = req.body;
    
    const current = await query('SELECT * FROM member WHERE member_id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const dbM = current.rows[0];

    const finalName = member_name || dbM.member_name;
    const finalEmail = member_email !== undefined ? member_email : dbM.member_email;
    const finalRole = member_role !== undefined ? member_role : dbM.member_role;
    const finalAdGroup = member_ad_group !== undefined ? member_ad_group : dbM.member_ad_group;
    const finalStatus = member_status || dbM.member_status;

    const result = await query(
      `UPDATE member
       SET member_name = $1,
           member_email = $2,
           member_role = $3,
           member_ad_group = $4,
           member_status = $5,
           member_updated_at = CURRENT_TIMESTAMP
       WHERE member_id = $6 RETURNING *`,
      [finalName, finalEmail, finalRole, finalAdGroup, finalStatus, id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE member
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM member WHERE member_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted successfully', member: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
