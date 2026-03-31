// src/app/context/Auth/useAuth.tsx

import { useContext } from 'react';
import { AuthContext } from './AuthContext.tsx'; // Adjust path as needed

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (undefined === context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
