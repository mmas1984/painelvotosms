// Authentication and Access Management Service (RBAC)
// Manages Master user, analyst, viewer roles, credentials, and persistent user accounts

export type UserRole = 'master' | 'analista' | 'visualizador';

export interface UserPermissions {
  canManageUsers: boolean;
  canExportData: boolean;
  canSyncSpreadsheet: boolean;
  canViewAudit: boolean;
  canViewExecutive: boolean;
  canViewMaps: boolean;
  canViewRedutos: boolean;
  canViewCandidates: boolean;
  canViewLocations: boolean;
  canViewCompleteTable: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  password: string; // In production this would be hashed; kept accessible for Master management
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'suspended';
  permissions: UserPermissions;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  action: string;
  targetUsername: string;
  performedBy: string;
  details?: string;
}

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-master-1',
    name: 'Administrador Master',
    username: 'master',
    role: 'master',
    password: 'master123',
    createdAt: '2024-01-01T00:00:00.000Z',
    status: 'active',
    permissions: {
      canManageUsers: true,
      canExportData: true,
      canSyncSpreadsheet: true,
      canViewAudit: true,
      canViewExecutive: true,
      canViewMaps: true,
      canViewRedutos: true,
      canViewCandidates: true,
      canViewLocations: true,
      canViewCompleteTable: true
    }
  },
  {
    id: 'user-analista-1',
    name: 'Analista de Dados Eleitorais',
    username: 'analista',
    role: 'analista',
    password: 'analista123',
    createdAt: '2024-01-10T12:00:00.000Z',
    status: 'active',
    permissions: {
      canManageUsers: false,
      canExportData: true,
      canSyncSpreadsheet: true,
      canViewAudit: true,
      canViewExecutive: true,
      canViewMaps: true,
      canViewRedutos: true,
      canViewCandidates: true,
      canViewLocations: true,
      canViewCompleteTable: true
    }
  },
  {
    id: 'user-consulta-1',
    name: 'Operador de Consulta',
    username: 'consulta',
    role: 'visualizador',
    password: 'consulta123',
    createdAt: '2024-02-01T08:30:00.000Z',
    status: 'active',
    permissions: {
      canManageUsers: false,
      canExportData: false,
      canSyncSpreadsheet: false,
      canViewAudit: false,
      canViewExecutive: true,
      canViewMaps: true,
      canViewRedutos: true,
      canViewCandidates: true,
      canViewLocations: true,
      canViewCompleteTable: true
    }
  }
];

const USERS_STORAGE_KEY = 'FZ_AUTH_USERS_V2';
const SESSION_STORAGE_KEY = 'FZ_AUTH_SESSION_V2';
const LOGS_STORAGE_KEY = 'FZ_AUTH_LOGS_V2';

export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error loading stored users:', err);
  }
  return DEFAULT_USERS;
}

export function saveStoredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving users to storage:', err);
  }
}

export function getStoredLogs(): AccessLog[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading logs:', err);
  }
  return [];
}

export function addAccessLog(action: string, targetUsername: string, performedBy: string, details?: string): void {
  try {
    const currentLogs = getStoredLogs();
    const newLog: AccessLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      targetUsername,
      performedBy,
      details
    };
    const updated = [newLog, ...currentLogs].slice(0, 100);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error adding log:', err);
  }
}

export function getSessionUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      const allUsers = getStoredUsers();
      const freshUser = allUsers.find(u => u.id === user.id || u.username === user.username);
      if (freshUser && freshUser.status === 'active') {
        return freshUser;
      }
    }
  } catch (err) {
    console.error('Error getting session user:', err);
  }
  return null;
}

export function getCurrentUser(): UserAccount {
  const session = getSessionUser();
  if (session) return session;
  const allUsers = getStoredUsers();
  return allUsers.find(u => u.role === 'master') || DEFAULT_USERS[0];
}

export function logoutUser(user?: UserAccount): void {
  try {
    if (user) {
      addAccessLog('LOGOUT_SYSTEM', user.username, user.username, 'Usuário desconectou-se do painel eleitoral');
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Error logging out:', err);
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      // Update last login
      const all = getStoredUsers();
      const idx = all.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        all[idx].lastLogin = new Date().toISOString();
        saveStoredUsers(all);
      }
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Error setting current user:', err);
  }
}

