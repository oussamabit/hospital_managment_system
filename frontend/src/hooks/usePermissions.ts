import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { Role } from '../types';

export const usePermissions = () => {
  const { user, hasRole, isDoctor, isSenior, isSecretaire, isAdmin } = useAuth();

  const canCreateRdv = useCallback(() => hasRole(Role.MEDECIN, Role.SECRETAIRE, Role.ADMIN), [hasRole]);
  const canDeleteRdv = useCallback(() => isSenior || isAdmin, [isSenior, isAdmin]);
  const canAssignRdvToDoctor = useCallback(() => isSenior || isSecretaire || isAdmin, [isSenior, isSecretaire, isAdmin]);
  const canViewConsultations = useCallback(() => isDoctor || isAdmin || isSecretaire, [isDoctor, isAdmin, isSecretaire]);
  const canCreateConsultations = useCallback(() => isDoctor || isAdmin, [isDoctor, isAdmin]);
  const canDeletePatient = useCallback(() => isSenior || isAdmin, [isSenior, isAdmin]);
  const canViewMedicalNotes = useCallback(() => isDoctor || isAdmin, [isDoctor, isAdmin]);
  const canManageUsers = useCallback(() => isAdmin, [isAdmin]);

  const canEditRdv = useCallback(
    (medecinId?: string) => {
      if (isSenior || isSecretaire || isAdmin) return true;
      // MEDECIN JUNIOR can edit only their own
      if (isDoctor && !isSenior && medecinId && user?._id === medecinId) return true;
      return false;
    },
    [isSenior, isSecretaire, isAdmin, isDoctor, user]
  );

  const canEditConsultation = useCallback(
    (medecinId?: string) => {
      if (isSenior || isAdmin) return true;
      if (isDoctor && medecinId && user?._id === medecinId) return true;
      return false;
    },
    [isSenior, isAdmin, isDoctor, user]
  );

  const getRoleLabel = useCallback((role: Role): string => {
    const labels: Record<Role, string> = {
      ADMIN: 'Administrateur',
      MEDECIN: 'Médecin',
      SECRETAIRE: 'Secrétaire',
      INFIRMIER: 'Infirmier',
    };
    return labels[role] || role;
  }, []);

  const canManagePrescriptions = useCallback(() => isDoctor || isAdmin || hasRole(Role.ADMIN), [isDoctor, isAdmin, hasRole]);

  return {
    isDoctor,
    isSenior,
    isSecretaire,
    isAdmin,
    hasRole,
    canCreateRdv,
    canDeleteRdv,
    canAssignRdvToDoctor,
    canViewConsultations,
    canCreateConsultations,
    canDeletePatient,
    canViewMedicalNotes,
    canManageUsers,
    canEditRdv,
    canEditConsultation,
    canManagePrescriptions,
    getRoleLabel,
  };
};
