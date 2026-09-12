import { Request, Response } from 'express';
import Option from '../models/Option';
import logger from '../config/logger';

export const getOptions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};
        const options = await Option.find(filter).sort({ value: 1 });
        res.json({ options });
    } catch (error) {
        logger.error('Get options error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des options' });
    }
};

export const createOption = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, value } = req.body;
        if (!category || !value) {
            res.status(400).json({ message: 'Catégorie et valeur requises' });
            return;
        }

        const option = await Option.create({ category, value });
        res.status(201).json({ option, message: 'Option créée avec succès' });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'Cette option existe déjà' });
            return;
        }
        logger.error('Create option error:', error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'option' });
    }
};

export const deleteOption = async (req: Request, res: Response): Promise<void> => {
    try {
        const option = await Option.findByIdAndDelete(req.params.id);
        if (!option) {
            res.status(404).json({ message: 'Option introuvable' });
            return;
        }
        res.json({ message: 'Option supprimée avec succès' });
    } catch (error) {
        logger.error('Delete option error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'option' });
    }
};
