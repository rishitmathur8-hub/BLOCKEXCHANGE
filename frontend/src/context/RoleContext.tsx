import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@/types';

interface RoleContextType {
  role: UserRole;
  userName: string;
  setRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
}

const DEFAULT_USERS: Record<UserRole, string> = {
  'Section Controller': 'V. K. Aggarwal (Chief Controller)',
  'Field Supervisor': 'Rameshwar Singh (SSE / P-Way)',
  'Engineering Officer': 'A. Roy (Sr. Divisional Engineer / Civil)',
  'S&T Officer': 'P. N. Sharma (Sr. Divisional Signal Engineer)',
  'Electrical (OHE) Officer': 'M. K. Verma (Sr. DEE / Traction)',
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('be_user_role') as UserRole) || 'Section Controller';
  });

  const [userName, setUserNameState] = useState<string>(() => {
    return localStorage.getItem('be_user_name') || DEFAULT_USERS[role];
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('be_user_role', newRole);
    const defaultName = DEFAULT_USERS[newRole];
    setUserNameState(defaultName);
    localStorage.setItem('be_user_name', defaultName);
  };

  const setUserName = (name: string) => {
    setUserNameState(name);
    localStorage.setItem('be_user_name', name);
  };

  return (
    <RoleContext.Provider value={{ role, userName, setRole, setUserName }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
