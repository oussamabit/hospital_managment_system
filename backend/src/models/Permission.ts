import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IPermission extends Document<string> {
    _id: string;
    code: string; // e.g., "RDV_ANNULER_AUTRUI", "DOSSIER_LECTURE"
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
    {
        _id: { type: String, default: () => uuidv4() },
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        description: { type: String, required: true },
    },
    {
        timestamps: true,
        _id: false,
    }
);

const Permission = mongoose.model<IPermission>('Permission', PermissionSchema);
export default Permission;
