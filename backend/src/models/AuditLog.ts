import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    RESTORE = 'RESTORE',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    STATUS_CHANGE = 'STATUS_CHANGE',
}

export interface IAuditLog extends Document<string> {
    _id: string;
    action: AuditAction;
    resourceType: string; // 'User', 'Patient', 'Appointment', 'Consultation', 'Option', 'Service'
    resourceId: string;
    performedBy: string; // User ID
    description: string;
    previousState?: any;
    newState?: any;
    timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        _id: { type: String, default: () => uuidv4() },
        action: { type: String, enum: Object.values(AuditAction), required: true },
        resourceType: { type: String, required: true },
        resourceId: { type: String, required: true },
        performedBy: { type: String, ref: 'User', required: true },
        description: { type: String, required: true },
        previousState: { type: Schema.Types.Mixed },
        newState: { type: Schema.Types.Mixed },
    },
    {
        timestamps: { createdAt: 'timestamp', updatedAt: false },
    }
);

// Indexes for faster searching in Admin UI
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ performedBy: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
