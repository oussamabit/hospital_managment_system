import { Request, Response } from 'express';
import Service from '../models/Service';
import logger from '../config/logger';

export const getAllServices = async (req: Request, res: Response): Promise<void> => {
    try {
        const services = await Service.find().sort({ nomService: 1 });
        res.json({ services });
    } catch (error) {
        logger.error('Get services error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des services' });
    }
};

export const getServiceById = async (req: Request, res: Response): Promise<void> => {
    try {
        const service = await Service.findById(req.params.id).populate('chefDeServiceId', 'firstName lastName');
        if (!service) {
            res.status(404).json({ message: 'Service introuvable' });
            return;
        }
        res.json({ service });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération du service' });
    }
};
export const createService = async (req: any, res: Response): Promise<void> => {
    try {
        const { nomService, chefDeServiceId } = req.body;
        
        if (!nomService || !chefDeServiceId) {
            res.status(400).json({ message: 'Nom du service et Chef de service requis' });
            return;
        }

        const existing = await Service.findOne({ nomService: nomService.trim() });
        if (existing) {
            res.status(400).json({ message: 'Ce service existe déjà' });
            return;
        }

        const service = await Service.create({
            nomService: nomService.trim(),
            chefDeServiceId,
            createdBy: req.user?._id
        });

        res.status(201).json({ service, message: 'Service créé avec succès' });
    } catch (error) {
        logger.error('Create service error:', error);
        res.status(500).json({ message: 'Erreur lors de la création du service' });
    }
};
