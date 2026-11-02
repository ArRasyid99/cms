import fs from 'node:fs';

const BASE_URL = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@alqosim.local';

function readEnvFile() {
  if (!fs.existsSync('.env')) return {};
  return Object.fromEntries(
    fs
      .readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = readEnvFile();
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  fs
    .readFileSync('.strapi-admin-credentials.txt', 'utf8')
    .split(/\r?\n/)
    .find((line) => line.startsWith('Password:'))
    ?.replace('Password:', '')
    .trim();

if (!ADMIN_PASSWORD) {
  throw new Error('Password admin tidak ditemukan. Jalankan scripts/bootstrap-admin.mjs dulu.');
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${method} ${path}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const CONTENT_EDITOR_SUBJECTS = new Set([
  'api::article.article',
  'api::category.category',
  'api::tag.tag',
  'api::author.author',
  'api::city.city',
  'api::office-space.office-space',
  'api::activity.activity',
]);

const FINANCE_SUBJECTS = new Set([
  'api::transaction.transaction',
  'api::financial-report.financial-report',
  'api::staff.staff',
  'api::activity.activity',
]);

const GENERAL_ACTIONS = new Set([
  'plugin::upload.read',
  'plugin::upload.assets.create',
  'plugin::upload.assets.update',
  'plugin::upload.assets.download',
  'plugin::upload.assets.copy-link',
  'plugin::content-manager.collection-types.configure-view',
  'plugin::content-manager.single-types.configure-view',
  'plugin::content-manager.components.configure-layout',
]);

function toPermissionPayload(permission) {
  return {
    action: permission.action,
    actionParameters: permission.actionParameters ?? {},
    subject: permission.subject ?? null,
    properties: permission.properties ?? {},
    conditions: permission.conditions ?? [],
  };
}

async function ensureRole(accessToken, roles, name, description, editorPermissions, subjects) {
  const existing = roles.find((role) => role.name === name);

  if (existing) {
    console.log(`Role "${name}" sudah ada (id ${existing.id}).`);
    return;
  }

  const permissions = editorPermissions
    .filter(
      (permission) =>
        (permission.subject && subjects.has(permission.subject)) ||
        (!permission.subject && GENERAL_ACTIONS.has(permission.action))
    )
    .map(toPermissionPayload);

  const created = await request('/admin/roles', {
    method: 'POST',
    token: accessToken,
    body: { name, description },
  });

  await request(`/admin/roles/${created.data.id}/permissions`, {
    method: 'PUT',
    token: accessToken,
    body: { permissions },
  });

  console.log(`Role "${name}" dibuat dengan ${permissions.length} permission.`);
}

async function main() {
  const login = await request('/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe: true },
  });

  const accessToken = login.data.accessToken ?? login.data.token;
  const roles = (await request('/admin/roles', { token: accessToken })).data;
  const editorRole = roles.find((role) => role.code === 'strapi-editor');

  if (!editorRole) {
    throw new Error('Role bawaan "Editor" tidak ditemukan.');
  }

  const editorPermissions = (
    await request(`/admin/roles/${editorRole.id}/permissions`, { token: accessToken })
  ).data;

  await ensureRole(
    accessToken,
    roles,
    'Editor Konten',
    'Mengelola artikel, kategori, tag, penulis, kota, office space, dan kegiatan.',
    editorPermissions,
    CONTENT_EDITOR_SUBJECTS
  );

  await ensureRole(
    accessToken,
    roles,
    'Finance',
    'Mengelola transaksi, laporan keuangan, pengurus, dan kegiatan.',
    editorPermissions,
    FINANCE_SUBJECTS
  );
}

main().catch((error) => {
  console.error(error.message);
  if (error.data) {
    console.error(JSON.stringify(error.data, null, 2));
  }
  process.exitCode = 1;
});
