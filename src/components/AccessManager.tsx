import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Check,
  Search,
  Eye,
  EyeOff,
  UserCheck,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Link2,
  Edit3,
  Copy,
  Sliders,
  CheckSquare,
  Square,
  Shield,
  User as UserIcon,
  Crown
} from 'lucide-react';
import {
  UserAccount,
  UserRole,
  UserPermissions,
  getStoredUsers,
  saveStoredUsers,
  createUserAccount,
  updateUserAccount,
  updateUserPassword,
  deleteUserAccount,
  getStoredLogs,
  addAccessLog,
  setCurrentUser,
  AccessLog,
  PERMISSION_DEFINITIONS,
  getDefaultPermissions
} from '../services/authService';
import {
  signInWithGoogle,
  getGoogleAccessToken,
  createUsersSpreadsheetInDrive,
  syncUsersToDriveSpreadsheet,
  fetchUsersFromDriveSpreadsheet,
  getLinkedUsersSpreadsheetInfo,
  setLinkedUsersSpreadsheetInfo
} from '../services/googleDriveUserService';

interface AccessManagerProps {
  currentUser: UserAccount;
  onUserChanged: (updatedUser: UserAccount) => void;
}

export default function AccessManager({ currentUser, onUserChanged }: AccessManagerProps) {
  const [users, setUsers] = useState<UserAccount[]>(getStoredUsers);
  const [logs, setLogs] = useState<AccessLog[]>(getStoredLogs);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Modals state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('analista');
  const [newStatus, setNewStatus] = useState<'active' | 'suspended'>('active');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(getDefaultPermissions('analista'));
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('analista');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(getDefaultPermissions('analista'));
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Password Update Form State (Standalone quick modal)
  const [updatePasswordInput, setUpdatePasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  // Password visibility map for the table
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Drive Spreadsheet State
  const [driveInfo, setDriveInfo] = useState<{ id: string | null; url: string | null }>(getLinkedUsersSpreadsheetInfo);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [showManualLink, setShowManualLink] = useState(false);

  const refreshData = () => {
    setUsers(getStoredUsers());
    setLogs(getStoredLogs());
    setDriveInfo(getLinkedUsersSpreadsheetInfo());
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Google Drive Operations
  const handleCreateDriveSpreadsheet = async () => {
    setIsDriveLoading(true);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        const authRes = await signInWithGoogle();
        token = authRes.accessToken;
      }
      const res = await createUsersSpreadsheetInDrive(token, users);
      setDriveInfo({ id: res.spreadsheetId, url: res.spreadsheetUrl });
      addAccessLog(
        'CREATE_DRIVE_SPREADSHEET',
        'GOOGLE_DRIVE',
        currentUser.username,
        `Planilha CONTROLE_DE_ACESSO_USUARIOS_ELEICOES_CEARA criada com ID: ${res.spreadsheetId}`
      );
      showToast('Planilha de Usuários criada com sucesso no seu Google Drive!', 'success');
      refreshData();
    } catch (err: any) {
      console.error('Erro ao criar planilha no Drive:', err);
      showToast(err?.message || 'Erro ao criar planilha no Google Drive.', 'error');
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSyncToDrive = async () => {
    if (!driveInfo.id) {
      showToast('Nenhuma planilha vinculada. Crie a planilha primeiro.', 'error');
      return;
    }
    setIsDriveLoading(true);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        const authRes = await signInWithGoogle();
        token = authRes.accessToken;
      }
      await syncUsersToDriveSpreadsheet(token, driveInfo.id, users);
      addAccessLog(
        'SYNC_USERS_DRIVE',
        'GOOGLE_DRIVE',
        currentUser.username,
        `${users.length} usuários sincronizados para a planilha Google Drive`
      );
      showToast(`Sucesso! ${users.length} contas de usuários sincronizadas com o Google Drive.`, 'success');
      refreshData();
    } catch (err: any) {
      console.error('Erro ao sincronizar com o Drive:', err);
      showToast(err?.message || 'Erro ao sincronizar com Google Drive.', 'error');
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleFetchFromDrive = async () => {
    if (!driveInfo.id) {
      showToast('Nenhuma planilha vinculada.', 'error');
      return;
    }
    setIsDriveLoading(true);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        const authRes = await signInWithGoogle();
        token = authRes.accessToken;
      }
      const remoteUsers = await fetchUsersFromDriveSpreadsheet(token, driveInfo.id);
      if (remoteUsers && remoteUsers.length > 0) {
        saveStoredUsers(remoteUsers);
        addAccessLog(
          'FETCH_USERS_DRIVE',
          'GOOGLE_DRIVE',
          currentUser.username,
          `${remoteUsers.length} usuários importados da planilha Google Drive`
        );
        showToast(`Sucesso! ${remoteUsers.length} contas carregadas da planilha do Google Drive.`, 'success');
        refreshData();
      } else {
        showToast('Nenhum registro encontrado na planilha.', 'error');
      }
    } catch (err: any) {
      console.error('Erro ao carregar do Drive:', err);
      showToast(err?.message || 'Erro ao ler dados da planilha do Google Drive.', 'error');
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSaveManualSheetLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualSheetInput.trim();
    if (!cleanId) return;
    const url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    setLinkedUsersSpreadsheetInfo(cleanId, url);
    setDriveInfo({ id: cleanId, url });
    setShowManualLink(false);
    setManualSheetInput('');
    showToast('ID da Planilha do Google Drive vinculado com sucesso!', 'success');
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const mName = u.name.toLowerCase().includes(q);
      const mUser = u.username.toLowerCase().includes(q);
      if (!mName && !mUser) return false;
    }
    return true;
  });

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setNewRole('analista');
    setNewStatus('active');
    setNewPermissions(getDefaultPermissions('analista'));
    setShowNewPassword(false);
    setIsNewUserModalOpen(true);
  };

  // Handle Create User
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createUserAccount(currentUser, {
      name: newName,
      username: newUsername,
      password: newPassword,
      role: newRole,
      status: newStatus,
      permissions: newPermissions
    });

    if (res.success) {
      showToast(res.message, 'success');
      setIsNewUserModalOpen(false);
      refreshData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserAccount) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword('');
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPermissions({ ...user.permissions });
    setShowEditPassword(false);
    setIsEditUserModalOpen(true);
  };

  // Handle Save Edit User
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const res = updateUserAccount(currentUser, selectedUser.id, {
      name: editName,
      username: editUsername,
      password: editPassword.trim() ? editPassword.trim() : undefined,
      role: editRole,
      status: editStatus,
      permissions: editPermissions
    });

    if (res.success) {
      showToast(res.message, 'success');
      setIsEditUserModalOpen(false);
      setSelectedUser(null);
      refreshData();
      if (res.user && res.user.id === currentUser.id) {
        onUserChanged(res.user);
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Update Password
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (updatePasswordInput !== confirmPasswordInput) {
      showToast('As senhas digitadas não coincidem.', 'error');
      return;
    }

    const res = updateUserPassword(currentUser, selectedUser.id, updatePasswordInput);
    if (res.success) {
      showToast(res.message, 'success');
      setIsPasswordModalOpen(false);
      setUpdatePasswordInput('');
      setConfirmPasswordInput('');
      setSelectedUser(null);
      refreshData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Delete User
  const handleDeleteUser = () => {
    if (!selectedUser) return;
    const res = deleteUserAccount(currentUser, selectedUser.id);
    if (res.success) {
      showToast(res.message, 'success');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      refreshData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Quick toggle status (Ativo / Inativo)
  const handleToggleStatus = (u: UserAccount) => {
    if (u.id === currentUser.id) {
      showToast('Você não pode suspender sua própria conta em uso.', 'error');
      return;
    }
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const res = updateUserAccount(currentUser, u.id, {
      name: u.name,
      username: u.username,
      role: u.role,
      status: nextStatus,
      permissions: u.permissions
    });
    if (res.success) {
      showToast(`Status do usuário ${u.name} alterado para ${nextStatus === 'active' ? 'ATIVO' : 'INATIVO'}.`);
      refreshData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Toggle reveal password in table
  const handleToggleRevealPassword = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Copy password to clipboard
  const handleCopyPassword = (userId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(userId);
    setTimeout(() => setCopiedPasswordId(null), 2000);
    showToast('Senha copiada para a área de transferência!');
  };

  // Generate random strong password
  const generateStrongPassword = (target: 'new' | 'edit') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (target === 'new') {
      setNewPassword(pass);
      setShowNewPassword(true);
    } else {
      setEditPassword(pass);
      setShowEditPassword(true);
    }
  };

  // Switch role view for testing
  const handleSwitchSession = (userToSwitch: UserAccount) => {
    setCurrentUser(userToSwitch);
    onUserChanged(userToSwitch);
    showToast(`Visualizando o sistema como ${userToSwitch.name} (${userToSwitch.role.toUpperCase()})`);
  };

  // Helper to count active permissions
  const countActivePermissions = (perms: UserPermissions): number => {
    return Object.values(perms).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm border animate-in fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="underline ml-4 hover:opacity-80">Fechar</button>
        </div>
      )}

      {/* Hero Banner for Master Access Control */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl text-white shadow-sm border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 fill-current" />
              Administrador Master
            </span>
            <span className="text-xs text-slate-300">Controle Total de Acesso & Gestão de Permissões</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Controle de Acesso e Gerenciamento de Usuários
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Como <strong>Administrador Master</strong>, você pode <strong>incluir, editar e excluir usuários</strong>, atualizar as <strong>senhas de acesso</strong> e definir com precisão as <strong>permissões específicas</strong> de cada conta, além de persistir tudo diretamente na planilha do Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 ring-1 ring-white/10"
          >
            <UserPlus className="w-4 h-4" />
            <span>Incluir Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Role Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Total de Usuários</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{users.length}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Cadastrados no sistema</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Administradores Master</span>
          <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">
            {users.filter(u => u.role === 'master').length}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Gestão e visão total</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Usuários Analistas</span>
          <span className="text-2xl font-bold font-mono text-blue-600 mt-1 block">
            {users.filter(u => u.role === 'analista').length}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Exportação & Sincronização</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Usuários de Consulta</span>
          <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
            {users.filter(u => u.role === 'visualizador').length}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Visualização de relatórios</span>
        </div>
      </div>

      {/* Quick Role Tester Switcher Bar */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
            👑
          </div>
          <div>
            <h4 className="font-bold text-amber-950 text-sm">Simulador de Perfis para Teste</h4>
            <p className="text-amber-800 text-xs">
              Alterne instantaneamente para testar como cada perfil enxerga o painel eleitoral (o que é permitido ou restrito):
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => handleSwitchSession(u)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs flex items-center gap-1.5 ${
                currentUser.id === u.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-amber-100/60 border border-amber-300'
              }`}
            >
              <span>{u.role === 'master' ? '👑' : u.role === 'analista' ? '📊' : '👁️'}</span>
              <span>{u.name.split(' ')[0]} ({u.role === 'master' ? 'Master' : 'Usuário'})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Google Drive Users Database Spreadsheet Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-blue-50/40 to-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Base de Dados dos Usuários no Google Drive</h3>
                {driveInfo.id ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Vinculada ao Google Drive
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                    Aguardando Criação no Drive
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Crie e sincronize a planilha oficial de usuários, senhas e perfis diretamente no seu Google Drive com acesso do Administrador Master.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {driveInfo.id ? (
              <>
                <a
                  href={driveInfo.url || `https://docs.google.com/spreadsheets/d/${driveInfo.id}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no Google Drive
                </a>

                <button
                  onClick={handleSyncToDrive}
                  disabled={isDriveLoading}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Atualizar dados da planilha do Drive com os usuários locais"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isDriveLoading ? 'Sincronizando...' : 'Enviar para o Drive'}
                </button>

                <button
                  onClick={handleFetchFromDrive}
                  disabled={isDriveLoading}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Puxar usuários da planilha do Drive para o painel"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  Puxar do Drive
                </button>
              </>
            ) : (
              <button
                onClick={handleCreateDriveSpreadsheet}
                disabled={isDriveLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isDriveLoading ? 'Criando no Google Drive...' : 'Criar Planilha de Usuários no Google Drive'}</span>
              </button>
            )}

            <button
              onClick={() => setShowManualLink(!showManualLink)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Vincular ID existente manualmente"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Manual ID Input Expansion */}
        {showManualLink && (
          <form onSubmit={handleSaveManualSheetLink} className="p-4 bg-slate-50 border-b border-slate-200 text-xs flex items-center gap-3">
            <span className="font-semibold text-slate-700 shrink-0">ID da Planilha no Google Drive:</span>
            <input
              type="text"
              placeholder="Cole o ID da planilha do Drive (ex: 1hJTkzxCQqY...)"
              value={manualSheetInput}
              onChange={e => setManualSheetInput(e.target.value)}
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
            >
              Vincular ID
            </button>
            <button
              type="button"
              onClick={() => setShowManualLink(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Fechar
            </button>
          </form>
        )}

        {/* Spreadsheet Status Info Bar */}
        <div className="p-4 text-xs bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-slate-600">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Nome do Arquivo no Drive</span>
              <span className="font-mono font-semibold text-slate-800">CONTROLE_DE_ACESSO_USUARIOS_ELEICOES_CEARA</span>
            </div>
            {driveInfo.id && (
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">ID do Documento</span>
                <span className="font-mono text-slate-600 text-[11px] truncate max-w-xs block">{driveInfo.id}</span>
              </div>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Permite inclusão, edição, exclusão e alteração de senhas sincronizadas pelo Administrador Master.</span>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Controle de Acesso • Usuários e Permissões
            </h3>
            <p className="text-xs text-slate-500">
              Visualização, inclusão, edição, exclusão e gerenciamento detalhado de permissões e senhas
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome ou login..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 w-52"
              />
            </div>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos os Perfis</option>
              <option value="master">Administrador Master</option>
              <option value="analista">Usuário Analista</option>
              <option value="visualizador">Usuário Consulta</option>
            </select>

            <button
              onClick={handleOpenCreateModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Incluir</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Nome do Usuário</th>
                <th className="py-3 px-4">Perfil (Administrador Master / Usuário)</th>
                <th className="py-3 px-4">Perfil / Nível</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Permissões Específicas</th>
                <th className="py-3 px-4">Senha Atual</th>
                <th className="py-3 px-4 text-right">Ações do Administrador Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum usuário encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = currentUser.id === u.id;
                  const isPassRevealed = Boolean(revealedPasswords[u.id]);
                  const activePermCount = countActivePermissions(u.permissions);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Nome do Usuário */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                            u.role === 'master'
                              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold ring-1 ring-amber-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}>
                            {u.role === 'master' ? <Crown className="w-4 h-4 fill-current" /> : u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                              {u.name}
                              {isCurrent && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-medium">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 font-mono text-[11px]">login: <strong>{u.username}</strong></div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Perfil (Administrador Master / Usuário) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.role === 'master' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5 shadow-2xs">
                            <Crown className="w-3.5 h-3.5 text-amber-600 fill-current" />
                            Administrador Master
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                            Usuário
                          </span>
                        )}
                      </td>

                      {/* 3. Perfil / Nível */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          u.role === 'master' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          u.role === 'analista' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {u.role === 'master' && '👑 Master (Acesso Total)'}
                          {u.role === 'analista' && '📊 Analista (Avançado)'}
                          {u.role === 'visualizador' && '👁️ Visualizador (Consulta)'}
                        </span>
                      </td>

                      {/* 4. Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                            u.status === 'active'
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                          }`}
                          title="Clique para alternar o status do usuário"
                        >
                          <span className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{u.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
                        </button>
                      </td>

                      {/* 5. Permissões Específicas */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {activePermCount} de 10 concedidas
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(u)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1"
                              title="Editar permissões específicas deste usuário"
                            >
                              <Sliders className="w-3 h-3" />
                              Editar Permissões
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {u.permissions.canManageUsers && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Gestão Acessos
                              </span>
                            )}
                            {u.permissions.canSyncSpreadsheet && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Sync Drive
                              </span>
                            )}
                            {u.permissions.canExportData && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                Exportar CSV
                              </span>
                            )}
                            {u.permissions.canViewAudit && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                Auditoria
                              </span>
                            )}
                            {u.permissions.canViewMaps && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                                Mapas 24/26
                              </span>
                            )}
                            {u.permissions.canViewRedutos && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                Redutos
                              </span>
                            )}
                            {u.permissions.canViewCandidates && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                Raio-X
                              </span>
                            )}
                            {u.permissions.canViewLocations && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                Bairros/Mun.
                              </span>
                            )}
                            {u.permissions.canViewCompleteTable && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                Base Votos
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 6. Senha Atual */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 max-w-fit font-mono text-xs">
                          <span className={`font-semibold ${isPassRevealed ? 'text-slate-900 font-bold' : 'text-slate-400 tracking-widest'}`}>
                            {isPassRevealed ? u.password : '••••••••'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleRevealPassword(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors ml-1"
                            title={isPassRevealed ? 'Ocultar senha' : 'Ver senha atual'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyPassword(u.id, u.password)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Copiar senha"
                          >
                            {copiedPasswordId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* 7. Ações do Administrador Master */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Editar Usuário e Permissões */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 border border-blue-200"
                            title="Editar dados cadastrais e permissões específicas"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>

                          {/* Botão Atualizar Senha */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setUpdatePasswordInput('');
                              setConfirmPasswordInput('');
                              setIsPasswordModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1 border border-amber-200"
                            title="Atualizar senha deste usuário"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Senha
                          </button>

                          {/* Botão Excluir Usuário */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDeleteModalOpen(true);
                            }}
                            disabled={isCurrent}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-200"
                            title={isCurrent ? 'Você não pode excluir sua própria conta Master em uso' : 'Excluir usuário'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Audit Trail Log Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Registro de Auditoria de Acesso (Audit Trail)
        </h3>
        <p className="text-xs text-slate-500">Histórico de ações administrativas realizadas no controle de acesso</p>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px]">
              <tr>
                <th className="py-2 px-3">Data e Hora</th>
                <th className="py-2 px-3">Ação</th>
                <th className="py-2 px-3">Usuário Afetado</th>
                <th className="py-2 px-3">Realizado Por</th>
                <th className="py-2 px-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">Nenhum evento registrado ainda.</td>
                </tr>
              ) : (
                logs.slice(0, 8).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{log.action}</td>
                    <td className="py-2 px-3 text-blue-700">{log.targetUsername}</td>
                    <td className="py-2 px-3 text-slate-500">{log.performedBy}</td>
                    <td className="py-2 px-3 text-slate-500">{log.details || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODAL 1: INCLUIR NOVO USUÁRIO COM PERMISSÕES ESPECÍFICAS         */}
      {/* ================================================================ */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Incluir Novo Usuário</h3>
                  <p className="text-[11px] text-slate-300">Cadastro de operador com controle de perfil e permissões específicas</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Row 1: Nome & Login */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome de Usuário (Login)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: carlos.eleitoral"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Senha & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Senha Inicial</label>
                    <button
                      type="button"
                      onClick={() => generateStrongPassword('new')}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" />
                      Gerar Senha Forte
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 4 caracteres"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status da Conta</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="active">🟢 Ativo (Liberado)</option>
                    <option value="suspended">🔴 Suspenso (Acesso Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Perfil / Nível */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Perfil (Administrador Master / Usuário) & Nível
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'master', label: '👑 Administrador Master', desc: 'Acesso total irrestrito + Gestão' },
                    { id: 'analista', label: '📊 Usuário Analista', desc: 'Filtros dinâmicos, dados e exportação' },
                    { id: 'visualizador', label: '👁️ Usuário Consulta', desc: 'Apenas visualização das telas' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setNewRole(r.id as UserRole);
                        setNewPermissions(getDefaultPermissions(r.id as UserRole));
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        newRole === r.id
                          ? 'border-blue-600 bg-blue-50/80 font-bold text-blue-950 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{r.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 4: Permissões Específicas Personalizáveis */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" />
                      Permissões Específicas do Usuário ({countActivePermissions(newPermissions)} de 10)
                    </span>
                    <p className="text-[11px] text-slate-500">Marque ou desmarque individualmente cada funcionalidade permitida</p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = {} as UserPermissions;
                        PERMISSION_DEFINITIONS.forEach(p => { allOn[p.key] = true; });
                        setNewPermissions(allOn);
                      }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Marcar Todas
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setNewPermissions(getDefaultPermissions(newRole))}
                      className="text-slate-500 hover:underline font-semibold"
                    >
                      Padrão do Perfil
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {PERMISSION_DEFINITIONS.map(p => {
                    const isChecked = Boolean(newPermissions[p.key]);
                    return (
                      <label
                        key={p.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            setNewPermissions(prev => ({
                              ...prev,
                              [p.key]: e.target.checked
                            }));
                          }}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="leading-tight">
                          <div className="font-semibold text-xs">{p.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">{p.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 2: EDITAR USUÁRIO E SUAS PERMISSÕES (ADMINISTRADOR MASTER) */}
      {/* ================================================================ */}
      {isEditUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Editar Usuário e Permissões Específicas</h3>
                  <p className="text-[11px] text-slate-300">
                    Modificar cadastro de <strong>{selectedUser.name}</strong> ({selectedUser.username})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Row 1: Nome & Login */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Login (Username)</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Nova Senha & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Alterar Senha Atual (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => generateStrongPassword('edit')}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" />
                      Gerar Nova Senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      placeholder="Deixe em branco para manter a senha atual"
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Senha atual gravada: <span className="font-mono text-slate-600">{selectedUser.password}</span>
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status da Conta</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="active">🟢 Ativo (Liberado para uso)</option>
                    <option value="suspended">🔴 Suspenso (Acesso temporariamente bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Perfil / Nível */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Perfil (Administrador Master / Usuário) & Nível
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'master', label: '👑 Administrador Master', desc: 'Acesso total irrestrito + Gestão' },
                    { id: 'analista', label: '📊 Usuário Analista', desc: 'Filtros dinâmicos, dados e exportação' },
                    { id: 'visualizador', label: '👁️ Usuário Consulta', desc: 'Apenas visualização das telas' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setEditRole(r.id as UserRole)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editRole === r.id
                          ? 'border-blue-600 bg-blue-50/80 font-bold text-blue-950 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{r.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 4: Permissões Específicas Interativas */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" />
                      Permissões Específicas Concedidas ({countActivePermissions(editPermissions)} de 10)
                    </span>
                    <p className="text-[11px] text-slate-500">Defina individualmente os privilégios deste usuário</p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = {} as UserPermissions;
                        PERMISSION_DEFINITIONS.forEach(p => { allOn[p.key] = true; });
                        setEditPermissions(allOn);
                      }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Marcar Todas
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setEditPermissions(getDefaultPermissions(editRole))}
                      className="text-slate-500 hover:underline font-semibold"
                    >
                      Restaurar Perfil
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {PERMISSION_DEFINITIONS.map(p => {
                    const isChecked = Boolean(editPermissions[p.key]);
                    return (
                      <label
                        key={p.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            setEditPermissions(prev => ({
                              ...prev,
                              [p.key]: e.target.checked
                            }));
                          }}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="leading-tight">
                          <div className="text-xs">{p.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">{p.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 3: ATUALIZAR SENHA (STANDALONE QUICK MODAL)                */}
      {/* ================================================================ */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Atualizar Senha de Acesso</h3>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Usuário Selecionado:</div>
                <div className="font-bold text-slate-900 text-sm">{selectedUser.name}</div>
                <div className="text-slate-500 font-mono text-xs">login: {selectedUser.username}</div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">Senha atual: {selectedUser.password}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showUpdatePassword ? 'text' : 'password'}
                    required
                    placeholder="Digite a nova senha..."
                    value={updatePasswordInput}
                    onChange={e => setUpdatePasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpdatePassword(!showUpdatePassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showUpdatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
                <input
                  type={showUpdatePassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha..."
                  value={confirmPasswordInput}
                  onChange={e => setConfirmPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 4: EXCLUIR CONTA DE USUÁRIO                                */}
      {/* ================================================================ */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Excluir Conta de Acesso</h3>
              <p className="text-slate-500 text-xs">
                Tem certeza de que deseja excluir o usuário <strong>{selectedUser.name}</strong> ({selectedUser.username})? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
