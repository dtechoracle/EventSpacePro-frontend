/**
 * EventSpacePro AI Operator — Server-Side Endpoint
 *
 * Implements the tool-calling loop:
 * 1. User message → DeepSeek (with tools)
 * 2. DeepSeek returns tool_calls → send to client
 * 3. Client executes tools → sends results back
 * 4. DeepSeek with tool results → next response
 * 5. Repeat until DeepSeek returns text only (or max iterations)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { OPERATOR_SYSTEM_PROMPT } from '@/lib/aiTools';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_AGENT_STEPS = 15;

type IncomingMessage = { role: 'user' | 'assistant' | 'tool'; content?: string; tool_calls?: any[]; tool_call_id?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  try {
    const { messages, tools, step = 0 } = req.body as {
      messages: IncomingMessage[];
      tools: any[];
      step?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Build the request for DeepSeek
    const apiMessages: any[] = [
      { role: 'system', content: OPERATOR_SYSTEM_PROMPT },
      ...messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return { role: 'assistant', content: m.content || '', tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const requestBody: any = {
      model: 'deepseek-chat',
      messages: apiMessages,
      temperature: 0.1,
      max_tokens: 4096,
    };

    // Only include tools if there are any and if we haven't exceeded max steps
    if (tools && tools.length > 0 && step < MAX_AGENT_STEPS) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI-Operator] DeepSeek error:', response.status, errText);
      return res.status(response.status).json({ error: `DeepSeek API error: ${response.status}` });
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return res.status(500).json({ error: 'No response from DeepSeek' });
    }

    const message = choice.message;

    // If the message has tool_calls, return them to the client
    if (message.tool_calls && message.tool_calls.length > 0) {
      return res.status(200).json({
        type: 'tool_calls',
        tool_calls: message.tool_calls,
        content: message.content || '',
        step: step + 1,
        max_steps: MAX_AGENT_STEPS,
      });
    }

    // Otherwise, return the text response
    return res.status(200).json({
      type: 'text',
      content: message.content || '',
      step: step + 1,
    });
  } catch (error: any) {
    console.error('[AI-Operator] Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
