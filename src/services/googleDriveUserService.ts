import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, UserRole, UserPermissions } from './authService';

// Initialize Firebase App instance safely (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Required Google Workspace scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn && onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro na autenticação com Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

const USERS_SPREADSHEET_ID_KEY = 'FZ_USERS_SPREADSHEET_ID_V2';
const USERS_SPREADSHEET_URL_KEY = 'FZ_USERS_SPREADSHEET_URL_V2';

export const getLinkedUsersSpreadsheetInfo = (): { id: string | null; url: string | null } => {
  const id = localStorage.getItem(USERS_SPREADSHEET_ID_KEY);
  const url = localStorage.getItem(USERS_SPREADSHEET_URL_KEY);
  return { id, url };
};

export const setLinkedUsersSpreadsheetInfo = (id: string, url: string): void => {
  localStorage.setItem(USERS_SPREADSHEET_ID_KEY, id);
  localStorage.setItem(USERS_SPREADSHEET_URL_KEY, url);
};

/**
 * Creates a brand new spreadsheet inside the user's Google Drive for user accounts
 */
export async function createUsersSpreadsheetInDrive(
  token: string,
  users: UserAccount[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const headers = [
    'ID',
    'Nome do Usuário',
    'Login (Username)',
    'Perfil (Administrador Master / Usuário)',
    'Perfil / Nível',
    'Status',
    'Permissões Específicas',
    'Senha Atual',
    'Data Criacao',
    'Ultimo Acesso'
  ];

  const rows = users.map(u => [
    u.id,
    u.name,
    u.username,
    u.role === 'master' ? 'Administrador Master' : 'Usuário',
    u.role.toUpperCase(),
    u.status.toUpperCase(),
    JSON.stringify(u.permissions),
    u.password,
    u.createdAt,
    u.lastLogin || ''
  ]);

  const body = {
    properties: {
      title: 'CONTROLE_DE_ACESSO_USUARIOS_ELEICOES_CEARA'
    },
    sheets: [
      {
        properties: {
          title: 'USUARIOS',
          gridProperties: {
            frozenRowCount: 1
          }
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: headers.map(h => ({
                  userEnteredValue: { stringValue: h },
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.15, green: 0.25, blue: 0.55 }
                  }
                }))
              },
              ...rows.map(row => ({
                values: row.map(cell => ({
                  userEnteredValue: { stringValue: String(cell) }
                }))
              }))
            ]
          }
        ]
      }
    ]
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao criar planilha no Google Drive: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  setLinkedUsersSpreadsheetInfo(spreadsheetId, spreadsheetUrl);

  return {
    spreadsheetId,
    spreadsheetUrl
  };
}

/**
 * Syncs the current users list into the linked Google Drive spreadsheet
 */
export async function syncUsersToDriveSpreadsheet(
  token: string,
  spreadsheetId: string,
  users: UserAccount[]
): Promise<void> {
  const headers = [
    'ID',
    'Nome do Usuário',
    'Login (Username)',
    'Perfil (Administrador Master / Usuário)',
    'Perfil / Nível',
    'Status',
    'Permissões Específicas',
    'Senha Atual',
    'Data Criacao',
    'Ultimo Acesso'
  ];

  const rows = users.map(u => [
    u.id,
    u.name,
    u.username,
    u.role === 'master' ? 'Administrador Master' : 'Usuário',
    u.role.toUpperCase(),
    u.status.toUpperCase(),
    JSON.stringify(u.permissions),
    u.password,
    u.createdAt,
    u.lastLogin || ''
  ]);

  const valueRange = {
    range: `USUARIOS!A1:J${rows.length + 1}`,
    majorDimension: 'ROWS',
    values: [headers, ...rows]
  };

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!A1:J${rows.length + 1}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(valueRange)
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao atualizar planilha de usuários: ${res.status} - ${errText}`);
  }
}

/**
 * Reads users from the linked Google Drive spreadsheet
 */
export async function fetchUsersFromDriveSpreadsheet(
  token: string,
  spreadsheetId: string
): Promise<UserAccount[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!A2:J500`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao ler planilha de usuários: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows.map((row, index) => {
    // Check if 10-column layout or 9-column legacy layout
    const is10Cols = row.length >= 10;
    let roleRaw = is10Cols ? row[4] : row[3];
    let passwordRaw = is10Cols ? row[7] : row[4];
    let statusRaw = is10Cols ? row[5] : row[5];
    let permsRaw = is10Cols ? row[6] : row[8];
    let createdRaw = is10Cols ? row[8] : row[6];
    let loginRaw = is10Cols ? row[9] : row[7];

    let perms: UserPermissions;
    try {
      perms = permsRaw ? JSON.parse(permsRaw) : null;
    } catch {
      perms = null as any;
    }

    const role = (roleRaw || 'visualizador').toLowerCase() as UserRole;

    if (!perms) {
      perms = {
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

    return {
      id: row[0] || `user-${Date.now()}-${index}`,
      name: row[1] || 'Usuário',
      username: row[2] || `user_${index}`,
      role,
      password: passwordRaw || '123456',
      status: (statusRaw || 'ACTIVE').toLowerCase() === 'active' ? 'active' : 'suspended',
      createdAt: createdRaw || new Date().toISOString(),
      lastLogin: loginRaw || '',
      permissions: perms
    };
  });
}
