import { z } from 'zod';
import { getConfig } from './config';

export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 502,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
export interface AIProvider {
  generate<T>(
    name: string,
    schema: z.ZodType<T>,
    instructions: string,
    content: unknown,
    signal?: AbortSignal,
    images?: readonly string[],
  ): Promise<T>;
}
export function mapProviderError(status: number): ServiceError {
  if (status === 429)
    return new ServiceError(
      'RATE_LIMIT',
      'The AI provider is busy or its quota is exhausted. Wait a moment, then retry; your work is preserved.',
      429,
    );
  if (status === 401 || status === 403)
    return new ServiceError(
      'PROVIDER_AUTH',
      'The analysis server could not authenticate with the AI provider. Ask the app owner to check its API key and permissions.',
      503,
    );
  if (status === 404)
    return new ServiceError(
      'MODEL_UNAVAILABLE',
      'The configured model is unavailable. Ask the app owner to check OPENAI_MODEL and model access.',
      503,
    );
  if (status === 400)
    return new ServiceError(
      'PROVIDER_REQUEST',
      'The configured model did not accept the structured analysis request. Check model compatibility in the server setup.',
      502,
    );
  return new ServiceError(
    'PROVIDER_UNAVAILABLE',
    'The AI provider is temporarily unavailable. Please retry; your text and prepared rubric are preserved.',
    502,
  );
}
export class OpenAIProvider implements AIProvider {
  constructor(
    private config = getConfig(),
    private fetcher: typeof fetch = fetch,
  ) {}
  async generate<T>(
    name: string,
    schema: z.ZodType<T>,
    instructions: string,
    content: unknown,
    signal?: AbortSignal,
    images: readonly string[] = [],
  ): Promise<T> {
    if (!this.config.apiKey)
      throw new ServiceError(
        'SETUP_REQUIRED',
        'Set OPENAI_API_KEY on the server to analyze your own answer. The fixed demonstration is available without a key.',
        503,
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) controller.abort();
    try {
      const jsonSchema = z.toJSONSchema(schema);
      delete jsonSchema.$schema;
      const response = await this.fetcher(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            store: false,
            instructions,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: JSON.stringify(content) },
                  ...images.map((image_url) => ({
                    type: 'input_image',
                    image_url,
                    detail: 'high',
                  })),
                ],
              },
            ],
            text: {
              format: {
                type: 'json_schema',
                name,
                strict: true,
                schema: jsonSchema,
              },
            },
            max_output_tokens: 16000,
          }),
        },
      );
      if (!response.ok) throw mapProviderError(response.status);
      const data = (await response.json()) as {
        status?: string;
        output?: Array<{
          type: string;
          content?: Array<{ type: string; text?: string }>;
        }>;
      };
      if (data.status === 'incomplete')
        throw new ServiceError(
          'INCOMPLETE_RESPONSE',
          'The model ran out of response space before finishing. No partial score was published. Please retry or use a shorter question.',
          502,
        );
      if (data.status !== 'completed')
        throw new ServiceError(
          'INCOMPLETE_RESPONSE',
          'The model did not finish the assessment. No partial score was published. Please retry.',
          502,
        );
      const parts =
        data.output
          ?.filter((x) => x.type === 'message')
          .flatMap((x) => x.content || []) || [];
      if (parts.some((x) => x.type === 'refusal'))
        throw new ServiceError(
          'MODEL_REFUSAL',
          'The AI provider declined this request. Review the supplied question and rubric, then try again.',
          422,
        );
      const output = parts
        .filter((x) => x.type === 'output_text')
        .map((x) => x.text || '')
        .join('');
      if (!output)
        throw new ServiceError(
          'EMPTY_RESPONSE',
          'The AI provider returned an empty assessment. Please retry.',
          502,
        );
      try {
        return schema.parse(JSON.parse(output));
      } catch {
        throw new ServiceError(
          'INVALID_OUTPUT',
          'The AI response failed structural validation. No unreliable score was published. Please retry.',
          502,
        );
      }
    } catch (e) {
      if (e instanceof ServiceError) throw e;
      if (controller.signal.aborted)
        throw new ServiceError(
          'TIMEOUT',
          'The AI request timed out or was canceled. Your work and any prepared rubric are preserved. Please retry.',
          504,
        );
      throw new ServiceError(
        'NETWORK_ERROR',
        'The analysis server could not reach the AI provider. Please retry later.',
        502,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}
export function getProvider(): AIProvider {
  const config = getConfig();
  if (config.provider !== 'openai')
    throw new ServiceError(
      'PROVIDER_UNSUPPORTED',
      'This installation supports the OpenAI provider. Check AI_PROVIDER on the server.',
      503,
    );
  return new OpenAIProvider(config);
}
