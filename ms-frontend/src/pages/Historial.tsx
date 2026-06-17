import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, FileText, Loader2 } from 'lucide-react';
import { getHistorial, getHistorialDownloadUrl, HistorialItem } from '@/api';

export default function Historial() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const { url, filename } = await getHistorialDownloadUrl(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // fallback: descargar via proxy directo
      window.open(`/api/historial/${id}/download`, '_blank');
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    getHistorial()
      .then(setItems)
      .catch((e) => setError(e.response?.data?.message ?? 'Error al cargar historial'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial de PDCs</h1>
        <p className="text-muted-foreground text-sm">Todos tus planes generados anteriormente.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Planes generados
          </CardTitle>
          <Badge variant="secondary">{items.length} documento{items.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground text-sm">Aún no has generado ningún PDC.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Unidad Educativa</TableHead>
                  <TableHead>Trimestre</TableHead>
                  <TableHead className="text-right">Descargar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {new Date(item.fecha).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{item.unidad_educativa}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.trimestre}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloading === item.id}
                        onClick={() => handleDownload(item.id)}
                      >
                        {downloading === item.id
                          ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          : <Download className="w-4 h-4 mr-1" />}
                        {item.filename}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
