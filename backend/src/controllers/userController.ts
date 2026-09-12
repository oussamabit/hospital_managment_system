import { Response } from 'express';
import User, { Role, Grade, Medecin, Secretaire, Infirmier } from '../models/User';
import { AuthRequest } from '../middlewares/authMiddleware';
import logger from '../config/logger';
import { hashPassword } from '../utils/password';
import { z } from 'zod';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';

const updateUserSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    grade: z.nativeEnum(Grade).optional(),
    specialite: z.string().optional(),
    numeroOrdre: z.string().optional(),
    service: z.string().optional(),
    codePoste: z.string().optional(),
    matricule: z.string().optional(),
    password: z.string().min(6).optional(),
});

const createUserSchema = z.object({
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

export const getPendingUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find({ isActive: false }).select('-password');
        logger.info(`Fetching pending users for Admin ${req.user?.email}. Found: ${users.length}`);
        res.json({ users });
    } catch (error) {
        logger.error('Get pending users error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des comptes en attente' });
    }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find().select('-password');
        logger.info(`Fetching all users for Admin ${req.user?.email}. Found: ${users.length}`);
        res.json({ users });
    } catch (error) {
        logger.error('Get all users error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
    }
};

export const approveUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndUpdate(id, { $set: { isActive: true } }, { new: true }).select('-password');

        if (!user) {
            res.status(404).json({ message: 'Utilisateur introuvable' });
            return;
        }

        res.json({ user, message: 'Compte validé avec succès' });
        logger.info(`Admin ${req.user?.email} approved user ${user.email}`);

        // Audit Log
        logAction({
            action: AuditAction.STATUS_CHANGE,
            resourceType: 'User',
            resourceId: user._id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Approuvé l'utilisateur ${user.email}`,
            previousState: { isActive: false },
            newState: { isActive: true }
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la validation du compte' });
    }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!Object.values(Role).includes(role)) {
            res.status(400).json({ message: 'Rôle invalide' });
            return;
        }

        const user = await User.findById(id);
        if (!user) {
            res.status(404).json({ message: 'Utilisateur introuvable' });
            return;
        }

        // Changing roles in Mongoose discriminators is tricky. 
        // Usually it requires updating the discriminator key directly if it's the same base model.
        // In our case, the base model is 'User' and disc key is 'userType'.

        user.role = role;
        // We might need to handle specific fields if common fields differ, 
        // but for now we just change the role enum. 
        // Note: Mongoose might not change the __t (or userType) automatically this way.

        await User.findByIdAndUpdate(id, { $set: { role, userType: role === Role.MEDECIN ? 'Medecin' : role === Role.SECRETAIRE ? 'Secretaire' : role === Role.INFIRMIER ? 'Infirmier' : undefined } });

        const updated = await User.findById(id).select('-password');
        if (!updated) {
            res.status(404).json({ message: 'Utilisateur introuvable après mise à jour' });
            return;
        }

        res.json({ user: updated, message: 'Rôle mis à jour' });

        // Audit Log
        logAction({
            action: AuditAction.UPDATE,
            resourceType: 'User',
            resourceId: id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Changé le rôle de ${user.email} de ${user.role} à ${role}`,
            previousState: { role: user.role },
            newState: { role: updated.role }
        });
    } catch (error) {
        logger.error('Update role error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du rôle' });
    }
};

export const terminateUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).select('-password');

        if (!user) {
            res.status(404).json({ message: 'Utilisateur introuvable' });
            return;
        }

        res.json({ user, message: 'Compte désactivé' });
        logger.info(`Admin ${req.user?.email} deactivated user ${user.email}`);

        // Audit Log
        logAction({
            action: AuditAction.STATUS_CHANGE,
            resourceType: 'User',
            resourceId: user._id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Désactivé l'utilisateur ${user.email}`,
            previousState: { isActive: true },
            newState: { isActive: false }
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la désactivation du compte' });
    }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        if (!user) {
            res.status(404).json({ message: 'Utilisateur introuvable' });
            return;
        }
        res.json({ user });
    } catch (error) {
        logger.error('Get user by id error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur' });
    }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = updateUserSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
            return;
        }

        const user = await User.findById(id);
        if (!user) {
            res.status(404).json({ message: 'Utilisateur introuvable' });
            return;
        }

        const { password, ...fieldsToUpdate } = result.data;
        const updatePayload: Record<string, unknown> = { ...fieldsToUpdate };

        if (password) {
            updatePayload.password = await hashPassword(password);
        }

        const updated = await User.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true }
        ).select('-password');

        logger.info(`Admin ${req.user?.email} updated user ${user.email}`);
        res.json({ user: updated, message: 'Utilisateur mis à jour avec succès' });

        // Audit Log
        logAction({
            action: AuditAction.UPDATE,
            resourceType: 'User',
            resourceId: id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Mis à jour les informations de ${user.email}`,
            previousState: user.toObject(),
            newState: updated?.toObject()
        });
    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const result = createUserSchema.safeParse(req.body);
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
            isActive: true, // Created by admin, so automatically active
        };

        if (role === Role.MEDECIN) {
            if (!details.grade || !details.specialite || !details.numeroOrdre) {
                res.status(400).json({ message: 'Informations médicales manquantes' });
                return;
            }
            newUser = await Medecin.create({
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
            newUser = await Secretaire.create({
                ...commonData,
                codePoste: details.codePoste,
                service: details.service,
            });
        } else if (role === Role.INFIRMIER) {
            if (!details.matricule) {
                res.status(400).json({ message: 'Matricule manquant' });
                return;
            }
            newUser = await Infirmier.create({
                ...commonData,
                matricule: details.matricule,
            });
        } else {
            newUser = await User.create(commonData);
        }

        const userObj = newUser.toObject() as unknown as Record<string, unknown>;
        delete userObj.password;

        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            user: userObj,
        });

        logger.info(`Admin ${req.user?.email} created new user: ${email} as ${role}`);

        // Audit Log
        logAction({
            action: AuditAction.CREATE,
            resourceType: 'User',
            resourceId: newUser._id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Créé un nouvel utilisateur ${email} (${role})`,
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
        logger.error('Create user error:', error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
    }
};
