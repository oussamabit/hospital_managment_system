import { Response, NextFunction } from 'express';
import { Role, Grade } from '../models/User';
import { AuthRequest } from './authMiddleware';

export const requireRoles = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({
        message: 'Accès refusé. Vous n\'avez pas la permission requise.',
        requiredRoles: roles,
        yourRole: req.user.role,
      });
      return;
    }

    next();
  };
};

// Senior Doctor check
export const isSenior = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.SENIOR) {
    next();
    return;
  }
  res.status(403).json({ message: 'Accès réservé aux médecins seniors' });
};

// Shorthand guards
export const isDoctor = requireRoles(Role.MEDECIN);
export const isSecretaire = requireRoles(Role.SECRETAIRE);
export const isAnyRole = requireRoles(Role.MEDECIN, Role.SECRETAIRE, Role.ADMIN, Role.INFIRMIER);

// Block medical data access for SECRETAIRE
export const blockSecretaire = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === Role.SECRETAIRE) {
    res.status(403).json({
      message: 'Accès interdit. Les données médicales ne sont pas accessibles au personnel administratif.',
    });
    return;
  }
  next();
};
