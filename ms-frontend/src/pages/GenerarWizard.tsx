import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { getReferenceData, generatePDC, GenerateResult, ReferenceData, Trimestre } from '@/api';
import { useAppStore } from '@/store/useAppStore';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Docente', 'Asignación', 'Materias', 'Materiales'];

export default function GenerarWizard() {
  const user = useAppStore((s) => s.user);
  const updateCreditos = useAppStore((s) => s.updateCreditos);
  const navigate = useNavigate();

  const [refData, setRefData] = useState<ReferenceData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  // Paso 1
  const [nombreDocente, setNombreDocente] = useState(user?.nombre ?? '');
  const [ciDocente, setCiDocente] = useState(user?.ci ?? '');
  const [tituloDocente, setTituloDocente] = useState(user?.titulo ?? 'Lic.');
  const [unidadEducativa, setUnidadEducativa] = useState('');
  const [distrito, setDistrito] = useState('');
  const [nombreDirector, setNombreDirector] = useState('');

  // Paso 2
  const [anioId, setAnioId] = useState(0);
  const [trimId, setTrimId] = useState(0);

  // Paso 3
  const [areasSelected, setAreasSelected] = useState<number[]>([]);
  const [temasSelected, setTemasSelected] = useState<Record<number, number[]>>({});

  // Paso 4
  const [materiales, setMateriales] = useState('');
  const [contexto, setContexto] = useState('');

  const creditos = user?.creditos ?? 0;
  const sinCreditos = creditos === 0;

  useEffect(() => {
    getReferenceData()
      .then(setRefData)
      .catch((e) => setLoadError('No se pudieron cargar los datos: ' + e.message));
  }, []);

  const toggleArea = (id: number) =>
    setAreasSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleTema = (areaId: number, temaId: number) =>
    setTemasSelected((prev) => {
      const cur = prev[areaId] ?? [];
      return {
        ...prev,
        [areaId]: cur.includes(temaId) ? cur.filter((x) => x !== temaId) : [...cur, temaId],
      };
    });

  const selectedTrim: Trimestre | undefined = refData?.trimestres.find((t) => t.id === trimId);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await generatePDC({
        nombre_docente: nombreDocente,
        ci_docente: ciDocente,
        titulo_docente: tituloDocente,
        unidad_educativa: unidadEducativa,
        distrito,
        nombre_director: nombreDirector || undefined,
        anio_escolaridad_id: anioId,
        trimestre_id: trimId,
        areas_seleccionadas: areasSelected,
        temas_seleccionados: temasSelected as Record<string, number[]>,
        materiales,
        contexto_social: contexto,
      });
      // Sincroniza los créditos en el store con el valor devuelto por el backend
      updateCreditos(res.creditos_restantes);
      setResult(res);
    } catch (e: any) {
      setError('Error: ' + (e.response?.data?.detalle ?? e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setStep(1);
    setAreasSelected([]);
    setTemasSelected({});
    setMateriales('');
    setContexto('');
  };

  // ── Estados de carga y error ───────────────────────────────────────────────

  if (loadError)
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {loadError}
            <br />
            <span className="text-xs opacity-70">Verifica que ms-orchestrator esté en :3001</span>
          </AlertDescription>
        </Alert>
      </div>
    );

  if (!refData)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm">Cargando datos del sistema...</p>
        </div>
      </div>
    );

  // ── Pantalla de éxito ──────────────────────────────────────────────────────

  if (result)
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold">PDC Generado</h2>
              <p className="text-muted-foreground text-sm">Plan #{result.plan_id} listo</p>
            </div>
            <Button asChild className="w-full">
              <a href={result.download_url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 w-4 h-4" />
                Descargar {result.filename}
              </a>
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="w-4 h-4" />
              Te quedan <strong>{result.creditos_restantes}</strong> crédito{result.creditos_restantes !== 1 ? 's' : ''}
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="w-full">
              <RotateCcw className="mr-2 w-3.5 h-3.5" />
              Generar otro PDC
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  // ── Wizard principal ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cabecera con créditos */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generar PDC</h1>
          <p className="text-muted-foreground text-sm">Plan de Desarrollo Curricular</p>
        </div>
        <Badge variant={sinCreditos ? 'destructive' : 'secondary'} className="flex items-center gap-1.5 text-sm px-3 py-1">
          <Coins className="w-3.5 h-3.5" />
          {creditos} crédito{creditos !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} className="flex items-center gap-1 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                    ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : n}
                </div>
                <span className={`text-xs hidden sm:block truncate ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <Separator className={`flex-1 mb-5 ${done ? 'bg-green-400' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        {/* ── Paso 1: Datos del docente ─────────────────────────────────── */}
        {step === 1 && (
          <>
            <CardHeader><CardTitle>Datos del Docente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo *</Label>
                  <Input id="nombre" value={nombreDocente} onChange={(e) => setNombreDocente(e.target.value)} placeholder="María Medina Apaza" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="titulo">Título</Label>
                  <Input id="titulo" value={tituloDocente} onChange={(e) => setTituloDocente(e.target.value)} placeholder="Lic." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ci">Cédula de Identidad *</Label>
                <Input id="ci" value={ciDocente} onChange={(e) => setCiDocente(e.target.value)} placeholder="87654321" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ue">Unidad Educativa *</Label>
                <Input id="ue" value={unidadEducativa} onChange={(e) => setUnidadEducativa(e.target.value)} placeholder="U.E. Simón Bolívar" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="distrito">Distrito *</Label>
                  <Input id="distrito" value={distrito} onChange={(e) => setDistrito(e.target.value)} placeholder="Distrito 1 — Santa Cruz" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="director">Director/a (opcional)</Label>
                  <Input id="director" value={nombreDirector} onChange={(e) => setNombreDirector(e.target.value)} placeholder="Prof. Juan Pérez" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!nombreDocente.trim() || !ciDocente.trim() || !unidadEducativa.trim() || !distrito.trim()}
                >
                  Siguiente <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* ── Paso 2: Asignación ────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <CardHeader><CardTitle>Asignación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Año de Escolaridad *</Label>
                <Select value={anioId ? String(anioId) : ''} onValueChange={(v) => setAnioId(+v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar año..." />
                  </SelectTrigger>
                  <SelectContent>
                    {refData.anios_escolaridad.map((ae) => (
                      <SelectItem key={ae.id} value={String(ae.id)}>
                        {ae.literal} — {ae.nivel_nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trimestre *</Label>
                <Select value={trimId ? String(trimId) : ''} onValueChange={(v) => setTrimId(+v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar trimestre..." />
                  </SelectTrigger>
                  <SelectContent>
                    {refData.trimestres.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        Trimestre {t.numero} — {t.gestion_anio} ({t.fecha_inicio} al {t.fecha_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 w-4 h-4" /> Atrás
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)} disabled={!anioId || !trimId}>
                  Siguiente <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* ── Paso 3: Materias y temas ──────────────────────────────────── */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Materias y Temas</CardTitle>
              <p className="text-sm text-muted-foreground">Selecciona las áreas y los temas del mes.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {refData.areas_curriculares.map((area) => {
                const checked = areasSelected.includes(area.id);
                const temasFiltrados = refData.temas_mes.filter(
                  (t) =>
                    t.area_curricular_id === area.id &&
                    t.anio_escolaridad_id === anioId &&
                    t.trimestre_num === (selectedTrim?.numero ?? 1),
                );
                return (
                  <div
                    key={area.id}
                    className={`border rounded-lg p-3 transition-colors ${checked ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`area-${area.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleArea(area.id)}
                      />
                      <label htmlFor={`area-${area.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium text-sm">{area.nombre}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{area.codigo}</Badge>
                      </label>
                    </div>

                    {checked && (
                      <div className="mt-3 pl-7 space-y-1">
                        {temasFiltrados.length > 0 ? (
                          temasFiltrados.map((t) => (
                            <div key={t.id} className="flex items-start gap-2">
                              <Checkbox
                                id={`tema-${t.id}`}
                                checked={(temasSelected[area.id] ?? []).includes(t.id)}
                                onCheckedChange={() => toggleTema(area.id, t.id)}
                                className="mt-0.5"
                              />
                              <label htmlFor={`tema-${t.id}`} className="text-xs cursor-pointer text-muted-foreground leading-5">
                                <span className="font-medium text-foreground">Semana {t.semana_num}:</span> {t.titulo}
                              </label>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-amber-600">Sin temas registrados — se generará contenido automático.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-1 w-4 h-4" /> Atrás
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)} disabled={areasSelected.length === 0}>
                  Siguiente <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* ── Paso 4: Materiales y contexto ─────────────────────────────── */}
        {step === 4 && (
          <>
            <CardHeader><CardTitle>Materiales y Contexto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="materiales">Materiales disponibles</Label>
                <Textarea
                  id="materiales"
                  value={materiales}
                  onChange={(e) => setMateriales(e.target.value)}
                  rows={3}
                  placeholder="Texto de aprendizaje, cuaderno, lápices de colores, regla..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contexto">Contexto sociocultural</Label>
                <Textarea
                  id="contexto"
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  rows={3}
                  placeholder="Comunidad rural de Sajlina, actividades agrícolas, región chaqueña..."
                />
              </div>

              {sinCreditos && (
                <Alert variant="destructive">
                  <Coins className="w-4 h-4" />
                  <AlertDescription>
                    Sin créditos disponibles — contacta al administrador para recargar.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-1 w-4 h-4" /> Atrás
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={submitting || sinCreditos}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Generando PDC… (30–90 s)
                    </>
                  ) : (
                    'Generar PDC'
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Resumen visible en pasos 3 y 4 */}
      {(step === 3 || step === 4) && (
        <Card className="bg-muted/40">
          <CardContent className="py-3 px-4 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>Docente:</strong> {tituloDocente} {nombreDocente}</span>
            <span><strong>CI:</strong> {ciDocente}</span>
            <span><strong>U.E.:</strong> {unidadEducativa}</span>
            <span><strong>Áreas:</strong> {areasSelected.length} seleccionadas</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
