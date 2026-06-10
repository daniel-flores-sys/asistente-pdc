import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  adminCreateReferencia,
  adminDeleteReferencia,
  adminGetReferencia,
  adminUpdateReferencia,
} from '@/api';

type Row = Record<string, string | number>;

const TABS = [
  { key: 'niveles',   label: 'Niveles',             fields: ['nombre'] },
  { key: 'anios',     label: 'Años de Escolaridad', fields: ['literal', 'nivel_id', 'numero'] },
  { key: 'areas',     label: 'Áreas Curriculares',  fields: ['nombre', 'codigo', 'nivel_id'] },
  { key: 'temas',     label: 'Temas Mensuales',     fields: ['titulo', 'semana_num', 'trimestre_num'] },
  { key: 'objetivos', label: 'Objetivos Holísticos', fields: ['anio_escolaridad_id', 'descripcion'] },
];

function ResourceTab({ recurso, fields }: { recurso: string; fields: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Row>({});
  const [newRow, setNewRow] = useState<Row>({});
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminGetReferencia(recurso)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [recurso]);

  const handleEdit = (row: Row) => {
    setEditingId(row.id as number);
    setEditData({ ...row });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await adminUpdateReferencia(recurso, editData.id as number, editData);
      setRows((prev) => prev.map((r) => (r.id === editData.id ? { ...editData } : r)));
      setEditingId(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await adminDeleteReferencia(recurso, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al eliminar');
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia(recurso, newRow);
      setRows((prev) => [...prev, created]);
      setNewRow({});
      setAdding(false);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  {fields.map((f) => <TableHead key={f}>{f}</TableHead>)}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Fila nueva */}
                {adding && (
                  <TableRow className="bg-primary/5">
                    <TableCell className="text-muted-foreground text-xs">nuevo</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f}>
                        <Input
                          className="h-7 text-xs"
                          placeholder={f}
                          value={(newRow[f] as string) ?? ''}
                          onChange={(e) => setNewRow((p) => ({ ...p, [f]: e.target.value }))}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={handleAdd} disabled={saving}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setAdding(false)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.id as number}>
                    <TableCell className="text-muted-foreground text-xs">{row.id as number}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f}>
                        {editingId === row.id ? (
                          <Input
                            className="h-7 text-xs"
                            value={(editData[f] as string) ?? ''}
                            onChange={(e) => setEditData((p) => ({ ...p, [f]: e.target.value }))}
                          />
                        ) : (
                          <span className="text-sm">{String(row[f] ?? '')}</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {editingId === row.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => handleEdit(row)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(row.id as number)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

export default function AdminReferencia() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Datos de Referencia</h1>
        <p className="text-muted-foreground text-sm">CRUD de tablas de catálogo usadas en el wizard.</p>
      </div>

      <Tabs defaultValue="anios-escolaridad">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TABS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key} className="text-xs">{label}</TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ key, fields }) => (
          <TabsContent key={key} value={key} className="mt-4">
            <ResourceTab recurso={key} fields={fields} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
