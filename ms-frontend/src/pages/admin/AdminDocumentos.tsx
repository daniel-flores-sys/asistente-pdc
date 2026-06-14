import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { FileText, Loader2, RefreshCcw, Trash2, UploadCloud } from 'lucide-react';
import { adminDeleteDocumento, adminGetDocumentos, adminReindexDocumento, adminUploadDocumento } from '@/api';

interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  chunks: number;
  fecha: string;
}

export default function AdminDocumentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reindexing, setReindexing] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    adminGetDocumentos()
      .then((raw: any) => {
        if (!Array.isArray(raw)) {
          throw new Error(raw?.detail ?? raw?.message ?? 'Respuesta inesperada del servidor');
        }
        setDocs(raw.map((d) => ({
          id: d.id,
          nombre: d.nombre_archivo ?? '',
          tipo: d.tipo ?? '',
          chunks: d.chunks_generados ?? 0,
          fecha: d.creado_en ?? new Date().toISOString(),
        })));
      })
      .catch((e) => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const upload = async (file: File) => {
    setError('');
    setSuccess('');
    setUploading(true);
    setUploadProgress(10);
    const timer = setInterval(() => setUploadProgress((p) => Math.min(p + 15, 85)), 400);
    try {
      await adminUploadDocumento(file);
      setUploadProgress(100);
      setSuccess(`"${file.name}" subido correctamente.`);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al subir el archivo');
    } finally {
      clearInterval(timer);
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, []);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      await adminDeleteDocumento(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al eliminar');
    }
  };

  const handleReindex = async (id: string) => {
    setReindexing((p) => ({ ...p, [id]: true }));
    setError('');
    try {
      const res = await adminReindexDocumento(id);
      setSuccess(res.mensaje ?? `Re-indexado: ${res.chunks_generados ?? 0} chunks generados.`);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al re-indexar');
    } finally {
      setReindexing((p) => ({ ...p, [id]: false }));
    }
  };

  const ext = (nombre: string) => nombre.split('.').pop()?.toUpperCase() ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos de Contexto</h1>
        <p className="text-muted-foreground text-sm">Sube PDFs, DOCX o TXT que sirven de base para la generación de PDCs.</p>
      </div>

      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          <UploadCloud className={`w-10 h-10 ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium text-sm">Arrastra un archivo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT — máximo 20 MB</p>
          </div>
          {uploading && (
            <div className="w-full max-w-xs space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Subiendo...</p>
            </div>
          )}
        </CardContent>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </Card>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">Documentos indexados</CardTitle>
          <Badge variant="secondary">{docs.length}</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No hay documentos aún.</div>
          ) : (
            <ul>
              {docs.map((doc, i) => (
                <li key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i !== docs.length - 1 ? 'border-b' : ''}`}>
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.chunks} chunks · {new Date(doc.fecha).toLocaleDateString('es-BO')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{ext(doc.nombre)}</Badge>
                  <Button
                    variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleReindex(doc.id)}
                    disabled={reindexing[doc.id]}
                    title="Re-indexar en ChromaDB"
                  >
                    {reindexing[doc.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(doc.id, doc.nombre)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
