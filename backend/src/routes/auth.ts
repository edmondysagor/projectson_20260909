import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const authRouter = Router()

/**
 * POST /api/auth/sync-user
 * Upsert Google OAuth user into public.users and automatically link/ensure public.member
 */
authRouter.post('/sync-user', async (req: Request, res: Response) => {
  const { 
    id, 
    email, 
    name, 
    avatar_url, 
    oauth_provider = 'google', 
    oauth_provider_id,
    role = 'admin'
  } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required for user synchronization' })
  }

  const userId = id || oauth_provider_id || `user_${Date.now()}`
  const userName = name || email.split('@')[0] || 'User'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 查詢是否已有管理員預先手動建立的成員 (Pre-provisioned Member Check)
    const existingMemberRes = await client.query(
      'SELECT member_uid, member_name, member_email, member_ad_group, member_status FROM public.member WHERE LOWER(member_email) = LOWER($1)',
      [email.toLowerCase().trim()]
    )
    const existingMember = existingMemberRes.rows[0] || null

    // 2. 若已有成員記錄，優先沿用既有名稱與部門群組（若無則使用 Google 授權名稱）
    const effectiveName = existingMember?.member_name || userName
    const effectiveAdGroup = existingMember?.member_ad_group || 'Project Leads'

    // 3. Upsert public.users (記錄 Google 登入帳號與大頭貼)
    const userQuery = `
      INSERT INTO public.users (
        id, email, name, avatar_url, role, status, oauth_provider, oauth_provider_id, last_sign_in_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'active', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        oauth_provider = EXCLUDED.oauth_provider,
        oauth_provider_id = COALESCE(EXCLUDED.oauth_provider_id, public.users.oauth_provider_id),
        last_sign_in_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    const userRes = await client.query(userQuery, [
      userId,
      email.toLowerCase().trim(),
      effectiveName,
      avatar_url || null,
      role,
      oauth_provider,
      oauth_provider_id || userId
    ])

    const savedUser = userRes.rows[0]

    // 4. 自動繼承 / 確保 public.member 記錄存在，將 is_oauth_verified 標記為 true (1)
    const memberQuery = `
      INSERT INTO public.member (
        member_name, member_email, member_ad_group, member_status, is_oauth_verified, updated_at
      ) VALUES (
        $1, $2, $3, 'Active', true, CURRENT_TIMESTAMP
      )
      ON CONFLICT (member_email) DO UPDATE SET
        member_status = 'Active',
        is_oauth_verified = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING member_uid, member_name, member_email, member_ad_group, member_status, is_oauth_verified
    `
    const memberRes = await client.query(memberQuery, [
      effectiveName,
      email.toLowerCase().trim(),
      effectiveAdGroup
    ])
    const linkedMember = memberRes.rows[0]

    await client.query('COMMIT')

    res.status(200).json({
      user: savedUser,
      linkedMember: linkedMember,
      isPreProvisionedMatch: Boolean(existingMember)
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Failed to sync user:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

/**
 * GET /api/auth/me
 * Retrieve user profile by email or user ID
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  const { email, id } = req.query

  if (!email && !id) {
    return res.status(400).json({ error: 'Either email or id query param is required' })
  }

  try {
    const query = email 
      ? 'SELECT * FROM public.users WHERE email = $1'
      : 'SELECT * FROM public.users WHERE id = $1'
    const param = email ? String(email).toLowerCase().trim() : String(id)

    const { rows } = await pool.query(query, [param])
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(rows[0])
  } catch (err: any) {
    console.error('Failed to get user profile:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/auth/users
 * List all users in system
 */
authRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM public.users ORDER BY created_at DESC')
    res.json(rows)
  } catch (err: any) {
    console.error('Failed to list users:', err)
    res.status(500).json({ error: err.message })
  }
})
