import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  adminCreateReferencia,
  adminDeleteReferencia,
  adminGetReferencia,
  adminUpdateReferencia,
  NivelEducativo,
  AnioEscolaridad,
  AreaCurricular,
  TemaTrimestral,
  ObjetivoHolistico,
} from '@/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TRIMESTRES = [
  { value: '1', label: 'Primer Trimestre' },
  { value: '2', label: 'Segundo Trimestre' },
  { value: '3', label: 'Tercer Trimestre' },
];

function Err({ msg }: { msg: string }) {
  return msg ? (
    <Alert variant="destructive" className="mb-3">
      <AlertDescription>{msg}</AlertDescription>
    </Alert>
  ) : null;
}

function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1 justify-end">
      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onEdit}>
        <Pencil className="w-3 h-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="w-7 h-7 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ── 1. NIVELES EDUCATIVOS ─────────────────────────────────────────────────────

export function NivelesTab() {
  const [rows, setRows] = useState<NivelEducativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [adding, setAdding] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminGetReferencia('niveles')
      .then((d) => setRows(d as NivelEducativo[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startEdit = (r: NivelEducativo) => { setEditId(r.id); setEditNombre(r.nombre); };

  const save = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await adminUpdateReferencia('niveles', editId, { nombre: editNombre });
      setRows((p) => p.map((r) => r.id === editId ? { ...r, nombre: editNombre } : r));
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia('niveles', { nombre: newNombre });
      setRows((p) => [...p, created as NivelEducativo]);
      setNewNombre(''); setAdding(false);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al crear'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este nivel? Se eliminarán también los años y áreas asociados.')) return;
    try {
      await adminDeleteReferencia('niveles', id);
      setRows((p) => p.filter((r) => r.id !== id));
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al eliminar'); }
  };

  return (
    <div className="space-y-4">
      <Err msg={error} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar nivel
        </Button>
      </div>
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && (
                <TableRow className="bg-primary/5">
                  <TableCell>
                    <Input className="h-7 text-xs" placeholder="Ej: Inicial" value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={add} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setAdding(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {editId === r.id
                      ? <Input className="h-7 text-xs" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                      : <span className="text-sm font-medium">{r.nombre}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {editId === r.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={save} disabled={saving}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : <ActionButtons onEdit={() => startEdit(r)} onDelete={() => del(r.id)} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

// ── 2. AÑOS DE ESCOLARIDAD ────────────────────────────────────────────────────

export function AniosTab() {
  const [niveles, setNiveles] = useState<NivelEducativo[]>([]);
  const [rows, setRows] = useState<AnioEscolaridad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nivel_id: '', numero: '', literal: '' });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([adminGetReferencia('niveles'), adminGetReferencia('anios')])
      .then(([n, a]) => { setNiveles(n as NivelEducativo[]); setRows(a as AnioEscolaridad[]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (r: AnioEscolaridad) => {
    setEditId(r.id);
    setForm({ nivel_id: r.nivel_id, numero: String(r.numero), literal: r.literal });
  };

  const payload = () => ({ nivel_id: form.nivel_id, numero: Number(form.numero), literal: form.literal });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminUpdateReferencia('anios', editId!, payload()) as any;
      const nivel = niveles.find((n) => n.id === form.nivel_id);
      setRows((p) => p.map((r) => r.id === editId
        ? { ...r, ...updated, nivel_nombre: nivel?.nombre ?? r.nivel_nombre } : r));
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia('anios', payload()) as any;
      const nivel = niveles.find((n) => n.id === form.nivel_id);
      setRows((p) => [...p, { ...created, nivel_nombre: nivel?.nombre ?? '' }]);
      setForm({ nivel_id: '', numero: '', literal: '' }); setAdding(false);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al crear'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este año? Se eliminarán objetivos y temas asociados.')) return;
    try { await adminDeleteReferencia('anios', id); setRows((p) => p.filter((r) => r.id !== id)); }
    catch (e: any) { setError(e.response?.data?.message ?? 'Error al eliminar'); }
  };

  const renderForm = () => (
    <div className="flex gap-2 items-center">
      <Select value={form.nivel_id} onValueChange={(v) => setForm((p) => ({ ...p, nivel_id: v }))}>
        <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Nivel" /></SelectTrigger>
        <SelectContent>{niveles.map((n) => <SelectItem key={n.id} value={n.id}>{n.nombre}</SelectItem>)}</SelectContent>
      </Select>
      <Input className="h-7 text-xs w-16" type="number" placeholder="Nº" value={form.numero}
        onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} />
      <Input className="h-7 text-xs flex-1" placeholder="Literal (ej: Cuarto)" value={form.literal}
        onChange={(e) => setForm((p) => ({ ...p, literal: e.target.value }))} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Err msg={error} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar año
        </Button>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead className="w-12">Nº</TableHead>
                <TableHead>Literal</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && (
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={3}>{renderForm()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={add} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setAdding(false)}><X className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {editId === r.id ? (
                    <TableCell colSpan={3}>{renderForm()}</TableCell>
                  ) : (
                    <>
                      <TableCell><Badge variant="outline" className="text-xs">{r.nivel_nombre}</Badge></TableCell>
                      <TableCell className="text-center text-sm">{r.numero}</TableCell>
                      <TableCell className="text-sm">{r.literal}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    {editId === r.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={save} disabled={saving}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    ) : <ActionButtons onEdit={() => startEdit(r)} onDelete={() => del(r.id)} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

// ── 3. ÁREAS CURRICULARES ─────────────────────────────────────────────────────

export function AreasTab() {
  const [niveles, setNiveles] = useState<NivelEducativo[]>([]);
  const [rows, setRows] = useState<AreaCurricular[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nivel_id: '', nombre: '', codigo: '', carga_horaria: '' });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([adminGetReferencia('niveles'), adminGetReferencia('areas')])
      .then(([n, a]) => { setNiveles(n as NivelEducativo[]); setRows(a as AreaCurricular[]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (r: AreaCurricular) => {
    setEditId(r.id);
    setForm({ nivel_id: r.nivel_id, nombre: r.nombre, codigo: r.codigo, carga_horaria: r.carga_horaria ?? '' });
  };

  const payload = () => ({
    nivel_id: form.nivel_id, nombre: form.nombre, codigo: form.codigo,
    carga_horaria: form.carga_horaria || undefined,
  });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminUpdateReferencia('areas', editId!, payload()) as any;
      const nivel = niveles.find((n) => n.id === form.nivel_id);
      setRows((p) => p.map((r) => r.id === editId
        ? { ...r, ...updated, nivel_nombre: nivel?.nombre ?? r.nivel_nombre } : r));
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia('areas', payload()) as any;
      const nivel = niveles.find((n) => n.id === form.nivel_id);
      setRows((p) => [...p, { ...created, nivel_nombre: nivel?.nombre ?? '' }]);
      setForm({ nivel_id: '', nombre: '', codigo: '', carga_horaria: '' }); setAdding(false);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al crear'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta área? Se eliminarán los temas asociados.')) return;
    try { await adminDeleteReferencia('areas', id); setRows((p) => p.filter((r) => r.id !== id)); }
    catch (e: any) { setError(e.response?.data?.message ?? 'Error al eliminar'); }
  };

  const renderForm = () => (
    <div className="flex gap-2 items-center flex-wrap">
      <Select value={form.nivel_id} onValueChange={(v) => setForm((p) => ({ ...p, nivel_id: v }))}>
        <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Nivel" /></SelectTrigger>
        <SelectContent>{niveles.map((n) => <SelectItem key={n.id} value={n.id}>{n.nombre}</SelectItem>)}</SelectContent>
      </Select>
      <Input className="h-7 text-xs w-12" placeholder="Cod" value={form.codigo}
        onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))} />
      <Input className="h-7 text-xs w-48" placeholder="Nombre del área" value={form.nombre}
        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
      <Input className="h-7 text-xs flex-1" placeholder="Carga horaria (opcional)" value={form.carga_horaria}
        onChange={(e) => setForm((p) => ({ ...p, carga_horaria: e.target.value }))} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Err msg={error} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar área
        </Button>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead className="w-16">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden lg:table-cell">Carga horaria</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && (
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={4}>{renderForm()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={add} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setAdding(false)}><X className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {editId === r.id ? (
                    <TableCell colSpan={4}>{renderForm()}</TableCell>
                  ) : (
                    <>
                      <TableCell><Badge variant="outline" className="text-xs">{r.nivel_nombre}</Badge></TableCell>
                      <TableCell><Badge className="text-xs font-mono">{r.codigo}</Badge></TableCell>
                      <TableCell className="text-sm">{r.nombre}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{r.carga_horaria ?? '—'}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    {editId === r.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={save} disabled={saving}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    ) : <ActionButtons onEdit={() => startEdit(r)} onDelete={() => del(r.id)} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

// ── 4. TEMAS TRIMESTRALES ─────────────────────────────────────────────────────

export function TemasTab() {
  const [areas, setAreas]   = useState<AreaCurricular[]>([]);
  const [anios, setAnios]   = useState<AnioEscolaridad[]>([]);
  const [rows, setRows]     = useState<TemaTrimestral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm]     = useState({
    area_curricular_id: '', anio_escolaridad_id: '', trimestre_num: '',
    titulo: '', descripcion: '',
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      adminGetReferencia('areas'),
      adminGetReferencia('anios'),
      adminGetReferencia('temas'),
    ])
      .then(([a, an, t]) => {
        setAreas(a as AreaCurricular[]);
        setAnios(an as AnioEscolaridad[]);
        setRows(t as TemaTrimestral[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (r: TemaTrimestral) => {
    setEditId(r.id);
    setForm({
      area_curricular_id: r.area_curricular_id,
      anio_escolaridad_id: r.anio_escolaridad_id,
      trimestre_num: String(r.trimestre_num),
      titulo: r.titulo,
      descripcion: r.descripcion ?? '',
    });
  };

  const payload = () => ({
    area_curricular_id: form.area_curricular_id,
    anio_escolaridad_id: form.anio_escolaridad_id,
    trimestre_num: Number(form.trimestre_num),
    titulo: form.titulo,
    descripcion: form.descripcion || undefined,
  });

  const labelFor = (f: typeof form) => {
    const area  = areas.find((a) => a.id === f.area_curricular_id);
    const anio  = anios.find((a) => a.id === f.anio_escolaridad_id);
    return { area_nombre: area?.nombre, area_codigo: area?.codigo, anio_literal: anio?.literal, nivel_nombre: anio ? anios.find((a) => a.id === anio.id)?.nivel_nombre : undefined };
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminUpdateReferencia('temas', editId!, payload()) as any;
      setRows((p) => p.map((r) => r.id === editId ? { ...r, ...updated, ...labelFor(form) } : r));
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia('temas', payload()) as any;
      setRows((p) => [...p, { ...created, ...labelFor(form) }]);
      setForm({ area_curricular_id: '', anio_escolaridad_id: '', trimestre_num: '', titulo: '', descripcion: '' });
      setAdding(false);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al crear'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este tema?')) return;
    try { await adminDeleteReferencia('temas', id); setRows((p) => p.filter((r) => r.id !== id)); }
    catch (e: any) { setError(e.response?.data?.message ?? 'Error al eliminar'); }
  };

  const renderForm = () => (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <Select value={form.area_curricular_id} onValueChange={(v) => setForm((p) => ({ ...p, area_curricular_id: v }))}>
          <SelectTrigger className="h-7 text-xs w-48"><SelectValue placeholder="Área curricular" /></SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="font-mono mr-1 text-xs text-muted-foreground">{a.codigo}</span> {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.anio_escolaridad_id} onValueChange={(v) => setForm((p) => ({ ...p, anio_escolaridad_id: v }))}>
          <SelectTrigger className="h-7 text-xs w-48"><SelectValue placeholder="Año de escolaridad" /></SelectTrigger>
          <SelectContent>
            {anios.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="text-xs text-muted-foreground mr-1">{a.nivel_nombre}</span> {a.literal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.trimestre_num} onValueChange={(v) => setForm((p) => ({ ...p, trimestre_num: v }))}>
          <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>{TRIMESTRES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Input className="h-7 text-xs" placeholder="Título del tema" value={form.titulo}
        onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} />
      <Textarea className="text-xs min-h-[60px]" placeholder="Descripción (opcional)" value={form.descripcion}
        onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Err msg={error} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar tema
        </Button>
      </div>

      {adding && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo tema trimestral</p>
            {renderForm()}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editId && (
        <Card className="border-amber-400/50 bg-amber-50/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Editando tema</p>
            {renderForm()}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Guardar cambios
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel / Año</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="w-28">Trimestre</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={editId === r.id ? 'opacity-40' : ''}>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{r.nivel_nombre}</div>
                    <div className="text-sm font-medium">{r.anio_literal}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">{r.area_codigo}</Badge>
                    <span className="ml-1 text-xs hidden lg:inline">{r.area_nombre}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className="text-xs" variant={r.trimestre_num === 1 ? 'default' : r.trimestre_num === 2 ? 'secondary' : 'outline'}>
                      T{r.trimestre_num}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.titulo}</TableCell>
                  <TableCell className="text-right">
                    <ActionButtons onEdit={() => startEdit(r)} onDelete={() => del(r.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

// ── 5. OBJETIVOS HOLÍSTICOS ───────────────────────────────────────────────────

export function ObjetivosTab() {
  const [anios, setAnios]   = useState<AnioEscolaridad[]>([]);
  const [rows, setRows]     = useState<ObjetivoHolistico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm]     = useState({
    anio_escolaridad_id: '', trimestre_num: '',
    ser: '', saber: '', hacer: '', decidir: '',
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([adminGetReferencia('anios'), adminGetReferencia('objetivos')])
      .then(([a, o]) => { setAnios(a as AnioEscolaridad[]); setRows(o as ObjetivoHolistico[]); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (r: ObjetivoHolistico) => {
    setEditId(r.id);
    setForm({
      anio_escolaridad_id: r.anio_escolaridad_id,
      trimestre_num: String(r.trimestre_num),
      ser: r.ser, saber: r.saber, hacer: r.hacer, decidir: r.decidir,
    });
  };

  const payload = () => ({
    anio_escolaridad_id: form.anio_escolaridad_id,
    trimestre_num: Number(form.trimestre_num),
    ser: form.ser, saber: form.saber, hacer: form.hacer, decidir: form.decidir,
  });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminUpdateReferencia('objetivos', editId!, payload()) as any;
      const anio = anios.find((a) => a.id === form.anio_escolaridad_id);
      setRows((p) => p.map((r) => r.id === editId
        ? { ...r, ...updated, anio_literal: anio?.literal, nivel_nombre: anio?.nivel_nombre } : r));
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const created = await adminCreateReferencia('objetivos', payload()) as any;
      const anio = anios.find((a) => a.id === form.anio_escolaridad_id);
      setRows((p) => [...p, { ...created, anio_literal: anio?.literal, nivel_nombre: anio?.nivel_nombre }]);
      setForm({ anio_escolaridad_id: '', trimestre_num: '', ser: '', saber: '', hacer: '', decidir: '' });
      setAdding(false);
    } catch (e: any) { setError(e.response?.data?.message ?? 'Error al crear'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo holístico?')) return;
    try { await adminDeleteReferencia('objetivos', id); setRows((p) => p.filter((r) => r.id !== id)); }
    catch (e: any) { setError(e.response?.data?.message ?? 'Error al eliminar'); }
  };

  const renderForm = () => (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Select value={form.anio_escolaridad_id} onValueChange={(v) => setForm((p) => ({ ...p, anio_escolaridad_id: v }))}>
          <SelectTrigger className="h-7 text-xs w-56"><SelectValue placeholder="Año de escolaridad" /></SelectTrigger>
          <SelectContent>
            {anios.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="text-xs text-muted-foreground mr-1">{a.nivel_nombre}</span> {a.literal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.trimestre_num} onValueChange={(v) => setForm((p) => ({ ...p, trimestre_num: v }))}>
          <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>{TRIMESTRES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(['ser', 'saber', 'hacer', 'decidir'] as const).map((dim) => (
          <div key={dim} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dim}</label>
            <Textarea
              className="text-xs min-h-[80px]"
              placeholder={`Dimensión del ${dim}...`}
              value={form[dim]}
              onChange={(e) => setForm((p) => ({ ...p, [dim]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Err msg={error} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Agregar objetivo
        </Button>
      </div>

      {adding && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo objetivo holístico</p>
            {renderForm()}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editId && (
        <Card className="border-amber-400/50 bg-amber-50/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Editando objetivo holístico</p>
            {renderForm()}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Guardar cambios
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel / Año</TableHead>
                <TableHead className="w-28">Trimestre</TableHead>
                <TableHead>Ser</TableHead>
                <TableHead className="hidden md:table-cell">Saber</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={editId === r.id ? 'opacity-40' : ''}>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{r.nivel_nombre}</div>
                    <div className="text-sm font-medium">{r.anio_literal}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className="text-xs" variant={r.trimestre_num === 1 ? 'default' : r.trimestre_num === 2 ? 'secondary' : 'outline'}>
                      T{r.trimestre_num}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={r.ser}>{r.ser}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate hidden md:table-cell" title={r.saber}>{r.saber}</TableCell>
                  <TableCell className="text-right">
                    <ActionButtons onEdit={() => startEdit(r)} onDelete={() => del(r.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground text-right">{rows.length} registros</p>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────

export default function AdminReferencia() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Datos de Referencia</h1>
        <p className="text-muted-foreground text-sm">
          Gestión de los catálogos del currículo boliviano usados en el wizard de generación de PDCs.
        </p>
      </div>

      <Tabs defaultValue="niveles">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="niveles"   className="text-xs">Niveles</TabsTrigger>
          <TabsTrigger value="anios"     className="text-xs">Años de Escolaridad</TabsTrigger>
          <TabsTrigger value="areas"     className="text-xs">Áreas Curriculares</TabsTrigger>
          <TabsTrigger value="temas"     className="text-xs">Temas Trimestrales</TabsTrigger>
          <TabsTrigger value="objetivos" className="text-xs">Objetivos Holísticos</TabsTrigger>
        </TabsList>

        <TabsContent value="niveles"   className="mt-4"><NivelesTab /></TabsContent>
        <TabsContent value="anios"     className="mt-4"><AniosTab /></TabsContent>
        <TabsContent value="areas"     className="mt-4"><AreasTab /></TabsContent>
        <TabsContent value="temas"     className="mt-4"><TemasTab /></TabsContent>
        <TabsContent value="objetivos" className="mt-4"><ObjetivosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
