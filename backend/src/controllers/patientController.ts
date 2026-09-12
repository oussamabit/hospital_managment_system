import { Response } from 'express';
import { z } from 'zod';
import Patient from '../models/Patient';
import logger from '../config/logger';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';
import DossierMedical from '../models/DossierMedical';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Role } from '../models/User';

const createPatientSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis'),
  lastName: z.string().min(2, 'Nom requis'),
  birthDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date de naissance invalide'),
  phone: z.string().min(8, 'Numéro de téléphone requis'),
  gender: z.enum(['M', 'F']),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  numSecu: z.string().optional(),
  dossierNumber: z.string().optional(),
  notes: z.string().optional(),
});

const updatePatientSchema = createPatientSchema.partial();

export const getAllPatients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { dossierNumber: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { numSecu: { $regex: search, $options: 'i' } },
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .populate('createdBy', 'firstName lastName role')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Patient.countDocuments(filter),
    ]);

    res.json({
      patients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get patients error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des patients' });
  }
};

export const getPatientById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patient = await Patient.findById(req.params.id).populate('createdBy', 'firstName lastName role');
    if (!patient) {
      res.status(404).json({ message: 'Patient introuvable' });
      return;
    }
    // Also fetch DossierMedical
    const dossier = await DossierMedical.findOne({ patientId: patient._id });
    res.json({ patient, dossier });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du patient' });
  }
};

export const createPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = createPatientSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
      return;
    }

    const patientData = {
      ...result.data,
      birthDate: new Date(result.data.birthDate),
      createdBy: req.user!._id,
    };

    const patient = await Patient.create(patientData);

    // Automatically create DossierMedical
    await DossierMedical.create({
      patientId: patient._id,
      createdBy: req.user!._id,
    });

    res.status(201).json({ patient, message: 'Patient créé avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.CREATE,
      resourceType: 'Patient',
      resourceId: patient._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Créé le patient ${patient.firstName} ${patient.lastName}`,
      newState: patient.toObject()
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Un patient avec ce numéro de dossier ou numéro de sécu existe déjà' });
      return;
    }
    logger.error('Create patient error:', error);
    res.status(500).json({ message: 'Erreur lors de la création du patient' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = updatePatientSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    // SECRETAIRE can only update basic info
    let updateData = result.data;
    if (req.user?.role === Role.SECRETAIRE) {
      const { firstName, lastName, phone, birthDate, dossierNumber, email } = updateData;
      updateData = { firstName, lastName, phone, birthDate, dossierNumber, email };
    }

    if (updateData.birthDate) {
      updateData = { ...updateData, birthDate: new Date(updateData.birthDate as string) as any };
    }

    const oldPatient = await Patient.findById(req.params.id);
    const oldPatientState = oldPatient?.toObject();

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!patient) {
      res.status(404).json({ message: 'Patient introuvable' });
      return;
    }

    res.json({ patient, message: 'Patient mis à jour avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.UPDATE,
      resourceType: 'Patient',
      resourceId: patient._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Mis à jour le patient ${patient.firstName} ${patient.lastName}`,
      previousState: oldPatientState,
      newState: patient.toObject()
    });
  } catch (error) {
    logger.error('Update patient error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du patient' });
  }
};

export const deletePatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const oldPatient = await Patient.findById(req.params.id);
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      res.status(404).json({ message: 'Patient introuvable' });
      return;
    }
    res.json({ message: 'Patient supprimé avec succès' });

    // Audit Log
    if (oldPatient) {
      logAction({
        action: AuditAction.DELETE,
        resourceType: 'Patient',
        resourceId: oldPatient._id,
        performedBy: req.user?._id || 'SYSTEM',
        description: `Supprimé le patient ${oldPatient.firstName} ${oldPatient.lastName}`,
        previousState: oldPatient.toObject()
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du patient' });
  }
};
