import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from './bot/bot.module';
import { LlmModule } from './llm/llm.module';
import { CrmModule } from './crm/crm.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientsModule } from './patients/patients.module';
import { Patient } from './patients/patient.entity';
import { Appointment } from './appointments/appointment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'clinic_bot'),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        entities: [Patient, Appointment],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    BotModule,
    LlmModule,
    CrmModule,
    AppointmentsModule,
    PatientsModule,
  ],
})
export class AppModule {}
