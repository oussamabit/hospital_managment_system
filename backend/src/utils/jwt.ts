import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwtConfig } from '../config/jwt';
import RefreshToken from '../models/RefreshToken';
import { IUser } from '../models/User';

export const generateAccessToken = (user: IUser): string => {
  return jwt.sign(
    { userId: user._id, role: user.role, email: user.email },
    jwtConfig.accessSecret,
    { expiresIn: jwtConfig.accessExpiresIn } as jwt.SignOptions
  );
};

export const generateRefreshToken = async (
  user: IUser,
  userAgent?: string,
  ip?: string
): Promise<string> => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + jwtConfig.refreshExpiresInMs);

  await RefreshToken.create({
    token,
    user: user._id,
    expiresAt,
    userAgent,
    ip,
  });

  return token;
};

export const verifyRefreshToken = async (token: string) => {
  const refreshToken = await RefreshToken.findOne({ token }).populate('user');

  if (!refreshToken) {
    throw new Error('Refresh token introuvable');
  }

  if (refreshToken.isRevoked) {
    throw new Error('Refresh token révoqué');
  }

  if (refreshToken.expiresAt < new Date()) {
    throw new Error('Refresh token expiré');
  }

  return refreshToken;
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await RefreshToken.findOneAndUpdate({ token }, { isRevoked: true });
};

export const revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
  await RefreshToken.updateMany({ user: userId, isRevoked: false }, { isRevoked: true });
};
