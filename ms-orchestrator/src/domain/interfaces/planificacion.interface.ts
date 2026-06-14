// Al vivir en domain/, estas interfaces son puras: sin imports de NestJS ni frameworks.
// Si mañana cambiamos NestJS por Express, este archivo no cambia.

export interface DatosDocente {
  nombre: string;
  materia: string;
  nivel: string;
  unidad: string;
  semestre: string;
}

// Refleja el modelo boliviano del Currículo Base del SEP (Sistema Educativo Plurinacional).
// Cuatro dimensiones del objetivo holístico: Ser, Saber, Hacer, Decidir.
export interface PlanificacionPDC {
  documento: string;
  datos_generales: {
    unidad_educativa: string;
    docente: string;
    area: string;
    nivel: string;
    bimestre: string;
    fecha: string;
  };
  objetivo_holistico: {
    ser: string;
    saber: string;
    hacer: string;
    decidir: string;
  };
  contenidos: Array<{
    semana: number;
    tema: string;
    subtemas: string[];
    estrategias: string[];
    recursos: string[];
    evaluacion: string;
  }>;
  evaluacion_general: Record<string, string>;
  bibliografia: string[];
}
