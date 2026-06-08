import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';

// Instancia base — Vite redirige /api/* al orchestrator
const api = axios.create({ baseURL: '/api' });

// Adjunta el token JWT en cada request si existe
api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el backend responde 401 limpiamos la sesión
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAppStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Tipos de dominio ──────────────────────────────────────────────────────────

export interface AnioEscolaridad {
  id: number;
  nivel_id: number;
  numero: number;
  literal: string;
  nivel_nombre: string;
}

export interface AreaCurricular {
  id: number;
  nivel_id: number;
  nombre: string;
  codigo: string;
}

export interface Trimestre {
  id: number;
  gestion_id: number;
  numero: number;
  fecha_inicio: string;
  fecha_fin: string;
  gestion_anio: number;
}

export interface TemaMes {
  id: number;
  area_curricular_id: number;
  anio_escolaridad_id: number;
  trimestre_num: number;
  semana_num: number;
  titulo: string;
  descripcion: string;
}

export interface ReferenceData {
  anios_escolaridad: AnioEscolaridad[];
  areas_curriculares: AreaCurricular[];
  trimestres: Trimestre[];
  temas_mes: TemaMes[];
}

export interface GeneratePayload {
  nombre_docente: string;
  ci_docente: string;
  titulo_docente: string;
  unidad_educativa: string;
  distrito: string;
  nombre_director?: string;
  anio_escolaridad_id: number;
  trimestre_id: number;
  areas_seleccionadas: number[];
  temas_seleccionados: Record<string, number[]>;
  materiales: string;
  contexto_social: string;
}

export interface GenerateResult {
  plan_id: number;
  download_url: string;
  filename: string;
  creditos_restantes: number;
}

export interface HistorialItem {
  id: number;
  fecha: string;
  unidad_educativa: string;
  trimestre: string;
  filename: string;
  download_url: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

// Normaliza el token y obtiene el perfil completo vía /auth/me
// El login devuelve `role` (inglés); el store espera `rol` (español)
// El admin no tiene ci/titulo/creditos en la respuesta de login → los trae /auth/me
export const authLogin = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  const token: string = data.access_token ?? data.token;

  // Llamar /auth/me con el token recién obtenido (aún no está en el store)
  const me = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = me.data;

  const user = {
    id: raw.id as number,
    nombre: raw.nombre as string,
    email: raw.email as string,
    ci: (raw.ci ?? '') as string,
    titulo: (raw.titulo ?? '') as string,
    rol: (raw.rol ?? raw.role) as 'docente' | 'admin',
    creditos: (raw.creditos ?? 0) as number,
    activo: (raw.activo ?? true) as boolean,
  };

  return { user, token };
};

// Register devuelve solo el usuario creado — sin token; el flujo redirige a /login
export const authRegister = (data: {
  nombre: string;
  email: string;
  password: string;
  ci: string;
  titulo: string;
}) => api.post('/auth/register', data).then((r) => r.data);

export const authMe = () =>
  api.get('/auth/me').then((r) => r.data);

// ── Datos de referencia y generación ─────────────────────────────────────────

export const getReferenceData = (): Promise<ReferenceData> =>
  api.get('/reference-data').then((r) => r.data);

export const generatePDC = (payload: GeneratePayload): Promise<GenerateResult> =>
  api.post('/generate', payload).then((r) => r.data);

export const getHistorial = (): Promise<HistorialItem[]> =>
  api.get('/historial').then((r) => r.data);

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminGetDocumentos = () =>
  api.get('/admin/documentos').then((r) => r.data);

export const adminDeleteDocumento = (id: number) =>
  api.delete(`/admin/documentos/${id}`);

export const adminReindexDocumento = (id: number) =>
  api.post(`/admin/documentos/${id}/reindex`).then((r) => r.data);

export const adminUploadDocumento = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/admin/documentos', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const adminGetDocentes = () =>
  api.get('/admin/usuarios').then((r) => r.data);

export const adminCreateDocente = (data: {
  nombre: string;
  email: string;
  password: string;
  ci: string;
  titulo?: string;
  creditos?: number;
}) => api.post('/admin/usuarios', data).then((r) => r.data);

export const adminAddCreditos = (id: number, creditos: number) =>
  api.put(`/admin/usuarios/${id}/creditos`, { creditos });

export const adminToggleActivo = (id: number, activo: boolean) =>
  api.put(`/admin/usuarios/${id}/activo`, { activo });

// Config claves: 'llm_params' | 'rag_params' | 'ingest_params' | 'prompts'
export const adminGetConfig = (clave: string) =>
  api.get(`/admin/config/${clave}`).then((r) => r.data);

export const adminSaveConfig = (clave: string, data: unknown) =>
  api.put(`/admin/config/${clave}`, data);

export const adminGetReferencia = (recurso: string) =>
  api.get(`/admin/referencia/${recurso}`).then((r) => r.data);

export const adminCreateReferencia = (recurso: string, data: unknown) =>
  api.post(`/admin/referencia/${recurso}`, data).then((r) => r.data);

export const adminUpdateReferencia = (recurso: string, id: number, data: unknown) =>
  api.put(`/admin/referencia/${recurso}/${id}`, data);

export const adminDeleteReferencia = (recurso: string, id: number) =>
  api.delete(`/admin/referencia/${recurso}/${id}`);

export const adminGetMonitorServices = () =>
  api.get('/admin/monitor/services').then((r) => r.data);

export const adminGetMonitorMetrics = () =>
  api.get('/admin/monitor/metrics').then((r) => r.data);

export const adminGetMonitorAlerts = () =>
  api.get('/admin/monitor/alerts').then((r) => r.data);

export const adminScaleService = (service_name: string, replicas: number) =>
  api.post('/admin/monitor/scale', { service_name, replicas });

export const adminGetMonitorConfig = () =>
  api.get('/admin/monitor/config').then((r) => r.data);

export const adminSaveMonitorConfig = (data: unknown) =>
  api.put('/admin/monitor/config', data);
