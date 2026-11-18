import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Activity,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileWarning,
  FolderSync,
  HeartPulse,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Ticket,
  Trash2,
  Users
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDateTime, formatNumber, formatShortDate } from '../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PENDING_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'critical', label: 'Críticas > 3 días' },
  { id: 'recent', label: 'Recientes' }
];

const KEYWORD_CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'restringida', label: 'restringida' },
  { id: 'fuera_alcance', label: 'fuera_alcance' },
  { id: 'dato_personal', label: 'dato_personal' },
  { id: 'politica', label: 'politica' },
  { id: 'tema_dashboard', label: 'tema_dashboard' }
];

export default function DashboardPage() {
  const { showToast } = useToast();

  const [reporte, setReporte] = useState(null);
  const [fechasDisponibles, setFechasDisponibles] = useState([]);
  const [selectedFecha, setSelectedFecha] = useState('');
  const [ingestStatus, setIngestStatus] = useState(null);

  const [tickets, setTickets] = useState([]);
  const [resolvingTicketId, setResolvingTicketId] = useState(null);
  const [ticketReplies, setTicketReplies] = useState({});
  const [savingTicketId, setSavingTicketId] = useState(null);

  const [keywords, setKeywords] = useState([]);
  const [kwCategoryFilter, setKwCategoryFilter] = useState('all');
  const [newKwPalabra, setNewKwPalabra] = useState('');
  const [newKwCategoria, setNewKwCategoria] = useState('restringida');
  const [newKwTema, setNewKwTema] = useState('');
  const [savingKeyword, setSavingKeyword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);

  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingFilter, setPendingFilter] = useState('all');
  const [highlightedSection, setHighlightedSection] = useState(null);

  const pendingTableRef = useRef(null);
  const passiveAlertRef = useRef(null);
  const gapsAlertRef = useRef(null);
  const chartsRef = useRef(null);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [latestRes, historyRes, ingestRes, ticketsRes, kwRes] = await Promise.all([
        api.get('/dashboard/latest'),
        api.get('/dashboard/history'),
        api.get('/ingest/status'),
        api.get('/tickets'),
        api.get('/dashboard/keywords?all=true')
      ]);

      const rep = latestRes.data?.reporte || null;
      setReporte(rep);
      setSelectedFecha(rep?.fecha || '');
      setFechasDisponibles(historyRes.data?.fechas_disponibles || (rep ? [rep.fecha] : []));
      setIngestStatus(ingestRes.data || null);
      setTickets(ticketsRes.data?.tickets || []);
      setKeywords(kwRes.data?.keywords || []);
    } catch (err) {
      showToast(
        err?.response?.data?.error || 'No se pudo cargar el dashboard de RRHH.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const scrollToSection = (ref, sectionKey) => {
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedSection(sectionKey);
    window.setTimeout(() => {
      setHighlightedSection((prev) => (prev === sectionKey ? null : prev));
    }, 1800);
  };

  const handleSelectDate = async (fecha) => {
    setSelectedFecha(fecha);
    if (!fecha) return;
    try {
      const { data } = await api.get(`/dashboard/history?fecha=${fecha}`);
      if (data.reporte) {
        setReporte(data.reporte);
        showToast(`Mostrando reporte histórico del ${formatShortDate(fecha)}.`, 'info');
      }
    } catch (err) {
      showToast(
        err?.response?.data?.error || 'Error al cargar el reporte histórico.',
        'error'
      );
    }
  };

  const handleRegenerateReport = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.post('/dashboard/generate', {});
      setReporte(data.reporte);
      setSelectedFecha(data.reporte?.fecha || '');
      const historyRes = await api.get('/dashboard/history');
      setFechasDisponibles(historyRes.data?.fechas_disponibles || []);
      showToast(
        `Reporte diario regenerado al ${formatShortDate(data.reporte?.fecha)}.`,
        'success'
      );
    } catch (err) {
      showToast(
        err?.response?.data?.error || 'No fue posible regenerar el reporte.',
        'error'
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    try {
      const { data } = await api.post('/ingest/sync', {});
      const statusRes = await api.get('/ingest/status');
      setIngestStatus(statusRes.data);
      const s = data.summary || {};
      showToast(
        `Drive sincronizado: ${s.totalActiveInFolder ?? 0} docs (${s.added ?? 0} nuevos, ${s.updated ?? 0} editados, ${s.totalChunks ?? 0} chunks).`,
        'success',
        4500
      );
    } catch (err) {
      showToast(
        err?.response?.data?.error || 'Error al sincronizar documentos desde Google Drive.',
        'error'
      );
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleDownloadJson = () => {
    if (!reporte) return;
    const payload = {
      fecha: reporte.fecha,
      generado_por: reporte.generado_por,
      resumen_ejecutivo: reporte.resumen_texto,
      indicadores: reporte.datos_json
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-rrhh-${reporte.fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Reporte JSON descargado (reporte-rrhh-${reporte.fecha}.json).`, 'success');
  };

  const handleDownloadCsv = () => {
    if (!reporte) return;
    const d = reporte.datos_json || {};
    const rows = [
      ['Seccion', 'Indicador', 'Valor'],
      ['General', 'Fecha del Reporte', reporte.fecha],
      ['General', 'Resumen Ejecutivo', reporte.resumen_texto],
      ['Ausencias', 'Total Ausentes Hoy', d.ausentes_hoy?.total ?? 0],
      ['Ausencias', 'Vacaciones Hoy', d.ausentes_hoy?.por_tipo?.vacaciones ?? 0],
      ['Ausencias', 'Permisos Hoy', (d.ausentes_hoy?.por_tipo?.permiso_con_goce ?? 0) + (d.ausentes_hoy?.por_tipo?.permiso_sin_goce ?? 0)],
      ['Ausencias', 'Incapacidades Hoy', d.ausentes_hoy?.por_tipo?.incapacidad ?? 0],
      ['Solicitudes', 'Total Pendientes', d.solicitudes_pendientes?.total ?? 0],
      ['Solicitudes', 'Atrasadas > 3 días', d.solicitudes_pendientes?.atrasadas_mas_3_dias ?? 0],
      ['Incapacidades', 'Activas Hoy', d.incapacidades_mes?.activas_hoy ?? 0],
      ['Incapacidades', 'Total Días Mes', d.incapacidades_mes?.total_dias_mes ?? 0],
      ['Rotación', 'Colaboradores Activos', d.rotacion_personal?.total_activos ?? 0],
      ['Rotación', 'Tasa Rotación Mensual (%)', d.rotacion_personal?.tasa_rotacion_pct ?? 0],
      ['Pasivo Vacaciones', 'Colaboradores > 20 días', d.riesgo_pasivo_vacaciones?.total_colaboradores ?? 0],
      ['Chatbot', 'Consultas Últimas 24h', d.metricas_chatbot?.consultas_ultimas_24h ?? 0],
      ['Chatbot', 'Resueltas sin Escalar (%)', d.metricas_chatbot?.porcentaje_resueltas_sin_escalar ?? 0],
      ['Chatbot', 'Latencia Promedio (ms)', d.metricas_chatbot?.latencia_promedio_ms ?? 0]
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-rrhh-${reporte.fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Reporte CSV descargado (reporte-rrhh-${reporte.fecha}.csv).`, 'success');
  };

  const handleResolveTicket = async (ticketId) => {
    const replyText = String(ticketReplies[ticketId] || '').trim();
    if (replyText.length < 5) {
      showToast('Escribe una respuesta oficial de al menos 5 caracteres.', 'error');
      return;
    }

    setSavingTicketId(ticketId);
    try {
      const { data } = await api.patch(`/tickets/${ticketId}/resolve`, {
        respuesta_rrhh: replyText,
        estado: 'resuelto'
      });

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
      setResolvingTicketId(null);
      showToast(`Ticket ${data.ticket.codigo} marcado como resuelto.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error al resolver el ticket.', 'error');
    } finally {
      setSavingTicketId(null);
    }
  };

  const handleCreateKeyword = async (e) => {
    e.preventDefault();
    if (!newKwPalabra.trim()) return;

    setSavingKeyword(true);
    try {
      const { data } = await api.post('/dashboard/keywords', {
        palabra: newKwPalabra.trim(),
        categoria: newKwCategoria,
        tema_asociado: newKwTema.trim() || null
      });

      setKeywords((prev) => [...prev, data.keyword]);
      setNewKwPalabra('');
      setNewKwTema('');
      showToast(
        `Palabra clave "${data.keyword.palabra}" agregada en ${data.keyword.categoria}.`,
        'success'
      );
    } catch (err) {
      showToast(err?.response?.data?.error || 'No se pudo agregar la palabra clave.', 'error');
    } finally {
      setSavingKeyword(false);
    }
  };

  const handleToggleKeyword = async (kw) => {
    try {
      const { data } = await api.patch(`/dashboard/keywords/${kw.id}`, {
        activa: !kw.activa
      });
      setKeywords((prev) =>
        prev.map((item) => (item.id === kw.id ? { ...item, activa: Boolean(data.keyword.activa) } : item))
      );
      showToast(
        `"${kw.palabra}" ${data.keyword.activa ? 'activada' : 'desactivada'} (caché actualizada).`,
        'info',
        2500
      );
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error al actualizar palabra clave.', 'error');
    }
  };

  const handleDeleteKeyword = async (kw) => {
    try {
      await api.delete(`/dashboard/keywords/${kw.id}`);
      setKeywords((prev) => prev.filter((item) => item.id !== kw.id));
      showToast(`Palabra clave "${kw.palabra}" eliminada.`, 'info', 2500);
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error al eliminar palabra clave.', 'error');
    }
  };

  const datos = reporte?.datos_json || {};
  const ausentesHoy = datos.ausentes_hoy || { total: 0, por_tipo: {}, por_departamento: {} };
  const solicitudesPendientes = datos.solicitudes_pendientes || {
    total: 0,
    atrasadas_mas_3_dias: 0,
    detalle: []
  };
  const incapacidadesMes = datos.incapacidades_mes || {
    activas_hoy: 0,
    total_dias_mes: 0,
    desglose_entidad: { CCSS: { cantidad: 0, dias: 0 }, INS: { cantidad: 0, dias: 0 } }
  };
  const riesgoPasivo = datos.riesgo_pasivo_vacaciones || {
    total_colaboradores: 0,
    detalle: []
  };
  const metricasChatbot = datos.metricas_chatbot || {
    consultas_ultimas_24h: 0,
    porcentaje_resueltas_sin_escalar: 0,
    latencia_promedio_ms: 0
  };
  const rotacion = datos.rotacion_personal || {
    total_activos: 0,
    ingresos_mes: 0,
    salidas_mes: 0,
    tasa_rotacion_pct: 0
  };
  const temasYBrechas = datos.temas_y_brechas || {
    top_5_intenciones: [],
    preguntas_escaladas: []
  };
  const tendencia30 = Array.isArray(datos.tendencia_30_dias) ? datos.tendencia_30_dias : [];

  const filteredPending = useMemo(() => {
    const query = pendingSearch.trim().toLowerCase();
    return (solicitudesPendientes.detalle || []).filter((sol) => {
      const atrasada = Number(sol.dias_espera) > 3;
      if (pendingFilter === 'critical' && !atrasada) return false;
      if (pendingFilter === 'recent' && atrasada) return false;
      if (!query) return true;
      return (
        String(sol.colaborador || '').toLowerCase().includes(query) ||
        String(sol.departamento || '').toLowerCase().includes(query) ||
        String(sol.tipo || '').toLowerCase().includes(query)
      );
    });
  }, [solicitudesPendientes.detalle, pendingSearch, pendingFilter]);

  const filteredKeywords = useMemo(() => {
    if (kwCategoryFilter === 'all') return keywords;
    return keywords.filter((k) => k.categoria === kwCategoryFilter);
  }, [keywords, kwCategoryFilter]);

  const openTicketsCount = tickets.filter((t) => t.estado !== 'resuelto').length;

  // Chart.js - Tendencia 30 días (Paleta Vino y Blanco)
  const lineChartData = {
    labels: tendencia30.map((d) => d.fecha.slice(5)),
    datasets: [
      {
        label: 'Consultas Chatbot',
        data: tendencia30.map((d) => d.consultas_chat),
        borderColor: '#722F37',
        backgroundColor: 'rgba(114, 47, 55, 0.12)',
        pointBackgroundColor: '#722F37',
        tension: 0.35,
        fill: true
      },
      {
        label: 'Ausencias (Vac./Perm./Incap.)',
        data: tendencia30.map((d) => d.ausencias),
        borderColor: '#C95D6F',
        backgroundColor: 'rgba(201, 93, 111, 0.10)',
        pointBackgroundColor: '#C95D6F',
        tension: 0.35,
        fill: false
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#1F1416', font: { size: 11, weight: '600' } } }
    },
    scales: {
      x: { ticks: { color: '#6E5A5E', font: { size: 10 } }, grid: { color: '#F3ECEE' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#6E5A5E', precision: 0 },
        grid: { color: '#F3ECEE' }
      }
    }
  };

  const topIntenciones = temasYBrechas.top_5_intenciones || [];
  const barChartData = {
    labels: topIntenciones.map((t) => t.intencion),
    datasets: [
      {
        label: 'Consultas (30 días)',
        data: topIntenciones.map((t) => t.total),
        backgroundColor: ['#722F37', '#9E3344', '#C95D6F', '#E598A5', '#4E1A21'],
        borderRadius: 6
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#1F1416', font: { size: 10 } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { color: '#6E5A5E', precision: 0 },
        grid: { color: '#F3ECEE' }
      }
    }
  };

  const deptoEntries = Object.entries(ausentesHoy.por_departamento || {});
  const doughnutData = {
    labels: deptoEntries.length > 0 ? deptoEntries.map(([d]) => d) : ['Sin ausencias hoy'],
    datasets: [
      {
        data: deptoEntries.length > 0 ? deptoEntries.map(([, c]) => c) : [1],
        backgroundColor:
          deptoEntries.length > 0
            ? ['#722F37', '#9E3344', '#C95D6F', '#E598A5', '#4E1A21', '#B57B84']
            : ['#F3D5DB'],
        borderColor: '#FFFFFF',
        borderWidth: 2
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#1F1416', font: { size: 11 } }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F8] text-[#1F1416]">
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Barra de Control Superior */}
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#F3D5DB] bg-white p-4 shadow-sm xl:flex-row xl:items-center">
          <div>
            <h1 className="text-lg font-bold text-[#4E1A21]">
              Centro de Analítica, Tickets y Cumplimiento RRHH
            </h1>
            <p className="text-xs text-[#6E5A5E]">
              Activos: <strong className="text-[#1F1416]">{rotacion.total_activos}</strong> ·
              Rotación mensual: <strong className="text-[#722F37]">{rotacion.tasa_rotacion_pct}%</strong>{' '}
              · Tickets abiertos: <strong className="text-[#722F37]">{openTicketsCount}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-[#F3D5DB] bg-[#FDF2F4] px-3 py-2 text-xs">
              <Database className="h-4 w-4 text-[#722F37]" />
              <span className="text-[#4E1A21]">
                Drive RAG:{' '}
                <strong className="font-bold">{ingestStatus?.totalDocuments ?? 0}</strong> docs ·{' '}
                <strong className="font-bold text-[#722F37]">
                  {ingestStatus?.totalChunks ?? 0}
                </strong>{' '}
                chunks
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-3 py-1.5">
              <Calendar className="h-4 w-4 text-[#722F37]" />
              <select
                value={selectedFecha}
                onChange={(e) => handleSelectDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#1F1416] outline-none cursor-pointer"
              >
                {fechasDisponibles.map((f) => (
                  <option key={f} value={f} className="bg-white text-[#1F1416]">
                    Reporte {formatShortDate(f)}
                  </option>
                ))}
              </select>
            </div>

            {/* Exportar Reporte (CSV / JSON) */}
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#F3D5DB] bg-[#FAF7F8]">
              <span className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold text-[#6E5A5E]">
                <Download className="h-3.5 w-3.5 text-[#722F37]" />
                Descargar Reporte:
              </span>
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={!reporte}
                className="border-l border-[#F3D5DB] bg-white px-2.5 py-2 text-[11px] font-bold text-[#722F37] transition hover:bg-[#FDF2F4] cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={!reporte}
                className="border-l border-[#F3D5DB] bg-white px-2.5 py-2 text-[11px] font-bold text-[#722F37] transition hover:bg-[#FDF2F4] cursor-pointer"
              >
                JSON
              </button>
            </div>

            <button
              type="button"
              onClick={handleRegenerateReport}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-xl border border-[#722F37] bg-white px-3.5 py-2 text-xs font-semibold text-[#722F37] transition hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Regenerar Reporte</span>
            </button>

            <button
              type="button"
              onClick={handleSyncDrive}
              disabled={syncingDrive}
              className="inline-flex items-center gap-2 rounded-xl bg-[#722F37] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5A2229] disabled:opacity-50 cursor-pointer"
            >
              {syncingDrive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderSync className="h-4 w-4" />
              )}
              <span>Sincronizar Google Drive</span>
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#F3D5DB] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-sm font-medium text-[#4E1A21]">
              <Loader2 className="h-5 w-5 animate-spin text-[#722F37]" />
              <span>Cargando indicadores diarios de Talento Humano...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Resumen Ejecutivo */}
            <section className="rounded-2xl border border-[#F3D5DB] border-l-4 border-l-[#722F37] bg-[#FDF2F4] p-5 shadow-sm">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#722F37]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#4E1A21]">
                    Resumen Ejecutivo Diario · {formatShortDate(reporte?.fecha)}
                  </h2>
                </div>
                <span className="rounded-full border border-[#F3D5DB] bg-white px-3 py-0.5 text-[11px] font-semibold text-[#722F37]">
                  Validado Sequelize ORM ({reporte?.generado_por || 'analistaAgent'})
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#1F1416]">{reporte?.resumen_texto}</p>
            </section>

            {/* 5 Tarjetas KPI Interactivas */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => scrollToSection(chartsRef, 'charts')}
                className="rounded-2xl border border-[#F3D5DB] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#722F37] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#6E5A5E]">
                  <span>Ausentes Hoy</span>
                  <Users className="h-4 w-4 text-[#722F37]" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#4E1A21]">{ausentesHoy.total}</p>
                <p className="mt-1.5 text-[11px] text-[#6E5A5E]">
                  Vac: {ausentesHoy.por_tipo?.vacaciones ?? 0} · Perm:{' '}
                  {(ausentesHoy.por_tipo?.permiso_con_goce ?? 0) +
                    (ausentesHoy.por_tipo?.permiso_sin_goce ?? 0)}{' '}
                  · Incap: {ausentesHoy.por_tipo?.incapacidad ?? 0}
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(pendingTableRef, 'pending')}
                className="rounded-2xl border border-[#F3D5DB] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#722F37] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#6E5A5E]">
                  <span>Solicitudes Pendientes</span>
                  <Clock className="h-4 w-4 text-[#9E3344]" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#4E1A21]">
                  {solicitudesPendientes.total}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#722F37]">
                  {solicitudesPendientes.atrasadas_mas_3_dias} con &gt; 3 días · Ver tabla ↓
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(chartsRef, 'charts')}
                className="rounded-2xl border border-[#F3D5DB] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#722F37] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#6E5A5E]">
                  <span>Incapacidades Mes</span>
                  <HeartPulse className="h-4 w-4 text-[#9E3344]" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#4E1A21]">
                  {incapacidadesMes.activas_hoy}{' '}
                  <span className="text-xs font-normal text-[#6E5A5E]">activas hoy</span>
                </p>
                <p className="mt-1.5 text-[11px] text-[#6E5A5E]">
                  {incapacidadesMes.total_dias_mes} días · CCSS:{' '}
                  {incapacidadesMes.desglose_entidad?.CCSS?.cantidad ?? 0} / INS:{' '}
                  {incapacidadesMes.desglose_entidad?.INS?.cantidad ?? 0}
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(passiveAlertRef, 'passive')}
                className="rounded-2xl border border-[#F3D5DB] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#722F37] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#6E5A5E]">
                  <span>Riesgo Pasivo (&gt;20d)</span>
                  <ShieldAlert className="h-4 w-4 text-[#722F37]" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#722F37]">
                  {riesgoPasivo.total_colaboradores}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#9E3344]">
                  Requieren plan de disfrute · Ver alerta ↓
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(gapsAlertRef, 'gaps')}
                className="rounded-2xl border border-[#F3D5DB] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#722F37] hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-[#6E5A5E]">
                  <span>Chatbot (24h)</span>
                  <Bot className="h-4 w-4 text-[#722F37]" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#722F37]">
                  {metricasChatbot.consultas_ultimas_24h}{' '}
                  <span className="text-xs font-normal text-[#6E5A5E]">consultas</span>
                </p>
                <p className="mt-1.5 text-[11px] text-[#6E5A5E]">
                  {formatNumber(metricasChatbot.porcentaje_resueltas_sin_escalar, 1)}% resueltas ·{' '}
                  {metricasChatbot.latencia_promedio_ms} ms
                </p>
              </button>
            </section>

            {/* Gráficos Chart.js */}
            <section
              ref={chartsRef}
              className={`grid grid-cols-1 gap-5 rounded-2xl transition-all lg:grid-cols-12 ${
                highlightedSection === 'charts'
                  ? 'ring-2 ring-[#722F37] ring-offset-4 ring-offset-[#FAF7F8]'
                  : ''
              }`}
            >
              <div className="rounded-2xl border border-[#F3D5DB] bg-white p-5 shadow-sm lg:col-span-6">
                <h3 className="mb-4 text-sm font-bold text-[#4E1A21]">
                  Tendencia de 30 Días: Consultas y Ausencias
                </h3>
                <div className="h-64">
                  <Line data={lineChartData} options={lineChartOptions} />
                </div>
              </div>

              <div className="rounded-2xl border border-[#F3D5DB] bg-white p-5 shadow-sm lg:col-span-3">
                <h3 className="mb-4 text-sm font-bold text-[#4E1A21]">Top Temas Consultados</h3>
                <div className="h-64">
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>

              <div className="rounded-2xl border border-[#F3D5DB] bg-white p-5 shadow-sm lg:col-span-3">
                <h3 className="mb-4 text-sm font-bold text-[#4E1A21]">
                  Ausencias por Departamento
                </h3>
                <div className="h-64">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </div>
            </section>

            {/* Bandeja de Tickets Escalados por Colaboradores */}
            <section className="rounded-2xl border border-[#F3D5DB] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-[#722F37]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#4E1A21]">
                      Bandeja de Tickets Escalados a Talento Humano
                    </h3>
                    <p className="text-xs text-[#6E5A5E]">
                      Consultas sin política vigente enviadas por colaboradores para resolución oficial
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#722F37] px-3 py-0.5 text-[11px] font-bold text-white">
                  {openTicketsCount} pendientes
                </span>
              </div>

              <div className="space-y-3">
                {tickets.length === 0 ? (
                  <p className="text-xs text-[#6E5A5E]">No hay tickets registrados.</p>
                ) : (
                  tickets.map((tkt) => {
                    const isResolved = tkt.estado === 'resuelto';
                    const isEditing = resolvingTicketId === tkt.id;

                    return (
                      <div
                        key={tkt.id}
                        className="rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#4E1A21]">{tkt.codigo}</span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  isResolved
                                    ? 'border border-[#F3D5DB] bg-white text-[#722F37]'
                                    : 'bg-[#722F37] text-white'
                                }`}
                              >
                                {tkt.estado}
                              </span>
                              <span className="text-[11px] text-[#6E5A5E]">
                                {tkt.colaborador?.nombre} ({tkt.colaborador?.departamento})
                              </span>
                            </div>
                            <p className="font-medium text-[#1F1416]">{tkt.consulta_original}</p>
                            <p className="text-[11px] text-[#6E5A5E]">Motivo: {tkt.motivo}</p>
                          </div>

                          {!isResolved && (
                            <button
                              type="button"
                              onClick={() =>
                                setResolvingTicketId(isEditing ? null : tkt.id)
                              }
                              className="rounded-lg bg-[#722F37] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#5A2229] cursor-pointer"
                            >
                              {isEditing ? 'Cancelar' : 'Responder y Resolver'}
                            </button>
                          )}
                        </div>

                        {isResolved && tkt.respuesta_rrhh && (
                          <div className="mt-3 rounded-lg border border-[#F3D5DB] bg-white p-3">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#722F37]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Respuesta Oficial ({tkt.atendedor?.nombre || 'RRHH'}):
                            </p>
                            <p className="mt-1 text-xs text-[#1F1416]">{tkt.respuesta_rrhh}</p>
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-3 space-y-2 rounded-lg border border-[#F3D5DB] bg-white p-3">
                            <textarea
                              rows={2}
                              value={ticketReplies[tkt.id] || ''}
                              onChange={(e) =>
                                setTicketReplies((prev) => ({
                                  ...prev,
                                  [tkt.id]: e.target.value
                                }))
                              }
                              placeholder="Escribe la respuesta oficial de Talento Humano para el colaborador..."
                              className="w-full rounded-lg border border-[#F3D5DB] bg-[#FAF7F8] p-2.5 text-xs text-[#1F1416] outline-none focus:border-[#722F37] focus:bg-white"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={savingTicketId === tkt.id}
                                onClick={() => handleResolveTicket(tkt.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#722F37] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#5A2229] disabled:opacity-50 cursor-pointer"
                              >
                                {savingTicketId === tkt.id && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                <span>Marcar como Resuelto</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Tabla Interactiva de Solicitudes Pendientes */}
            <section
              ref={pendingTableRef}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                highlightedSection === 'pending'
                  ? 'border-[#722F37] ring-2 ring-[#722F37]/30'
                  : 'border-[#F3D5DB]'
              }`}
            >
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold text-[#4E1A21]">
                    Solicitudes Pendientes de Aprobación
                  </h3>
                  <p className="text-xs text-[#6E5A5E]">
                    Mostrando {filteredPending.length} de {solicitudesPendientes.detalle.length}{' '}
                    solicitudes
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6E5A5E]" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      placeholder="Buscar nombre o área..."
                      className="rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] py-1.5 pr-3 pl-8 text-xs text-[#1F1416] placeholder-[#6E5A5E]/70 outline-none transition focus:border-[#722F37] focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {PENDING_FILTERS.map((f) => {
                      const active = pendingFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setPendingFilter(f.id)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            active
                              ? 'bg-[#722F37] text-white'
                              : 'border border-[#F3D5DB] bg-[#FAF7F8] text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F3D5DB] bg-[#FDF2F4] text-[11px] uppercase text-[#4E1A21]">
                    <tr>
                      <th className="rounded-tl-lg px-3 py-2.5">Colaborador</th>
                      <th className="px-3 py-2.5">Departamento</th>
                      <th className="px-3 py-2.5">Tipo</th>
                      <th className="px-3 py-2.5">Fechas</th>
                      <th className="rounded-tr-lg px-3 py-2.5 text-right">Días en espera</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3D5DB]/70">
                    {filteredPending.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-5 text-center text-[#6E5A5E]">
                          No hay solicitudes pendientes que coincidan con el filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      filteredPending.map((sol) => {
                        const atrasada = Number(sol.dias_espera) > 3;
                        return (
                          <tr key={sol.id} className="transition hover:bg-[#FDF2F4]/70">
                            <td className="px-3 py-2.5 font-semibold text-[#1F1416]">
                              {sol.colaborador}
                            </td>
                            <td className="px-3 py-2.5 text-[#6E5A5E]">{sol.departamento}</td>
                            <td className="px-3 py-2.5">
                              <span className="rounded-md border border-[#F3D5DB] bg-[#FAF7F8] px-2 py-0.5 text-[11px] font-medium text-[#4E1A21]">
                                {sol.tipo}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[#6E5A5E]">
                              {formatShortDate(sol.fecha_inicio)} — {formatShortDate(sol.fecha_fin)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  atrasada
                                    ? 'bg-[#722F37] text-white'
                                    : 'border border-[#F3D5DB] bg-[#FDF2F4] text-[#722F37]'
                                }`}
                              >
                                {sol.dias_espera} días
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Gestor Visual CRUD de Palabras Clave (palabras_clave) */}
            <section className="rounded-2xl border border-[#F3D5DB] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#722F37]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#4E1A21]">
                      Gestor Dinámico de Palabras Clave (MySQL · `palabras_clave`)
                    </h3>
                    <p className="text-xs text-[#6E5A5E]">
                      Administra reglas de privacidad, fuera de alcance y clasificación temática en
                      tiempo real ({keywords.length} registros)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {KEYWORD_CATEGORIES.map((cat) => {
                    const active = kwCategoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setKwCategoryFilter(cat.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-[#722F37] text-white'
                            : 'border border-[#F3D5DB] bg-[#FAF7F8] text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Formulario rápido de alta */}
              <form
                onSubmit={handleCreateKeyword}
                className="mb-4 grid grid-cols-1 gap-2.5 rounded-xl border border-[#F3D5DB] bg-[#FDF2F4] p-3.5 sm:grid-cols-4"
              >
                <input
                  type="text"
                  required
                  value={newKwPalabra}
                  onChange={(e) => setNewKwPalabra(e.target.value)}
                  placeholder="Nueva palabra o frase clave..."
                  className="rounded-lg border border-[#F3D5DB] bg-white px-3 py-2 text-xs text-[#1F1416] outline-none focus:border-[#722F37]"
                />
                <select
                  value={newKwCategoria}
                  onChange={(e) => setNewKwCategoria(e.target.value)}
                  className="rounded-lg border border-[#F3D5DB] bg-white px-3 py-2 text-xs font-medium text-[#1F1416] outline-none focus:border-[#722F37] cursor-pointer"
                >
                  <option value="restringida">restringida</option>
                  <option value="fuera_alcance">fuera_alcance</option>
                  <option value="dato_personal">dato_personal</option>
                  <option value="politica">politica</option>
                  <option value="tema_dashboard">tema_dashboard</option>
                </select>
                <input
                  type="text"
                  value={newKwTema}
                  onChange={(e) => setNewKwTema(e.target.value)}
                  placeholder="Tema asociado (opcional)"
                  className="rounded-lg border border-[#F3D5DB] bg-white px-3 py-2 text-xs text-[#1F1416] outline-none focus:border-[#722F37]"
                />
                <button
                  type="submit"
                  disabled={savingKeyword}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#722F37] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#5A2229] disabled:opacity-50 cursor-pointer"
                >
                  {savingKeyword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Agregar Palabra</span>
                </button>
              </form>

              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredKeywords.map((kw) => (
                  <div
                    key={kw.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                      kw.activa
                        ? 'border-[#F3D5DB] bg-[#FAF7F8]'
                        : 'border-slate-200 bg-slate-50 opacity-65'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#1F1416]">{kw.palabra}</p>
                      <p className="truncate text-[10px] text-[#6E5A5E]">
                        <span className="font-semibold text-[#722F37]">{kw.categoria}</span>
                        {kw.tema_asociado ? ` · ${kw.tema_asociado}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleKeyword(kw)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                          kw.activa
                            ? 'bg-[#722F37] text-white'
                            : 'border border-[#F3D5DB] bg-white text-[#6E5A5E]'
                        }`}
                      >
                        {kw.activa ? 'Activa' : 'Inactiva'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteKeyword(kw)}
                        aria-label={`Eliminar ${kw.palabra}`}
                        className="rounded-md p-1 text-[#6E5A5E] transition hover:bg-[#FDF2F4] hover:text-[#722F37] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Paneles de Alertas de RRHH (2 columnas) */}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div
                ref={passiveAlertRef}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  highlightedSection === 'passive'
                    ? 'border-[#722F37] ring-2 ring-[#722F37]/30'
                    : 'border-[#F3D5DB]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#722F37]" />
                    <h3 className="text-sm font-bold text-[#4E1A21]">
                      Alertas de Pasivo de Vacaciones (&gt; 20 días)
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#722F37] px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {riesgoPasivo.detalle.length}
                  </span>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {riesgoPasivo.detalle.map((item) => (
                    <div
                      key={item.colaborador_id}
                      className="flex items-center justify-between rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-3.5 py-2.5 text-xs transition hover:bg-[#FDF2F4]"
                    >
                      <div>
                        <p className="font-semibold text-[#1F1416]">{item.nombre}</p>
                        <p className="text-[11px] text-[#6E5A5E]">{item.departamento}</p>
                      </div>
                      <span className="rounded-lg border border-[#F3D5DB] bg-white px-2.5 py-1 font-bold text-[#722F37]">
                        {formatNumber(item.dias_disponibles, 2)} días
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                ref={gapsAlertRef}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  highlightedSection === 'gaps'
                    ? 'border-[#722F37] ring-2 ring-[#722F37]/30'
                    : 'border-[#F3D5DB]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-[#9E3344]" />
                    <h3 className="text-sm font-bold text-[#4E1A21]">
                      Preguntas Escaladas / Brechas Documentales
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#9E3344] px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {temasYBrechas.preguntas_escaladas?.length ?? 0}
                  </span>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {(temasYBrechas.preguntas_escaladas || []).length === 0 ? (
                    <p className="text-xs text-[#6E5A5E]">
                      Sin preguntas escaladas en los últimos 30 días.
                    </p>
                  ) : (
                    temasYBrechas.preguntas_escaladas.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] p-3 text-xs transition hover:bg-[#FDF2F4]"
                      >
                        <p className="font-medium text-[#1F1416]">{q.pregunta}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#6E5A5E]">
                          <span className="font-semibold text-[#722F37]">{q.agente}</span>
                          <span>{formatDateTime(q.fecha)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
