import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  formatDateTime,
  formatNumber,
  formatShortDate,
  renderFormattedText
} from '../utils/formatters';

const SUGGESTED_QUESTIONS = [
  {
    categoria: 'Vacaciones',
    pregunta: '¿Cuántos días de vacaciones me quedan disponibles?'
  },
  {
    categoria: 'Vacaciones',
    pregunta: '¿Cuántos días me quedan y puedo pasar los que sobren al otro año?'
  },
  {
    categoria: 'Vacaciones',
    pregunta: '¿Qué feriados quedan este año?'
  },
  {
    categoria: 'Pagos',
    pregunta: '¿Cuándo pagan el aguinaldo y cómo se calcula?'
  },
  {
    categoria: 'Pagos',
    pregunta: '¿Qué día cae mi próximo pago?'
  },
  {
    categoria: 'Pagos',
    pregunta: '¿Qué porcentaje cubren en incapacidades de 1 a 3 días?'
  },
  {
    categoria: 'Teletrabajo',
    pregunta: '¿Cuántos días puedo trabajar desde casa por semana?'
  },
  {
    categoria: 'Teletrabajo',
    pregunta: '¿Cómo se pagan las horas extra?'
  },
  {
    categoria: 'Privacidad',
    pregunta: '¿Cuáles son mis derechos ARCO sobre mis datos personales en la empresa?'
  },
  {
    categoria: 'Privacidad',
    pregunta: '¿Cuál es el salario del gerente general?'
  },
  {
    categoria: 'Vacaciones',
    pregunta: '¿La empresa da bono por mascotas?'
  }
];

const RRHH_SUGGESTION = {
  categoria: 'Vacaciones',
  pregunta: '¿Cuántas personas están de vacaciones hoy?'
};

const FILTER_TABS = ['Todas', 'Vacaciones', 'Pagos', 'Teletrabajo', 'Privacidad'];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    '¡Hola! Soy el asistente interno de Talento Humano de **NovaCore Technologies Costa Rica S.A.** Puedo responder dudas sobre políticas oficiales, legislación laboral vigente en Costa Rica y consultar tu saldo de vacaciones, solicitudes o fechas de pago.',
  citas: [],
  escalada: false,
  agente: 'AgenteOrquestador',
  intencion: 'bienvenida',
  latencia_ms: null
};

