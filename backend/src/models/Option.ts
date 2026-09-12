import mongoose, { Document, Schema } from 'mongoose';

export interface IOption extends Document {
    category: 'SPECIALITE' | 'SERVICE';
    value: string;
}

const OptionSchema = new Schema<IOption>(
    {
        category: { type: String, enum: ['SPECIALITE', 'SERVICE'], required: true },
        value: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

OptionSchema.index({ category: 1, value: 1 }, { unique: true });

export default mongoose.model<IOption>('Option', OptionSchema);
