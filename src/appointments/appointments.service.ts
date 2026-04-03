import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { CrmService } from '../crm/crm.service';
import { PatientsService } from '../patients/patients.service';

export interface CreateAppointmentDto {
  telegramId: string;
  fullName: string;
  phone: string;
  slotId: string;
  doctorName: string;
  specialty: string;
  scheduledAt: Date;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly crmService: CrmService,
    private readonly patientsService: PatientsService,
  ) {}

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const patient = await this.patientsService.findOrCreate(
      dto.telegramId,
      dto.fullName,
      dto.phone,
    );

    const crmRecord = await this.crmService.createRecord(
      { name: dto.fullName, phone: dto.phone },
      dto.slotId,
    );

    const appointment = this.repo.create({
      patientId: patient.id,
      doctorName: dto.doctorName,
      specialty: dto.specialty,
      scheduledAt: dto.scheduledAt,
      status: AppointmentStatus.CONFIRMED,
      crmRecordId: crmRecord.id,
    });

    return this.repo.save(appointment);
  }
}
