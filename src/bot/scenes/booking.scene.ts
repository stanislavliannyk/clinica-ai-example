import { Wizard, WizardStep, Ctx, On, Action } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { Logger } from '@nestjs/common';
import { CrmService, CrmSlot } from '../../crm/crm.service';
import { LlmService } from '../../llm/llm.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { Markup } from 'telegraf';

export const BOOKING_SCENE_ID = 'booking';

interface BookingSession {
  name?: string;
  phone?: string;
  complaint?: string;
  specialty?: string;
  slotId?: string;
  slot?: CrmSlot;
  telegramId?: string;
}

type BookingContext = WizardContext & {
  scene: WizardContext['scene'] & { session: BookingSession };
  from: { id: number; first_name?: string };
};

@Wizard(BOOKING_SCENE_ID)
export class BookingScene {
  private readonly logger = new Logger(BookingScene.name);

  constructor(
    private readonly crm: CrmService,
    private readonly llm: LlmService,
    private readonly appointments: AppointmentsService,
  ) {}

  @WizardStep(1)
  async step1(@Ctx() ctx: BookingContext) {
    ctx.scene.session.telegramId = String(ctx.from.id);
    await ctx.reply('👤 Як вас звати? Вкажіть ім\'я та прізвище:');
    ctx.wizard.next();
  }

  @WizardStep(2)
  @On('text')
  async step2(@Ctx() ctx: BookingContext) {
    const text = (ctx as any).message?.text ?? '';
    const words = text.trim().split(/\s+/);
    if (words.length < 2) {
      await ctx.reply('❌ Вкажіть, будь ласка, ім\'я та прізвище (мінімум 2 слова):');
      return;
    }
    ctx.scene.session.name = text.trim();
    await ctx.reply('📱 Ваш номер телефону у форматі +38XXXXXXXXXX:');
    ctx.wizard.next();
  }

  @WizardStep(3)
  @On('text')
  async step3(@Ctx() ctx: BookingContext) {
    const text = (ctx as any).message?.text ?? '';
    const phoneRegex = /^\+38\d{10}$/;
    if (!phoneRegex.test(text.trim())) {
      await ctx.reply('❌ Невірний формат. Введіть номер у форматі +38XXXXXXXXXX:');
      return;
    }
    ctx.scene.session.phone = text.trim();
    await ctx.reply('🩺 Опишіть вашу скаргу або причину візиту:');
    ctx.wizard.next();
  }

  @WizardStep(4)
  @On('text')
  async step4(@Ctx() ctx: BookingContext) {
    const complaint = (ctx as any).message?.text ?? '';
    ctx.scene.session.complaint = complaint;

    await ctx.reply('⏳ Визначаю спеціаліста...');
    const specialty = await this.llm.detectSpecialty(complaint);
    ctx.scene.session.specialty = specialty;

    const slots = await this.crm.getAvailableSlots(specialty);
    if (!slots.length) {
      await ctx.reply(
        `😔 На жаль, немає вільних слотів для *${specialty}*.\n\nСпробуйте пізніше або зверніться до адміністратора: @admin`,
        { parse_mode: 'Markdown' },
      );
      return await ctx.scene.leave();
    }

    const buttons = slots.map((slot) => {
      const date = slot.startAt.toLocaleString('uk-UA', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      return [Markup.button.callback(`${slot.doctorName} — ${date}`, `slot:${slot.id}`)];
    });

    await ctx.reply(
      `🔍 Виявлено: *${specialty}*\nОберіть зручний час прийому:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) },
    );
    ctx.wizard.next();
  }

  @WizardStep(5)
  @Action(/^slot:(.+)$/)
  async step5(@Ctx() ctx: BookingContext) {
    const callbackData = (ctx as any).callbackQuery?.data ?? '';
    const slotId = callbackData.replace('slot:', '');
    const slot = this.crm.getSlot(slotId);

    if (!slot) {
      await ctx.reply('❌ Слот не знайдено. Почніть спочатку: /book');
      return await ctx.scene.leave();
    }

    // Release previously reserved slot if user re-selected
    if (ctx.scene.session.slotId) {
      this.crm.releaseSlot(ctx.scene.session.slotId);
    }
    this.crm.reserveSlot(slotId);

    ctx.scene.session.slotId = slotId;
    ctx.scene.session.slot = slot;

    const date = slot.startAt.toLocaleString('uk-UA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    await ctx.editMessageText(
      `📋 *Підтвердіть запис:*\n\n` +
      `👤 Ім'я: ${ctx.scene.session.name}\n` +
      `📱 Телефон: ${ctx.scene.session.phone}\n` +
      `🩺 Спеціаліст: ${slot.doctorName}\n` +
      `📅 Дата: ${date}\n\n` +
      `Все вірно?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Підтвердити', 'confirm')],
          [Markup.button.callback('❌ Скасувати', 'cancel')],
        ]),
      },
    );
    ctx.wizard.next();
  }

  @WizardStep(6)
  @Action('confirm')
  async confirm(@Ctx() ctx: BookingContext) {
    const session = ctx.scene.session;
    try {
      await this.appointments.create({
        telegramId: session.telegramId!,
        fullName: session.name!,
        phone: session.phone!,
        slotId: session.slotId!,
        doctorName: session.slot!.doctorName,
        specialty: session.slot!.specialty,
        scheduledAt: session.slot!.startAt,
      });

      const date = session.slot!.startAt.toLocaleString('uk-UA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });

      await ctx.editMessageText(
        `✅ *Ви успішно записані!*\n\n` +
        `🩺 Лікар: ${session.slot!.doctorName}\n` +
        `📅 Дата: ${date}\n` +
        `📱 Підтвердження надійде на ${session.phone}\n\n` +
        `Очікуємо вас! При потребі звертайтесь: @admin`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      this.logger.error('Failed to create appointment', err);
      await ctx.reply(
        '❌ Помилка при записі. Зверніться до адміністратора: @admin\n\nСпробуйте знову: /book',
      );
    }
    await ctx.scene.leave();
  }

  @WizardStep(6)
  @Action('cancel')
  async cancelBooking(@Ctx() ctx: BookingContext) {
    if (ctx.scene.session.slotId) {
      this.crm.releaseSlot(ctx.scene.session.slotId);
    }
    await ctx.editMessageText(
      '❌ Запис скасовано.\n\nЯкщо передумаєте — натисніть /book або просто напишіть "хочу записатися".',
    );
    await ctx.scene.leave();
  }
}
