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
  const explicitMeetingMatch = normalizedContent.match(/(?:^|[\r\n])[-*•]?\s*(?:\*{0,2}(?:會議主題|會議名稱|會議標題|主題|Meeting)\*{0,2})[：:]\s*([^\n\r]+)/im)
  const headerMatch = normalizedContent.match(/^#\s*(.*?)$/m)
  if (explicitMeetingMatch && explicitMeetingMatch[1].trim()) {
    meetingTitle = explicitMeetingMatch[1].replace(/[*`#]/g, '').trim()
  } else if (headerMatch && headerMatch[1].trim()) {
    meetingTitle = headerMatch[1].replace(/[*`#]/g, '').trim()
  }

  // 2. 提取會議日期 (支援 **會議日期**：2026-09-13 或 - Date: 2026-09-08 等格式)
  let meetingDate: string | undefined
  const dateMatch = normalizedContent.match(/(?:\*{0,2}(?:會議日期|日期|Date|時間|Time)\*{0,2})[：:]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i)
  if (dateMatch) {
    meetingDate = dateMatch[1].replace(/[./]/g, '-')
  }

  // 3. 提取出席者/與會人員 (支援單行逗號分隔與多行清單)
  let attendees: string[] = []
  const attendeesSectionMatch = normalizedContent.match(/(?:\*{0,2}(?:出席成員|出席人員|與會人員|出席者|Attendees|Participants)\*{0,2})[：:]\s*([\s\S]*?)(?=\n\s*(?:---|###|##|#|\*\*[^\*]+\*\*|$))/i)
  if (attendeesSectionMatch && attendeesSectionMatch[1]) {
    const rawAttendeesBlock = attendeesSectionMatch[1].trim()
    const attendeeLines = rawAttendeesBlock.split('\n')
    for (const aLine of attendeeLines) {
      const cleanLine = aLine.replace(/^[-*•\d.]+\s*/, '').trim()
      if (!cleanLine) continue
      // 支援逗號或分號分隔之單行成員名單 (如 "Edmond, Kevin, Sarah, David")
      const rawTokens = cleanLine.includes(',') || cleanLine.includes('，') || cleanLine.includes(';') || cleanLine.includes('；')
        ? cleanLine.split(/[,，;；]/)
        : [cleanLine]

      for (const tok of rawTokens) {
        const cleanTok = tok.replace(/^[-*•\d.]+\s*/, '').trim()
        if (!cleanTok) continue
        const nameMatch = cleanTok.match(/^([A-Za-z0-9\u4e00-\u9fa5\s]+?)(?:\s*[\(（]|$)/)
        if (nameMatch && nameMatch[1].trim()) {
          const name = nameMatch[1].trim()
          if (name && !attendees.includes(name)) {
            attendees.push(name)
          }
        }
      }
    }
  }

  // 4. 提取會議目標 / 摘要 (Meeting Objective / Summary)
  let meetingObjective: string | undefined
  const objSectionMatch = normalizedContent.match(/(?:##\s*Meeting Objective|###?\s*會議目標|###?\s*Objective)[\s\S]*?\n\n([\s\S]*?)(?=\n\s*(?:---|###|##|#|$))/i)
  if (objSectionMatch && objSectionMatch[1]) {
    meetingObjective = objSectionMatch[1].trim()
  } else {
    const objBulletMatch = normalizedContent.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:會議目標|Meeting Objective|主題目標)(?:\*\*)?[：:]\s*([^\n\r]+)/i)
    if (objBulletMatch && objBulletMatch[1]) {
      meetingObjective = objBulletMatch[1].trim()
    }
  }

  return {
    documentId: documentId || `DOC-${documentHash.substring(0, 8).toUpperCase()}`,
    documentName: filename || meetingTitle,
    documentHash,
    meetingTitle,
    meetingDate,
    meetingObjective,
    attendees,
    normalizedContent,
    summary: meetingObjective
  }
}
