import { query } from '../config/database';
import { ToolProposal } from '../types';

/**
 * Full Prompt for the Router Agent and 3 Specialized Brains (Sprint 3)
 */
const getRouterSystemPrompt = (
  existingTasks: any[],
  existingMeetings: any[],
  existingCharters: any[],
  existingRequirements: any[],
  existingPlans: any[],
  existingKnowledge: any[],
  existingBottlenecks: any[]
) => {
  return `你是一個企業級專案管理主控路由 Agent (The Router Agent)。
你需要判斷用戶的輸入意圖，並將任務分發給對應的專職大腦：

1. 【Baseline Agent (規劃大腦)】：
   - 職責：負責專案章程 (Charter)、需求基準 (Requirements)、以及里程碑與 RACI (Project Plans) 的生成與更新。
   - 觸發時機：用戶提及 "章程"、"Charter"、"專案目標"、"需求"、"Requirement"、"優先級"、"里程碑"、"RACI"、"WBS"、"分工"。
   - 可用提案類型 (type)：
     - "upsert_charter" (targetType: "charter")：更新或建立章程。after 包含 project_id, title, goals, scope, out_of_scope, w5h2 (who, why, how, what, when, where, how_much)。
     - "create_requirement" (targetType: "requirement")：建立需求。after 包含 project_id, title, description, category, priority, status, remarks_entry。
     - "update_requirement" (targetType: "requirement")：修改需求。需要 targetId 與 after。
     - "upsert_project_plan" (targetType: "plan")：新增或更新 WBS 里程碑計畫。after 包含 project_id, title, description, milestone_date, r_assignees (TEXT[]), a_assignees (TEXT[]), c_assignees (TEXT[]), i_assignees (TEXT[])。

2. 【Execution Agent (執行大腦)】：
   - 職責：聽取會議記錄、更新前線 Tasks / Meetings、連結 Traceability、登錄專案 Risks/Bottlenecks。
   - 觸發時機：討論任務進度、更改負責人、分析會議流水、將需求對接任務、回報阻礙或卡點。
   - 可用提案類型 (type)：
     - "create_new_log" (targetType: "task" 或 "meeting")
     - "update_existing_log" (targetType: "task" 或 "meeting")
     - "create_traceability_link" (targetType: "traceability")：連結需求與任務。after 包含 project_id, requirement_id, task_id。
     - "create_bottleneck" (targetType: "bottleneck")：登錄專案瓶頸。after 包含 project_id, title, description, severity ('High' | 'Medium' | 'Low')。

3. 【Knowledge Agent (知識大腦)】：
   - 職責：透過學習工具將新專案行話 (Jargon)、計算口徑、業務知識寫入知識庫。
   - 觸發時機：提及 "術語"、"定義"、"行話"、"計算公式"、"Jargon"、"KPI公式"。
   - 可用提案類型 (type)：
     - "learn_project_knowledge" (targetType: "knowledge")：學習知識。after 包含 product_id, term, definition, kpi_formula, remarks_entry。
     - 【死命令（防重複記憶）】：如果用戶要求學習的名詞在以下現有知識庫中已經存在該 term，你必須直接在 "reason" 指出該名詞已存在，且**不得**回傳新增提案 (type: learn_project_knowledge)，以免造成主鍵衝突。如果定義有變，可以改為返回修改提案（此時 type 為 update_knowledge 或是拒絕提案）。

---
現有 Tasks 資料：
${JSON.stringify(existingTasks, null, 2)}

現有 Meetings 資料：
${JSON.stringify(existingMeetings, null, 2)}

現有 Charters 資料：
${JSON.stringify(existingCharters, null, 2)}

現有 Requirements 資料：
${JSON.stringify(existingRequirements, null, 2)}

現有 WBS Plans & RACI 資料：
${JSON.stringify(existingPlans, null, 2)}

現有 Knowledge 知識庫資料：
${JSON.stringify(existingKnowledge, null, 2)}

現有 Bottlenecks 瓶頸資料：
${JSON.stringify(existingBottlenecks, null, 2)}

---
全域鐵律：
所有 Markdown (會議記錄 content 必須是 5 欄表格) 或 JSONB 更新必須採用「Remarks 接龍流水帳 (Remarks Append-only)」機制，在 "remarks_entry" 必須填寫合理的變更備註。

請以合法的 JSON 陣列格式回傳。不要有任何 markdown 標籤（除非是 JSON 本身）。`;
};

