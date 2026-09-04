export const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export class AiUpstreamError extends Error {}
export class AiInvalidResponseError extends Error {}

type GeminiStep = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type GeminiInteraction = {
  status?: string;
  steps?: GeminiStep[];
};

function extractOutputText(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const interaction = value as GeminiInteraction;
  if (interaction.status && interaction.status !== 'completed') return null;
  const steps = Array.isArray(interaction.steps) ? interaction.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (let j = step.content.length - 1; j >= 0; j -= 1) {
      const content = step.content[j];
      if (content?.type === 'text' && typeof content.text === 'string' && content.text.trim()) return content.text;
    }
  }
  return null;
}

export async function callGeminiStructured(
  apiKey: string,
  input: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        store: false,
        input,
        generation_config: { temperature: 0.2, max_output_tokens: 700 },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema,
        },
      }),
    });
  } catch {
    throw new AiUpstreamError('gemini_request_failed');
  }

  if (!response.ok) throw new AiUpstreamError('gemini_request_failed');
  const body = await response.json().catch(() => null);
  const text = extractOutputText(body);
  if (!text) throw new AiInvalidResponseError('gemini_output_missing');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiInvalidResponseError('gemini_output_invalid_json');
  }
}
