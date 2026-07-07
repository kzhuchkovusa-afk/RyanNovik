import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/shared/Landing.jsx';
import Login from './components/shared/Login.jsx';
import ChildHub from './components/child/ChildHub.jsx';
import GamePlayer from './components/child/GamePlayer.jsx';
import ParentDashboard from './components/parent/ParentDashboard.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import CreateChild from './components/admin/CreateChild.jsx';
import ManageChild from './components/admin/ManageChild.jsx';
import ManageGames from './components/admin/ManageGames.jsx';
import GameHost from './game-host/GameHost.jsx';
import DevSdkTest from './components/shell/DevSdkTest.jsx';
import { useAuth } from './lib/auth.jsx';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-spinner">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Game contract — the /game-host route is loaded inside a sandboxed iframe
          and speaks the SDK contract. It has no layout/auth wrapper: the shell
          passes child/config via postMessage, not via routing state. */}
      <Route path="/game-host" element={<GameHost />} />
      {/* Dev-only SDK harness. Safe to leave in prod — reachable via URL only. */}
      <Route path="/dev/sdk-test" element={<DevSdkTest />} />

      <Route
        path="/play"
        element={
          <Protected roles={['child']}>
            <ChildHub />
          </Protected>
        }
      />
      <Route
        path="/play/game/:id"
        element={
          <Protected roles={['child']}>
            <GamePlayer />
          </Protected>
        }
      />
      <Route
        path="/parent"
        element={
          <Protected roles={['child']}>
            <ParentDashboard />
          </Protected>
        }
      />

      <Route
        path="/admin"
        element={
          <Protected roles={['admin']}>
            <AdminDashboard />
          </Protected>
        }
      />
      <Route
        path="/admin/new"
        element={
          <Protected roles={['admin']}>
            <CreateChild />
          </Protected>
        }
      />
      <Route
        path="/admin/child/:id"
        element={
          <Protected roles={['admin']}>
            <ManageChild />
          </Protected>
        }
      />
      <Route
        path="/admin/child/:id/games"
        element={
          <Protected roles={['admin']}>
            <ManageGames />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
