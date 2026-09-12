import AuditLog, { AuditAction } from '../models/AuditLog';
import logger from '../config/logger';
import mongoose from 'mongoose';

interface LogData {
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    performedBy: string;
    description: string;
    previousState?: any;
    newState?: any;
}

export const logAction = async (data: LogData) => {
    try {
        await AuditLog.create(data);
    } catch (error) {
        logger.error('Failed to create audit log:', error);
    }
};

export const getAuditLogs = async (filters: any = {}, limit = 100, skip = 0) => {
    return await AuditLog.find(filters)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .populate('performedBy', 'firstName lastName email role');
};

export const getAuditLogById = async (id: string) => {
    return await AuditLog.findById(id).populate('performedBy', 'firstName lastName email role');
};

export const undoAction = async (logId: string) => {
    const log = await AuditLog.findById(logId);
    if (!log) throw new Error('Audit log not found');
    if (log.action === AuditAction.RESTORE) throw new Error('Cannot undo a restore action');

    const Model = mongoose.model(log.resourceType);
    if (!Model) throw new Error(`Model for ${log.resourceType} not found`);

    switch (log.action) {
        case AuditAction.CREATE:
            // To undo a creation, we delete the resource
            await Model.findByIdAndDelete(log.resourceId);
            break;

        case AuditAction.UPDATE:
        case AuditAction.STATUS_CHANGE:
            // To undo an update or status change, we restore the previous state
            if (!log.previousState) throw new Error('No previous state recorded for this action');
            await Model.findByIdAndUpdate(log.resourceId, { $set: log.previousState });
            break;

        case AuditAction.DELETE:
            // To undo a deletion, we re-create the resource
            if (!log.previousState) throw new Error('No previous state recorded for this deletion');

            // Check if it already exists (prevent duplicates if already restored)
            const existing = await Model.findById(log.resourceId);
            if (existing) throw new Error('Resource already exists');

            await Model.create(log.previousState);
            break;

        default:
            throw new Error(`Undo not supported for action: ${log.action}`);
    }

    // Record the undo action itself
    await logAction({
        action: AuditAction.RESTORE,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        performedBy: 'SYSTEM', // Or pass the admin ID who clicked undo
        description: `Undid ${log.action} on ${log.resourceType} (Log ID: ${log._id})`,
        previousState: log.newState,
        newState: log.previousState
    });

    return true;
};
