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
import { formatNumber, formatShortDate, renderFormattedText } from '../utils/formatters';

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

function formatCompactDays(value) {
  const num = Number(value ?? 0);
  return Number.isInteger(num) ? String(num) : formatNumber(num, 2);
}

export default function ChatPage() {
  const { user, saldoVacaciones } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [myTickets, setMyTickets] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [createdTicketsMap, setCreatedTicketsMap] = useState({});
  const [creatingTicketId, setCreatingTicketId] = useState(null);

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
      // Silencioso si aún no hay tickets
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    loadMyTickets();

    return () => {
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
  }, [loadMyTickets]);

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
    <div className="flex min-h-screen flex-col bg-[#F8F9FB] text-[#18181B] lg:h-screen lg:overflow-hidden">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:h-[calc(100vh-64px)] lg:flex-row lg:overflow-hidden">
        {/* Columna Izquierda Fija (w-80) con exactamente 2 bloques proporcionados */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:w-80">
          {/* Bloque 1: Tarjeta Compacta de Perfil y Vacaciones */}
          <section className="shrink-0 overflow-hidden rounded-2xl border border-[#FFB8D0]/60 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#D9044B] via-[#E6004C] to-[#FF1F6A] px-4 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white backdrop-blur-sm">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold leading-tight">{user?.nombre}</h2>
                  <p className="truncate text-xs text-white/90">{user?.puesto}</p>
                  <p className="mt-0.5 truncate text-[10px] text-white/80">
                    {user?.departamento} · Ingreso {formatShortDate(user?.fecha_ingreso)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#52525B]">
                  <CalendarDays className="h-3.5 w-3.5 text-[#E6004C]" />
                  Vacaciones {saldoVacaciones?.periodo || 2026}
                </span>
                {alertaPasivo ? (
                  <span className="rounded-full bg-[#E6004C] px-2 py-0.5 text-[10px] font-bold text-white">
                    &gt; 20 días
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-[#E6004C]">{progressPct}%</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] px-2 py-2 text-center">
                  <span className="block text-[10px] font-semibold text-[#52525B]">
                    Disponibles
                  </span>
                  <span className="mt-0.5 block text-lg font-extrabold text-[#E6004C]">
                    {formatCompactDays(diasDisponibles)}
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-[#F8F9FB] px-2 py-2 text-center">
                  <span className="block text-[10px] font-semibold text-[#52525B]">Asignados</span>
                  <span className="mt-0.5 block text-lg font-bold text-[#18181B]">
                    {formatCompactDays(diasAsignados)}
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-[#F8F9FB] px-2 py-2 text-center">
                  <span className="block text-[10px] font-semibold text-[#52525B]">Tomados</span>
                  <span className="mt-0.5 block text-lg font-bold text-[#52525B]">
                    {formatCompactDays(diasTomados)}
                  </span>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#FFF0F5]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#E6004C] to-[#FF1764] shadow-[0_0_10px_rgba(230,0,76,0.35)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </section>

          {/* Bloque 2: Tarjeta "Mis Tickets RRHH" con scroll interno */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#FFB8D0]/60 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#E6004C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B]">
                  Mis Tickets RRHH
                </h3>
              </div>
              <span className="rounded-full border border-[#FFB8D0] bg-[#FFF0F5] px-2.5 py-0.5 text-[11px] font-bold text-[#E6004C]">
                {myTickets.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
              {loadingTickets ? (
                <p className="text-xs text-[#52525B]">Cargando tickets...</p>
              ) : myTickets.length === 0 ? (
                <p className="text-xs text-[#52525B]">
                  No tienes tickets escalados a Talento Humano.
                </p>
              ) : (
                myTickets.map((tkt) => {
                  const resolved = tkt.estado === 'resuelto';
                  return (
                    <div
                      key={tkt.id}
                      className="rounded-xl border border-zinc-200/80 bg-[#F8F9FB] p-3 text-xs transition hover:border-[#FFB8D0] hover:bg-[#FFF0F5]/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#18181B]">{tkt.codigo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            resolved
                              ? 'border border-[#FFB8D0] bg-[#FFF0F5] text-[#E6004C]'
                              : 'bg-[#E6004C] text-white'
                          }`}
                        >
                          {tkt.estado}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[#52525B]">
                        {tkt.consulta_original}
                      </p>
                      {resolved && tkt.respuesta_rrhh && (
                        <div className="mt-2 rounded-lg border border-[#FFB8D0] bg-white p-2 text-[11px] text-[#18181B]">
                          <span className="block font-bold text-[#E6004C]">Respuesta RRHH:</span>
                          <p className="mt-0.5 leading-relaxed text-[#52525B]">
                            {tkt.respuesta_rrhh}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </aside>

        {/* Columna Derecha: Área Principal de Chat */}
        <section className="flex min-h-[540px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#FFB8D0]/60 bg-white shadow-sm lg:min-h-0">
          {/* Cabecera compacta (h-14) */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#FFB8D0]/40 bg-white px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] text-[#E6004C]">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold text-[#18181B]">
                    Asistente Virtual de Talento Humano
                  </h1>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FFB8D0] bg-[#FFF0F5] px-2 py-0.5 text-[10px] font-bold text-[#E6004C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En línea
                  </span>
                </div>
                <p className="hidden truncate text-[11px] text-[#52525B] sm:block">
                  Políticas Google Drive + Datos MySQL + Validación de fidelidad y voz
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-[#F8F9FB] px-3 py-1.5 text-xs font-semibold text-[#52525B] transition hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpiar chat</span>
            </button>
          </div>

          {/* Zona de Mensajes */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8F9FB]/55 px-4 py-5 sm:px-6">
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
                        ? 'rounded-tr-sm bg-[#E6004C] text-white shadow-[0_4px_14px_rgba(230,0,76,0.22)]'
                        : 'rounded-tl-sm border border-[#FFD6E4] bg-white text-[#18181B] shadow-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E6004C]">
                            <Bot className="h-3.5 w-3.5" />
                            Respuesta del Asistente
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(msg.id, msg.content)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                                isSpeaking
                                  ? 'border-[#E6004C] bg-[#E6004C] text-white'
                                  : 'border-zinc-200 bg-[#F8F9FB] text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
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
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                                isCopied
                                  ? 'border-[#E6004C] bg-[#E6004C] text-white'
                                  : 'border-zinc-200 bg-[#F8F9FB] text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
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
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">{renderFormattedText(msg.content)}</div>

                        {/* Tarjeta de Escalamiento -> POST /api/tickets */}
                        {msg.escalada && (
                          <div className="mt-3.5 rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3.5 text-xs">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E6004C]" />
                              <div className="flex-1">
                                <p className="font-bold text-[#18181B]">
                                  Consulta sin respaldo en políticas vigentes
                                </p>
                                <p className="mt-0.5 text-[#52525B]">
                                  Puedes abrir un ticket formal para que un especialista de Talento
                                  Humano atienda y responda tu consulta en el portal.
                                </p>

                                <button
                                  type="button"
                                  disabled={Boolean(createdTicketCode) || isCreatingTicket}
                                  onClick={() => handleCreateTicket(msg)}
                                  className={`mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                    createdTicketCode
                                      ? 'border border-[#FFB8D0] bg-white text-[#E6004C] cursor-default'
                                      : 'bg-[#E6004C] text-white hover:bg-[#FF1764] hover:shadow-[0_0_16px_rgba(230,0,76,0.35)] cursor-pointer disabled:opacity-60'
                                  }`}
                                >
                                  {isCreatingTicket ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Creando ticket...</span>
                                    </>
                                  ) : createdTicketCode ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-[#E6004C]" />
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

                        {/* Tarjetas clicables de Citas a Google Drive */}
                        {Array.isArray(msg.citas) && msg.citas.length > 0 && (
                          <div className="mt-3.5 border-t border-zinc-100 pt-3">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E6004C]">
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
                                  className="group flex flex-col justify-between rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3 text-xs transition hover:border-[#E6004C] hover:shadow-sm"
                                >
                                  <div>
                                    <p className="font-bold text-[#18181B] group-hover:text-[#E6004C]">
                                      {cita.titulo}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-[#E6004C]">
                                      {cita.codigo_version}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#52525B]">
                                      Sección: {cita.seccion}
                                    </p>
                                  </div>
                                  {cita.enlace && (
                                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#E6004C]">
                                      <span>Abrir documento en Drive</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </span>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Chips técnicos */}
                        {(msg.agente || msg.intencion || msg.latencia_ms !== null) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2.5 text-[10px] text-[#52525B]">
                            {msg.agente && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-[#F8F9FB] px-2 py-0.5 font-medium">
                                <Cpu className="h-3 w-3 text-[#E6004C]" />
                                {msg.agente}
                              </span>
                            )}
                            {msg.intencion && (
                              <span className="rounded-md border border-zinc-200 bg-[#F8F9FB] px-2 py-0.5">
                                intención:{' '}
                                <strong className="text-[#18181B]">{msg.intencion}</strong>
                              </span>
                            )}
                            {msg.validado && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#FFB8D0] bg-[#FFF0F5] px-2 py-0.5 font-bold text-[#E6004C]">
                                <ShieldCheck className="h-3 w-3" />
                                Validado
                              </span>
                            )}
                            {msg.latencia_ms !== null && msg.latencia_ms !== undefined && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-[#F8F9FB] px-2 py-0.5">
                                <Clock className="h-3 w-3 text-[#E6004C]" />
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
                <div className="flex items-center gap-2.5 rounded-2xl border border-[#FFD6E4] bg-white px-4 py-3 text-xs font-semibold text-[#18181B] shadow-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-[#E6004C]" />
                  <span>Consultando y validando respuesta con agentes de Talento Humano...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra Horizontal de Preguntas Sugeridas justo encima del input */}
          <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pt-2.5 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#E6004C]">
                <Sparkles className="h-3.5 w-3.5" />
                Explorar:
              </span>
              {FILTER_TABS.map((tab) => {
                const active = activeCategory === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveCategory(tab)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-[#E6004C] text-white shadow-[0_0_12px_rgba(230,0,76,0.3)]'
                        : 'border border-zinc-200 bg-[#F8F9FB] text-[#52525B] hover:border-[#FFB8D0] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
              {filteredSuggestions.map((item) => (
                <button
                  key={item.pregunta}
                  type="button"
                  disabled={sending}
                  onClick={() => sendQuestion(item.pregunta)}
                  className="shrink-0 whitespace-nowrap rounded-full border border-[#FF8FB5] bg-[#FFF0F5] px-3 py-1 text-xs font-medium text-[#18181B] transition hover:border-[#E6004C] hover:bg-[#E6004C] hover:text-white hover:shadow-[0_0_12px_rgba(230,0,76,0.28)] disabled:opacity-50 cursor-pointer"
                >
                  {item.pregunta}
                </button>
              ))}
            </div>
          </div>

          {/* Barra de Entrada Inferior */}
          <form onSubmit={handleSubmit} className="shrink-0 border-t border-zinc-100 bg-white p-4">
            <div className="flex items-end gap-2.5">
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                disabled={sending}
                title={listening ? 'Detener dictado por voz' : 'Hablar consulta por micrófono'}
                aria-label="Dictar consulta por voz"
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                  listening
                    ? 'animate-pulse border-[#E6004C] bg-[#E6004C] text-white ring-4 ring-[#E6004C]/25'
                    : 'border-[#FFB8D0] bg-[#FFF0F5] text-[#E6004C] hover:bg-[#FF1764] hover:text-white hover:shadow-[0_0_16px_rgba(230,0,76,0.35)]'
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
                className="max-h-28 flex-1 resize-none rounded-xl border border-zinc-200 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#18181B] placeholder-[#52525B]/70 outline-none transition focus:border-[#E6004C] focus:bg-white focus:ring-4 focus:ring-[#E6004C]/15 disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#E6004C] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#FF1764] hover:shadow-[0_0_16px_rgba(230,0,76,0.35)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
