import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/shared/Landing.jsx';
import Login from './components/shared/Login.jsx';
import EnterViaLink from './components/shared/EnterViaLink.jsx';
import InstallHint from './components/shared/InstallHint.jsx';
import ChildHub from './components/child/ChildHub.jsx';
import ParentGate from './components/parent/ParentGate.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import CreateChild from './components/admin/CreateChild.jsx';
import CreateClient from './components/admin/CreateClient.jsx';
import ManageChild from './components/admin/ManageChild.jsx';
import ClientView from './components/admin/ClientView.jsx';
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
    <>
      <InstallHint />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/enter" element={<EnterViaLink />} />

        {/* Game contract — /game-host loads inside a sandboxed iframe and
            speaks the SDK contract. No auth wrapper. */}
        <Route path="/game-host" element={<GameHost />} />
        <Route path="/dev/sdk-test" element={<DevSdkTest />} />

        <Route path="/play" element={<Protected roles={['child']}><ChildHub /></Protected>} />
        <Route path="/parent" element={<Protected roles={['child']}><ParentGate /></Protected>} />

        <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="/admin/new" element={<Protected roles={['admin']}><CreateChild /></Protected>} />
        <Route path="/admin/new-client" element={<Protected roles={['admin']}><CreateClient /></Protected>} />
        <Route path="/admin/client/:id" element={<Protected roles={['admin']}><ClientView /></Protected>} />
        <Route path="/admin/child/:id" element={<Protected roles={['admin']}><ManageChild /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
