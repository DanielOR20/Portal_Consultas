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
    `flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all ${
      isActive
        ? 'bg-white text-[#E6004C] font-semibold shadow-sm'
        : 'bg-white/15 text-white/95 backdrop-blur-sm hover:bg-white/25 hover:text-white'
    }`;

  return (
    <header className="no-print sticky top-0 z-30 h-16 shrink-0 bg-gradient-to-r from-[#D9044B] via-[#E6004C] to-[#FF1764] text-white shadow-[0_2px_18px_rgba(230,0,76,0.28)]">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white backdrop-blur-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-sm font-bold tracking-wide text-white leading-tight">
                NovaCore Talento Humano
              </span>
              <span className="block text-[11px] text-white/85 leading-tight">
                Portal RRHH Multiagente
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

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur-sm md:flex">
            <User className="h-3.5 w-3.5 text-white" />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-white">{user?.nombre}</span>
              <span className="text-white/75">·</span>
              <span className="text-[11px] text-white/90">{user?.departamento}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#E6004C]">
                {user?.rol}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-[#E6004C] cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
