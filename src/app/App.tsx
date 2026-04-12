import { Routes, Route, Outlet } from 'react-router-dom';
import { Navbar } from './nav/Navbar';
import { routes } from './pages/index.tsx';
import AuthWrapper from '../components/AuthWrapper.tsx';

export default function App() {
  return (
    <Navbar>
      <Routes>
        <Route path="/" element={<Outlet />}>
          {routes.map(({ path, element: Element, requiresAuth, requiresAdmin }) => (
            <Route
              key={path}
              path={path === '/' ? undefined : path.replace(/^\//, '')}
              index={path === '/'}
              element={
                <AuthWrapper requiresAuth={requiresAuth} requiresAdmin={requiresAdmin}>
                  <Element />
                </AuthWrapper>
              }
            />
          ))}
        </Route>
      </Routes>
    </Navbar>
  );
}
