import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Ticket,
  Trash2,
  User as UserIcon,
  Volume2
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
  validado: true,
  agente: 'AgenteOrquestador',
  intencion: 'bienvenida',
  latencia_ms: null
};

function stripMarkdownForSpeech(text) {
  return String(text || '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\|/g, ', ')
    .replace(/\n+/g, '. ')
    .trim();
}

export default function ChatPage() {
  const { user, saldoVacaciones } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [createdTicketsMap, setCreatedTicketsMap] = useState({});
  const [creatingTicketId, setCreatingTicketId] = useState(null);

  // Estado de voz (Web Speech API)
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const loadMyTickets = useCallback(async () => {
    try {
      const { data } = await api.get('/tickets/mine');
      if (Array.isArray(data?.tickets)) {
        setMyTickets(data.tickets);
      }
    } catch {
      // Silencioso si falla temporalmente
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      try {
        const [histRes, ticketsRes] = await Promise.all([
          api.get('/chat/history'),
          api.get('/tickets/mine')
        ]);
        if (mounted && Array.isArray(histRes.data?.historial)) {
          setRecentLogs(histRes.data.historial);
        }
        if (mounted && Array.isArray(ticketsRes.data?.tickets)) {
          setMyTickets(ticketsRes.data.tickets);
        }
      } catch {
        // Silencioso si aún no hay datos
      } finally {
        if (mounted) {
          setLoadingHistory(false);
          setLoadingTickets(false);
        }
      }
    }
    loadInitial();

    return () => {
      mounted = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
        preguntaOrigen: trimmed,
        content: data.respuesta,
        citas: data.citas || [],
        escalada: Boolean(data.escalada),
        validado: data.validado !== false,
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
          validado: false,
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

  const handleToggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast(
        'Tu navegador no soporta reconocimiento de voz nativo (usa Chrome o Edge).',
        'error'
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-CR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        showToast('Escuchando consulta por voz (es-CR)...', 'info', 2500);
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          setInput((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
          showToast('Voz transcrita al cuadro de consulta.', 'success', 2200);
        }
      };

      recognition.onerror = () => {
        setListening(false);
        showToast('No se detectó audio o se denegó el acceso al micrófono.', 'error');
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
      showToast('No fue posible iniciar el micrófono.', 'error');
    }
  };

  const handleToggleSpeak = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      showToast('Tu navegador no soporta lectura de voz (speechSynthesis).', 'error');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
    utterance.lang = 'es-CR';
    utterance.rate = 1.0;

    utterance.onend = () => {
      setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
    };
    utterance.onerror = () => {
      setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
    };

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
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

  const handleCreateTicket = async (msg) => {
    if (createdTicketsMap[msg.id] || creatingTicketId === msg.id) return;

    setCreatingTicketId(msg.id);
    try {
      const { data } = await api.post('/tickets', {
        consulta_original: msg.preguntaOrigen || 'Consulta escalada desde el chat',
        motivo: 'Consulta escalada sin política vigente en Google Drive'
      });

      const codigo = data.ticket?.codigo || 'TKT-2026-NEW';
      setCreatedTicketsMap((prev) => ({ ...prev, [msg.id]: codigo }));
      showToast(`Ticket #${codigo} creado y enviado a Talento Humano.`, 'success', 4000);
      await loadMyTickets();
    } catch (err) {
      showToast(
        err?.response?.data?.error || 'No se pudo registrar el ticket en RRHH.',
        'error'
      );
    } finally {
      setCreatingTicketId(null);
    }
  };

  const handleClearChat = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }
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

                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-[#F3D5DB] bg-white">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#722F37] to-[#9E3344] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="mt-2.5 flex justify-between text-[11px] text-[#6E5A5E]">
                  <span>
                    Asignados:{' '}
                    <strong className="text-[#1F1416]">{formatNumber(diasAsignados, 2)}</strong>
                  </span>
                  <span>
                    Tomados:{' '}
                    <strong className="text-[#1F1416]">{formatNumber(diasTomados, 2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Mis Tickets RRHH */}
          <section className="rounded-2xl border border-[#F3D5DB] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#722F37]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4E1A21]">
                  Mis Tickets RRHH
                </h3>
              </div>
              <span className="rounded-full bg-[#FDF2F4] px-2 py-0.5 text-[11px] font-bold text-[#722F37]">
                {myTickets.length}
              </span>
            </div>

            {loadingTickets ? (
              <p className="text-xs text-[#6E5A5E]">Cargando tickets...</p>
            ) : myTickets.length === 0 ? (
              <p className="text-xs text-[#6E5A5E]">
                No tienes tickets escalados a Talento Humano.
              </p>
            ) : (
              <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
                {myTickets.map((tkt) => {
                  const resolved = tkt.estado === 'resuelto';
                  return (
                    <div
                      key={tkt.id}
                      className="rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#4E1A21]">{tkt.codigo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            resolved
                              ? 'bg-[#FDF2F4] text-[#722F37] border border-[#F3D5DB]'
                              : 'bg-[#722F37] text-white'
                          }`}
                        >
                          {tkt.estado}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#1F1416]">
                        {tkt.consulta_original}
                      </p>
                      {resolved && tkt.respuesta_rrhh && (
                        <div className="mt-2 rounded-lg border border-[#F3D5DB] bg-white p-2 text-[11px] text-[#1F1416]">
                          <span className="block font-bold text-[#722F37]">
                            Respuesta RRHH:
                          </span>
                          <p className="mt-0.5 leading-relaxed">{tkt.respuesta_rrhh}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

            <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
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
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
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
        <section className="flex h-[calc(100vh-8.5rem)] min-h-[580px] flex-col rounded-2xl border border-[#F3D5DB] bg-white shadow-sm lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3D5DB] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F3D5DB] bg-[#FDF2F4] text-[#722F37]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#4E1A21]">
                  Asistente Virtual de Talento Humano
                </h1>
                <p className="text-[11px] text-[#6E5A5E]">
                  Políticas oficiales en Google Drive + Datos MySQL + Validación de fidelidad y voz
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
              const isSpeaking = speakingMsgId === msg.id;
              const createdTicketCode = createdTicketsMap[msg.id];
              const isCreatingTicket = creatingTicketId === msg.id;

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
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#F3D5DB]/70 pb-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#722F37]">
                            <Bot className="h-3.5 w-3.5" />
                            Respuesta del Asistente
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(msg.id, msg.content)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                                isSpeaking
                                  ? 'border-[#722F37] bg-[#722F37] text-white'
                                  : 'border-[#F3D5DB] bg-[#FAF7F8] text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
                              }`}
                            >
                              {isSpeaking ? (
                                <>
                                  <Square className="h-3 w-3" />
                                  <span>Detener</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3 w-3" />
                                  <span>Escuchar</span>
                                </>
                              )}
                            </button>

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
                        </div>

                        <div className="space-y-1">{renderFormattedText(msg.content)}</div>

                        {/* Tarjeta interactiva de Escalamiento -> POST /api/tickets */}
                        {msg.escalada && (
                          <div className="mt-3.5 rounded-xl border border-[#722F37]/30 bg-[#FDF2F4] p-3.5 text-xs">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#722F37]" />
                              <div className="flex-1">
                                <p className="font-bold text-[#4E1A21]">
                                  Consulta sin respaldo en políticas vigentes
                                </p>
                                <p className="mt-0.5 text-[#6E5A5E]">
                                  Puedes abrir un ticket formal para que un especialista de Talento
                                  Humano atienda y responda tu consulta en el portal.
                                </p>

                                <button
                                  type="button"
                                  disabled={Boolean(createdTicketCode) || isCreatingTicket}
                                  onClick={() => handleCreateTicket(msg)}
                                  className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    createdTicketCode
                                      ? 'border border-[#F3D5DB] bg-white text-[#722F37] cursor-default'
                                      : 'bg-[#722F37] text-white hover:bg-[#5A2229] cursor-pointer disabled:opacity-60'
                                  }`}
                                >
                                  {isCreatingTicket ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Creando ticket...</span>
                                    </>
                                  ) : createdTicketCode ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-[#722F37]" />
                                      <span>Ticket #{createdTicketCode} creado ✓</span>
                                    </>
                                  ) : (
                                    <span>Confirmar envío de consulta a Talento Humano</span>
                                  )}
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
                            {msg.validado && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#F3D5DB] bg-[#FDF2F4] px-2 py-0.5 font-semibold text-[#722F37]">
                                <ShieldCheck className="h-3 w-3" />
                                Validado
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
                  <span>Consultando y validando respuesta con agentes de Talento Humano...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-b-2xl border-t border-[#F3D5DB] bg-white p-3 sm:p-4"
          >
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                disabled={sending}
                title={listening ? 'Detener dictado por voz' : 'Hablar consulta por micrófono'}
                aria-label="Dictar consulta por voz"
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                  listening
                    ? 'animate-pulse border-[#722F37] bg-[#722F37] text-white ring-4 ring-[#722F37]/20'
                    : 'border-[#F3D5DB] bg-[#FAF7F8] text-[#722F37] hover:border-[#722F37] hover:bg-[#FDF2F4]'
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Escribe o dicta tu consulta (Enter para enviar, Shift+Enter para nueva línea)..."
                className="max-h-32 flex-1 resize-none rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-4 py-2.5 text-sm text-[#1F1416] placeholder-[#6E5A5E]/70 outline-none transition focus:border-[#722F37] focus:bg-white focus:ring-2 focus:ring-[#722F37]/15 disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#722F37] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5A2229] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
