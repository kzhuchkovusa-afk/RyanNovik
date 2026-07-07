import { useNavigate } from 'react-router-dom';
import PinPad from './PinPad.jsx';
import { useParentAuth } from '../../lib/parentAuth.jsx';
import ParentArea from './ParentArea.jsx';

// Shell around the parent area. Shows the PIN pad until a valid parent token
// is in sessionStorage; then hands control to <ParentArea> (Progress +
// Controls tabs). Exiting from inside calls logout() and returns to /play.
export default function ParentGate() {
  const { token, logout } = useParentAuth();
  const nav = useNavigate();

  if (!token) {
    return <PinPad onCancel={() => nav('/play')} />;
  }
  return <ParentArea onExit={() => { logout(); nav('/play'); }} />;
}
