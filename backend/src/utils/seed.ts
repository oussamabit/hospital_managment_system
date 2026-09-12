import 'dotenv/config';
import mongoose from 'mongoose';
import User, { Role, Grade, Medecin, Secretaire } from '../models/User';
import Patient from '../models/Patient';
import RendezVous, { RdvStatus } from '../models/RendezVous';
import Service from '../models/Service';
import DossierMedical from '../models/DossierMedical';
import { hashPassword } from './password';
import logger from '../config/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_rdv';

const seed = async () => {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for seeding...');

  // Clear existing data
  await User.deleteMany({});
  await Patient.deleteMany({});
  await RendezVous.deleteMany({});
  await Service.deleteMany({});
  await DossierMedical.deleteMany({});
  logger.info('Cleared existing seed data');

  // Create Service
  const cardiologie = await Service.create({
    nomService: 'Cardiologie',
    chefDeServiceId: 'placeholder', // Will update after creating user
  });

  // Create users
  const hashedPw = await hashPassword('Password123!');

  const senior = await Medecin.create({
    email: 'senior@hospital.dz',
    password: hashedPw,
    firstName: 'Docteur',
    lastName: 'Mansouri',
    role: Role.MEDECIN,
    grade: Grade.SENIOR,
    specialite: 'Cardiologie',
    numeroOrdre: 'MED12345/09',
    service: cardiologie._id,
    phone: '+213 550 12 34 56',
    isActive: true,
  });

  // Update Service chef
  cardiologie.chefDeServiceId = senior._id;
  await cardiologie.save();

  const junior = await Medecin.create({
    email: 'junior@hospital.dz',
    password: hashedPw,
    firstName: 'Docteur',
    lastName: 'Benali',
    role: Role.MEDECIN,
    grade: Grade.JUNIOR,
    specialite: 'Généraliste',
    numeroOrdre: 'MED67890/16',
    service: cardiologie._id,
    phone: '+213 660 12 34 56',
    isActive: true,
  });

  const staff = await Secretaire.create({
    email: 'secretaire@hospital.dz',
    password: hashedPw,
    firstName: 'Amira',
    lastName: 'Brahimi',
    role: Role.SECRETAIRE,
    codePoste: 'STF-001',
    service: cardiologie._id,
    phone: '+213 770 12 34 56',
    isActive: true,
  });

  const admin = await User.create({
    email: 'admin@hospital.dz',
    password: hashedPw,
    firstName: 'Yassine',
    lastName: 'Belkacem',
    role: Role.ADMIN,
    isActive: true,
  });

  logger.info('✅ Admin, Specialized Users and Services created');

  // Create patients
  const patientData = [
    {
      firstName: 'Mohamed',
      lastName: 'Amrani',
      birthDate: new Date('1980-05-15'),
      phone: '+213 551 22 33 44',
      email: 'mohamed.amrani@email.dz',
      gender: 'M',
      bloodGroup: 'A+',
      numSecu: '1800575123456',
      address: 'Cité des 500 logements, Alger Centre',
      createdBy: staff._id,
    },
    {
      firstName: 'Fatima',
      lastName: 'Zohra',
      birthDate: new Date('1990-11-22'),
      phone: '+213 661 99 88 77',
      email: 'fatima.zohra@email.dz',
      gender: 'F',
      bloodGroup: 'O-',
      numSecu: '2901169123456',
      address: 'Quartier Akid Lotfi, Oran',
      createdBy: staff._id,
    },
    {
      firstName: 'Ahmed',
      lastName: 'Messaoudi',
      birthDate: new Date('1965-03-08'),
      phone: '+213 771 00 11 22',
      gender: 'M',
      bloodGroup: 'B+',
      numSecu: '1650313123456',
      address: 'Boulevard de l\'ALN, Constantine',
      createdBy: senior._id,
    },
  ];

  const patients = [];
  for (const data of patientData) {
    const p = await Patient.create(data);
    patients.push(p);
    // Create DossierMedical
    await DossierMedical.create({ patientId: p._id, createdBy: staff._id });
  }

  logger.info('✅ Patients and Medical Dossiers created');

  // Create some RDVs
  const today = new Date();
  today.setHours(9, 0, 0, 0);

  const rdvs = [];
  for (let i = 0; i < 3; i++) {
    const rdvDate = new Date(today);
    rdvDate.setHours(9 + i * 2, 0, 0, 0);

    rdvs.push({
      patient: patients[i % patients.length]._id,
      medecin: i % 2 === 0 ? senior._id : junior._id,
      service: cardiologie._id,
      dateTime: rdvDate,
      duration: 30,
      motif: ['Consultation de routine', 'Suivi de traitement', 'Bilan de santé'][i],
      status: [RdvStatus.PLANIFIE, RdvStatus.CONFIRME, RdvStatus.EN_COURS][i],
      createdBy: staff._id,
    });
  }

  await RendezVous.create(rdvs);
  logger.info('✅ RendezVous created');

  logger.info('\n🏥 ===== NEW ARCHITECTURE SEED COMPLETE =====');
  logger.info('Test credentials (all passwords: Password123!):');
  logger.info('  ADMIN             → admin@hospital.dz');
  logger.info('  SENIOR (MEDECIN)  → senior@hospital.dz');
  logger.info('  JUNIOR (MEDECIN)  → junior@hospital.dz');
  logger.info('  SECRETAIRE        → secretaire@hospital.dz');
  logger.info('============================================\n');

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  logger.error('Seed error:', err);
  process.exit(1);
});
