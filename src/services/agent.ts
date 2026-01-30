import Anthropic from '@anthropic-ai/sdk'
import type { Project, AskResponse, Message } from '../types'
import { supabase } from '../lib/supabase'
import {
  toolDefinitions,
  readFile,
  listDirectory,
  searchFiles,
  grepContent
} from '../tools'
import { logAudit } from './audit'
import { getUserAccessLevel } from './team'

export type AskQuestionContext = {
  userId: string
  userEmail: string
  teamId: string
}

const client = new Anthropic()

// Base prompt shared by all access levels
const BASE_PROMPT = `You are a product expert helping users understand a software product by exploring its codebase.

## CRITICAL: No Hallucination Policy
- You MUST use tools to search and read files BEFORE answering any question about the codebase
- NEVER guess, assume, or make up function names, variable names, file names, or any code details
- If you cannot find something after searching, say "I searched but could not find this in the codebase"
- Only describe what you have ACTUALLY READ in the files - nothing more
- If asked about specific code (functions, classes, etc.), you MUST read the relevant file first

## Core Principles
1. **Verify before answering** - Always use tools to find and read relevant code before responding
2. **Speak the user's language** - Reply in the same language the user uses
3. **Be concise** - Keep answers focused and avoid unnecessary elaboration

## Response Guidelines
- Use plain language accessible to non-technical users
- Focus on user-facing features, workflows, and business logic
- When explaining processes, use ASCII diagrams:
  \`\`\`
  [Step A] --> [Step B] --> [Step C]
  \`\`\`
- Keep answers under 500 words unless the topic requires more detail

## When Information Is Unavailable
- If you searched but cannot find relevant information, clearly state: "I searched the codebase but could not find [X]"
- NEVER fabricate code, function names, or implementation details
- Suggest alternative searches or ask for clarification

## Out of Scope
For questions unrelated to this product, politely redirect: "I can only answer questions about this product."
`

// Full access (100%) - Developers
// Can see everything including technical details
const FULL_PROMPT = BASE_PROMPT + `
## Access Level: Full (Developer)
You have full access to describe technical details including:
- Function names, class names, and code structure
- API endpoints, database schemas, and data models
- Third-party libraries and frameworks used
- Technical implementation details

Be thorough and technical when answering developer questions.
`

// Internal access (60%) - Product/Operations
// Can see functionality but not technical implementation details
const INTERNAL_PROMPT = BASE_PROMPT + `
## Access Level: Internal (Product/Operations)
You can describe:
- General architecture and system concepts
- Data flows and how components interact
- Business logic and feature behavior
- What features exist and how they work

You CANNOT reveal:
- Names of third-party services, libraries, or frameworks
- API endpoints, database table names, field names, file paths
- Specific security or encryption implementations
- Hosting providers or infrastructure specifics

Use generic terms (database, server, API, frontend, backend) instead of product names.
Describe WHAT the product does, not HOW it's technically built.
`

// External access (30%) - End users / Customer support
// Customer service mode - helpful but protective of internal details
const EXTERNAL_PROMPT = BASE_PROMPT + `
## Access Level: External (Customer Support / End User)
You are acting as a helpful customer support agent. Your role is to help users understand how to USE the product, not how it's built.

You CAN answer questions about:
- How to use features
- What the product can and cannot do
- User workflows and processes
- General product capabilities

You CANNOT reveal or discuss:
- Any internal implementation details
- Technical architecture or code structure
- Pricing logic, discount rules, or business strategies
- Security measures or how to bypass limitations
- Internal policies or decision-making processes
- Any information that could be used to exploit or game the system
- "Why" questions about business decisions or technical choices

If asked about internal details, respond with: "I can help you with how to use the product. Is there something specific you'd like to know how to do?"

Be friendly, helpful, and focused on the user's practical needs. If you're unsure whether something should be shared, err on the side of caution.
`

function getSystemPrompt(accessLevel: number): string {
  if (accessLevel >= 100) return FULL_PROMPT
  if (accessLevel >= 60) return INTERNAL_PROMPT
  return EXTERNAL_PROMPT
}

export async function getConversationHistory(projectId: string, userId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select()
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load conversation history:', error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    filesRead: row.files_read || [],
    timestamp: new Date(row.created_at)
  }))
}

