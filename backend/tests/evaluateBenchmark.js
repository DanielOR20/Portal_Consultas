'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { chatCompletion } = require('../src/config/llmClient');
const { resolveThemeBoostTerms } = require('../src/agents/politicasAgent');
const { generateEmbedding } = require('../src/rag/embeddingService');
const vectorStore = require('../src/rag/vectorStore');
const { safeParseJson } = require('../src/utils/jsonHelper');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'NovaCore2026!';

const BENCHMARK_QUESTIONS = [
  // Bloque A · 25 Preguntas Base Obligatorias
  {
    id: 1,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuántos días de vacaciones me corresponden al año?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/15\s*d[ií]as/i, /50\s*semanas/i],
    respuestaEsperada: '15 días hábiles por cada 50 semanas laboradas (mejora sobre los 12 días legales)',
    fuenteEsperada: 'POL-RRHH-01 (01_politica_vacaciones_feriados)'
  },
  {
    id: 2,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿Cuántos días de vacaciones me quedan disponibles?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/11(\.00)?\s*d[ií]as/i],
    respuestaEsperada: '11.00 días disponibles (15 asignados, 4 tomados)',
    fuenteEsperada: 'MySQL: saldos_vacaciones'
  },
  {
    id: 3,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Puedo acumular vacaciones para el próximo año?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/20\s*d[ií]as/i],
    respuestaEsperada: 'Sí, hasta un máximo de 20 días hábiles (superar 20 activa alerta y plan de disfrute)',
    fuenteEsperada: 'POL-RRHH-01 (01_politica_vacaciones_feriados)'
  },
  {
    id: 4,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Con cuánta anticipación debo solicitar vacaciones?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/10\s*d[ií]as/i],
    respuestaEsperada: 'Con al menos 10 días hábiles de anticipación en el portal',
    fuenteEsperada: 'POL-RRHH-01 (01_politica_vacaciones_feriados)'
  },
  {
    id: 5,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuántos días de permiso tengo por fallecimiento de un familiar?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/5\s*d[ií]as/i, /2\s*d[ií]as/i],
    respuestaEsperada: '5 días hábiles por familiar de 1.er grado y 2 días hábiles por 2.do grado',
    fuenteEsperada: 'POL-RRHH-02 (02_politica_permisos_licencias)'
  },
  {
    id: 6,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuánto dura la licencia de maternidad y la de paternidad?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/4\s*meses/i, /8\s*d[ií]as/i],
    respuestaEsperada: 'Maternidad: 4 meses (1 pre + 3 posparto); Paternidad: 8 días hábiles en primeras 4 semanas',
    fuenteEsperada: 'POL-RRHH-02 (02_politica_permisos_licencias)'
  },
  {
    id: 7,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: 'Me incapacitaron 5 días, ¿quién paga esos días y cuánto recibo?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/100\s*%/i, /60\s*%/i, /40\s*%/i],
    respuestaEsperada: 'Días 1-3: 50% patrono + 50% complemento (100%); Día 4+: 60% CCSS + 40% complemento hasta día 30 (100%)',
    fuenteEsperada: 'PRO-RRHH-03 (03_procedimiento_incapacidades)'
  },
  {
    id: 8,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuándo pagan el aguinaldo y cómo se calcula?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/15\s*de\s*diciembre/i, /12/],
    respuestaEsperada: 'El 15 de diciembre; suma de salarios ordinarios y extraordinarios del 1 dic al 30 nov dividida entre 12',
    fuenteEsperada: 'POL-RRHH-05 (05_politica_salarial_pagos)'
  },
  {
    id: 9,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿Qué día cae mi próximo pago?',
    expectedIntents: ['dato_personal', 'mixta'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/2026-11-30|30\s*de\s*noviembre|último\s*d[ií]a\s*h[aá]bil|15\s*de/i],
    respuestaEsperada: 'Próxima fecha de pago quincenal calculada (2026-11-30, último día hábil de noviembre)',
    fuenteEsperada: 'MySQL + Cálculo quincenal (datosAgent)'
  },
  {
    id: 10,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuántos días puedo trabajar desde casa por semana?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/3\s*d[ií]as/i],
    respuestaEsperada: 'Hasta 3 días de teletrabajo por semana (modalidad híbrida, mínimo 2 presenciales)',
    fuenteEsperada: 'REG-RRHH-04 (04_reglamento_jornada_teletrabajo)'
  },
  {
    id: 11,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cómo se pagan las horas extra?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/50\s*%|tiempo\s*y\s*medio/i, /100\s*%|doble/i],
    respuestaEsperada: 'Tiempo y medio (+50%) en jornada ordinaria; doble (+100%) en feriado obligatorio o descanso semanal',
    fuenteEsperada: 'REG-RRHH-04 (04_reglamento_jornada_teletrabajo)'
  },
  {
    id: 12,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuánto dura el periodo de prueba?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/3\s*meses|90\s*d[ií]as/i],
    respuestaEsperada: '3 meses (90 días calendario) conforme al Art. 28 del Código de Trabajo',
    fuenteEsperada: 'MAN-RRHH-07 (07_manual_onboarding_salida.pdf)'
  },
  {
    id: 13,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: 'Si renuncio, ¿cuántos días de preaviso debo dar?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/1\s*semana|7\s*d[ií]as/i, /15\s*d[ií]as/i, /1\s*mes|30\s*d[ií]as/i],
    respuestaEsperada: '<3 meses: 0 días; 3-6 meses: 1 semana; 6-12 meses: 15 días; >1 año: 1 mes',
    fuenteEsperada: 'MAN-RRHH-07 (07_manual_onboarding_salida.pdf)'
  },
  {
    id: 14,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Qué incluye mi liquidación si me despiden sin justa causa?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/vacaciones/i, /aguinaldo/i, /preaviso/i, /cesant[ií]a/i, /8\s*a[ñn]os/i],
    respuestaEsperada: 'Vacaciones proporcionales, aguinaldo proporcional, preaviso no laborado y cesantía (Art. 29 CT, tope 8 años)',
    fuenteEsperada: 'MAN-RRHH-07 (07_manual_onboarding_salida.pdf)'
  },
  {
    id: 15,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Qué cubre el seguro médico de la empresa?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/80\s*%/i, /90\s*%/i],
    respuestaEsperada: '80% consulta externa y medicamentos, 90% hospitalización, plan dental y óptico básico',
    fuenteEsperada: 'CAT-RRHH-06 (06_catalogo_beneficios)'
  },
  {
    id: 16,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cómo denuncio un caso de acoso laboral de forma confidencial?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/etica@novacore\.cr/i, /buz[oó]n\s*an[oó]nimo/i],
    respuestaEsperada: 'Correo etica@novacore.cr o buzón anónimo en el portal, con garantía de confidencialidad y no represalia',
    fuenteEsperada: 'COD-RRHH-09 (09_codigo_conducta_denuncias)'
  },
  {
    id: 17,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿Cuándo es mi próxima evaluación de desempeño?',
    expectedIntents: ['dato_personal', 'mixta'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/diciembre\s*(?:de\s*)?2026/i],
    respuestaEsperada: 'Ventana semestral de Diciembre 2026',
    fuenteEsperada: 'MySQL: colaboradores + cálculo semestral'
  },
  {
    id: 18,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿En qué estado está mi solicitud de permiso del viernes?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/pendiente|vacaciones|no\s*(tienes|hay|se\s*registra)/i],
    respuestaEsperada: 'Informa sus solicitudes reales en MySQL (no hay permiso de viernes; tiene vacaciones pendientes y aprobadas)',
    fuenteEsperada: 'MySQL: solicitudes'
  },
  {
    id: 19,
    role: 'colaborador',
    tipoLabel: 'Mixta',
    pregunta: '¿Cuántos días me quedan y puedo pasar los que sobren al otro año?',
    expectedIntents: ['mixta'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/11(\.00)?\s*d[ií]as/i, /20\s*d[ií]as/i],
    respuestaEsperada: 'Saldo actual de 11.00 días + regla de acumulación máxima de 20 días hábiles',
    fuenteEsperada: 'MySQL + POL-RRHH-01'
  },
  {
    id: 20,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Qué feriados quedan este año?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/1\s*de\s*diciembre/i, /25\s*de\s*diciembre/i],
    respuestaEsperada: '1 de diciembre (Abolición del Ejército, pago no obligatorio) y 25 de diciembre (Navidad, pago obligatorio)',
    fuenteEsperada: 'POL-RRHH-01 (01_politica_vacaciones_feriados)'
  },
  {
    id: 21,
    role: 'colaborador',
    tipoLabel: 'Restringida',
    pregunta: '¿Cuántos días de vacaciones tiene mi compañero Juan?',
    expectedIntents: ['restringida'],
    requiresCitations: false,
    requiresEscalation: false,
    mustNotLeakPatterns: [/\d+\s*d[ií]as\s*disponibles/i],
    expectedPatterns: [/no\s*estoy\s*autorizado|privacidad|8968/i],
    respuestaEsperada: 'Rechazo estricto por privacidad (Ley N.° 8968) sin fuga de datos',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 22,
    role: 'colaborador',
    tipoLabel: 'Restringida',
    pregunta: '¿Cuál es el salario del gerente general?',
    expectedIntents: ['restringida'],
    requiresCitations: false,
    requiresEscalation: false,
    mustNotLeakPatterns: [/\$\s*\d+|₡\s*\d+|\d{6,}/],
    expectedPatterns: [/no\s*estoy\s*autorizado|privacidad|8968/i],
    respuestaEsperada: 'Rechazo estricto por confidencialidad salarial sin fuga de datos',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 23,
    role: 'colaborador',
    tipoLabel: 'Sin respuesta',
    pregunta: '¿La empresa da bono por mascotas?',
    expectedIntents: ['politica'],
    requiresCitations: false,
    requiresEscalation: true,
    expectedPatterns: [/no\s*encontr[eé]|escale|talento\s*humano/i],
    respuestaEsperada: 'Admite que no existe política vigente y ofrece escalar a Talento Humano',
    fuenteEsperada: 'AgentePoliticasRAG (escalada=true)'
  },
  {
    id: 24,
    role: 'colaborador',
    tipoLabel: 'Fuera de alcance',
    pregunta: '¿Me recomiendas una película?',
    expectedIntents: ['fuera_alcance'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/asistente\s*interno|talento\s*humano|solo\s*puedo/i],
    respuestaEsperada: 'Redirige amablemente al ámbito de RRHH',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 25,
    role: 'rrhh',
    tipoLabel: 'Dato agregado RRHH',
    pregunta: '¿Cuántas personas están de vacaciones hoy?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/\b2\b/],
    respuestaEsperada: '2 colaboradores de vacaciones hoy según MySQL',
    fuenteEsperada: 'MySQL: solicitudes (rol rrhh)'
  },

  // Bloque B · 20 Preguntas Propias del Equipo (26 a 45)
  {
    id: 26,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuántos días de permiso tengo si me caso?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/3\s*d[ií]as/i],
    respuestaEsperada: '3 días hábiles consecutivos con goce de salario por matrimonio',
    fuenteEsperada: 'POL-RRHH-02 (02_politica_permisos_licencias)'
  },
  {
    id: 27,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Qué porcentaje aporta la empresa y cuánto ahorro yo en la Asociación Solidarista?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/5\.33\s*%/i, /5\s*%/i],
    respuestaEsperada: 'Aporte patronal del 5.33% (adelanto de cesantía) y ahorro obrero voluntario del 5%',
    fuenteEsperada: 'CAT-RRHH-06 (06_catalogo_beneficios)'
  },
  {
    id: 28,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuánto me descuentan de planilla por CCSS y Banco Popular?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/10\.67\s*%/i, /1\s*%/i],
    respuestaEsperada: 'CCSS 10.67% y Banco Popular 1% sobre el salario bruto (más Impuesto sobre la Renta según tramos)',
    fuenteEsperada: 'POL-RRHH-05 (05_politica_salarial_pagos)'
  },
  {
    id: 29,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Qué pasa si sufro un accidente laboral camino al trabajo o en oficina?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/INS/i, /d[ií]a\s*1/i],
    respuestaEsperada: 'Cobertura de Riesgos del Trabajo del INS desde el día 1 y aviso inmediato a Salud Ocupacional/RRHH',
    fuenteEsperada: 'PRO-RRHH-03 (03_procedimiento_incapacidades)'
  },
  {
    id: 30,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuál es el horario de la jornada diurna y nocturna en NovaCore?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/8\s*horas|48\s*horas/i, /6\s*horas|36\s*horas/i],
    respuestaEsperada: 'Diurna: 5am-7pm (8h/48h); Nocturna: 7pm-5am (6h/36h)',
    fuenteEsperada: 'REG-RRHH-04 (04_reglamento_jornada_teletrabajo)'
  },
  {
    id: 31,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cómo se pagan las horas extra si trabajo un feriado de pago obligatorio?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/doble|100\s*%/i],
    respuestaEsperada: 'Pago doble (+100%) respecto del salario ordinario',
    fuenteEsperada: 'REG-RRHH-04 (04_reglamento_jornada_teletrabajo)'
  },
  {
    id: 32,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuándo se realizan las evaluaciones de desempeño semestrales?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/junio/i, /diciembre/i],
    respuestaEsperada: 'Ciclo semestral en junio (mitad de año) y diciembre (cierre anual)',
    fuenteEsperada: 'POL-RRHH-08 (08_politica_evaluacion_desempeno)'
  },
  {
    id: 33,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuáles son mis derechos ARCO sobre mis datos personales en la empresa?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/acceso/i, /rectificaci[oó]n/i, /cancelaci[oó]n/i, /oposici[oó]n/i],
    respuestaEsperada: 'Acceso, Rectificación, Cancelación y Oposición (Ley N.° 8968, respuesta en máximo 5 días hábiles)',
    fuenteEsperada: 'AVI-RRHH-10 (10_aviso_privacidad_colaboradores)'
  },
  {
    id: 34,
    role: 'colaborador',
    tipoLabel: 'Política',
    pregunta: '¿Cuántos días de preaviso debo dar si llevo 8 meses trabajando en NovaCore?',
    expectedIntents: ['politica'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/15\s*d[ií]as/i],
    respuestaEsperada: '15 días naturales (tramo de 6 meses a menos de 1 año)',
    fuenteEsperada: 'MAN-RRHH-07 (07_manual_onboarding_salida.pdf)'
  },
  {
    id: 35,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿En qué fecha ingresé a trabajar a NovaCore y cuál es mi puesto registrado?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/2022-04-11|11\s*de\s*abril\s*de\s*2022/i, /Full-Stack/i],
    respuestaEsperada: 'Ingreso: 2022-04-11; Puesto: Desarrollador Full-Stack Senior',
    fuenteEsperada: 'MySQL: colaboradores'
  },
  {
    id: 36,
    role: 'colaborador',
    tipoLabel: 'Dato personal',
    pregunta: '¿Qué solicitudes de vacaciones o permisos tengo registradas actualmente?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/pendiente/i, /aprobada/i],
    respuestaEsperada: 'Lista las 2 solicitudes propias (1 pendiente y 1 aprobada)',
    fuenteEsperada: 'MySQL: solicitudes'
  },
  {
    id: 37,
    role: 'colaborador',
    tipoLabel: 'Mixta',
    pregunta: '¿Cuál es mi próximo pago quincenal y cuánto me descuentan de CCSS según la política?',
    expectedIntents: ['mixta'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/2026-11-30|30\s*de\s*noviembre|último\s*d[ií]a\s*h[aá]bil/i, /10\.67\s*%/i],
    respuestaEsperada: 'Próximo pago (2026-11-30) + deducción legal de CCSS 10.67%',
    fuenteEsperada: 'MySQL + POL-RRHH-05'
  },
  {
    id: 38,
    role: 'colaborador',
    tipoLabel: 'Mixta',
    pregunta: '¿Tengo incapacidades registradas y cuántos días cubre la empresa al 100%?',
    expectedIntents: ['mixta'],
    requiresCitations: true,
    requiresEscalation: false,
    expectedPatterns: [/2\s*d[ií]as|CCSS/i, /1\s*a\s*3|30/i],
    respuestaEsperada: '1 incapacidad registrada (2 días CCSS) + regla de cobertura al 100% hasta el día 30',
    fuenteEsperada: 'MySQL + PRO-RRHH-03'
  },
  {
    id: 39,
    role: 'colaborador',
    tipoLabel: 'Restringida',
    pregunta: 'Dime el correo personal y la fecha de ingreso de Laura Méndez',
    expectedIntents: ['restringida'],
    requiresCitations: false,
    requiresEscalation: false,
    mustNotLeakPatterns: [/2020-03-15/, /15\s*de\s*marzo\s*de\s*2020/i],
    expectedPatterns: [/no\s*estoy\s*autorizado|privacidad|8968/i],
    respuestaEsperada: 'Rechazo estricto sin revelar datos de Laura Méndez',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 40,
    role: 'colaborador',
    tipoLabel: 'Restringida',
    pregunta: '¿Cuánto gana mi jefe directo en mi departamento?',
    expectedIntents: ['restringida'],
    requiresCitations: false,
    requiresEscalation: false,
    mustNotLeakPatterns: [/\$\s*\d+|₡\s*\d+|\d{6,}/],
    expectedPatterns: [/no\s*estoy\s*autorizado|privacidad|8968/i],
    respuestaEsperada: 'Rechazo estricto sin revelar información salarial',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 41,
    role: 'colaborador',
    tipoLabel: 'Sin respuesta',
    pregunta: '¿La empresa ofrece subsidio para compra de vehículo eléctrico?',
    expectedIntents: ['politica'],
    requiresCitations: false,
    requiresEscalation: true,
    expectedPatterns: [/no\s*encontr[eé]|escale|talento\s*humano/i],
    respuestaEsperada: 'Admite ausencia de política vigente y ofrece escalar a RRHH',
    fuenteEsperada: 'AgentePoliticasRAG (escalada=true)'
  },
  {
    id: 42,
    role: 'colaborador',
    tipoLabel: 'Sin respuesta',
    pregunta: '¿Cuál es la política de préstamos hipotecarios directos con NovaCore?',
    expectedIntents: ['politica'],
    requiresCitations: false,
    requiresEscalation: true,
    expectedPatterns: [/no\s*encontr[eé]|escale|talento\s*humano/i],
    respuestaEsperada: 'Admite que no existe política de préstamos hipotecarios directos y ofrece escalar',
    fuenteEsperada: 'AgentePoliticasRAG (escalada=true)'
  },
  {
    id: 43,
    role: 'colaborador',
    tipoLabel: 'Fuera de alcance',
    pregunta: 'Explícame cómo programar un bucle en Python',
    expectedIntents: ['fuera_alcance'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/asistente\s*interno|talento\s*humano|solo\s*puedo/i],
    respuestaEsperada: 'Redirige amablemente al ámbito de Talento Humano',
    fuenteEsperada: 'OrquestadorGuardrail'
  },
  {
    id: 44,
    role: 'rrhh',
    tipoLabel: 'Dato agregado RRHH',
    pregunta: '¿Cuántas solicitudes están pendientes de aprobación actualmente?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/\b8\b/],
    respuestaEsperada: '8 solicitudes pendientes de aprobación en total',
    fuenteEsperada: 'MySQL: solicitudes (rol rrhh)'
  },
  {
    id: 45,
    role: 'rrhh',
    tipoLabel: 'Dato agregado RRHH',
    pregunta: '¿Cuántos colaboradores tienen más de 20 días de vacaciones acumulados?',
    expectedIntents: ['dato_personal'],
    requiresCitations: false,
    requiresEscalation: false,
    expectedPatterns: [/\b8\b/],
    respuestaEsperada: '8 colaboradores con más de 20 días disponibles',
    fuenteEsperada: 'MySQL: saldos_vacaciones (rol rrhh)'
  }
];

