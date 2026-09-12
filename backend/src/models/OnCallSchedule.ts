import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IDoctorConstraint {
  label: string;
  dayOfWeek?: number;
  specificDate?: Date;
  startTime: string;
  endTime: string;
  recurring: boolean;
}

export interface IOnCallEntry {
  doctorId: string;
  doctorName?: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxAppointments?: number;
}

export interface IOnCallSchedule extends Document {
  date: Date;
  entries: IOnCallEntry[];
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDoctorAvailability extends Document {
  doctorId: string;
  constraints: IDoctorConstraint[];
  defaultSlotDuration: number;
  updatedAt: Date;
}

const OnCallEntrySchema = new Schema<IOnCallEntry>({
  doctorId:            { type: String, ref: 'User', required: true },
  doctorName:          String,
  startTime:           { type: String, required: true },
  endTime:             { type: String, required: true },
  slotDurationMinutes: { type: Number, default: 30 },
  maxAppointments:     Number,
}, { _id: false });

const OnCallScheduleSchema = new Schema<IOnCallSchedule>({
  date:        { type: Date, required: true, index: true },
  entries:     [OnCallEntrySchema],
  notes:       String,
  createdBy:   { type: String, ref: 'User', required: true },
  updatedBy:   { type: String, ref: 'User' },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

OnCallScheduleSchema.index({ date: 1 }, { unique: true });

const DoctorConstraintSchema = new Schema<IDoctorConstraint>({
  label:        { type: String, required: true },
  dayOfWeek:    Number,
  specificDate: Date,
  startTime:    { type: String, required: true },
  endTime:      { type: String, required: true },
  recurring:    { type: Boolean, default: false },
}, { _id: false });

const DoctorAvailabilitySchema = new Schema<IDoctorAvailability>({
  doctorId:            { type: String, ref: 'User', required: true, unique: true },
  constraints:         [DoctorConstraintSchema],
  defaultSlotDuration: { type: Number, default: 30 },
}, { timestamps: true });

export const OnCallSchedule    = mongoose.model<IOnCallSchedule>('OnCallSchedule', OnCallScheduleSchema);
export const DoctorAvailability = mongoose.model<IDoctorAvailability>('DoctorAvailability', DoctorAvailabilitySchema);

export default OnCallSchedule;