export const PERMISSION_DEFINITIONS: { key: keyof UserPermissions; label: string; desc: string; category: string }[] = [
  { key: 'canManageUsers', label: 'Gestão de Usuários e Senhas', desc: 'Permite criar, editar, redefinir senhas e excluir usuários', category: 'Administração' },
  { key: 'canSyncSpreadsheet', label: 'Sincronizar Google Drive', desc: 'Criar, sincronizar e carregar planilha no Google Drive', category: 'Administração' },
  { key: 'canExportData', label: 'Exportação CSV', desc: 'Download e exportação de dados tabulares filtrados em CSV', category: 'Operacional' },
  { key: 'canViewAudit', label: 'Auditoria de Acessos', desc: 'Trilha de auditoria e histórico de ações administrativas', category: 'Segurança' },
  { key: 'canViewExecutive', label: 'Visão Executiva', desc: 'Acesso aos cards e gráficos executivos da eleição', category: 'Navegação' },
  { key: 'canViewMaps', label: 'Cartografia & Mapas', desc: 'Visualização dos mapas de Fortaleza 2024 e Ceará 2026', category: 'Navegação' },
  { key: 'canViewRedutos', label: 'Redutos Eleitorais', desc: 'Análise de concentração eleitoral e redutos fortes', category: 'Navegação' },
  { key: 'canViewCandidates', label: 'Raio-X do Candidato', desc: 'Detalhamento de performance por candidato', category: 'Navegação' },
  { key: 'canViewLocations', label: 'Análise por Localidade', desc: 'Detalhamento por bairros/municípios e comparador', category: 'Navegação' },
  { key: 'canViewCompleteTable', label: 'Base Completa de Votos', desc: 'Acesso à tabela geral com milhares de registros', category: 'Navegação' }
];

export function getDefaultPermissions(role: UserRole): UserPermissions {
  return {
    canManageUsers: role === 'master',
    canExportData: role === 'master' || role === 'analista',
    canSyncSpreadsheet: role === 'master' || role === 'analista',
    canViewAudit: role === 'master' || role === 'analista',
    canViewExecutive: true,
    canViewMaps: true,
    canViewRedutos: true,
    canViewCandidates: true,
    canViewLocations: true,
    canViewCompleteTable: true
  };
}

/**
 * Inserts a new user account (Permitted for Master)
 */
export function createUserAccount(
  actor: UserAccount,
  data: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    status?: 'active' | 'suspended';
    permissions?: UserPermissions;
  }
): { success: boolean; message: string; user?: UserAccount } {
  if (actor.role !== 'master') {
    return { success: false, message: 'Apenas o usuário Administrador Master pode cadastrar novas contas.' };
  }

  const users = getStoredUsers();
  const cleanUsername = data.username.trim().toLowerCase();

  if (!data.name.trim()) {
    return { success: false, message: 'O nome completo do usuário é obrigatório.' };
  }
  if (!cleanUsername) {
    return { success: false, message: 'O nome de usuário/login é obrigatório.' };
  }
  if (!data.password || data.password.length < 4) {
    return { success: false, message: 'A senha deve ter pelo menos 4 caracteres.' };
  }

  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `O login "${cleanUsername}" já está em uso por outro usuário.` };
  }

  const permissions: UserPermissions = data.permissions || getDefaultPermissions(data.role);

  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: data.name.trim(),
    username: cleanUsername,
    role: data.role,
    password: data.password,
    createdAt: new Date().toISOString(),
    status: data.status || 'active',
    permissions
  };

  users.push(newUser);
  saveStoredUsers(users);
  addAccessLog('Criação de Usuário', cleanUsername, actor.username, `Perfil: ${data.role === 'master' ? 'Administrador Master' : 'Usuário (' + data.role + ')'}`);

  return { success: true, message: `Usuário ${cleanUsername} cadastrado com sucesso.`, user: newUser };
}

/**
 * Updates an existing user account and permissions (Permitted for Master)
 */