export async function clearConversation(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to clear conversation: ${error.message}`)
  }
}

export async function askQuestion(
  project: Project,
  question: string,
  context: AskQuestionContext
): Promise<AskResponse> {
  const { userId, userEmail, teamId } = context
  const filesRead: string[] = []

  // Get user's access level for this team
  const accessLevel = await getUserAccessLevel(teamId, userId)
  const systemPrompt = getSystemPrompt(accessLevel)

  // Load conversation history from database
  const history = await getConversationHistory(project.id, userId)

  // Build messages array from conversation history
  const apiMessages: Anthropic.MessageParam[] = []

  // Add conversation history
  for (const msg of history) {
    apiMessages.push({ role: 'user', content: msg.question })
    apiMessages.push({ role: 'assistant', content: msg.answer })
  }

  // Add current question
  const currentQuestion = history.length === 0
    ? `Project: ${project.name}\n\nQuestion: ${question}`
    : question

  apiMessages.push({ role: 'user', content: currentQuestion })

  let response = await client.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    system: systemPrompt,
    tools: toolDefinitions,
    messages: apiMessages
  })

  // Agentic loop - keep processing until we get a final answer
  while (response.stop_reason === 'tool_use') {
    const assistantMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: response.content
    }
    apiMessages.push(assistantMessage)

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(
          project.workspacePath,
          block.name,
          block.input as Record<string, string>,
          filesRead
        )

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result
        })
      }
    }

    apiMessages.push({
      role: 'user',
      content: toolResults
    })

    response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDefinitions,
      messages: apiMessages
    })
  }

  // Extract final text response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )
  const answer = textBlocks.map(b => b.text).join('\n')

  // Save to database
  const uniqueFilesRead = [...new Set(filesRead)]
  const { data: insertedConversation, error } = await supabase
    .from('conversations')
    .insert({
      project_id: project.id,
      user_id: userId,
      question,
      answer,
      files_read: uniqueFilesRead
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save conversation:', error)
  }

  // Log audit entry
  await logAudit({
    teamId,
    userId,
    userEmail,
    action: 'ask_question',
    resourceType: 'conversation',
    resourceId: insertedConversation?.id,
    metadata: {
      project_name: project.name,
      question,
      files_read_count: uniqueFilesRead.length
    }
  })

  // Generate follow-up suggestions
  const followUpSuggestions = await generateFollowUpSuggestions(project.name, question, answer)

  return {
    id: insertedConversation?.id,
    answer,
    filesRead: uniqueFilesRead,
    conversationLength: history.length + 1,
    followUpSuggestions
  }
}

async function generateFollowUpSuggestions(
  projectName: string,
  question: string,
  answer: string
): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Based on this Q&A about "${projectName}", suggest 3 short follow-up questions (under 40 chars each) the user might ask next.

Question: ${question}
Answer: ${answer.slice(0, 500)}...

Return ONLY a JSON array of 3 strings. Example: ["How do users log in?", "What data is stored?", "How are errors handled?"]`
        }
      ]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3)
    }
  } catch (err) {
    console.error('Failed to generate follow-up suggestions:', err)
  }
  return []
}

async function executeTool(
  workspacePath: string,
  toolName: string,
  input: Record<string, string>,
  filesRead: string[]
): Promise<string> {
  try {
    switch (toolName) {
      case 'read_file': {
        const filePath = input.file_path
        filesRead.push(filePath)
        const content = await readFile(workspacePath, filePath)
        return content
      }

      case 'list_directory': {
        const entries = await listDirectory(workspacePath, input.path)
        return entries.length > 0
          ? entries.join('\n')
          : '[Empty directory or not found]'
      }

      case 'search_files': {
        const files = await searchFiles(workspacePath, input.pattern)
        return files.length > 0
          ? `Found ${files.length} files:\n${files.join('\n')}`
          : '[No files found matching pattern]'
      }

      case 'grep': {
        const results = await grepContent(
          workspacePath,
          input.search_term,
          input.file_pattern
        )
        if (results.length === 0) {
          return '[No matches found]'
        }
        return results
          .map(r => `${r.file}:${r.line}: ${r.content}`)
          .join('\n')
      }

      default:
        return `[Unknown tool: ${toolName}]`
    }
  } catch (error) {
    return `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
  }
}
