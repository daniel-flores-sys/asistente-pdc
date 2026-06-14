import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Coins, Loader2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminAddCreditos, adminCreateDocente, adminGetDocentes, adminToggleActivo } from '@/api';

interface Docente {
  id: string;
  nombre: string;
  email: string;
  ci: string;
  titulo: string;
  creditos: number;
  activo: boolean;
}

const emptyForm = { nombre: '', email: '', password: '', ci: '', titulo: 'Lic.', creditos: 5 };

export default function AdminDocentes() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creditosInput, setCreditosInput] = useState<Record<string, string>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // Modal crear docente
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    adminGetDocentes()
      .then(setDocentes)
      .catch((e) => setError(e.response?.data?.message ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAddCreditos = async (id: string) => {
    const n = parseInt(creditosInput[id] ?? '0', 10);
    if (!n || n <= 0) return;
    try {
      await adminAddCreditos(id, n);
      setDocentes((prev) =>
        prev.map((d) => (d.id === id ? { ...d, creditos: d.creditos + n } : d)),
      );
      setCreditosInput((prev) => ({ ...prev, [id]: '' }));
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al agregar créditos');
    }
  };

  const handleToggle = async (id: string, activo: boolean) => {
    setToggling((prev) => ({ ...prev, [id]: true }));
    try {
      await adminToggleActivo(id, !activo);
      setDocentes((prev) =>
        prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d)),
      );
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al cambiar estado');
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const nuevo = await adminCreateDocente({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        ci: form.ci,
        titulo: form.titulo || undefined,
        creditos: form.creditos,
      });
      setDocentes((prev) => [nuevo, ...prev]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (e: any) {
      setCreateError(e.response?.data?.message ?? 'Error al crear docente');
    } finally {
      setCreating(false);
    }
  };

  const setField = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: k === 'creditos' ? +e.target.value : e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Docentes</h1>
          <p className="text-muted-foreground text-sm">Administra créditos y estado de los docentes registrados.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Crear docente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear docente manualmente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="c-nombre">Nombre completo *</Label>
                  <Input id="c-nombre" value={form.nombre} onChange={setField('nombre')} required placeholder="María Medina Apaza" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="c-email">Email *</Label>
                  <Input id="c-email" type="email" value={form.email} onChange={setField('email')} required placeholder="docente@example.com" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="c-pass">Contraseña *</Label>
                  <Input id="c-pass" type="password" value={form.password} onChange={setField('password')} required minLength={8} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-ci">CI *</Label>
                  <Input id="c-ci" value={form.ci} onChange={setField('ci')} required placeholder="87654321" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-titulo">Título</Label>
                  <Input id="c-titulo" value={form.titulo} onChange={setField('titulo')} placeholder="Lic." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-creditos">Créditos iniciales</Label>
                  <Input id="c-creditos" type="number" min="0" value={form.creditos} onChange={setField('creditos')} />
                </div>
              </div>
              {createError && (
                <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>
              )}
              <Separator />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                  Crear cuenta
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">Docentes registrados</CardTitle>
          <Badge variant="secondary">{docentes.length}</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : docentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No hay docentes registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Docente</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead className="text-center">Créditos</TableHead>
                  <TableHead>Agregar créditos</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docentes.map((d) => (
                  <TableRow key={d.id} className={!d.activo ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{d.titulo} {d.nombre}</p>
                        <p className="text-xs text-muted-foreground">{d.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{d.ci}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={d.creditos === 0 ? 'destructive' : 'secondary'}
                        className="flex items-center gap-1 justify-center w-fit mx-auto"
                      >
                        <Coins className="w-3 h-3" />
                        {d.creditos}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="1" placeholder="0"
                          className="w-20 h-8 text-sm"
                          value={creditosInput[d.id] ?? ''}
                          onChange={(e) => setCreditosInput((p) => ({ ...p, [d.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCreditos(d.id)}
                        />
                        <Button size="sm" variant="outline" onClick={() => handleAddCreditos(d.id)}>
                          + Agregar
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleToggle(d.id, d.activo)}
                        disabled={toggling[d.id]}
                        className={d.activo ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground'}
                      >
                        {toggling[d.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : d.activo ? (
                          <><ToggleRight className="w-5 h-5 mr-1" /> Activo</>
                        ) : (
                          <><ToggleLeft className="w-5 h-5 mr-1" /> Inactivo</>
                        )}
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
