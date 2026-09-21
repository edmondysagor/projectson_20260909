import crypto from 'crypto'
import { DocumentMetadata } from './types.js'

/**
 * 正規化文件純文字內容（統一換行、去除行尾空白、收斂空白行）
 */
export function normalizeDocumentText(rawText: string): string {
  if (!rawText) return ''
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 計算標準 SHA-256 內容雜湊
 */
export function computeDocumentHash(text: string): string {
  const normalized = normalizeDocumentText(text)
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * 提取文件/會議紀錄之核心元數據 (Title, Date, Attendees, Hash)
 */
export function extractDocumentMetadata(text: string, filename?: string, documentId?: string): DocumentMetadata {
  const normalizedContent = normalizeDocumentText(text)
  const documentHash = computeDocumentHash(normalizedContent)

  // 1. 提取會議標題
  let meetingTitle = filename ? filename.replace(/\.[^/.]+$/, '') : '會議記錄'
  const titleMatch = normalizedContent.match(/(?:\*{0,2}(?:會議主題|會議名稱|會議標題|主題)\*{0,2})[：:]\s*([^\n\r]+)/i) ||
                     normalizedContent.match(/^#\s*(.*?)$/m)
  if (titleMatch && titleMatch[1].trim()) {
    meetingTitle = titleMatch[1].replace(/[*`#]/g, '').trim()
  }

  // 2. 提取會議日期 (支援 **會議日期**：2026-09-13 等格式)
  let meetingDate: string | undefined
  const dateMatch = normalizedContent.match(/(?:\*{0,2}(?:會議日期|日期|Date|時間|Time)\*{0,2})[：:]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i)
  if (dateMatch) {
    meetingDate = dateMatch[1].replace(/[./]/g, '-')
  }

  // 3. 提取出席者/與會人員 (支援單行與多行清單)
  let attendees: string[] = []
  const attendeesSectionMatch = normalizedContent.match(/(?:\*{0,2}(?:出席成員|出席人員|與會人員|出席者|Attendees|Participants)\*{0,2})[：:]\s*([\s\S]*?)(?=\n\s*(?:---|###|#|\*\*[^\*]+\*\*|$))/i)
  if (attendeesSectionMatch && attendeesSectionMatch[1]) {
    const rawAttendeesBlock = attendeesSectionMatch[1].trim()
    const attendeeLines = rawAttendeesBlock.split('\n')
    for (const aLine of attendeeLines) {
      const cleanLine = aLine.replace(/^[-*•\d.]+\s*/, '').trim()
      if (!cleanLine) continue
      // 提取姓名（如 "Kevin Lau (Senior Backend...)" ➔ "Kevin Lau"）
      const nameMatch = cleanLine.match(/^([A-Za-z0-9\u4e00-\u9fa5\s]+?)(?:\s*[\(（]|$)/)
      if (nameMatch && nameMatch[1].trim()) {
        const name = nameMatch[1].trim()
        if (name && !attendees.includes(name)) {
          attendees.push(name)
        }
      }
    }
  }

  return {
    documentId: documentId || `DOC-${documentHash.substring(0, 8).toUpperCase()}`,
    documentName: filename || meetingTitle,
    documentHash,
    meetingTitle,
    meetingDate,
    attendees,
    normalizedContent
  }
}
