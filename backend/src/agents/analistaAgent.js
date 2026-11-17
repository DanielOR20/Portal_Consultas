'use strict';

const { Op } = require('sequelize');
const {
  Colaborador,
  SaldoVacaciones,
  Solicitud,
  Incapacidad,
  MovimientoPersonal,
  ConsultaChat,
  ReporteDiario,
  PalabraClave
} = require('../models');
const { chatCompletion } = require('../config/llmClient');

const SYSTEM_PROMPT = `Eres el Agente Analista de Talento Humano de NovaCore Technologies Costa Rica S.A.
Recibirás un objeto JSON con los 8 indicadores diarios calculados directamente desde la base de datos MySQL.

Tu tarea es redactar un RESUMEN EJECUTIVO para la Dirección de Talento Humano siguiendo estas reglas estrictas:
1. Extensión obligatoria: entre 3 y 5 frases claras y bien redactadas en español.
2. Usa ÚNICAMENTE las cifras exactas contenidas en el JSON. No inventes números, no estimes valores y no agregues datos que no aparezcan en el JSON.
3. Menciona los hallazgos operativos clave del día (ausentes hoy, solicitudes pendientes con atraso mayor a 3 días, incapacidades activas, colaboradores con más de 20 días de vacaciones disponibles y desempeño/brechas del asistente virtual).
4. Responde en un único párrafo fluido de 3 a 5 frases, sin viñetas ni encabezados Markdown.`;

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, days) {
  const copy = new Date(baseDate.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

async function generateDailyReport(targetDateInput = null) {
  const targetDateObj = targetDateInput
    ? typeof targetDateInput === 'string'
      ? parseLocalDate(targetDateInput)
      : new Date(targetDateInput.getFullYear(), targetDateInput.getMonth(), targetDateInput.getDate())
    : (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      })();

  const targetDateStr = formatDate(targetDateObj);
  const monthStartStr = `${targetDateStr.slice(0, 7)}-01`;
  const nextMonthStart = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth() + 1, 1);
  const monthEndStr = formatDate(addDays(nextMonthStart, -1));
  const threeDaysAgoDate = addDays(targetDateObj, -3);
  const start30DaysDate = addDays(targetDateObj, -29);
  const start30DaysStr = formatDate(start30DaysDate);
  const start90DaysStr = formatDate(addDays(targetDateObj, -90));
  const last24hDate = new Date(targetDateObj.getTime() - 24 * 60 * 60 * 1000);
  const targetEndOfDay = new Date(`${targetDateStr}T23:59:59`);

  const [
    totalActivos,
    solicitudesAusentesHoy,
    incapacidadesAll,
    solicitudesPendientesRaw,
    movimientos90d,
    saldosRiesgoRaw,
    consultas30d,
    solicitudes30d,
    temaKeywords
  ] = await Promise.all([
    Colaborador.count({ where: { estado: 'activo' } }),
    Solicitud.findAll({
      where: {
        estado: 'aprobada',
        tipo: { [Op.in]: ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce'] },
        fecha_inicio: { [Op.lte]: targetDateStr },
        fecha_fin: { [Op.gte]: targetDateStr }
      },
      include: [
        { model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }
      ]
    }),
    Incapacidad.findAll({
      include: [
        { model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }
      ]
    }),
    Solicitud.findAll({
      where: { estado: 'pendiente' },
      include: [
        { model: Colaborador, as: 'colaborador', attributes: ['id', 'nombre', 'departamento'] }
      ],
      order: [['creada_en', 'ASC']]
    }),
    MovimientoPersonal.findAll({
      where: {
        fecha: { [Op.between]: [start90DaysStr, targetDateStr] }
      },
      raw: true
    }),
    SaldoVacaciones.findAll({
      where: {
        dias_disponibles: { [Op.gt]: 20 }
      },
      include: [
        {
          model: Colaborador,
          as: 'colaborador',
          where: { estado: 'activo' },
          attributes: ['id', 'nombre', 'departamento']
        }
      ],
      order: [['dias_disponibles', 'DESC']]
    }),
    ConsultaChat.findAll({
      where: {
        fecha: { [Op.between]: [new Date(`${start30DaysStr}T00:00:00`), targetEndOfDay] }
      },
      order: [['fecha', 'DESC']],
      raw: true
    }),
    Solicitud.findAll({
      where: {
        estado: 'aprobada',
        tipo: { [Op.in]: ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce'] },
        fecha_fin: { [Op.gte]: start30DaysStr },
        fecha_inicio: { [Op.lte]: targetDateStr }
      },
      raw: true
    }),
    PalabraClave.findAll({
      where: { categoria: 'tema_dashboard', activa: true },
      attributes: ['palabra', 'tema_asociado'],
      raw: true
    })
  ]);

  // 1. ausentes_hoy
  const ausentesPorTipo = {
    vacaciones: 0,
    permiso_con_goce: 0,
    permiso_sin_goce: 0,
    incapacidad: 0
  };
  const ausentesPorDepto = {};

  for (const sol of solicitudesAusentesHoy) {
    ausentesPorTipo[sol.tipo] = (ausentesPorTipo[sol.tipo] || 0) + 1;
    const depto = sol.colaborador?.departamento || 'Sin departamento';
    ausentesPorDepto[depto] = (ausentesPorDepto[depto] || 0) + 1;
  }

  const incapacidadesActivasHoy = [];
  for (const inc of incapacidadesAll) {
    const start = parseLocalDate(inc.fecha_inicio);
    const end = addDays(start, Number(inc.dias) - 1);
    if (start <= targetDateObj && targetDateObj <= end) {
      incapacidadesActivasHoy.push(inc);
      ausentesPorTipo.incapacidad += 1;
      const depto = inc.colaborador?.departamento || 'Sin departamento';
      ausentesPorDepto[depto] = (ausentesPorDepto[depto] || 0) + 1;
    }
  }

  const totalAusentesHoy =
    ausentesPorTipo.vacaciones +
    ausentesPorTipo.permiso_con_goce +
    ausentesPorTipo.permiso_sin_goce +
    ausentesPorTipo.incapacidad;

  const ausentes_hoy = {
    total: totalAusentesHoy,
    por_tipo: ausentesPorTipo,
    por_departamento: ausentesPorDepto
  };

  // 2. solicitudes_pendientes
  let atrasadasMas3Dias = 0;
  const pendientesDetalle = solicitudesPendientesRaw.map((s) => {
    const creada = new Date(s.creada_en);
    const diasEspera = Math.max(
      0,
      Math.floor((targetEndOfDay - creada) / (1000 * 60 * 60 * 24))
    );
    if (creada < threeDaysAgoDate) {
      atrasadasMas3Dias += 1;
    }
    return {
      id: s.id,
      colaborador: s.colaborador?.nombre || 'N/D',
      departamento: s.colaborador?.departamento || 'N/D',
      tipo: s.tipo,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      dias_espera: diasEspera
    };
  });

  const solicitudes_pendientes = {
    total: pendientesDetalle.length,
    atrasadas_mas_3_dias: atrasadasMas3Dias,
    detalle: pendientesDetalle
  };

  // 3. incapacidades_mes
  const incapacidadesMesList = incapacidadesAll.filter(
    (inc) => inc.fecha_inicio >= monthStartStr && inc.fecha_inicio <= monthEndStr
  );
  const desgloseEntidad = {
    CCSS: { cantidad: 0, dias: 0 },
    INS: { cantidad: 0, dias: 0 }
  };
  let totalDiasMes = 0;

  for (const inc of incapacidadesMesList) {
    const dias = Number(inc.dias) || 0;
    totalDiasMes += dias;
    if (desgloseEntidad[inc.entidad]) {
      desgloseEntidad[inc.entidad].cantidad += 1;
      desgloseEntidad[inc.entidad].dias += dias;
    }
  }

  const incapacidades_mes = {
    activas_hoy: incapacidadesActivasHoy.length,
    total_registros_mes: incapacidadesMesList.length,
    total_dias_mes: totalDiasMes,
    desglose_entidad: desgloseEntidad
  };

  // 4. rotacion_personal
  const movimientosMes = movimientos90d.filter(
    (m) => m.fecha >= monthStartStr && m.fecha <= targetDateStr
  );
  const ingresosMes = movimientosMes.filter((m) => m.tipo === 'ingreso').length;
  const salidasMes = movimientosMes.filter((m) => m.tipo === 'salida').length;
  const ascensosMes = movimientosMes.filter((m) => m.tipo === 'ascenso').length;
  const ingresos90d = movimientos90d.filter((m) => m.tipo === 'ingreso').length;
  const salidas90d = movimientos90d.filter((m) => m.tipo === 'salida').length;

  const tasaRotacionMensual =
    totalActivos > 0 ? Number(((salidasMes / totalActivos) * 100).toFixed(2)) : 0;
  const tasaRotacion90d =
    totalActivos > 0 ? Number(((salidas90d / totalActivos) * 100).toFixed(2)) : 0;

  const rotacion_personal = {
    total_activos: totalActivos,
    ingresos_mes: ingresosMes,
    salidas_mes: salidasMes,
    ascensos_mes: ascensosMes,
    tasa_rotacion_pct: tasaRotacionMensual,
    ingresos_90d: ingresos90d,
    salidas_90d: salidas90d,
    tasa_rotacion_90d_pct: tasaRotacion90d
  };

  // 5. riesgo_pasivo_vacaciones
  const detallePasivo = saldosRiesgoRaw.map((s) => ({
    colaborador_id: s.colaborador?.id || s.colaborador_id,
    nombre: s.colaborador?.nombre || 'N/D',
    departamento: s.colaborador?.departamento || 'N/D',
    dias_disponibles: Number(s.dias_disponibles)
  }));

  const riesgo_pasivo_vacaciones = {
    total_colaboradores: detallePasivo.length,
    umbral_dias: 20,
    detalle: detallePasivo
  };

  // 6. metricas_chatbot
  const consultas24h = consultas30d.filter((c) => new Date(c.fecha) >= last24hDate);
  const baseMetricsSet = consultas24h.length > 0 ? consultas24h : consultas30d;
  const resueltasCount = baseMetricsSet.filter((c) => c.resuelta && !c.escalada).length;
  const porcentajeResueltas =
    baseMetricsSet.length > 0
      ? Number(((resueltasCount / baseMetricsSet.length) * 100).toFixed(2))
      : 100;
  const latenciaPromedio =
    baseMetricsSet.length > 0
      ? Math.round(
          baseMetricsSet.reduce((acc, c) => acc + (Number(c.latencia_ms) || 0), 0) /
            baseMetricsSet.length
        )
      : 0;

  const metricas_chatbot = {
    consultas_ultimas_24h: consultas24h.length,
    consultas_30_dias: consultas30d.length,
    porcentaje_resueltas_sin_escalar: porcentajeResueltas,
    latencia_promedio_ms: latenciaPromedio
  };

  // 7. temas_y_brechas (clasificación dinámica usando PalabraClave de MySQL)
  const normalizeTemaStr = (val) =>
    String(val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const temasMap = {};
  const preguntasEscaladas = [];

  for (const c of consultas30d) {
    const normPregunta = normalizeTemaStr(c.pregunta);
    const matchedThemes = new Set();

    for (const kw of temaKeywords) {
      const normKw = normalizeTemaStr(kw.palabra);
      if (normKw && normPregunta.includes(normKw) && kw.tema_asociado) {
        matchedThemes.add(kw.tema_asociado);
      }
    }

    if (matchedThemes.size > 0) {
      for (const tema of matchedThemes) {
        temasMap[tema] = (temasMap[tema] || 0) + 1;
      }
    } else {
      const fallbackTema = c.intencion || 'General';
      temasMap[fallbackTema] = (temasMap[fallbackTema] || 0) + 1;
    }

    if (c.escalada || !c.resuelta) {
      preguntasEscaladas.push({
        id: c.id,
        pregunta: c.pregunta,
        intencion: c.intencion,
        agente: c.agente,
        fecha: c.fecha
      });
    }
  }

  const top5Intenciones = Object.entries(temasMap)
    .map(([intencion, total]) => ({ intencion, tema: intencion, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const temas_y_brechas = {
    top_5_intenciones: top5Intenciones,
    preguntas_escaladas: preguntasEscaladas
  };

  // 8. tendencia_30_dias
  const consultasPorDia = {};
  for (const c of consultas30d) {
    const f = formatDate(new Date(c.fecha));
    consultasPorDia[f] = (consultasPorDia[f] || 0) + 1;
  }

  const tendencia_30_dias = [];
  for (let i = 0; i < 30; i += 1) {
    const dayObj = addDays(start30DaysDate, i);
    const dayStr = formatDate(dayObj);

    const ausenciasSolicitudesDia = solicitudes30d.filter(
      (s) => s.fecha_inicio <= dayStr && s.fecha_fin >= dayStr
    ).length;

    const ausenciasIncapacidadDia = incapacidadesAll.filter((inc) => {
      const sDate = parseLocalDate(inc.fecha_inicio);
      const eDate = addDays(sDate, Number(inc.dias) - 1);
      return sDate <= dayObj && dayObj <= eDate;
    }).length;

    tendencia_30_dias.push({
      fecha: dayStr,
      consultas_chat: consultasPorDia[dayStr] || 0,
      ausencias: ausenciasSolicitudesDia + ausenciasIncapacidadDia
    });
  }

  const datos_json = {
    fecha_reporte: targetDateStr,
    ausentes_hoy,
    solicitudes_pendientes,
    incapacidades_mes,
    rotacion_personal,
    riesgo_pasivo_vacaciones,
    metricas_chatbot,
    temas_y_brechas,
    tendencia_30_dias
  };

  const summaryPayload = {
    fecha_reporte: targetDateStr,
    ausentes_hoy,
    solicitudes_pendientes: {
      total: solicitudes_pendientes.total,
      atrasadas_mas_3_dias: solicitudes_pendientes.atrasadas_mas_3_dias
    },
    incapacidades_mes,
    rotacion_personal,
    riesgo_pasivo_vacaciones: {
      total_colaboradores: riesgo_pasivo_vacaciones.total_colaboradores,
      umbral_dias: 20
    },
    metricas_chatbot,
    top_intenciones: top5Intenciones,
    total_preguntas_escaladas: preguntasEscaladas.length
  };

  const resumen_texto = (
    await chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Datos del reporte diario (JSON):\n${JSON.stringify(summaryPayload, null, 2)}`,
      temperature: 0.2,
      jsonMode: false
    })
  ).trim();

  const existing = await ReporteDiario.findOne({ where: { fecha: targetDateStr } });
  let record;
  if (existing) {
    await existing.update({
      datos_json,
      resumen_texto,
      generado_por: 'analistaAgent'
    });
    record = existing;
  } else {
    record = await ReporteDiario.create({
      fecha: targetDateStr,
      datos_json,
      resumen_texto,
      generado_por: 'analistaAgent'
    });
  }

  return record;
}

module.exports = {
  generateDailyReport
};

