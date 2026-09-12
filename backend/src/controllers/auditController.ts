import { Request, Response } from 'express';
import * as auditService from '../services/auditService';
import logger from '../config/logger';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { resourceType, action, performedBy, startDate, endDate, page = 1, limit = 50 } = req.query;

        const filters: any = {};
        if (resourceType) filters.resourceType = resourceType;
        if (action) filters.action = action;
        if (performedBy) filters.performedBy = performedBy;

        if (startDate || endDate) {
            filters.timestamp = {};
            if (startDate) filters.timestamp.$gte = new Date(startDate as string);
            if (endDate) filters.timestamp.$lte = new Date(endDate as string);
        }

        const skip = (Number(page) - 1) * Number(limit);
        const logs = await auditService.getAuditLogs(filters, Number(limit), skip);

        res.json({ logs });
    } catch (error) {
        logger.error('Get audit logs error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
    }
};

export const undo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await auditService.undoAction(id);
        res.json({ message: 'Action annulée avec succès' });
    } catch (error: any) {
        logger.error('Undo action error:', error);
        res.status(500).json({ message: error.message || 'Erreur lors de l\'annulation de l\'action' });
    }
};