/**
 * Smart mock fallback router for Sprint 3
 */
const mockFallbackRouter = (
  text: string,
  existingTasks: any[],
  existingRequirements: any[],
  existingKnowledge: any[]
): ToolProposal[] => {
  const proposals: ToolProposal[] = [];
  const lowerText = text.toLowerCase();

  // 1. Knowledge Agent Route Cues
  if (lowerText.includes('定義') || lowerText.includes('術語') || lowerText.includes('行話') || lowerText.includes('jargon') || lowerText.includes('kpi')) {
    const termMatch = text.match(/(?:定義|名詞|術語|行話)[:：]?\s*([a-zA-Z\u4e00-\u9fa5]+)/);
    const term = termMatch ? termMatch[1].trim() : 'BAU';
    
    // Check for duplicate memory rule
    const duplicate = existingKnowledge.find(k => k.term.toLowerCase() === term.toLowerCase());
    
    if (duplicate) {
      // Return a message that it's duplicate, no proposal generated
      console.warn(`Memory check: Term "${term}" already exists.`);
    } else {
      proposals.push({
        id: `proposal-mock-knowledge-${Date.now()}`,
        type: 'learn_project_knowledge',
        targetType: 'knowledge',
        after: {
          product_id: '11111111-1111-1111-1111-111111111111',
          term,
          definition: text.includes('意思') ? text.split('意思').pop()?.trim() || '業務定義說明' : 'Business As Usual 常規維運項目。',
          kpi_formula: '無特定KPI公式',
          remarks_entry: `知識大腦學習新術語: ${term}`
        },
        reason: `知識大腦檢測到未曾記錄過的專案術語「${term}」，提議記錄到業務字典。`
      });
    }
  }

  // 2. Project Plans / RACI Cues
  if (lowerText.includes('里程碑') || lowerText.includes('raci') || lowerText.includes('wbs') || lowerText.includes('里程')) {
    proposals.push({
      id: `proposal-mock-plan-${Date.now()}`,
      type: 'upsert_project_plan',
      targetType: 'plan',
      after: {
        project_id: '22222222-2222-2222-2222-222222222222',
        title: '里程碑 WBS 2: 系統正式上線',
        description: '發布 1.0 正式版本，支援 Vercel 與 Railway 的 B2B 雲端部署。',
        milestone_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        r_assignees: ['Antigravity'],
        a_assignees: ['Edmond'],
        c_assignees: ['PMO'],
        i_assignees: ['BA', 'IT'],
        remarks_entry: 'AI 規劃大腦草擬里程碑分工'
      },
      reason: '用戶詢問或討論專案進度，Baseline Agent 提議新建上線里程碑計畫及 RACI 權責。'
    });
  }

  // 3. Traceability matrix Cues
  if (lowerText.includes('對接') || lowerText.includes('link') || lowerText.includes('trace') || lowerText.includes('對照')) {
    if (existingRequirements.length > 0 && existingTasks.length > 0) {
      const req = existingRequirements[0];
      const task = existingTasks[0];
      proposals.push({
        id: `proposal-mock-trace-${Date.now()}`,
        type: 'create_requirement', // actually link_requirement_task in DB routing
        targetType: 'requirement', // represented as matrix link
        after: {
          project_id: '22222222-2222-2222-2222-222222222222',
          requirement_id: req.id,
          task_id: task.id,
          remarks_entry: '建立需求與工單之追蹤矩陣對接'
        },
        reason: `用戶要求連結需求基準與後續開發任務，提議在對照矩陣中綁定「${req.title}」與「${task.title}」。`
      });
    }
  }

  // 4. Bottlenecks / Risks Cues
  if (lowerText.includes('樽頸') || lowerText.includes('瓶頸') || lowerText.includes('風險') || lowerText.includes('block') || lowerText.includes('risk')) {
    proposals.push({
      id: `proposal-mock-bottleneck-${Date.now()}`,
      type: 'create_bottleneck',
      targetType: 'bottleneck',
      after: {
        project_id: '22222222-2222-2222-2222-222222222222',
        title: 'Neon 連線池連接限制問題',
        description: 'Serverless Neon Postgres 最大連線池容量偏小，可能引發並行存取請求超時風險。',
        severity: 'High',
        remarks_entry: '執行大腦登錄系統瓶頸風險'
      },
      reason: '會議或對話中提及效能或阻礙限制，執行大腦提議登錄一項 High 級別專案瓶頸。'
    });
  }

  // Fallback default tasks if queue is empty
  if (proposals.length === 0) {
    // Return standard dummy tasks to show HITL is alive
    proposals.push({
      id: 'proposal-demo-k-1',
      type: 'learn_project_knowledge',
      targetType: 'knowledge',
      after: {
        product_id: '11111111-1111-1111-1111-111111111111',
        term: 'BAU',
        definition: 'Business As Usual，指專案結束後，系統轉化為例行日常運營的維運模式。',
        kpi_formula: 'BAU工單處理率 = (已解決工單數 / 接收工單總數) * 100%',
        remarks_entry: 'AI 知識大腦起草術語'
      },
      reason: 'AI 偵測到有術語「BAU」需要建立知識字典存檔。'
    });

    proposals.push({
      id: 'proposal-demo-plan-1',
      type: 'upsert_project_plan',
      targetType: 'plan',
      after: {
        project_id: '22222222-2222-2222-2222-222222222222',
        title: '里程碑 WBS 2: 系統正式上線',
        description: '發布 1.0 正式版本，支援 Vercel 與 Railway 的 B2B 雲端部署。',
        milestone_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        r_assignees: ['Antigravity'],
        a_assignees: ['Edmond'],
        c_assignees: ['PMO'],
        i_assignees: ['BA', 'IT'],
        remarks_entry: '起草上線里程碑計畫'
      },
      reason: 'AI 規劃大腦建議為專案建立第二階段上線里程碑。'
    });
  }

  return proposals;
};

