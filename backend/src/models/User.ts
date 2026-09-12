import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum Role {
  ADMIN = 'ADMIN',
  SECRETAIRE = 'SECRETAIRE',
  MEDECIN = 'MEDECIN',
  INFIRMIER = 'INFIRMIER',
}

export enum Grade {
  SENIOR = 'SENIOR',
  JUNIOR = 'JUNIOR',
}

export interface IUser extends Document<string> {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => uuidv4() },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: Object.values(Role),
      required: true,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    discriminatorKey: 'userType',
  }
);

// Virtual for full name
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.model<IUser>('User', UserSchema);

// ====================== DISCRIMINATORS ======================

// Medecin Discriminator
export interface IMedecin extends IUser {
  grade: Grade;
  specialite: string;
  numeroOrdre: string;
  service?: string; // Ref to Service
}

export const Medecin = User.discriminator<IMedecin>(
  'Medecin',
  new Schema({
    grade: { type: String, enum: Object.values(Grade), required: true },
    specialite: { type: String, required: true },
    numeroOrdre: { type: String, required: true, unique: true },
    service: { type: String }, // plain text, no ref
  })
);

// Secretaire Discriminator
export interface ISecretaire extends IUser {
  codePoste: string;
  service?: string; // Ref to Service
}

export const Secretaire = User.discriminator<ISecretaire>(
  'Secretaire',
  new Schema({
    codePoste: { type: String, required: true },
    service: { type: String }, // plain text, no ref
  })
);

// Infirmier Discriminator
export interface IInfirmier extends IUser {
  matricule: string;
}

export const Infirmier = User.discriminator<IInfirmier>(
  'Infirmier',
  new Schema({
    matricule: { type: String, required: true },
  })
);

export default User;
