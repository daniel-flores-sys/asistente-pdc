import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Cpu,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
} from 'lucide-react';
import {
  adminGetMonitorServices,
  adminGetMonitorMetrics,
  adminGetMonitorAlerts,
  adminGetMonitorConfig,
  adminSaveMonitorConfig,
  adminScaleService,
} from '@/api';

interface ServiceInfo {
  name: string;
  replicas_running: number;
  replicas_desired: number;
  image: string;
  tasks: { id: string; state: string; node: string; updated_at: string }[];
}

interface MetricInfo {
  service_name: string;
  cpu_percent: number;
  memory_mb: number;
  restart_count: number;
}

interface AlertItem {
  timestamp: string;
  service: string;
  event: 'scale_up' | 'scale_down' | 'container_restart' | 'service_down';
  details: string;
  old_value: number | null;
  new_value: number | null;
}

interface MonitorConfig {
  scale_up_cpu_threshold: number;
  scale_down_cpu_threshold: number;
  scale_down_delay_minutes: number;
  max_replicas: number;
  min_replicas: number;
}

const estadoBadge = (running: number, desired: number) => {
  if (running === 0) return { label: 'Caído', variant: 'destructive' as const };
  if (running < desired) return { label: 'Parcial', variant: 'outline' as const };
  return { label: 'Corriendo', variant: 'default' as const };
};

const eventColor: Record<AlertItem['event'], string> = {
  scale_up: 'text-blue-500',
  scale_down: 'text-orange-500',
  container_restart: 'text-yellow-500',
  service_down: 'text-red-500',
};

export default function AdminMonitor() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [config, setConfig] = useState<MonitorConfig>({
    scale_up_cpu_threshold: 70,
    scale_down_cpu_threshold: 20,
    scale_down_delay_minutes: 5,
    max_replicas: 5,
    min_replicas: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scaling, setScaling] = useState<Record<string, boolean>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [svc, met, ale, cfg] = await Promise.all([
        adminGetMonitorServices(),
        adminGetMonitorMetrics(),
        adminGetMonitorAlerts(),
        adminGetMonitorConfig(),
      ]);
      setServices(svc);
      setMetrics(met);
      setAlerts(ale);
      setConfig(cfg);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al conectar con ms-monitor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleScale = async (name: string, current: number, delta: number) => {
    const next = Math.max(0, current + delta);
    setScaling((p) => ({ ...p, [name]: true }));
    try {
      await adminScaleService(name, next);
      setServices((prev) =>
        prev.map((s) => (s.name === name ? { ...s, replicas_desired: next } : s)),
      );
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al escalar');
    } finally {
      setScaling((p) => ({ ...p, [name]: false }));
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await adminSaveMonitorConfig(config);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al guardar configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const getMetric = (name: string) => metrics.find((m) => m.service_name === name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitor Swarm</h1>
          <p className="text-muted-foreground text-sm">Estado en tiempo real — refresca cada 30 s.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {configSaved && <Alert><AlertDescription>Configuración de umbrales guardada.</AlertDescription></Alert>}

      {loading && services.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="servicios">
          <TabsList>
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="metricas">CPU / RAM</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
            <TabsTrigger value="config">Auto-scaling</TabsTrigger>
          </TabsList>

          {/* ── Servicios ─────────────────────────────────────────────── */}
          <TabsContent value="servicios" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((svc) => {
                const badge = estadoBadge(svc.replicas_running, svc.replicas_desired);
                return (
                  <Card key={svc.name}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm">{svc.name}</CardTitle>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground font-mono truncate">{svc.image}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-bold text-lg">{svc.replicas_running}</span>
                          <span className="text-muted-foreground">/{svc.replicas_desired} réplicas</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline" size="icon" className="w-7 h-7"
                            onClick={() => handleScale(svc.name, svc.replicas_desired, -1)}
                            disabled={scaling[svc.name] || svc.replicas_desired <= 0}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{svc.replicas_desired}</span>
                          <Button
                            variant="outline" size="icon" className="w-7 h-7"
                            onClick={() => handleScale(svc.name, svc.replicas_desired, 1)}
                            disabled={scaling[svc.name]}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Métricas CPU / RAM ─────────────────────────────────────── */}
          <TabsContent value="metricas" className="mt-4">
            <div className="space-y-4">
              {services.filter((s) => s.replicas_running > 0).map((svc) => {
                const m = getMetric(svc.name);
                return (
                  <Card key={svc.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                        {svc.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {m ? (
                        <>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>CPU (promedio réplicas)</span>
                              <span className="font-medium text-foreground">{m.cpu_percent.toFixed(1)}%</span>
                            </div>
                            <Progress value={m.cpu_percent} className="h-2" />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">RAM total</span>
                            <span className="font-medium">{m.memory_mb.toFixed(0)} MB</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Reinicios (24h)</span>
                            <Badge variant={m.restart_count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                              {m.restart_count}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin métricas disponibles</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Alertas ───────────────────────────────────────────────── */}
          <TabsContent value="alertas" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 py-4">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-base">Últimas 200 alertas</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin alertas registradas.</p>
                ) : (
                  <ul>
                    {alerts.slice(0, 50).map((a, i) => (
                      <li key={i} className={`flex items-start gap-3 px-4 py-2.5 ${i !== alerts.length - 1 ? 'border-b' : ''}`}>
                        <span className={`text-xs font-medium mt-0.5 shrink-0 ${eventColor[a.event]}`}>
                          {a.event}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{a.details}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.service} · {new Date(a.timestamp).toLocaleString('es-BO')}
                            {a.old_value !== null && ` · ${a.old_value} → ${a.new_value} réplicas`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Auto-scaling config ───────────────────────────────────── */}
          <TabsContent value="config" className="mt-4">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4" />
                  Umbrales de auto-scaling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>CPU scale-up (%)</Label>
                    <Input
                      type="number" min="1" max="100"
                      value={config.scale_up_cpu_threshold}
                      onChange={(e) => setConfig((p) => ({ ...p, scale_up_cpu_threshold: +e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Escala ↑ si CPU supera este valor</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPU scale-down (%)</Label>
                    <Input
                      type="number" min="1" max="100"
                      value={config.scale_down_cpu_threshold}
                      onChange={(e) => setConfig((p) => ({ ...p, scale_down_cpu_threshold: +e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Escala ↓ si CPU baja de este valor</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delay scale-down (min)</Label>
                    <Input
                      type="number" min="1"
                      value={config.scale_down_delay_minutes}
                      onChange={(e) => setConfig((p) => ({ ...p, scale_down_delay_minutes: +e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Minutos antes de escalar hacia abajo</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Réplicas mínimas</Label>
                    <Input
                      type="number" min="1"
                      value={config.min_replicas}
                      onChange={(e) => setConfig((p) => ({ ...p, min_replicas: +e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Réplicas máximas</Label>
                    <Input
                      type="number" min="1"
                      value={config.max_replicas}
                      onChange={(e) => setConfig((p) => ({ ...p, max_replicas: +e.target.value }))}
                    />
                  </div>
                </div>
                <Separator />
                <Button onClick={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                  Guardar umbrales
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
