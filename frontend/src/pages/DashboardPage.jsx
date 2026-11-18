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
  Users,
  X
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
  const [modalTicket, setModalTicket] = useState(null);
  const [modalReplyText, setModalReplyText] = useState('');
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
  const [rightChartView, setRightChartView] = useState('temas');
  const [activeBottomTab, setActiveBottomTab] = useState('pending');
  const [highlightedSection, setHighlightedSection] = useState(null);

  const chartsRef = useRef(null);
  const bottomTabsRef = useRef(null);

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

  const scrollToSection = (ref, sectionKey, targetTab = null) => {
    if (targetTab) {
      setActiveBottomTab(targetTab);
    }
    window.setTimeout(() => {
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      [
        'Ausencias',
        'Permisos Hoy',
        (d.ausentes_hoy?.por_tipo?.permiso_con_goce ?? 0) +
          (d.ausentes_hoy?.por_tipo?.permiso_sin_goce ?? 0)
      ],
      ['Ausencias', 'Incapacidades Hoy', d.ausentes_hoy?.por_tipo?.incapacidad ?? 0],
      ['Solicitudes', 'Total Pendientes', d.solicitudes_pendientes?.total ?? 0],
      ['Solicitudes', 'Atrasadas > 3 días', d.solicitudes_pendientes?.atrasadas_mas_3_dias ?? 0],
      ['Incapacidades', 'Activas Hoy', d.incapacidades_mes?.activas_hoy ?? 0],
      ['Incapacidades', 'Total Días Mes', d.incapacidades_mes?.total_dias_mes ?? 0],
      ['Rotación', 'Colaboradores Activos', d.rotacion_personal?.total_activos ?? 0],
      ['Rotación', 'Tasa Rotación Mensual (%)', d.rotacion_personal?.tasa_rotacion_pct ?? 0],
      [
        'Pasivo Vacaciones',
        'Colaboradores > 20 días',
        d.riesgo_pasivo_vacaciones?.total_colaboradores ?? 0
      ],
      ['Chatbot', 'Consultas Últimas 24h', d.metricas_chatbot?.consultas_ultimas_24h ?? 0],
      [
        'Chatbot',
        'Resueltas sin Escalar (%)',
        d.metricas_chatbot?.porcentaje_resueltas_sin_escalar ?? 0
      ],
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

  const openResolveModal = (ticket) => {
    setModalTicket(ticket);
    setModalReplyText('');
  };

  const closeResolveModal = () => {
    setModalTicket(null);
    setModalReplyText('');
  };

  const handleResolveTicket = async (e) => {
    e.preventDefault();
    if (!modalTicket) return;

    const replyText = modalReplyText.trim();
    if (replyText.length < 5) {
      showToast('Escribe una respuesta oficial de al menos 5 caracteres.', 'error');
      return;
    }

    setSavingTicketId(modalTicket.id);
    try {
      const { data } = await api.patch(`/tickets/${modalTicket.id}/resolve`, {
        respuesta_rrhh: replyText,
        estado: 'resuelto'
      });

      setTickets((prev) => prev.map((t) => (t.id === modalTicket.id ? data.ticket : t)));
      showToast(`Ticket ${data.ticket.codigo} marcado como resuelto.`, 'success');
      closeResolveModal();
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
        prev.map((item) =>
          item.id === kw.id ? { ...item, activa: Boolean(data.keyword.activa) } : item
        )
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
  const alertsBadgeCount =
    (riesgoPasivo.detalle?.length ?? 0) + (temasYBrechas.preguntas_escaladas?.length ?? 0);

  // Chart.js - Paleta Vino Fosforescente (#E6004C, #FF2A70, #FF709E, #B8003E)
  const lineChartData = {
    labels: tendencia30.map((d) => d.fecha.slice(5)),
    datasets: [
      {
        label: 'Consultas Chatbot',
        data: tendencia30.map((d) => d.consultas_chat),
        borderColor: '#E6004C',
        backgroundColor: 'rgba(230, 0, 76, 0.12)',
        pointBackgroundColor: '#E6004C',
        tension: 0.35,
        fill: true
      },
      {
        label: 'Ausencias (Vac./Perm./Incap.)',
        data: tendencia30.map((d) => d.ausencias),
        borderColor: '#FF709E',
        backgroundColor: 'rgba(255, 112, 158, 0.14)',
        pointBackgroundColor: '#FF2A70',
        tension: 0.35,
        fill: false
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#18181B', font: { size: 11, weight: '600' } } }
    },
    scales: {
      x: { ticks: { color: '#52525B', font: { size: 10 } }, grid: { color: '#F1F5F9' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#52525B', precision: 0 },
        grid: { color: '#F1F5F9' }
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
        backgroundColor: ['#E6004C', '#FF2A70', '#FF709E', '#B8003E', '#FFB8D0'],
        borderRadius: 8
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#18181B', font: { size: 11 } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { color: '#52525B', precision: 0 },
        grid: { color: '#F1F5F9' }
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
            ? ['#E6004C', '#FF2A70', '#FF709E', '#B8003E', '#FFB8D0']
            : ['#FFF0F5'],
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
        labels: { color: '#18181B', font: { size: 11 } }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#18181B]">
      <Navbar />

      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
        {/* Barra Superior de Control */}
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#FFB8D0]/60 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#18181B]">
              Centro de Analítica, Tickets y Cumplimiento RRHH
            </h1>
            <p className="mt-0.5 text-xs text-[#52525B]">
              Activos: <strong className="text-[#18181B]">{rotacion.total_activos}</strong> ·
              Rotación mensual:{' '}
              <strong className="text-[#E6004C]">{rotacion.tasa_rotacion_pct}%</strong> · Tickets
              abiertos: <strong className="text-[#E6004C]">{openTicketsCount}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] px-3 py-2 text-xs">
              <Database className="h-4 w-4 text-[#E6004C]" />
              <span className="text-[#18181B]">
                Drive RAG:{' '}
                <strong className="font-bold">{ingestStatus?.totalDocuments ?? 0}</strong> docs ·{' '}
                <strong className="font-bold text-[#E6004C]">
                  {ingestStatus?.totalChunks ?? 0}
                </strong>{' '}
                chunks
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-[#F8F9FB] px-3 py-1.5">
              <Calendar className="h-4 w-4 text-[#E6004C]" />
              <select
                value={selectedFecha}
                onChange={(e) => handleSelectDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#18181B] outline-none cursor-pointer"
              >
                {fechasDisponibles.map((f) => (
                  <option key={f} value={f} className="bg-white text-[#18181B]">
                    Reporte {formatShortDate(f)}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#FFB8D0] bg-[#FFF0F5]">
              <span className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold text-[#18181B]">
                <Download className="h-3.5 w-3.5 text-[#E6004C]" />
                Descargar Reporte:
              </span>
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={!reporte}
                className="border-l border-[#FFB8D0] bg-white px-2.5 py-2 text-[11px] font-bold text-[#E6004C] transition hover:bg-[#FFF0F5] cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={!reporte}
                className="border-l border-[#FFB8D0] bg-white px-2.5 py-2 text-[11px] font-bold text-[#E6004C] transition hover:bg-[#FFF0F5] cursor-pointer"
              >
                JSON
              </button>
            </div>

            <button
              type="button"
              onClick={handleRegenerateReport}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6004C] bg-white px-3.5 py-2 text-xs font-semibold text-[#E6004C] transition hover:bg-[#FFF0F5] disabled:opacity-50 cursor-pointer"
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#E6004C] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FF1764] hover:shadow-[0_0_16px_rgba(230,0,76,0.35)] disabled:opacity-50 cursor-pointer"
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
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#FFB8D0]/60 bg-white shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold text-[#18181B]">
              <Loader2 className="h-5 w-5 animate-spin text-[#E6004C]" />
              <span>Cargando indicadores diarios de Talento Humano...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Resumen Ejecutivo */}
            <section className="rounded-2xl border border-[#FFB8D0] border-l-4 border-l-[#E6004C] bg-[#FFF0F5] p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#E6004C]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#18181B]">
                    Resumen Ejecutivo Diario · {formatShortDate(reporte?.fecha)}
                  </h2>
                </div>
                <span className="rounded-full border border-[#FFB8D0] bg-white px-3 py-0.5 text-[11px] font-bold text-[#E6004C]">
                  Validado Sequelize ORM ({reporte?.generado_por || 'analistaAgent'})
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#18181B]">{reporte?.resumen_texto}</p>
            </section>

            {/* Fila de 5 KPIs Uniformes */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => scrollToSection(chartsRef, 'charts')}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.14)] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between text-xs font-semibold text-[#52525B]">
                  <span>Ausentes Hoy</span>
                  <Users className="h-4 w-4 text-[#E6004C]" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-[#E6004C]">{ausentesHoy.total}</p>
                <p className="mt-1.5 text-[11px] text-[#52525B]">
                  Vac: {ausentesHoy.por_tipo?.vacaciones ?? 0} · Perm:{' '}
                  {(ausentesHoy.por_tipo?.permiso_con_goce ?? 0) +
                    (ausentesHoy.por_tipo?.permiso_sin_goce ?? 0)}{' '}
                  · Incap: {ausentesHoy.por_tipo?.incapacidad ?? 0}
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(bottomTabsRef, 'tabs', 'pending')}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.14)] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between text-xs font-semibold text-[#52525B]">
                  <span>Solicitudes Pendientes</span>
                  <Clock className="h-4 w-4 text-[#E6004C]" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-[#E6004C]">
                  {solicitudesPendientes.total}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#52525B]">
                  <span className="text-[#E6004C]">
                    {solicitudesPendientes.atrasadas_mas_3_dias} con &gt; 3 días
                  </span>{' '}
                  · Ver abajo ↓
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(chartsRef, 'charts')}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.14)] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between text-xs font-semibold text-[#52525B]">
                  <span>Incapacidades Mes</span>
                  <HeartPulse className="h-4 w-4 text-[#E6004C]" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-[#E6004C]">
                  {incapacidadesMes.activas_hoy}{' '}
                  <span className="text-xs font-medium text-[#52525B]">activas</span>
                </p>
                <p className="mt-1.5 text-[11px] text-[#52525B]">
                  {incapacidadesMes.total_dias_mes} días · CCSS:{' '}
                  {incapacidadesMes.desglose_entidad?.CCSS?.cantidad ?? 0} / INS:{' '}
                  {incapacidadesMes.desglose_entidad?.INS?.cantidad ?? 0}
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(bottomTabsRef, 'tabs', 'alerts')}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.14)] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between text-xs font-semibold text-[#52525B]">
                  <span>Riesgo Pasivo (&gt;20d)</span>
                  <ShieldAlert className="h-4 w-4 text-[#E6004C]" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-[#E6004C]">
                  {riesgoPasivo.total_colaboradores}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#52525B]">
                  Requieren plan de disfrute ↓
                </p>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(bottomTabsRef, 'tabs', 'tickets')}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.14)] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between text-xs font-semibold text-[#52525B]">
                  <span>Chatbot (24h)</span>
                  <Bot className="h-4 w-4 text-[#E6004C]" />
                </div>
                <p className="mt-2 text-3xl font-extrabold text-[#E6004C]">
                  {metricasChatbot.consultas_ultimas_24h}{' '}
                  <span className="text-xs font-medium text-[#52525B]">consultas</span>
                </p>
                <p className="mt-1.5 text-[11px] text-[#52525B]">
                  {formatNumber(metricasChatbot.porcentaje_resueltas_sin_escalar, 1)}% resueltas ·{' '}
                  {metricasChatbot.latencia_promedio_ms} ms
                </p>
              </button>
            </section>

            {/* Fila de Gráficos (7 + 5) */}
            <section
              ref={chartsRef}
              className={`grid grid-cols-1 gap-5 rounded-2xl transition-all lg:grid-cols-12 ${
                highlightedSection === 'charts'
                  ? 'ring-2 ring-[#E6004C] ring-offset-4 ring-offset-[#F8F9FB]'
                  : ''
              }`}
            >
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm lg:col-span-7">
                <h3 className="mb-4 text-sm font-bold text-[#18181B]">
                  Tendencia de 30 Días: Consultas y Ausencias
                </h3>
                <div className="h-72">
                  <Line data={lineChartData} options={lineChartOptions} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm lg:col-span-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#18181B]">
                    {rightChartView === 'temas'
                      ? 'Top Temas Consultados'
                      : 'Ausencias por Departamento'}
                  </h3>

                  <div className="inline-flex rounded-full border border-[#FFB8D0] bg-[#FFF0F5] p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setRightChartView('temas')}
                      className={`rounded-full px-3 py-1 transition cursor-pointer ${
                        rightChartView === 'temas'
                          ? 'bg-[#E6004C] text-white shadow-xs'
                          : 'text-[#52525B] hover:text-[#E6004C]'
                      }`}
                    >
                      Top Temas
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightChartView('deptos')}
                      className={`rounded-full px-3 py-1 transition cursor-pointer ${
                        rightChartView === 'deptos'
                          ? 'bg-[#E6004C] text-white shadow-xs'
                          : 'text-[#52525B] hover:text-[#E6004C]'
                      }`}
                    >
                      Ausencias Depto
                    </button>
                  </div>
                </div>

                <div className="h-72">
                  {rightChartView === 'temas' ? (
                    <Bar data={barChartData} options={barChartOptions} />
                  ) : (
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                  )}
                </div>
              </div>
            </section>

            {/* Panel Inferior Organizado en 3 Pestañas Limpias */}
            <section
              ref={bottomTabsRef}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                highlightedSection === 'tabs'
                  ? 'border-[#E6004C] ring-2 ring-[#E6004C]/25'
                  : 'border-zinc-200/80'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-[#F8F9FB] px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => setActiveBottomTab('pending')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    activeBottomTab === 'pending'
                      ? 'bg-[#E6004C] text-white shadow-[0_0_14px_rgba(230,0,76,0.3)]'
                      : 'border border-zinc-200 bg-white text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Solicitudes Pendientes</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      activeBottomTab === 'pending'
                        ? 'bg-white text-[#E6004C]'
                        : 'bg-[#FFF0F5] text-[#E6004C]'
                    }`}
                  >
                    {solicitudesPendientes.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('tickets')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    activeBottomTab === 'tickets'
                      ? 'bg-[#E6004C] text-white shadow-[0_0_14px_rgba(230,0,76,0.3)]'
                      : 'border border-zinc-200 bg-white text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
                  }`}
                >
                  <Ticket className="h-3.5 w-3.5" />
                  <span>Tickets Escalados RRHH</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      activeBottomTab === 'tickets'
                        ? 'bg-white text-[#E6004C]'
                        : 'bg-[#FFF0F5] text-[#E6004C]'
                    }`}
                  >
                    {openTicketsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBottomTab('alerts')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
                    activeBottomTab === 'alerts'
                      ? 'bg-[#E6004C] text-white shadow-[0_0_14px_rgba(230,0,76,0.3)]'
                      : 'border border-zinc-200 bg-white text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Alertas de Pasivo y Palabras Clave</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      activeBottomTab === 'alerts'
                        ? 'bg-white text-[#E6004C]'
                        : 'bg-[#FFF0F5] text-[#E6004C]'
                    }`}
                  >
                    {alertsBadgeCount}
                  </span>
                </button>
              </div>

              <div className="p-5">
                {/* Pestaña 1: Solicitudes Pendientes */}
                {activeBottomTab === 'pending' && (
                  <div>
                    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="text-sm font-bold text-[#18181B]">
                          Solicitudes Pendientes de Aprobación
                        </h3>
                        <p className="text-xs text-[#52525B]">
                          Mostrando {filteredPending.length} de{' '}
                          {solicitudesPendientes.detalle.length} solicitudes
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#52525B]" />
                          <input
                            type="text"
                            value={pendingSearch}
                            onChange={(e) => setPendingSearch(e.target.value)}
                            placeholder="Buscar nombre o área..."
                            className="rounded-xl border border-zinc-200 bg-[#F8F9FB] py-1.5 pr-3 pl-8 text-xs text-[#18181B] placeholder-[#52525B]/70 outline-none transition focus:border-[#E6004C] focus:bg-white focus:ring-2 focus:ring-[#E6004C]/15"
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
                                    ? 'bg-[#E6004C] text-white shadow-xs'
                                    : 'border border-zinc-200 bg-[#F8F9FB] text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
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
                        <thead className="border-b border-[#FFB8D0] bg-[#FFF0F5] text-[11px] uppercase text-[#18181B]">
                          <tr>
                            <th className="rounded-tl-xl px-3 py-2.5">Colaborador</th>
                            <th className="px-3 py-2.5">Departamento</th>
                            <th className="px-3 py-2.5">Tipo</th>
                            <th className="px-3 py-2.5">Fechas</th>
                            <th className="rounded-tr-xl px-3 py-2.5 text-right">
                              Días en espera
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {filteredPending.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-[#52525B]">
                                No hay solicitudes pendientes que coincidan con el filtro aplicado.
                              </td>
                            </tr>
                          ) : (
                            filteredPending.map((sol) => {
                              const atrasada = Number(sol.dias_espera) > 3;
                              return (
                                <tr key={sol.id} className="transition hover:bg-[#FFF0F5]/60">
                                  <td className="px-3 py-2.5 font-semibold text-[#18181B]">
                                    {sol.colaborador}
                                  </td>
                                  <td className="px-3 py-2.5 text-[#52525B]">{sol.departamento}</td>
                                  <td className="px-3 py-2.5">
                                    <span className="rounded-md border border-zinc-200 bg-[#F8F9FB] px-2 py-0.5 text-[11px] font-medium text-[#18181B]">
                                      {sol.tipo}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-[#52525B]">
                                    {formatShortDate(sol.fecha_inicio)} —{' '}
                                    {formatShortDate(sol.fecha_fin)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                        atrasada
                                          ? 'bg-[#E6004C] text-white'
                                          : 'border border-[#FFB8D0] bg-[#FFF0F5] text-[#E6004C]'
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
                  </div>
                )}

                {/* Pestaña 2: Tickets Escalados RRHH */}
                {activeBottomTab === 'tickets' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#18181B]">
                          Bandeja de Tickets Escalados a Talento Humano
                        </h3>
                        <p className="text-xs text-[#52525B]">
                          Consultas sin política vigente enviadas por colaboradores para
                          resolución oficial
                        </p>
                      </div>
                      <span className="rounded-full bg-[#E6004C] px-3 py-1 text-[11px] font-bold text-white">
                        {openTicketsCount} abiertos · {tickets.length} totales
                      </span>
                    </div>

                    {tickets.length === 0 ? (
                      <p className="py-4 text-xs text-[#52525B]">No hay tickets registrados.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {tickets.map((tkt) => {
                          const isResolved = tkt.estado === 'resuelto';
                          return (
                            <div
                              key={tkt.id}
                              className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-[#F8F9FB] p-4 text-xs transition hover:border-[#FFB8D0]"
                            >
                              <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#18181B]">{tkt.codigo}</span>
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                        isResolved
                                          ? 'border border-[#FFB8D0] bg-[#FFF0F5] text-[#E6004C]'
                                          : 'bg-[#E6004C] text-white'
                                      }`}
                                    >
                                      {tkt.estado}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-[#52525B]">
                                    {tkt.colaborador?.nombre} ({tkt.colaborador?.departamento})
                                  </span>
                                </div>

                                <p className="mt-2 font-semibold text-[#18181B]">
                                  {tkt.consulta_original}
                                </p>
                                <p className="mt-1 text-[11px] text-[#52525B]">
                                  Motivo: {tkt.motivo}
                                </p>
                              </div>

                              {isResolved && tkt.respuesta_rrhh ? (
                                <div className="mt-3 rounded-lg border border-[#FFB8D0] bg-white p-3">
                                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#E6004C]">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Respuesta Oficial ({tkt.atendedor?.nombre || 'RRHH'}):
                                  </p>
                                  <p className="mt-1 text-xs text-[#18181B]">
                                    {tkt.respuesta_rrhh}
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-3 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => openResolveModal(tkt)}
                                    className="rounded-xl bg-[#E6004C] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#FF1764] hover:shadow-[0_0_14px_rgba(230,0,76,0.35)] cursor-pointer"
                                  >
                                    Responder y Resolver
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Pestaña 3: Alertas de Pasivo, Brechas y CRUD Palabras Clave */}
                {activeBottomTab === 'alerts' && (
                  <div className="space-y-6">
                    {/* Alertas de Pasivo y Brechas Documentales */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div className="rounded-xl border border-[#FFB8D0] bg-[#FFF0F5]/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-[#E6004C]" />
                            <h4 className="text-sm font-bold text-[#18181B]">
                              Alertas de Pasivo de Vacaciones (&gt; 20 días)
                            </h4>
                          </div>
                          <span className="rounded-full bg-[#E6004C] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {riesgoPasivo.detalle.length}
                          </span>
                        </div>

                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {riesgoPasivo.detalle.map((item) => (
                            <div
                              key={item.colaborador_id}
                              className="flex items-center justify-between rounded-xl border border-[#FFB8D0]/60 bg-white px-3.5 py-2.5 text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#18181B]">{item.nombre}</p>
                                <p className="text-[11px] text-[#52525B]">{item.departamento}</p>
                              </div>
                              <span className="rounded-lg border border-[#FFB8D0] bg-[#FFF0F5] px-2.5 py-1 font-bold text-[#E6004C]">
                                {formatNumber(item.dias_disponibles, 2)} días
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#FFB8D0] bg-[#FFF0F5]/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileWarning className="h-4 w-4 text-[#E6004C]" />
                            <h4 className="text-sm font-bold text-[#18181B]">
                              Preguntas Escaladas / Brechas Documentales
                            </h4>
                          </div>
                          <span className="rounded-full bg-[#E6004C] px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {temasYBrechas.preguntas_escaladas?.length ?? 0}
                          </span>
                        </div>

                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {(temasYBrechas.preguntas_escaladas || []).length === 0 ? (
                            <p className="text-xs text-[#52525B]">
                              Sin preguntas escaladas en los últimos 30 días.
                            </p>
                          ) : (
                            temasYBrechas.preguntas_escaladas.map((q) => (
                              <div
                                key={q.id}
                                className="rounded-xl border border-[#FFB8D0]/60 bg-white p-3 text-xs"
                              >
                                <p className="font-medium text-[#18181B]">{q.pregunta}</p>
                                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#52525B]">
                                  <span className="font-semibold text-[#E6004C]">{q.agente}</span>
                                  <span>{formatDateTime(q.fecha)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gestor CRUD Dinámico de palabras_clave */}
                    <div className="border-t border-zinc-100 pt-5">
                      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-[#E6004C]" />
                          <div>
                            <h4 className="text-sm font-bold text-[#18181B]">
                              Gestor Dinámico de Palabras Clave (MySQL · `palabras_clave`)
                            </h4>
                            <p className="text-xs text-[#52525B]">
                              Reglas activas en tiempo real con invalidación inmediata de caché (
                              {keywords.length} registros)
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
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                                  active
                                    ? 'bg-[#E6004C] text-white'
                                    : 'border border-zinc-200 bg-[#F8F9FB] text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
                                }`}
                              >
                                {cat.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <form
                        onSubmit={handleCreateKeyword}
                        className="mb-4 grid grid-cols-1 gap-2.5 rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3.5 sm:grid-cols-4"
                      >
                        <input
                          type="text"
                          required
                          value={newKwPalabra}
                          onChange={(e) => setNewKwPalabra(e.target.value)}
                          placeholder="Nueva palabra o frase clave..."
                          className="rounded-xl border border-[#FFB8D0] bg-white px-3 py-2 text-xs text-[#18181B] outline-none focus:border-[#E6004C]"
                        />
                        <select
                          value={newKwCategoria}
                          onChange={(e) => setNewKwCategoria(e.target.value)}
                          className="rounded-xl border border-[#FFB8D0] bg-white px-3 py-2 text-xs font-semibold text-[#18181B] outline-none focus:border-[#E6004C] cursor-pointer"
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
                          className="rounded-xl border border-[#FFB8D0] bg-white px-3 py-2 text-xs text-[#18181B] outline-none focus:border-[#E6004C]"
                        />
                        <button
                          type="submit"
                          disabled={savingKeyword}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E6004C] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#FF1764] hover:shadow-[0_0_14px_rgba(230,0,76,0.35)] disabled:opacity-50 cursor-pointer"
                        >
                          {savingKeyword ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          <span>Agregar Palabra</span>
                        </button>
                      </form>

                      <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredKeywords.map((kw) => (
                          <div
                            key={kw.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                              kw.activa
                                ? 'border-zinc-200/80 bg-[#F8F9FB]'
                                : 'border-zinc-200 bg-zinc-50 opacity-60'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#18181B]">{kw.palabra}</p>
                              <p className="truncate text-[10px] text-[#52525B]">
                                <span className="font-semibold text-[#E6004C]">
                                  {kw.categoria}
                                </span>
                                {kw.tema_asociado ? ` · ${kw.tema_asociado}` : ''}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleKeyword(kw)}
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                  kw.activa
                                    ? 'bg-[#E6004C] text-white'
                                    : 'border border-zinc-300 bg-white text-[#52525B]'
                                }`}
                              >
                                {kw.activa ? 'Activa' : 'Inactiva'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteKeyword(kw)}
                                aria-label={`Eliminar ${kw.palabra}`}
                                className="rounded-md p-1 text-[#52525B] transition hover:bg-[#FFF0F5] hover:text-[#E6004C] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Modal Elegante para Responder y Resolver Ticket RRHH */}
      {modalTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#FFB8D0] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#D9044B] to-[#FF1764] px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                <h3 className="text-sm font-bold">Resolver Ticket {modalTicket.codigo}</h3>
              </div>
              <button
                type="button"
                onClick={closeResolveModal}
                aria-label="Cerrar modal"
                className="rounded-lg p-1 text-white/85 transition hover:bg-white/20 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResolveTicket} className="space-y-4 p-5">
              <div className="rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3 text-xs">
                <p className="font-bold text-[#18181B]">
                  {modalTicket.colaborador?.nombre} ({modalTicket.colaborador?.departamento})
                </p>
                <p className="mt-1 text-[#52525B]">{modalTicket.consulta_original}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#18181B]">
                  Respuesta oficial de Talento Humano
                </label>
                <textarea
                  rows={4}
                  required
                  value={modalReplyText}
                  onChange={(e) => setModalReplyText(e.target.value)}
                  placeholder="Escribe la resolución oficial que verá el colaborador en su chat..."
                  className="w-full rounded-xl border border-zinc-200 bg-[#F8F9FB] p-3 text-xs text-[#18181B] outline-none transition focus:border-[#E6004C] focus:bg-white focus:ring-4 focus:ring-[#E6004C]/15"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-[#52525B] transition hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTicketId === modalTicket.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E6004C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#FF1764] hover:shadow-[0_0_16px_rgba(230,0,76,0.35)] disabled:opacity-50 cursor-pointer"
                >
                  {savingTicketId === modalTicket.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Marcar como Resuelto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
