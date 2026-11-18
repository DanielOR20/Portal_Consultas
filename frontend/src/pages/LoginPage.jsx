import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  FileSearch,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const performLogin = async (loginEmail, loginPassword) => {
    setError('');
    setSubmitting(true);

    try {
      await login(loginEmail.trim(), loginPassword);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          'No fue posible iniciar sesión. Verifica tus credenciales y la conexión al servidor.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleDemoLogin = async (demoEmail) => {
    const demoPass = 'NovaCore2026!';
    setEmail(demoEmail);
    setPassword(demoPass);
    await performLogin(demoEmail, demoPass);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-white text-[#18181B] lg:grid-cols-12">
      {/* Mitad Izquierda: Marca Corporativa en Vino Fosforescente */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#C90044] via-[#E6004C] to-[#FF2A70] p-8 text-white sm:p-12 lg:col-span-5">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 backdrop-blur-sm">
            <ShieldCheck className="h-6 w-6 text-white" />
            <div>
              <span className="block text-sm font-bold tracking-wide">
                NovaCore Technologies CR
              </span>
              <span className="block text-[11px] text-white/85">Talento Humano · Costa Rica</span>
            </div>
          </div>

          <h1 className="mt-8 text-3xl font-extrabold tracking-tight leading-tight sm:text-4xl">
            Portal Interno de Políticas y Datos RRHH
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/90">
            Consulta al instante reglamentos laborales vigentes, tus saldos personales y recibe
            respuestas auditadas con citas oficiales verificables.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-start gap-3.5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#E6004C] shadow-sm">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Políticas en Google Drive</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-white/85">
                  Búsqueda semántica RAG sobre Docs, Sheets y PDF con citas de código, versión y
                  enlace directo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#E6004C] shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Consultas Personales MySQL</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-white/85">
                  Acceso en tiempo real a vacaciones disponibles, solicitudes, incapacidades y
                  próximas fechas de pago.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#E6004C] shadow-sm">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Protección de Datos Ley 8968</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-white/85">
                  Aislamiento estricto por rol JWT y validación de fidelidad y privacidad antes de
                  cada respuesta.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-5 text-xs text-white/85">
          <span>Arquitectura RAG Multiagente (7 Agentes)</span>
          <span className="font-semibold text-white">Código de Trabajo CR</span>
        </div>
      </aside>

      {/* Mitad Derecha: Formulario Limpio sobre Blanco Puro */}
      <main className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:col-span-7">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFB8D0] bg-[#FFF0F5] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E6004C]">
              <Sparkles className="h-3.5 w-3.5" />
              Acceso Corporativo Seguro
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#18181B]">
              Inicia sesión en tu portal
            </h2>
            <p className="mt-1.5 text-sm text-[#52525B]">
              Ingresa con tu correo institucional de NovaCore Technologies CR.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3.5 text-xs text-[#E6004C]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E6004C]" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-[#18181B]">
                Correo institucional
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#52525B]" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre.apellido@novacore.cr"
                  className="w-full rounded-xl border border-zinc-200 bg-[#F8F9FB] py-3 pr-4 pl-10 text-sm text-[#18181B] placeholder-[#52525B]/60 outline-none transition focus:border-[#E6004C] focus:bg-white focus:ring-4 focus:ring-[#E6004C]/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-[#18181B]"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#52525B]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-zinc-200 bg-[#F8F9FB] py-3 pr-11 pl-10 text-sm text-[#18181B] placeholder-[#52525B]/60 outline-none transition focus:border-[#E6004C] focus:bg-white focus:ring-4 focus:ring-[#E6004C]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-[#52525B] transition hover:bg-[#FFF0F5] hover:text-[#E6004C] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E6004C] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#FF1764] hover:shadow-[0_0_16px_rgba(230,0,76,0.35)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Ingresando al portal...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-zinc-100 pt-6">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#52525B]">
              <UserCheck className="h-3.5 w-3.5 text-[#E6004C]" />
              Acceso Rápido Demo (1 clic)
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('carlos.solano@novacore.cr')}
                className="group flex flex-col justify-between rounded-xl border border-[#FFB8D0] bg-white p-3.5 text-left transition hover:border-[#E6004C] hover:bg-[#FFF0F5] hover:shadow-[0_0_14px_rgba(230,0,76,0.16)] disabled:opacity-60 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#18181B] group-hover:text-[#E6004C]">
                    Carlos Solano
                  </span>
                  <span className="rounded-full border border-[#FFB8D0] bg-[#FFF0F5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#E6004C]">
                    colaborador
                  </span>
                </div>
                <span className="mt-1.5 truncate text-[11px] text-[#52525B]">
                  carlos.solano@novacore.cr
                </span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('laura.mendez@novacore.cr')}
                className="group flex flex-col justify-between rounded-xl border border-[#FFB8D0] bg-[#FFF0F5] p-3.5 text-left transition hover:border-[#E6004C] hover:shadow-[0_0_16px_rgba(230,0,76,0.22)] disabled:opacity-60 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-[#18181B] group-hover:text-[#E6004C]">
                    <Sparkles className="h-3.5 w-3.5 text-[#E6004C]" />
                    Laura Méndez
                  </span>
                  <span className="rounded-full bg-[#E6004C] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    rrhh
                  </span>
                </div>
                <span className="mt-1.5 truncate text-[11px] text-[#52525B]">
                  laura.mendez@novacore.cr
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
