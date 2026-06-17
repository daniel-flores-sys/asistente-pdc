import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';

// Instancia base — Vite redirige /api/* al orchestrator
const api = axios.create({ baseURL: '/api' });

// Adjunta el token JWT en cada request si existe y no hay Authorization explícito.
// Sin esta condición el interceptor sobreescribe el token nuevo durante authLogin,
// haciendo que /auth/me devuelva los datos de la sesión anterior.
api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

export interface NivelEducativo {
  id: string;
  nombre: string;
}

export interface AnioEscolaridad {
  id: string;
  nivel_id: string;
  numero: number;
  literal: string;
  nivel_nombre: string;
}

export interface AreaCurricular {
  id: string;
  nivel_id: string;
  nombre: string;
  codigo: string;
  carga_horaria?: string;
  nivel_nombre?: string;
}

export interface Trimestre {
  id: string;
  gestion_id: string;
  numero: number;
  fecha_inicio: string;
  fecha_fin: string;
  gestion_anio: number;
}

export interface TemaTrimestral {
  id: string;
  area_curricular_id: string;
  anio_escolaridad_id: string;
  trimestre_num: number;
  titulo: string;
  descripcion?: string;
  area_nombre?: string;
  area_codigo?: string;
  anio_literal?: string;
  nivel_nombre?: string;
}

export interface ObjetivoHolistico {
  id: string;
  anio_escolaridad_id: string;
  trimestre_num: number;
  ser: string;
  saber: string;
  hacer: string;
  decidir: string;
  anio_literal?: string;
  nivel_nombre?: string;
}

export interface ReferenceData {
  anios_escolaridad: AnioEscolaridad[];
  areas_curriculares: AreaCurricular[];
  trimestres: Trimestre[];
  temas_mes: TemaTrimestral[];
}

export interface GeneratePayload {
  nombre_docente: string;
  ci_docente: string;
  titulo_docente: string;
  unidad_educativa: string;
  distrito: string;
  nombre_director?: string;
  anio_escolaridad_id: string;
  trimestre_id: string;
  areas_seleccionadas: string[];
  temas_seleccionados: Record<string, string[]>;
  materiales: string;
  contexto_social: string;
}

export interface GenerateResult {
  plan_id: string;
  download_url: string;
  filename: string;
  creditos_restantes: number;
}

export interface HistorialItem {
  id: string;
  fecha: string;
  unidad_educativa: string;
  trimestre: string;
  filename: string;
  download_url: string;
  anio_literal?: string;
  nivel_nombre?: string;
  gestion_anio?: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const API_VERSION = '2';

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
    id: raw.id as string,
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

export const getHistorialDownloadUrl = (id: string): Promise<{ url: string; filename: string }> =>
  api.get(`/historial/${id}/download-url`).then((r) => r.data);

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminGetDocumentos = () =>
  api.get('/admin/documentos').then((r) => r.data);

export const adminDeleteDocumento = (id: string) =>
  api.delete(`/admin/documentos/${id}`);

export const adminReindexDocumento = (id: string) =>
  api.post(`/admin/documentos/${id}/reindex`).then((r) => r.data);

export const adminUploadDocumento = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  // No setear Content-Type manualmente: axios lo pone con el boundary correcto
  return api.post('/admin/documentos', fd).then((r) => r.data);
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

export const adminAddCreditos = (id: string, creditos: number) =>
  api.put(`/admin/usuarios/${id}/creditos`, { creditos });

export const adminToggleActivo = (id: string, activo: boolean) =>
  api.put(`/admin/usuarios/${id}/activo`, { activo });

// Config claves: 'llm_params' | 'rag_params' | 'ingest_params' | 'prompts'
export const adminGetConfig = (clave: string) =>
  api.get(`/admin/config/${clave}`).then((r) => r.data);

export const adminSaveConfig = (clave: string, data: unknown) =>
  // El DTO del backend espera { valor: ... } — sin este wrapper retorna 400
  api.put(`/admin/config/${clave}`, { valor: data });

export const adminGetReferencia = (recurso: string) =>
  api.get(`/admin/referencia/${recurso}`).then((r) => r.data);

export const adminCreateReferencia = (recurso: string, data: unknown) =>
  api.post(`/admin/referencia/${recurso}`, data).then((r) => r.data);

export const adminUpdateReferencia = (recurso: string, id: string, data: unknown) =>
  api.put(`/admin/referencia/${recurso}/${id}`, data).then((r) => r.data);

export const adminDeleteReferencia = (recurso: string, id: string) =>
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