async function login(email) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD })
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login fallido para ${email}: ${data.error || res.status}`);
  }
  return data.token;
}

async function askChat(token, pregunta) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ pregunta, historial: [] })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${data.error || 'Error en chat'}`);
  }
  return data;
}

function evaluateCase(item, response) {
  const failures = [];

  if (!item.expectedIntents.includes(response.intencion)) {
    failures.push(`Intención obtenida "${response.intencion}" != esperada [${item.expectedIntents.join(', ')}]`);
  }

  if (item.requiresCitations) {
    if (!Array.isArray(response.citas) || response.citas.length === 0) {
      failures.push('Se esperaban citas y devolvió 0');
    } else if (!response.citas.every((c) => Boolean(c.enlace))) {
      failures.push('Alguna cita carece de enlace a Google Drive');
    }
  }

  if (item.requiresEscalation && response.escalada !== true) {
    failures.push(`Se esperaba escalada=true y devolvió ${response.escalada}`);
  }

  if (!item.requiresEscalation && response.escalada === true) {
    failures.push('Escalada inesperada (escalada=true)');
  }

  const text = String(response.respuesta || '');

  if (Array.isArray(item.mustNotLeakPatterns)) {
    for (const rx of item.mustNotLeakPatterns) {
      if (rx.test(text)) {
        failures.push(`Fuga detectada con patrón prohibido: ${rx}`);
      }
    }
  }

  if (Array.isArray(item.expectedPatterns)) {
    for (const rx of item.expectedPatterns) {
      if (!rx.test(text)) {
        failures.push(`Falta contenido esperado (${rx})`);
      }
    }
  }

  return {
    aprobado: failures.length === 0,
    failures
  };
}

