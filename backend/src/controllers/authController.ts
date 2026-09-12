import { Request, Response } from 'express';
import { z } from 'zod';
import User, { Role, Grade } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from '../utils/jwt';
import { jwtConfig } from '../config/jwt';
import logger from '../config/logger';
import { AuthRequest } from '../middlewares/authMiddleware';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
});

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  firstName: z.string().min(2, 'Prénom trop court'),
  lastName: z.string().min(2, 'Nom trop court'),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  // Role specific fields
  grade: z.nativeEnum(Grade).optional(),
  specialite: z.string().optional(),
  numeroOrdre: z.string().optional(),
  service: z.string().optional(),
  codePoste: z.string().optional(),
  matricule: z.string().optional(),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court').optional(),
  lastName: z.string().min(2, 'Nom trop court').optional(),
  phone: z.string().optional(),
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: jwtConfig.refreshExpiresInMs,
  path: '/',
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const { email, password } = result.data;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn(`Login failed: User not found for ${email}`);
      res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      return;
    }

    if (!user.isActive) {
      logger.warn(`Login failed: User ${email} is inactive`);
      res.status(403).json({ message: 'Compte désactivé. Contactez l\'administrateur.' });
      return;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      logger.warn(`Login failed: Password mismatch for ${email}`);
      res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(
      user,
      req.headers['user-agent'],
      req.ip
    );

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Remove password from response
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.password;

    res.json({
      accessToken,
      user: userObj,
    });

    logger.info(`User ${user.email} logged in successfully`);

    // Audit Log
    logAction({
      action: AuditAction.LOGIN,
      resourceType: 'User',
      resourceId: user._id,
      performedBy: user._id,
      description: `Connexion réussie: ${user.email}`,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      res.status(401).json({ message: 'Refresh token manquant' });
      return;
    }

    const refreshTokenDoc = await verifyRefreshToken(token);
    const user = refreshTokenDoc.user as unknown as InstanceType<typeof User>;

    // Rotate refresh token
    await revokeRefreshToken(token);
    const newRefreshToken = await generateRefreshToken(
      user as Parameters<typeof generateRefreshToken>[0],
      req.headers['user-agent'],
      req.ip
    );

    const accessToken = generateAccessToken(user as Parameters<typeof generateAccessToken>[0]);

    res.cookie('refreshToken', newRefreshToken, cookieOptions);
    res.json({ accessToken });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.clearCookie('refreshToken');
    res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await revokeRefreshToken(token);
    }

    if (req.user) {
      await revokeAllUserRefreshTokens(req.user._id as string);
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Déconnexion réussie' });

    // Audit Log
    if (req.user) {
      logAction({
        action: AuditAction.LOGOUT,
        resourceType: 'User',
        resourceId: req.user._id as string,
        performedBy: req.user._id as string,
        description: `Déconnexion: ${req.user.email}`,
      });
    }
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ message: 'Erreur lors de la déconnexion' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const { currentPassword, newPassword } = result.data;
    const user = await User.findById(req.user?._id).select('+password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Mot de passe actuel incorrect' });
      return;
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    // Revoke all refresh tokens after password change
    await revokeAllUserRefreshTokens(user._id as string);
    res.clearCookie('refreshToken');

    res.json({ message: 'Mot de passe modifié avec succès. Veuillez vous reconnecter.' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
};

export const getDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctors = await User.find({
      role: Role.MEDECIN,
      isActive: true,
    }).select('-password');
    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des médecins' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const { firstName, lastName, phone } = result.data;

    // Only update provided fields
    const updateData: Record<string, string> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    res.json({ user, message: 'Profil mis à jour avec succès' });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
      return;
    }

    const { email, password, role, ...details } = result.data;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    let newUser;
    const commonData = {
      email,
      password: hashedPassword,
      firstName: details.firstName,
      lastName: details.lastName,
      role,
      phone: details.phone,
      isActive: false, // Must be validated by Admin
    };

    if (role === Role.MEDECIN) {
      if (!details.grade || !details.specialite || !details.numeroOrdre) {
        res.status(400).json({ message: 'Informations médicales manquantes' });
        return;
      }
      newUser = await require('../models/User').Medecin.create({
        ...commonData,
        grade: details.grade,
        specialite: details.specialite,
        numeroOrdre: details.numeroOrdre,
        service: details.service,
      });
    } else if (role === Role.SECRETAIRE) {
      if (!details.codePoste) {
        res.status(400).json({ message: 'Code poste manquant' });
        return;
      }
      newUser = await require('../models/User').Secretaire.create({
        ...commonData,
        codePoste: details.codePoste,
        service: details.service,
      });
    } else if (role === Role.INFIRMIER) {
      if (!details.matricule) {
        res.status(400).json({ message: 'Matricule manquant' });
        return;
      }
      newUser = await require('../models/User').Infirmier.create({
        ...commonData,
        matricule: details.matricule,
      });
    } else {
      newUser = await User.create(commonData);
    }

    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({
      message: 'Inscription réussie. Votre compte est en attente de validation par l\'administrateur.',
      user: {
        id: newUser._id as string,
        email: newUser.email,
        role: newUser.role,
      },
    });

    logger.info(`New user registration: ${email} as ${role}`);

    // Audit Log
    const { logAction } = require('../services/auditService');
    const { AuditAction } = require('../models/AuditLog');
    logAction({
      action: AuditAction.CREATE,
      resourceType: 'User',
      resourceId: newUser._id,
      performedBy: newUser._id, // Self-created
      description: `Nouvelle inscription: ${email} (${role})`,
      newState: userObj
    });
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'champ';
      const msg = field === 'email' ? 'Cet email est déjà utilisé' :
        field === 'numeroOrdre' ? 'Ce numéro d\'ordre est déjà utilisé' :
          `Valeur en double pour ${field}`;
      res.status(400).json({ message: msg });
      return;
    }
    logger.error('Signup error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
};
