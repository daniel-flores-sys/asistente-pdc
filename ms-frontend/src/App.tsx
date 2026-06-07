import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

// Guards y layouts
import PrivateRoute from '@/components/PrivateRoute';
import AdminRoute from '@/components/AdminRoute';
import AppLayout from '@/components/AppLayout';

// Páginas públicas
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// Páginas privadas
import GenerarWizard from '@/pages/GenerarWizard';
import Historial from '@/pages/Historial';

// Admin
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDocumentos from '@/pages/admin/AdminDocumentos';
import AdminReferencia from '@/pages/admin/AdminReferencia';
import AdminConfig from '@/pages/admin/AdminConfig';
import AdminDocentes from '@/pages/admin/AdminDocentes';
import AdminMonitor from '@/pages/admin/AdminMonitor';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Privadas — requieren token */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/generar" element={<GenerarWizard />} />
            <Route path="/historial" element={<Historial />} />
          </Route>

          {/* Admin — requieren rol admin, layout propio */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/documentos" replace />} />
              <Route path="documentos" element={<AdminDocumentos />} />
              <Route path="referencia" element={<AdminReferencia />} />
              <Route path="config" element={<AdminConfig />} />
              <Route path="docentes" element={<AdminDocentes />} />
              <Route path="monitor" element={<AdminMonitor />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast global */}
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
