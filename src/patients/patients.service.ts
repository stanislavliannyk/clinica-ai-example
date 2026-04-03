import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly repo: Repository<Patient>,
  ) {}

  async findOrCreate(telegramId: string, fullName: string, phone: string): Promise<Patient> {
    let patient = await this.repo.findOne({ where: { telegramId } });
    if (!patient) {
      patient = this.repo.create({ telegramId, fullName, phone });
      await this.repo.save(patient);
    } else {
      patient.fullName = fullName;
      patient.phone = phone;
      await this.repo.save(patient);
    }
    return patient;
  }
}
