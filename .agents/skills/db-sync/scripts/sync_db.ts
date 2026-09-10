import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  category: string;
}

function parseMarkdownQuestions(filePath: string): Question[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File ${filePath} not found.`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split('### Q:').slice(1);
  const questions: Question[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const questionText = lines[0].trim();

    const options: string[] = [];
    let correctAnswer = '';
    let explanation = '';
    let category = 'General';

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^- \[(x| )\] (.*)/);
      if (optMatch) {
        const optText = optMatch[2].trim();
        options.push(optText);
        if (optMatch[1] === 'x') {
          correctAnswer = optText;
        }
      }

      if (line.includes('**Explanation**:')) {
        explanation = line.replace('**Explanation**:', '').trim();
      }

      if (line.includes('**Category**:')) {
        category = line.replace('**Category**:', '').trim();
      }
    }

    questions.push({
      question: questionText,
      options,
      correct_answer: correctAnswer,
      explanation,
      category,
    });
  }

  return questions;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npx ts-node sync_db.ts <path_to_markdown_file> [env_mode]');
    return;
  }

  const filePath = args[0];
  const mode = args[1] || 'development';

  // 載入 .env 變數
  const envPaths = ['.env.local', `backend/.env.${mode}`, '.env', 'backend/.env'];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not defined in environment variables.');
    return;
  }

  console.log(`📡 Connecting to Neon PostgreSQL using @neondatabase/serverless...`);
  const sql = neon(databaseUrl);

  const questions = parseMarkdownQuestions(filePath);
  if (questions.length === 0) {
    console.log('No questions found to sync.');
    return;
  }

  console.log(`📝 Found ${questions.length} questions. Starting upsert into Neon DB...`);

  try {
    for (const q of questions) {
      await sql`
        INSERT INTO questions (question, options, correct_answer, explanation, category)
        VALUES (${q.question}, ${JSON.stringify(q.options)}, ${q.correct_answer}, ${q.explanation}, ${q.category})
        ON CONFLICT (question) DO UPDATE SET
          options = EXCLUDED.options,
          correct_answer = EXCLUDED.correct_answer,
          explanation = EXCLUDED.explanation,
          category = EXCLUDED.category;
      `;
    }
    console.log(`✅ Success! Synced ${questions.length} records to Neon PostgreSQL.`);
  } catch (error) {
    console.error('❌ Failed to sync:', error);
  }
}

main();