/**
 * Main parser calling Gemini API or falling back
 */
export const parseTranscript = async (transcript: string): Promise<ToolProposal[]> => {
  // 1. Fetch contexts across all 7 views
  const tasksRes = await query('SELECT id, title, description, status, nature, assignees FROM tasks');
  const meetingsRes = await query('SELECT id, title, summary, content FROM meetings');
  const chartersRes = await query('SELECT id, title, content FROM charters');
  const requirementsRes = await query('SELECT id, title, description, category, priority, status FROM requirement_logs');
  const plansRes = await query('SELECT id, title, description, milestone_date, r_assignees, a_assignees, c_assignees, i_assignees FROM project_plans');
  const knowledgeRes = await query('SELECT id, term, definition, kpi_formula FROM knowledge_notes');
  const bottlenecksRes = await query('SELECT id, title, description, severity, status FROM bottlenecks');
  
  const existingTasks = tasksRes.rows;
  const existingMeetings = meetingsRes.rows;
  const existingCharters = chartersRes.rows;
  const existingRequirements = requirementsRes.rows;
  const existingPlans = plansRes.rows;
  const existingKnowledge = knowledgeRes.rows;
  const existingBottlenecks = bottlenecksRes.rows;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('GEMINI_API_KEY is not configured. Falling back to local mock router.');
    return mockFallbackRouter(transcript, existingTasks, existingRequirements, existingKnowledge);
  }

  try {
    const systemPrompt = getRouterSystemPrompt(
      existingTasks,
      existingMeetings,
      existingCharters,
      existingRequirements,
      existingPlans,
      existingKnowledge,
      existingBottlenecks
    );
    
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n以下是會議紀錄或對話內容，請產生變更提案：\n\n${transcript}` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}: ${await response.text()}`);
    }

    const jsonResponse: any = await response.json();
    const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    const proposals: ToolProposal[] = JSON.parse(rawText.trim());

    return proposals.map((p, idx) => ({
      ...p,
      id: p.id || `proposal-${Date.now()}-${idx}`
    }));

  } catch (error) {
    console.error('Failed to parse transcript using Gemini API:', error);
    console.warn('Falling back to local mock router.');
    return mockFallbackRouter(transcript, existingTasks, existingRequirements, existingKnowledge);
  }
};
