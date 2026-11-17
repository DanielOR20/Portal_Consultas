import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, LogOut, MessageSquareText, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
      isActive
        ? 'bg-white text-[#4E1A21] shadow-sm font-semibold'
        : 'text-white/85 hover:bg-white/15 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-[#722F37] bg-[#4E1A21] text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-[#722F37] text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-wide text-white">
                NovaCore Talento Humano
              </span>
              <span className="block text-[11px] text-rose-100/80">
                Portal Interno de Consultas RRHH
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink to="/chat" className={navLinkClass}>
              <MessageSquareText className="h-4 w-4" />
              <span>Asistente Virtual</span>
            </NavLink>

            {user?.rol === 'rrhh' && (
              <NavLink to="/dashboard" className={navLinkClass}>
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard RRHH</span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 rounded-lg border border-white/20 bg-[#722F37]/70 px-3 py-1.5 sm:flex">
            <User className="h-4 w-4 text-rose-100" />
            <div className="text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.nombre}</p>
              <p className="text-[11px] text-rose-100/85 leading-tight">
                {user?.departamento} ·{' '}
                <span className="ml-0.5 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#4E1A21]">
                  {user?.rol}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white hover:text-[#4E1A21] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
