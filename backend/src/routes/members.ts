import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const memberRouter = Router()

// GET /api/members - 取得成員列表
memberRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.member ORDER BY member_name ASC`
    )
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch members error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/members/provision - 查詢或自動 Provision 成員 (Search or Auto-create)
memberRouter.post('/provision', async (req: Request, res: Response) => {
  const { member_name, member_email, member_ad_group } = req.body

  if (!member_email && !member_name) {
    return res.status(400).json({ error: 'member_name or member_email is required' })
  }

  const cleanEmail = (member_email || `${member_name.toLowerCase().replace(/\s+/g, '.')}@projectson.local`).trim().toLowerCase()
  const cleanName = (member_name || member_email.split('@')[0]).trim()

  try {
    // 1. 查找是否已存在
    const existing = await pool.query(
      `SELECT * FROM public.member WHERE LOWER(member_email) = $1 OR LOWER(member_name) = $2 LIMIT 1`,
      [cleanEmail, cleanName.toLowerCase()]
    )

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0])
    }

    // 2. 自動創建新成員
    const inserted = await pool.query(
      `INSERT INTO public.member (member_name, member_email, member_ad_group, member_status)
       VALUES ($1, $2, $3, 'Active')
       RETURNING *`,
      [cleanName, cleanEmail, member_ad_group || null]
    )

    res.status(201).json(inserted.rows[0])
  } catch (err: any) {
    console.error('Provision member error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/members - 手動建立成員
memberRouter.post('/', async (req: Request, res: Response) => {
  const { member_name, member_email, member_ad_group, member_status } = req.body

  if (!member_name || !member_email) {
    return res.status(400).json({ error: 'member_name and member_email are required' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.member (member_name, member_email, member_ad_group, member_status)
       VALUES ($1, $2, $3, COALESCE($4, 'Active'))
       RETURNING *`,
      [member_name.trim(), member_email.trim().toLowerCase(), member_ad_group || null, member_status]
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: `電子郵件 ${member_email} 已被註冊` })
    }
    console.error('Create member error:', err)
    res.status(500).json({ error: err.message })
  }
})
