import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const sourceRouter = Router()

// GET /api/sources - 獲取專案或 Workspace 下的知識文件清單 (支援 Scope 過濾與專案關聯)
sourceRouter.get('/', async (req: Request, res: Response) => {
  const { workspace_uid, project_uid, scope = 'all' } = req.query

  if (!workspace_uid) {
    return res.status(400).json({ error: 'workspace_uid is required' })
  }

  try {
    let query = `
      SELECT 
        s.source_uid,
        s.workspace_uid,
        s.project_uid,
        s.file_name,
        s.file_size,
        s.file_type,
        s.r2_url,
        s.page_count,
        s.status,
        s.error_message,
        s.is_active,
        s.created_at,
        s.updated_at,
        p.project_name,
        p.project_display_code as project_code,
        (SELECT COUNT(*) FROM public.okf_chunks c WHERE c.source_uid = s.source_uid) as chunk_count
      FROM public.okf_sources s
      LEFT JOIN public.project p ON s.project_uid = p.project_uid
      WHERE s.workspace_uid = $1
    `
    const params: any[] = [workspace_uid]

    if (scope === 'global') {
      query += ` AND s.project_uid IS NULL`
    } else if (scope === 'project' && project_uid) {
      params.push(project_uid)
      query += ` AND s.project_uid = $${params.length}`
    } else if (project_uid) {
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

// GET /api/sources/:uid - 獲取單一知識文件詳情與切片清單 (供閱讀預覽)
sourceRouter.get('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params

  try {
    const sourceRes = await pool.query(`
      SELECT 
        s.*,
        p.project_name,
        p.project_display_code as project_code
      FROM public.okf_sources s
      LEFT JOIN public.project p ON s.project_uid = p.project_uid
      WHERE s.source_uid = $1
    `, [uid])

    if (sourceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' })
    }

    const source = sourceRes.rows[0]

    const chunksRes = await pool.query(`
      SELECT 
        chunk_uid,
        page_number,
        chunk_index,
        chunk_content,
        metadata,
        created_at
      FROM public.okf_chunks
      WHERE source_uid = $1
      ORDER BY chunk_index ASC
    `, [uid])

    res.json({
      ...source,
      chunks: chunksRes.rows
    })
  } catch (err: any) {
    console.error('Fetch source detail error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sources - 建立或登記新知識文件 (上傳元數據 + 寫入文字 + 觸發解析切片)
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
        content_text,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'indexed')
      RETURNING *
    `
    const sourceRes = await pool.query(insertQuery, [
      workspace_uid,
      project_uid || null,
      file_name,
      file_size,
      file_type,
      r2_url,
      page_count,
      content_text || null
    ])

    const createdSource = sourceRes.rows[0]

    // 若有內文，做段落切片 (Chunking) 寫入 okf_chunks
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

// PATCH /api/sources/:uid - 更新知識文件屬性 (啟用/停用開關、變更所屬專案 Scope)
sourceRouter.patch('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { is_active, project_uid } = req.body

  try {
    let updateFields: string[] = ['updated_at = CURRENT_TIMESTAMP']
    let params: any[] = [uid]

    if (is_active !== undefined) {
      params.push(is_active)
      updateFields.push(`is_active = $${params.length}`)
    }

    if (project_uid !== undefined) {
      params.push(project_uid || null)
      updateFields.push(`project_uid = $${params.length}`)
    }

    const result = await pool.query(`
      UPDATE public.okf_sources
      SET ${updateFields.join(', ')}
      WHERE source_uid = $1
      RETURNING *
    `, params)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' })
    }

    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update source error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/sources/:uid - 刪除知識來源 (觸發 ON DELETE CASCADE 自動清空向量分塊)
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
