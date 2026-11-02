import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE_URL = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@alqosim.local';
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  `${crypto.randomBytes(9).toString('base64url')}Aa1!`;

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
    const error = new Error(`HTTP ${response.status} ${path}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function login() {
  const result = await request('/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe: true },
  });

  return result.data.accessToken ?? result.data.token;
}

async function main() {
  let accessToken;

  try {
    const result = await request('/admin/register-admin', {
      method: 'POST',
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        firstname: 'Admin',
        lastname: 'Al Qosim',
      },
    });

    accessToken = result.data.accessToken ?? result.data.token;
    fs.writeFileSync(
      '.strapi-admin-credentials.txt',
      `URL: ${BASE_URL}/admin\nEmail: ${ADMIN_EMAIL}\nPassword: ${ADMIN_PASSWORD}\n`,
      'utf8'
    );
    console.log(`Admin dibuat: ${ADMIN_EMAIL}`);
    console.log('Kredensial disimpan di .strapi-admin-credentials.txt');
  } catch (error) {
    if (error.status === 400) {
      console.log('Admin sudah ada, mencoba login...');
      accessToken = await login();
    } else {
      throw error;
    }
  }

  const tokens = await request('/admin/api-tokens', { token: accessToken });
  const existing = tokens.data.find((token) => token.name === 'office-frontend');

  if (existing) {
    console.log('API token "office-frontend" sudah ada.');
    console.log(
      'Access key hanya ditampilkan sekali saat dibuat. Hapus lalu buat ulang lewat admin jika perlu.'
    );
    return;
  }

  const created = await request('/admin/api-tokens', {
    method: 'POST',
    token: accessToken,
    body: {
      name: 'office-frontend',
      description: 'Read-only token untuk dashboard keuangan office',
      type: 'read-only',
      lifespan: null,
    },
  });

  const accessKey = created.data.accessKey;
  fs.writeFileSync('.strapi-api-token', `${accessKey}\n`, 'utf8');

  console.log('API token "office-frontend" dibuat.');
  console.log(`Token disimpan di .strapi-api-token`);
  console.log(`Token: ${accessKey}`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.data) {
    console.error(JSON.stringify(error.data, null, 2));
  }
  process.exitCode = 1;
});