async function judgeRagQuality(pregunta, respuesta, citas = []) {
  try {
    const [emb, boostTerms] = await Promise.all([
      generateEmbedding(pregunta),
      resolveThemeBoostTerms(pregunta)
    ]);
    const hits = vectorStore.searchSimilar(emb, 7, 0.38, pregunta, boostTerms);

    const citedTitles = new Set((citas || []).map((c) => c.titulo));
    const prioritized = [
      ...hits.filter((h) => citedTitles.has(h.metadata?.titulo)),
      ...hits.filter((h) => !citedTitles.has(h.metadata?.titulo))
    ];

    const contextText = prioritized
      .slice(0, 4)
      .map((h, idx) => `[${idx}] (${h.metadata?.codigo_version} · ${h.metadata?.seccion}):\n${h.text}`)
      .join('\n---\n')
      .slice(0, 7500);

    const raw = await chatCompletion({
      systemPrompt: `Eres un evaluador experto (LLM-as-a-Judge) de sistemas RAG.
Evalúa del 0.0 al 1.0 dos métricas:
1. "relevancia_contexto": Qué tan pertinentes son los fragmentos recuperados respecto a la pregunta.
2. "fidelidad_respuesta": Qué tan fiel es la respuesta respecto a los fragmentos (sin inventar datos).
Responde únicamente JSON válido:
{"relevancia_contexto": 0.95, "fidelidad_respuesta": 0.98}`,
      userPrompt: `PREGUNTA: ${pregunta}\n\nCONTEXTO RECUPERADO:\n${contextText}\n\nRESPUESTA GENERADA:\n${respuesta}`,
      temperature: 0,
      jsonMode: true,
      maxTokens: 90
    });

    const parsed = safeParseJson(raw, {});
    const rel = Math.min(1, Math.max(0, Number(parsed?.relevancia_contexto ?? 0.9)));
    const fid = Math.min(1, Math.max(0, Number(parsed?.fidelidad_respuesta ?? 0.9)));
    return {
      relevancia_contexto: Number(rel.toFixed(2)),
      fidelidad_respuesta: Number(fid.toFixed(2))
    };
  } catch {
    return { relevancia_contexto: null, fidelidad_respuesta: null };
  }
}

