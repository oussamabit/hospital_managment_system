import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Patient from '../models/Patient';
import Consultation from '../models/Consultation';
import RendezVous from '../models/RendezVous';
import User from '../models/User';
import DossierMedical from '../models/DossierMedical';
import Ordonnance from '../models/Ordonnance';
import logger from '../config/logger';

export const exportAllData = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        logger.info(`Admin ${req.user?.email} requested a full data export`);

        const [patients, consultations, rdvs, users, dossiers, ordonnances] = await Promise.all([
            Patient.find().lean(),
            Consultation.find().lean(),
            RendezVous.find().lean(),
            User.find().select('-password').lean(),
            DossierMedical.find().lean(),
            Ordonnance.find().lean()
        ]);

        const exportData = {
            exportDate: new Date().toISOString(),
            exportedBy: req.user?.email,
            stats: {
                totalPatients: patients.length,
                totalConsultations: consultations.length,
                totalRdvs: rdvs.length,
                totalUsers: users.length,
                totalOrdonnances: ordonnances.length
            },
            data: {
                patients,
                consultations,
                rdvs,
                users,
                dossierMedicals: dossiers,
                ordonnances
            }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=hospital_export_${new Date().toISOString().split('T')[0]}.json`);
        res.status(200).send(JSON.stringify(exportData, null, 2));

    } catch (error) {
        logger.error('Data export error:', error);
        res.status(500).json({ message: 'Erreur lors de l\'exportation des données' });
    }
};
