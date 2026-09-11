import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const sourceRouter = Router()

// GET /api/sources - 獲取專案或 Workspace 下的知識文件清單
sourceRouter.get('/', async (req: Request, res: Response) => {
  const { workspace_uid, project_uid } = req.query

  if (!workspace_uid) {
    return res.status(400).json({ error: 'workspace_uid is required' })
  }

  try {
    let query = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM public.okf_chunks c WHERE c.source_uid = s.source_uid) as chunk_count
      FROM public.okf_sources s
      WHERE s.workspace_uid = $1
    `
    const params: any[] = [workspace_uid]

    if (project_uid) {
      params.push(project_uid)
      query += ` AND (s.project_uid = $${params.length} OR s.project_uid IS NULL)`
    }

    query += ` ORDER BY s.created_at DESC`

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch sources error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sources - 建立或登記新知識文件 (上傳元數據 + 觸發解析)
sourceRouter.post('/', async (req: Request, res: Response) => {
  const {
    workspace_uid,
    project_uid,
    file_name,
    file_size = 0,
    file_type = 'pdf',
    r2_url = '',
    page_count = 1,
    content_text = '' // 支援直接上傳或前端傳入文字
  } = req.body

  if (!workspace_uid || !file_name) {
    return res.status(400).json({ error: 'workspace_uid and file_name are required' })
  }

  try {
    const insertQuery = `
      INSERT INTO public.okf_sources (
        workspace_uid,
        project_uid,
        file_name,
        file_size,
        file_type,
        r2_url,
        page_count,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'indexed')
      RETURNING *
    `
    const sourceRes = await pool.query(insertQuery, [
      workspace_uid,
      project_uid || null,
      file_name,
      file_size,
      file_type,
      r2_url,
      page_count
    ])

    const createdSource = sourceRes.rows[0]

    // 若有內文，做輕量段落切片 (Chunking)
    if (content_text && typeof content_text === 'string' && content_text.trim().length > 0) {
      const paragraphs = content_text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0)
      for (let i = 0; i < paragraphs.length; i++) {
        await pool.query(`
          INSERT INTO public.okf_chunks (
            source_uid,
            workspace_uid,
            project_uid,
            page_number,
            chunk_index,
            chunk_content,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          createdSource.source_uid,
          workspace_uid,
          project_uid || null,
          Math.floor(i / 3) + 1,
          i,
          paragraphs[i].trim(),
          JSON.stringify({ file_name, chunk_index: i })
        ])
      }
    }

    res.status(201).json(createdSource)
  } catch (err: any) {
    console.error('Create source error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/sources/:uid - 切換來源啟用狀態 (is_active toggle)
sourceRouter.patch('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { is_active } = req.body

  try {
    const result = await pool.query(`
      UPDATE public.okf_sources
      SET is_active = COALESCE($1, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE source_uid = $2
      RETURNING *
    `, [is_active, uid])

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Source not found' })
    }

    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update source error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/sources/:uid - 刪除知識來源 (觸發 ON DELETE CASCADE 自動清空向量)
sourceRouter.delete('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params

  try {
    const result = await pool.query(`
      DELETE FROM public.okf_sources
      WHERE source_uid = $1
      RETURNING source_uid, file_name
    `, [uid])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' })
    }

    res.json({ message: 'Source deleted successfully', deleted: result.rows[0] })
  } catch (err: any) {
    console.error('Delete source error:', err)
    res.status(500).json({ error: err.message })
  }
})
