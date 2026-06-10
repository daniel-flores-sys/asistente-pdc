import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { adminGetConfig, adminSaveConfig } from '@/api';

interface LLMParams { modelo: string; temperatura: number; max_tokens: number; }
interface RAGParams { top_k: number; score_threshold: number; collection: string; }
interface Prompts { system_prompt: string; user_template: string; }

function useConfigSection<T>(clave: string, defaults: T) {
  const [data, setData] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGetConfig(clave)
      .then((v) => { if (v != null) setData(v); })
      .catch(() => {/* usa defaults si no hay config guardada */})
      .finally(() => setLoading(false));
  }, [clave]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await adminSaveConfig(clave, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return { data, setData, loading, saving, saved, error, save };
}

export default function AdminConfig() {
  const llm = useConfigSection<LLMParams>('llm_params', { modelo: 'gemma3:4b', temperatura: 0.7, max_tokens: 4096 });
  const rag = useConfigSection<RAGParams>('rag_params', { top_k: 5, score_threshold: 0.7, collection: 'curriculum_pdc' });
  const prompts = useConfigSection<Prompts>('prompts', { system_prompt: '', user_template: '' });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
        <p className="text-muted-foreground text-sm">Parámetros LLM, RAG y prompts — sin necesidad de redeploy.</p>
      </div>

      <Tabs defaultValue="llm">
        <TabsList>
          <TabsTrigger value="llm">Parámetros LLM</TabsTrigger>
          <TabsTrigger value="rag">Parámetros RAG</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
        </TabsList>

        {/* ── LLM ──────────────────────────────────────────────────── */}
        <TabsContent value="llm" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Modelo de lenguaje (Ollama / Gemma)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {llm.loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Modelo</Label>
                    <Input
                      value={llm.data.modelo}
                      onChange={(e) => llm.setData((p) => ({ ...p, modelo: e.target.value }))}
                      placeholder="gemma3:4b"
                    />
                    <p className="text-xs text-muted-foreground">Nombre del modelo en Ollama (ej: gemma3:4b, llama3:8b)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Temperatura ({llm.data.temperatura})</Label>
                      <Input
                        type="number" min="0" max="2" step="0.05"
                        value={llm.data.temperatura}
                        onChange={(e) => llm.setData((p) => ({ ...p, temperatura: +e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">0 = determinista · 2 = muy creativo</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max tokens</Label>
                      <Input
                        type="number" min="256" max="8192" step="256"
                        value={llm.data.max_tokens}
                        onChange={(e) => llm.setData((p) => ({ ...p, max_tokens: +e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}
              {llm.error && <Alert variant="destructive"><AlertDescription>{llm.error}</AlertDescription></Alert>}
              {llm.saved && <Alert><AlertDescription>Parámetros LLM guardados.</AlertDescription></Alert>}
              <Separator />
              <Button onClick={llm.save} disabled={llm.saving || llm.loading}>
                {llm.saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RAG ──────────────────────────────────────────────────── */}
        <TabsContent value="rag" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Búsqueda RAG (ChromaDB)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {rag.loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Top K</Label>
                      <Input
                        type="number" min="1" max="20"
                        value={rag.data.top_k}
                        onChange={(e) => rag.setData((p) => ({ ...p, top_k: +e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Chunks a recuperar por query RAG</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Score threshold ({rag.data.score_threshold})</Label>
                      <Input
                        type="number" min="0" max="1" step="0.05"
                        value={rag.data.score_threshold}
                        onChange={(e) => rag.setData((p) => ({ ...p, score_threshold: +e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Mínima similitud para incluir un chunk</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Colección ChromaDB</Label>
                    <Input
                      value={rag.data.collection}
                      onChange={(e) => rag.setData((p) => ({ ...p, collection: e.target.value }))}
                      placeholder="curriculum_pdc"
                    />
                  </div>
                </>
              )}
              {rag.error && <Alert variant="destructive"><AlertDescription>{rag.error}</AlertDescription></Alert>}
              {rag.saved && <Alert><AlertDescription>Parámetros RAG guardados.</AlertDescription></Alert>}
              <Separator />
              <Button onClick={rag.save} disabled={rag.saving || rag.loading}>
                {rag.saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Prompts ───────────────────────────────────────────────── */}
        <TabsContent value="prompts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">System Prompt y User Template</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {prompts.loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>System Prompt</Label>
                    <p className="text-xs text-muted-foreground">
                      Se inyecta como rol "system" antes del request al LLM.
                      {' '}{prompts.data.system_prompt.length} caracteres.
                    </p>
                    <div className="border rounded-md overflow-hidden h-52">
                      <Editor
                        defaultLanguage="markdown"
                        value={prompts.data.system_prompt}
                        onChange={(v) => prompts.setData((p) => ({ ...p, system_prompt: v ?? '' }))}
                        options={{
                          minimap: { enabled: false },
                          wordWrap: 'on',
                          lineNumbers: 'off',
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          padding: { top: 8, bottom: 8 },
                        }}
                        theme="vs-light"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>User Template</Label>
                    <p className="text-xs text-muted-foreground">
                      Plantilla del mensaje del usuario. Usa <code className="bg-muted px-1 rounded">{'{{area}}'}</code>, <code className="bg-muted px-1 rounded">{'{{temas}}'}</code>, etc.
                    </p>
                    <div className="border rounded-md overflow-hidden h-40">
                      <Editor
                        defaultLanguage="markdown"
                        value={prompts.data.user_template}
                        onChange={(v) => prompts.setData((p) => ({ ...p, user_template: v ?? '' }))}
                        options={{
                          minimap: { enabled: false },
                          wordWrap: 'on',
                          lineNumbers: 'off',
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                          padding: { top: 8, bottom: 8 },
                        }}
                        theme="vs-light"
                      />
                    </div>
                  </div>
                </>
              )}
              {prompts.error && <Alert variant="destructive"><AlertDescription>{prompts.error}</AlertDescription></Alert>}
              {prompts.saved && <Alert><AlertDescription>Prompts guardados.</AlertDescription></Alert>}
              <Separator />
              <Button onClick={prompts.save} disabled={prompts.saving || prompts.loading}>
                {prompts.saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                Guardar prompts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
