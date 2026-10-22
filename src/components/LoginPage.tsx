import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  MapPin,
  Database,
  Shield,
  FileSpreadsheet
} from 'lucide-react';
import { UserAccount, authenticateUser, getStoredUsers } from '../services/authService';
import { signInWithGoogle } from '../services/googleDriveUserService';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const storedUsers = getStoredUsers();

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = authenticateUser(username, password);
    if (res.success && res.user) {
      setSuccessMsg(`Autenticado com sucesso! Bem-vindo(a), ${res.user.name}.`);
      setTimeout(() => {
        onLoginSuccess(res.user!);
      }, 500);
    } else {
      setError(res.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      const email = res.user.email || '';
      // Find matching user or elevate as Master for Google Drive management
      let targetUser = storedUsers.find(u => u.username.toLowerCase() === email.toLowerCase());
      if (!targetUser) {
        // Find default master
        targetUser = storedUsers.find(u => u.role === 'master') || storedUsers[0];
      }
      setSuccessMsg(`Google OAuth conectado: ${res.user.displayName || email}`);
      setTimeout(() => {
        onLoginSuccess(targetUser!);
      }, 500);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setError(err?.message || 'Falha ao autenticar com Google Drive.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden font-sans">
      {/* Background glowing ambient elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Institutional Top Bar */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 flex items-center justify-center text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold tracking-wider text-blue-400 uppercase">
                  Elaborado Por Marcos Silveira
                </span>
              </div>
              <h1 className="text-base font-bold text-white leading-tight">
                Portal de Controle de Acesso • Painel Eleitoral 2024 / 2026
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Base de Dados Google Drive Ativa</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <span>Versão Segura v2.4</span>
          </div>
        </div>
      </header>

      {/* Main Login Screen Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Context, Features & Cartography Info */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Autenticação de Segurança e Inteligência Política</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Controle de Acesso ao Painel Eleitoral do Ceará
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                Área reservada para consulta, cruzamento e auditoria dos resultados eleitorais de 
                <strong className="text-white"> Fortaleza 2024 (111 bairros)</strong> e 
                <strong className="text-white"> Ceará 2026 (184 municípios)</strong> com base sincronizada via Google Drive.
              </p>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900/70 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Shield className="w-4 h-4" />
                  <span>Perfil Master & Gestão</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Visão total do sistema, inclusão e exclusão de contas, redefinição de senhas e sincronização com Google Drive.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Base no Google Drive</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Planilha de usuários e votações atualizada e sincronizada ao vivo diretamente na nuvem do Google Drive.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <MapPin className="w-4 h-4" />
                  <span>Cartografia Dinâmica</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ano 2024 exibe os 111 bairros de Fortaleza. Ano 2026 comuta automaticamente para os 184 municípios do Ceará.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                  <Layers className="w-4 h-4" />
                  <span>Filtro Global de Cargo</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Filtros dinâmicos simultâneos por Cargo (Vereador, Deputado Estadual, etc.), Partido, Status e Redutos.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login Box */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-7 backdrop-blur-xl relative">
              {/* Card Header */}
              <div className="mb-6 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Identificação</h3>
                  <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/80 text-[10px] font-bold uppercase rounded-md tracking-wider">
                    Acesso Seguro
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Informe suas credenciais para liberar o painel eleitoral.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleFormLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Usuário / Login
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="master, analista ou consulta"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Acessar Painel Eleitoral</span>
                </button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">ou autenticação google</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Google Drive Sign-In button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Conectando ao Google...' : 'Entrar com Conta Google (Google Drive)'}</span>
              </button>

              {/* Bottom security notice */}
              <div className="mt-5 pt-4 border-t border-slate-800 text-center">
                <p className="text-[11px] text-slate-500">
                  O painel só é revelado após autenticação autorizada.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/90 py-3.5 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2024 - 2026 Sistema Integrado de Inteligência Eleitoral • Estado do Ceará</span>
          <span className="font-mono text-[11px] text-slate-400">Elaborado Por Marcos Silveira • Google Drive Realtime Integration</span>
        </div>
      </footer>
    </div>
  );
}
