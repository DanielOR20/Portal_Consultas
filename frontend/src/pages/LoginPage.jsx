import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
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
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-[#FAF7F8] via-[#FAF7F8] to-[#F7E6E9] px-4 py-10 text-[#1F1416]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#F3D5DB] bg-[#722F37] text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#4E1A21]">
            NovaCore Technologies CR
          </h1>
          <p className="mt-1.5 text-sm text-[#6E5A5E]">
            Portal Interno de Consulta de Políticas de RRHH con RAG Multiagente
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#F3D5DB] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 bg-[#722F37] px-6 py-4 text-white">
            <Building2 className="h-4 w-4 text-rose-100" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Acceso Corporativo Seguro
            </h2>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#722F37]/30 bg-[#FDF2F4] p-3.5 text-xs text-[#722F37]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#722F37]" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-[#1F1416]"
                >
                  Correo institucional
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6E5A5E]" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre.apellido@novacore.cr"
                    className="w-full rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] py-2.5 pr-4 pl-10 text-sm text-[#1F1416] placeholder-[#6E5A5E]/60 outline-none transition focus:border-[#722F37] focus:bg-white focus:ring-2 focus:ring-[#722F37]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold text-[#1F1416]"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6E5A5E]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] py-2.5 pr-11 pl-10 text-sm text-[#1F1416] placeholder-[#6E5A5E]/60 outline-none transition focus:border-[#722F37] focus:bg-white focus:ring-2 focus:ring-[#722F37]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-[#6E5A5E] transition hover:bg-[#FDF2F4] hover:text-[#722F37] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#722F37] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5A2229] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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

            <div className="mt-6 border-t border-[#F3D5DB] pt-5">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6E5A5E]">
                <UserCheck className="h-3.5 w-3.5 text-[#722F37]" />
                Acceso Rápido Demo (1 clic)
              </p>

              <div className="grid gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin('carlos.solano@novacore.cr')}
                  className="flex w-full items-center justify-between rounded-xl border border-[#F3D5DB] bg-[#FAF7F8] px-3.5 py-2.5 text-left text-xs transition hover:border-[#722F37] hover:bg-[#FDF2F4] disabled:opacity-60 cursor-pointer"
                >
                  <div>
                    <span className="block font-semibold text-[#1F1416]">
                      Entrar como Colaborador (Carlos Solano)
                    </span>
                    <span className="text-[11px] text-[#6E5A5E]">carlos.solano@novacore.cr</span>
                  </div>
                  <span className="rounded-full border border-[#F3D5DB] bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#722F37]">
                    colaborador
                  </span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin('laura.mendez@novacore.cr')}
                  className="flex w-full items-center justify-between rounded-xl border border-[#722F37]/30 bg-[#FDF2F4] px-3.5 py-2.5 text-left text-xs transition hover:border-[#722F37] hover:bg-[#F7E6E9] disabled:opacity-60 cursor-pointer"
                >
                  <div>
                    <span className="flex items-center gap-1 font-semibold text-[#4E1A21]">
                      <Sparkles className="h-3.5 w-3.5 text-[#722F37]" />
                      Entrar como RRHH (Laura Méndez)
                    </span>
                    <span className="text-[11px] text-[#6E5A5E]">laura.mendez@novacore.cr</span>
                  </div>
                  <span className="rounded-full bg-[#722F37] px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    rrhh
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
