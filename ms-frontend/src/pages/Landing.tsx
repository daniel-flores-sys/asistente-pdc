import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Brain, FileText, Shield } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'IA Generativa',
    desc: 'Gemma 4B genera planificaciones curriculares adaptadas al contexto sociocultural boliviano.',
  },
  {
    icon: BookOpen,
    title: 'Currículo Nacional',
    desc: 'Alineado al modelo educativo MESCP de la Ley 070 Avelino Siñani.',
  },
  {
    icon: FileText,
    title: 'Documento listo',
    desc: 'Descarga el PDC en formato DOCX listo para presentar a dirección.',
  },
  {
    icon: Shield,
    title: 'Seguro y privado',
    desc: 'Tus datos solo se usan para generar tu PDC, nunca se comparten.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Sistema PDC Bolivia</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Registrarse</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center gap-6">
        <Badge variant="secondary" className="text-sm">
          Educación Primaria Bolivia — Ley 070
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight max-w-2xl leading-tight">
          Genera tu Plan de Desarrollo Curricular en minutos
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl">
          Herramienta asistida por inteligencia artificial para docentes bolivianos.
          Ingresa tus datos, selecciona materias y recibe un PDC completo listo para imprimir.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button size="lg" asChild>
            <Link to="/register">Comenzar gratis</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </main>

      {/* Features */}
      <section className="px-4 pb-20 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="text-center">
              <CardContent className="pt-6 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-muted-foreground text-xs">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Sistema PDC Bolivia — COM610 Trabajando en la Nube
      </footer>
    </div>
  );
}
