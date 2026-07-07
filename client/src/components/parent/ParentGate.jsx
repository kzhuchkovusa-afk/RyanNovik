import { useNavigate } from 'react-router-dom';
import PinPad from './PinPad.jsx';
import { useParentAuth } from '../../lib/parentAuth.jsx';
import ParentDashboard from './ParentDashboard.jsx';

// Shell around the parent area. Shows the PIN pad until a valid parent token
// is in sessionStorage; then hands control to <ParentDashboard>. Exiting the
// parent area (from inside the dashboard) calls logout() and returns here.
export default function ParentGate() {
  const { token, logout } = useParentAuth();
  const nav = useNavigate();

  if (!token) {
    return <PinPad onCancel={() => nav('/play')} />;
  }
  return <ParentDashboard onExit={() => { logout(); nav('/play'); }} />;
}
