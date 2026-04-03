import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { INTENT_SYSTEM_PROMPT } from './prompts/intent.prompt';
import { FAQ_SYSTEM_PROMPT } from './prompts/faq.prompt';
import { SPECIALTY_SYSTEM_PROMPT } from './prompts/specialty.prompt';

export type Intent = 'booking' | 'faq' | 'fallback';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY') });
    this.model = config.get('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async detectIntent(text: string): Promise<Intent> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 100,
      });
      const raw = response.choices[0]?.message?.content ?? '{}';
      try {
        const parsed = JSON.parse(raw);
        if ((parsed.confidence ?? 1) < 0.7) return 'fallback';
        return parsed.intent ?? 'fallback';
      } catch {
        return 'fallback';
      }
    } catch (err) {
      this.logger.error('detectIntent error', err);
      return 'fallback';
    }
  }

  async generateReply(messages: ChatMessage[], systemPrompt: string = FAQ_SYSTEM_PROMPT): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      });
      return response.choices[0]?.message?.content ?? 'Вибачте, сталася помилка. Спробуйте ще раз.';
    } catch (err) {
      this.logger.error('generateReply error', err);
      return 'Вибачте, AI-сервіс тимчасово недоступний. Зверніться до адміністратора: @admin';
    }
  }

  async detectSpecialty(complaint: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SPECIALTY_SYSTEM_PROMPT },
          { role: 'user', content: complaint },
        ],
        temperature: 0,
        max_tokens: 100,
      });
      const raw = response.choices[0]?.message?.content ?? '{}';
      try {
        const parsed = JSON.parse(raw);
        return parsed.specialty ?? 'терапевт';
      } catch {
        return 'терапевт';
      }
    } catch (err) {
      this.logger.error('detectSpecialty error', err);
      return 'терапевт';
    }
  }
}
