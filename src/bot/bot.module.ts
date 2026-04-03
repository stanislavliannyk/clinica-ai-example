import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { session } from 'telegraf';
import { BotUpdate } from './bot.update';
import { BookingScene } from './scenes/booking.scene';
import { LlmModule } from '../llm/llm.module';
import { CrmModule } from '../crm/crm.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        token: config.get('TELEGRAM_BOT_TOKEN') ?? process.env.TELEGRAM_BOT_TOKEN,
        middlewares: [session()],
      }),
      inject: [ConfigService],
    }),
    LlmModule,
    CrmModule,
    AppointmentsModule,
  ],
  providers: [BotUpdate, BookingScene],
})
export class BotModule {}