export default function ChatPage() {
  const { user, saldoVacaciones } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [escalatedConfirmed, setEscalatedConfirmed] = useState({});

  const messagesEndRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      try {
        const { data } = await api.get('/chat/history');
        if (mounted && Array.isArray(data.historial)) {
          setRecentLogs(data.historial);
        }
      } catch {
        // Silencioso si aún no hay historial disponible
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    }
    loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const filteredSuggestions = useMemo(() => {
    const all =
      user?.rol === 'rrhh' ? [...SUGGESTED_QUESTIONS, RRHH_SUGGESTION] : SUGGESTED_QUESTIONS;
    if (activeCategory === 'Todas') return all;
    return all.filter((item) => item.categoria === activeCategory);
  }, [activeCategory, user?.rol]);

  const sendQuestion = async (questionText) => {
    const trimmed = String(questionText || '').trim();
    if (!trimmed || sending) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    const historialPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/chat', {
        pregunta: trimmed,
        historial: historialPayload
      });

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.respuesta,
        citas: data.citas || [],
        escalada: Boolean(data.escalada),
        agente: data.agente,
        intencion: data.intencion,
        latencia_ms: data.latencia_ms
      };

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const histRes = await api.get('/chat/history');
        if (Array.isArray(histRes.data?.historial)) {
          setRecentLogs(histRes.data.historial);
        }
      } catch {
        // Sin bloqueo
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            err?.response?.data?.error ||
            'Ocurrió un inconveniente al consultar los agentes de RRHH. Intenta nuevamente.',
          citas: [],
          escalada: false,
          agente: 'Sistema',
          intencion: 'error',
          latencia_ms: null
        }
      ]);
      showToast('No fue posible obtener respuesta del servidor.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  };

  const handleCopyMessage = async (msgId, text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setCopiedId(msgId);
      showToast('Respuesta copiada al portapapeles.', 'success', 2200);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === msgId ? null : prev));
      }, 2200);
    } catch {
      showToast('No se pudo copiar al portapapeles.', 'error');
    }
  };

  const handleConfirmEscalation = (msgId) => {
    setEscalatedConfirmed((prev) => ({ ...prev, [msgId]: true }));
    showToast('Solicitud enviada y registrada para revisión de Talento Humano.', 'info');
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    showToast('Vista de conversación limpiada.', 'info', 2200);
  };

  const diasDisponibles = Number(saldoVacaciones?.dias_disponibles ?? 0);
  const diasAsignados = Math.max(Number(saldoVacaciones?.dias_asignados ?? 15), 1);
  const diasTomados = Number(saldoVacaciones?.dias_tomados ?? 0);
  const progressPct = Math.min(100, Math.round((diasDisponibles / diasAsignados) * 100));
  const alertaPasivo = diasDisponibles > 20;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F8] text-[#1F1416]">
      <Navbar />

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12">
        {/* Panel lateral izquierdo */}
        <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
          {/* Perfil + Saldo de Vacaciones */}
          <section className="overflow-hidden rounded-2xl border border-[#F3D5DB] bg-white shadow-sm">
            <div className="bg-[#722F37] px-4 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold">{user?.nombre}</h2>
                  <p className="truncate text-xs text-rose-100/90">{user?.puesto}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5A5E]">Departamento:</span>
                  <span className="font-semibold text-[#1F1416]">{user?.departamento}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6E5A5E]">Fecha de ingreso:</span>
                  <span className="font-semibold text-[#1F1416]">
                    {formatShortDate(user?.fecha_ingreso)}
                  </span>
                </div>
              </div>

              {/* Barra de progreso visual en color vino */}
              <div className="rounded-xl border border-[#F3D5DB] bg-[#FDF2F4] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-[#722F37]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#4E1A21]">
                      Vacaciones {saldoVacaciones?.periodo || 2026}
                    </span>
                  </div>
                  {alertaPasivo && (
                    <span className="rounded-full bg-[#722F37] px-2 py-0.5 text-[10px] font-bold text-white">
                      &gt; 20 días
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-[#722F37]">
                      {formatNumber(diasDisponibles, 2)}
                    </span>
                    <span className="ml-1 text-xs text-[#6E5A5E]">
                      / {formatNumber(diasAsignados, 0)} días disp.
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#9E3344]">{progressPct}%</span>
                </div>

                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white border border-[#F3D5DB]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#722F37] to-[#9E3344] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="mt-2.5 flex justify-between text-[11px] text-[#6E5A5E]">
                  <span>
                    Asignados: <strong className="text-[#1F1416]">{formatNumber(diasAsignados, 2)}</strong>
                  </span>
                  <span>
                    Tomados: <strong className="text-[#1F1416]">{formatNumber(diasTomados, 2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Explorador de Preguntas Sugeridas con Filtros */}
          <section className="rounded-2xl border border-[#F3D5DB] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#722F37]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4E1A21]">
                Explorar Preguntas
              </h3>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {FILTER_TABS.map((tab) => {
                const active = activeCategory === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveCategory(tab)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-[#722F37] text-white shadow-xs'
                        : 'border border-[#F3D5DB] bg-[#FAF7F8] text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
              {filteredSuggestions.map((item) => (
                <button
                  key={item.pregunta}
                  type="button"
                  disabled={sending}
                  onClick={() => sendQuestion(item.pregunta)}
                  className="rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-3 py-2 text-left text-xs text-[#1F1416] transition hover:border-[#722F37] hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
                >
                  {item.pregunta}
                </button>
              ))}
            </div>
          </section>

          {/* Historial reciente */}
          <section className="rounded-2xl border border-[#F3D5DB] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#722F37]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4E1A21]">
                  Consultas Recientes
                </h3>
              </div>
              <span className="rounded-full bg-[#FDF2F4] px-2 py-0.5 text-[11px] font-bold text-[#722F37]">
                {recentLogs.length}
              </span>
            </div>

            {loadingHistory ? (
              <p className="text-xs text-[#6E5A5E]">Cargando historial...</p>
            ) : recentLogs.length === 0 ? (
              <p className="text-xs text-[#6E5A5E]">Aún no tienes consultas registradas.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {recentLogs.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInput(item.pregunta)}
                    className="w-full rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] p-2.5 text-left transition hover:border-[#722F37]/50 hover:bg-[#FDF2F4] cursor-pointer"
                  >
                    <p className="line-clamp-2 text-xs font-medium text-[#1F1416]">
                      {item.pregunta}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#6E5A5E]">
                      <span className="font-semibold text-[#9E3344]">{item.intencion}</span>
                      <span>{formatDateTime(item.fecha)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        {/* Área central de conversación */}
        <section className="flex h-[calc(100vh-8.5rem)] min-h-[560px] flex-col rounded-2xl border border-[#F3D5DB] bg-white shadow-sm lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3D5DB] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FDF2F4] border border-[#F3D5DB] text-[#722F37]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#4E1A21]">
                  Asistente Virtual de Talento Humano
                </h1>
                <p className="text-[11px] text-[#6E5A5E]">
                  Políticas oficiales en Google Drive + Datos personales verificados en MySQL
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#F3D5DB] bg-[#FAF7F8] px-3 py-1.5 text-xs font-medium text-[#6E5A5E] transition hover:border-[#722F37] hover:bg-[#FDF2F4] hover:text-[#722F37] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpiar chat</span>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#FAF7F8]/60 px-4 py-5 sm:px-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isCopied = copiedId === msg.id;
              const isConfirmed = Boolean(escalatedConfirmed[msg.id]);

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3.5 sm:max-w-[82%] ${
                      isUser
                        ? 'bg-[#722F37] text-white shadow-sm'
                        : 'border border-[#EED8DC] bg-white text-[#1F1416] shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#F3D5DB]/70 pb-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#722F37]">
                            <Bot className="h-3.5 w-3.5" />
                            Respuesta del Asistente
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                              isCopied
                                ? 'border-[#722F37] bg-[#722F37] text-white'
                                : 'border-[#F3D5DB] bg-[#FAF7F8] text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copiar respuesta</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-1">{renderFormattedText(msg.content)}</div>

                        {/* Tarjeta interactiva de Escalamiento */}
                        {msg.escalada && (
                          <div className="mt-3.5 rounded-xl border border-[#722F37]/30 bg-[#FDF2F4] p-3.5 text-xs">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#722F37]" />
                              <div className="flex-1">
                                <p className="font-bold text-[#4E1A21]">
                                  Consulta sin respaldo en políticas vigentes
                                </p>
                                <p className="mt-0.5 text-[#6E5A5E]">
                                  Puedes confirmar el escalamiento para que un especialista de
                                  Talento Humano atienda tu caso directamente.
                                </p>

                                <button
                                  type="button"
                                  disabled={isConfirmed}
                                  onClick={() => handleConfirmEscalation(msg.id)}
                                  className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    isConfirmed
                                      ? 'border border-[#F3D5DB] bg-white text-[#722F37] cursor-default'
                                      : 'bg-[#722F37] text-white hover:bg-[#5A2229] cursor-pointer'
                                  }`}
                                >
                                  {isConfirmed
                                    ? 'Solicitud enviada a RRHH ✓'
                                    : 'Confirmar envío de consulta a Talento Humano'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tarjetas interactivas de Citas a Google Drive */}
                        {Array.isArray(msg.citas) && msg.citas.length > 0 && (
                          <div className="mt-3.5 border-t border-[#F3D5DB] pt-3">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#722F37]">
                              <FileText className="h-3.5 w-3.5" />
                              Fuentes Oficiales Citadas
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {msg.citas.map((cita, idx) => (
                                <a
                                  key={`${cita.titulo}-${idx}`}
                                  href={cita.enlace || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex flex-col justify-between rounded-xl border border-[#F3D5DB] bg-[#FDF2F4] p-3 text-xs transition hover:border-[#722F37] hover:bg-[#F9E4E8]"
                                >
                                  <div>
                                    <p className="font-bold text-[#4E1A21] group-hover:text-[#722F37]">
                                      {cita.titulo}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-[#9E3344]">
                                      {cita.codigo_version}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#6E5A5E]">
                                      Sección: {cita.seccion}
                                    </p>
                                  </div>
                                  {cita.enlace && (
                                    <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#722F37]">
                                      <span>Abrir documento en Drive</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </span>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Chips técnicos discretos */}
                        {(msg.agente || msg.intencion || msg.latencia_ms !== null) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F3D5DB]/70 pt-2.5 text-[10px] text-[#6E5A5E]">
                            {msg.agente && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#F3D5DB] bg-[#FAF7F8] px-2 py-0.5 font-medium">
                                <Cpu className="h-3 w-3 text-[#722F37]" />
                                {msg.agente}
                              </span>
                            )}
                            {msg.intencion && (
                              <span className="rounded-md border border-[#F3D5DB] bg-[#FAF7F8] px-2 py-0.5">
                                intención:{' '}
                                <strong className="text-[#4E1A21]">{msg.intencion}</strong>
                              </span>
                            )}
                            {msg.latencia_ms !== null && msg.latencia_ms !== undefined && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#F3D5DB] bg-[#FAF7F8] px-2 py-0.5">
                                <Clock className="h-3 w-3 text-[#9E3344]" />
                                {msg.latencia_ms} ms
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 rounded-2xl border border-[#F3D5DB] bg-white px-4 py-3 text-xs font-medium text-[#4E1A21] shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[#722F37]" />
                  <span>Consultando agentes de Talento Humano...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-b-2xl border-t border-[#F3D5DB] bg-white p-3 sm:p-4"
          >
            <div className="flex items-end gap-2.5">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Escribe tu consulta (Enter para enviar, Shift+Enter para nueva línea)..."
                className="max-h-32 flex-1 resize-none rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-4 py-2.5 text-sm text-[#1F1416] placeholder-[#6E5A5E]/70 outline-none transition focus:border-[#722F37] focus:bg-white focus:ring-2 focus:ring-[#722F37]/15 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#722F37] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5A2229] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
