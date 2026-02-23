import React, { createContext, useContext, useState } from 'react';
import { Page, RouterState } from '../types';

interface RouterContextType {
  route: RouterState;
  navigate: (page: Page, contactId?: string) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouterState>({ page: 'login' });

  const navigate = (page: Page, contactId?: string) => {
    setRoute({ page, contactId });
    window.scrollTo(0, 0);
  };

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}
