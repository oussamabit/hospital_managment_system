import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { User, Role } from '../types';
import { authApi } from '../services/api';
import { AxiosError } from 'axios';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESTORE_SESSION'; payload: { user: User; accessToken: string } }
  | { type: 'UPDATE_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'RESTORE_SESSION':
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isSenior: boolean;
  isSecretaire: boolean;
  isInfirmier: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const response = await authApi.getProfile();
        dispatch({
          type: 'RESTORE_SESSION',
          payload: { user: response.data.user, accessToken: token },
        });
      } catch {
        localStorage.removeItem('accessToken');
        dispatch({ type: 'LOGOUT' });
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { accessToken, user } = response.data;
    localStorage.setItem('accessToken', accessToken);
    dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Even if the API call fails, clear local state
      const err = e as AxiosError;
      console.warn('Logout API error:', err.message);
    } finally {
      localStorage.removeItem('accessToken');
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!state.user) return false;
      return roles.includes(state.user.role as Role);
    },
    [state.user]
  );

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    updateUser: (user: User) => dispatch({ type: 'UPDATE_USER', payload: user }),
    hasRole,
    isAdmin: state.user?.role === 'ADMIN',
    isDoctor: state.user?.role === 'MEDECIN',
    isSenior: state.user?.role === 'MEDECIN' && state.user?.grade === 'SENIOR',
    isSecretaire: state.user?.role === 'SECRETAIRE',
    isInfirmier: state.user?.role === 'INFIRMIER',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
