import { Update, Start, Command, On, Ctx, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { BOOKING_SCENE_ID } from './scenes/booking.scene';

const FALLBACK_MESSAGE = `Не зрозумів вашого запиту 🤔\n\nЯ можу:\n• 📅 Записати вас до лікаря — напишіть "хочу записатися"\n• ❓ Відповісти на питання про клініку\n\nАбо зверніться до адміністратора: @admin`;

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly llm: LlmService) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const name = ctx.from?.first_name ?? 'пацієнт';
    await ctx.reply(
      `👋 Вітаю, *${name}*! Я AI-асистент клініки "Здоров'я".\n\n` +
      `Я можу:\n• 📅 Записати вас до лікаря\n• ❓ Відповісти на питання про клініку\n\n` +
      `Напишіть, чим можу допомогти?`,
      { parse_mode: 'Markdown' },
    );
  }

  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      `*Команди бота:*\n\n` +
      `/start — Привітання\n` +
      `/book — Записатися до лікаря\n` +
      `/help — Допомога\n\n` +
      `Або просто напишіть ваше питання!`,
      { parse_mode: 'Markdown' },
    );
  }

  @Command('book')
  async onBookCommand(@Ctx() ctx: any) {
    await ctx.scene.enter(BOOKING_SCENE_ID);
  }

  @On('text')
  async onText(@Ctx() ctx: any, @Message('text') text: string) {
    if (ctx.scene?.current) return; // Already in a scene

    this.logger.debug(`Incoming message: ${text}`);
    await ctx.sendChatAction('typing');
    const intent = await this.llm.detectIntent(text);
    this.logger.debug(`Detected intent: ${intent}`);

    if (intent === 'booking') {
      await ctx.reply('Чудово! Давайте запишемо вас до лікаря 📅');
      await ctx.scene.enter(BOOKING_SCENE_ID);
    } else if (intent === 'faq') {
      await ctx.sendChatAction('typing');
      const reply = await this.llm.generateReply([{ role: 'user', content: text }]);
      await ctx.reply(reply);
    } else {
      await ctx.reply(FALLBACK_MESSAGE);
    }
  }
}