export function updateUserAccount(
  actor: UserAccount,
  userId: string,
  data: {
    name: string;
    username: string;
    password?: string;
    role: UserRole;
    status: 'active' | 'suspended';
    permissions: UserPermissions;
  }
): { success: boolean; message: string; user?: UserAccount } {
  if (actor.role !== 'master') {
    return { success: false, message: 'Apenas o usuário Administrador Master pode editar usuários.' };
  }

  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  const cleanUsername = data.username.trim().toLowerCase();
  if (!data.name.trim()) {
    return { success: false, message: 'O nome do usuário não pode ficar vazio.' };
  }
  if (!cleanUsername) {
    return { success: false, message: 'O login do usuário não pode ficar vazio.' };
  }

  // Check unique username if altered
  if (cleanUsername !== target.username.toLowerCase()) {
    if (users.some(u => u.id !== userId && u.username.toLowerCase() === cleanUsername)) {
      return { success: false, message: `O login "${cleanUsername}" já pertence a outro usuário.` };
    }
  }

  target.name = data.name.trim();
  target.username = cleanUsername;
  target.role = data.role;
  target.status = data.status;
  target.permissions = data.permissions;
  if (data.password && data.password.trim().length >= 4) {
    target.password = data.password.trim();
  }

  saveStoredUsers(users);
  addAccessLog(
    'Edição de Usuário',
    target.username,
    actor.username,
    `Atualizado: Nome, Perfil (${data.role}), Status (${data.status}) e Permissões Específicas`
  );

  // If editing self, update active session
  const current = getCurrentUser();
  if (current.id === userId) {
    setCurrentUser(target);
  }

  return { success: true, message: `Usuário ${target.name} atualizado com sucesso.`, user: target };
}

/**
 * Updates a user's password (Permitted for Master)
 */
export function updateUserPassword(
  actor: UserAccount,
  userId: string,
  newPassword: string
): { success: boolean; message: string } {
  if (actor.role !== 'master') {
    return { success: false, message: 'Apenas o usuário Master pode atualizar senhas de acesso.' };
  }

  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' };
  }

  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  target.password = newPassword;
  saveStoredUsers(users);
  addAccessLog('Alteração de Senha', target.username, actor.username, 'Senha de acesso redefinida pelo Master');

  // If the target is the currently active user, refresh session
  const current = getCurrentUser();
  if (current.id === userId) {
    setCurrentUser(target);
  }

  return { success: true, message: `Senha do usuário ${target.name} (${target.username}) atualizada com sucesso.` };
}

/**
 * Deletes a user account (Permitted for Master)
 */
export function deleteUserAccount(
  actor: UserAccount,
  userId: string
): { success: boolean; message: string } {
  if (actor.role !== 'master') {
    return { success: false, message: 'Apenas o usuário Master pode excluir contas de acesso.' };
  }

  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  // Prevent deleting self if actor is this user
  if (actor.id === userId) {
    return { success: false, message: 'Você não pode excluir sua própria conta Master em uso.' };
  }

  // Prevent deleting the last master
  if (target.role === 'master') {
    const masterCount = users.filter(u => u.role === 'master').length;
    if (masterCount <= 1) {
      return { success: false, message: 'Não é permitido excluir o único usuário Master do sistema.' };
    }
  }

  const filtered = users.filter(u => u.id !== userId);
  saveStoredUsers(filtered);
  addAccessLog('Exclusão de Usuário', target.username, actor.username, `Usuário ${target.name} removido do sistema`);

  return { success: true, message: `Usuário ${target.name} (${target.username}) excluído com sucesso.` };
}

/**
 * Authenticates user credentials
 */
export function authenticateUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; message: string; user?: UserAccount } {
  const users = getStoredUsers();
  const cleanUsername = usernameInput.trim().toLowerCase();

  const user = users.find(u => u.username.toLowerCase() === cleanUsername);
  if (!user) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  if (user.status !== 'active') {
    return { success: false, message: 'Esta conta de acesso está suspensa ou inativa.' };
  }

  if (user.password !== passwordInput) {
    return { success: false, message: 'Senha incorreta.' };
  }

  setCurrentUser(user);
  addAccessLog('Login Efetuado', user.username, user.username, `Login via perfil ${user.role}`);

  return { success: true, message: `Bem-vindo, ${user.name}!`, user };
}
