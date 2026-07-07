import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { ParentAuthProvider } from './lib/parentAuth.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ParentAuthProvider>
          <App />
        </ParentAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