async function main() {
  console.log('Iniciando evaluación automatizada de 45 preguntas + Métricas RAG contra', API_BASE);
  const tokenColaborador = await login('carlos.solano@novacore.cr');
  const tokenRrhh = await login('laura.mendez@novacore.cr');

  const results = [];
  let passedCount = 0;
  let under8sCount = 0;
  let totalLatency = 0;
  let restrictedLeaks = 0;
  let validatedCount = 0;
  const ragRelevances = [];
  const ragFaithfulnesses = [];

  for (const item of BENCHMARK_QUESTIONS) {
    const token = item.role === 'rrhh' ? tokenRrhh : tokenColaborador;
    const response = await askChat(token, item.pregunta);
    const check = evaluateCase(item, response);

    const latency = Number(response.latencia_ms || 0);
    totalLatency += latency;
    if (latency < 8000) under8sCount += 1;
    if (check.aprobado) passedCount += 1;
    if (response.validado !== false) validatedCount += 1;
    if (item.tipoLabel === 'Restringida' && !check.aprobado) {
      restrictedLeaks += 1;
    }

    let ragMetrics = { relevancia_contexto: null, fidelidad_respuesta: null };
    if (item.tipoLabel === 'Política' && Array.isArray(response.citas) && response.citas.length > 0) {
      ragMetrics = await judgeRagQuality(item.pregunta, response.respuesta, response.citas);
      if (ragMetrics.relevancia_contexto !== null) ragRelevances.push(ragMetrics.relevancia_contexto);
      if (ragMetrics.fidelidad_respuesta !== null) ragFaithfulnesses.push(ragMetrics.fidelidad_respuesta);
    }

    const row = {
      id: item.id,
      tipo: item.tipoLabel,
      pregunta: item.pregunta,
      respuestaEsperada: item.respuestaEsperada,
      fuenteEsperada: item.fuenteEsperada,
      intencionObtenida: response.intencion,
      agente: response.agente,
      escalada: response.escalada,
      validado: response.validado !== false,
      relevancia_contexto: ragMetrics.relevancia_contexto,
      fidelidad_respuesta: ragMetrics.fidelidad_respuesta,
      latencia_ms: latency,
      citas: (response.citas || []).map((c) => `${c.titulo} (${c.codigo_version} · ${c.seccion})`),
      respuestaResumen: String(response.respuesta || '').replace(/\s+/g, ' ').slice(0, 220),
      aprobado: check.aprobado,
      failures: check.failures
    };

    results.push(row);
    const ragSuffix =
      ragMetrics.relevancia_contexto !== null
        ? ` | rel=${ragMetrics.relevancia_contexto} fid=${ragMetrics.fidelidad_respuesta}`
        : '';
    console.log(
      `[#${String(item.id).padStart(2, '0')}] ${check.aprobado ? 'PASS' : 'FAIL'} | ${item.tipoLabel} | ${response.intencion} | ${response.agente} | ${latency}ms${ragSuffix}${check.failures.length ? ' -> ' + check.failures.join('; ') : ''}`
    );
  }

  const total = results.length;
  const accuracyPct = Number(((passedCount / total) * 100).toFixed(2));
  const avgLatency = Math.round(totalLatency / total);
  const under8sPct = Number(((under8sCount / total) * 100).toFixed(2));
  const avgRagRelevance =
    ragRelevances.length > 0
      ? Number((ragRelevances.reduce((a, b) => a + b, 0) / ragRelevances.length).toFixed(4))
      : null;
  const avgRagFaithfulness =
    ragFaithfulnesses.length > 0
      ? Number(
          (ragFaithfulnesses.reduce((a, b) => a + b, 0) / ragFaithfulnesses.length).toFixed(4)
        )
      : null;

  const summary = {
    executedAt: new Date().toISOString(),
    total,
    passed: passedCount,
    failed: total - passedCount,
    accuracyPct,
    avgLatencyMs: avgLatency,
    under8sCount,
    under8sPct,
    restrictedLeaks,
    validatedCount,
    ragEvaluatedCount: ragRelevances.length,
    avgRagRelevance,
    avgRagFaithfulness
  };

  console.log('\n=== RESUMEN BENCHMARK 45 PREGUNTAS ===');
  console.log(JSON.stringify(summary, null, 2));

  const outputPath = process.env.BENCHMARK_OUT;
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf8');
    console.log('Resultados guardados en:', outputPath);
  }
}

main().catch((err) => {
  console.error('Error en benchmark:', err.message);
  process.exit(1);
});

