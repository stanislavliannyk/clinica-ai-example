import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface CrmSlot {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  startAt: Date;
}

export interface CrmRecord {
  id: string;
  patientName: string;
  phone: string;
  slotId: string;
  status: 'confirmed' | 'cancelled';
}

export interface PatientDto {
  name: string;
  phone: string;
}

@Injectable()
export class CrmService implements OnModuleInit {
  private readonly logger = new Logger(CrmService.name);
  private slots = new Map<string, CrmSlot>();
  private records = new Map<string, CrmRecord>();
  private reservedSlotIds = new Set<string>();

  private readonly doctors = [
    { id: 'doc1', name: 'Іваненко Олег Петрович', specialty: 'терапевт' },
    { id: 'doc2', name: 'Коваль Марія Сергіївна', specialty: 'кардіолог' },
    { id: 'doc3', name: 'Петренко Андрій Миколайович', specialty: 'невролог' },
    { id: 'doc4', name: 'Сидоренко Тетяна Василівна', specialty: 'дерматолог' },
  ];

  onModuleInit() {
    this.seedSlots();
    this.logger.log(`CRM initialized with ${this.slots.size} slots`);
  }

  private seedSlots() {
    const now = new Date();
    for (let day = 1; day <= 7; day++) {
      for (const doctor of this.doctors) {
        for (const hour of [9, 11, 14, 16]) {
          const startAt = new Date(now);
          startAt.setDate(now.getDate() + day);
          startAt.setHours(hour, 0, 0, 0);
          const slot: CrmSlot = {
            id: uuidv4(),
            doctorId: doctor.id,
            doctorName: doctor.name,
            specialty: doctor.specialty,
            startAt,
          };
          this.slots.set(slot.id, slot);
        }
      }
    }
  }

  async getAvailableSlots(specialty: string, date?: Date): Promise<CrmSlot[]> {
    const normalizedSpecialty = specialty.toLowerCase();
    const all = Array.from(this.slots.values()).filter(
      (s) => s.specialty.toLowerCase().includes(normalizedSpecialty),
    );
    const bookedSlotIds = new Set([
      ...Array.from(this.records.values()).map((r) => r.slotId),
      ...this.reservedSlotIds,
    ]);
    return all.filter((s) => !bookedSlotIds.has(s.id)).slice(0, 6);
  }

  reserveSlot(slotId: string): void {
    this.reservedSlotIds.add(slotId);
  }

  releaseSlot(slotId: string): void {
    this.reservedSlotIds.delete(slotId);
  }

  async createRecord(patient: PatientDto, slotId: string): Promise<CrmRecord> {
    this.reservedSlotIds.delete(slotId);
    const record: CrmRecord = {
      id: uuidv4(),
      patientName: patient.name,
      phone: patient.phone,
      slotId,
      status: 'confirmed',
    };
    this.records.set(record.id, record);
    return record;
  }

  async updateStatus(recordId: string, status: CrmRecord['status']): Promise<CrmRecord> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);
    record.status = status;
    return record;
  }

  async getRecord(recordId: string): Promise<CrmRecord> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);
    return record;
  }

  getSlot(slotId: string): CrmSlot | undefined {
    return this.slots.get(slotId);
  }
}
