import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IRefreshToken extends Document<string> {
  _id: string;
  token: string;
  user: string;
  expiresAt: Date;
  isRevoked: boolean;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    _id: { type: String, default: () => uuidv4() },
    token: { type: String, required: true, unique: true },
    user: { type: String, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    userAgent: { type: String },
    ip: { type: String },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Auto-delete expired tokens via TTL index
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ user: 1 });

const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
export default RefreshToken;
