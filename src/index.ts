// BlackRoad API Keys Management Service
// Create, manage, rotate, and revoke API keys

interface Env {
  ENVIRONMENT: string;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  scopes: string[];
  rateLimit: number;
  usage: {
    requests: number;
    lastHour: number;
    lastDay: number;
  };
}

// In-memory storage (in production, use KV or D1)
const keys: Map<string, APIKey> = new Map();

// Generate secure random key
function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

function generateId(): string {
  return 'key_' + crypto.randomUUID().split('-')[0];
}

// Seed some demo keys
function seedKeys(): void {
  if (keys.size === 0) {
    const demoKeys: APIKey[] = [
      {
        id: 'key_abc12345',
        name: 'Production API',
        key: 'br_live_' + generateKey(),
        prefix: 'br_live_',
        createdAt: '2026-01-15T10:00:00Z',
        lastUsed: '2026-02-15T04:30:00Z',
        expiresAt: null,
        status: 'active',
        scopes: ['read', 'write', 'deploy'],
        rateLimit: 10000,
        usage: { requests: 145632, lastHour: 234, lastDay: 4521 },
      },
      {
        id: 'key_def67890',
        name: 'Development',
        key: 'br_test_' + generateKey(),
        prefix: 'br_test_',
        createdAt: '2026-02-01T14:30:00Z',
        lastUsed: '2026-02-15T03:45:00Z',
        expiresAt: '2026-03-01T00:00:00Z',
        status: 'active',
        scopes: ['read', 'write'],
        rateLimit: 1000,
        usage: { requests: 8934, lastHour: 45, lastDay: 892 },
      },
      {
        id: 'key_ghi11223',
        name: 'CI/CD Pipeline',
        key: 'br_ci_' + generateKey(),
        prefix: 'br_ci_',
        createdAt: '2026-02-10T09:00:00Z',
        lastUsed: '2026-02-15T05:00:00Z',
        expiresAt: null,
        status: 'active',
        scopes: ['deploy', 'read'],
        rateLimit: 5000,
        usage: { requests: 2341, lastHour: 12, lastDay: 156 },
      },
    ];
    demoKeys.forEach(k => keys.set(k.id, k));
  }
}

// Available scopes
const SCOPES = [
  { id: 'read', name: 'Read', description: 'Read access to resources' },
  { id: 'write', name: 'Write', description: 'Create and update resources' },
  { id: 'delete', name: 'Delete', description: 'Delete resources' },
  { id: 'deploy', name: 'Deploy', description: 'Deploy services' },
  { id: 'admin', name: 'Admin', description: 'Full administrative access' },
  { id: 'webhooks', name: 'Webhooks', description: 'Manage webhooks' },
  { id: 'email', name: 'Email', description: 'Send emails' },
  { id: 'agents', name: 'Agents', description: 'Manage agents' },
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlackRoad API Keys</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #111 0%, #000 100%);
      border-bottom: 1px solid #333;
      padding: 21px 34px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 21px;
      font-weight: bold;
      background: linear-gradient(135deg, #F5A623 0%, #FF1D6C 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .btn {
      padding: 10px 21px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .btn-primary {
      background: linear-gradient(135deg, #FF1D6C 0%, #9C27B0 100%);
      color: #fff;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 34px; }
    .section-title {
      font-size: 21px;
      margin-bottom: 21px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title span { color: #FF1D6C; }
    .keys-list { display: flex; flex-direction: column; gap: 13px; }
    .key-card {
      background: #111;
      border: 1px solid #333;
      border-radius: 13px;
      padding: 21px;
      transition: border-color 0.2s;
    }
    .key-card:hover { border-color: #FF1D6C; }
    .key-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 13px;
    }
    .key-name { font-size: 18px; font-weight: 600; }
    .key-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .key-status.active { background: #10B98133; color: #10B981; }
    .key-status.revoked { background: #EF444433; color: #EF4444; }
    .key-status.expired { background: #F5A62333; color: #F5A623; }
    .key-value {
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 13px;
      font-family: monospace;
      font-size: 13px;
      color: #10B981;
      margin-bottom: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .key-value span { user-select: all; }
    .copy-btn {
      background: #333;
      border: none;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .copy-btn:hover { background: #444; }
    .key-meta {
      display: flex;
      gap: 21px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #888;
    }
    .key-meta-item { display: flex; gap: 8px; align-items: center; }
    .key-meta-label { color: #666; }
    .scopes {
      display: flex;
      gap: 8px;
      margin-top: 13px;
      flex-wrap: wrap;
    }
    .scope {
      background: #2979FF22;
      color: #2979FF;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .key-actions {
      display: flex;
      gap: 8px;
      margin-top: 13px;
      padding-top: 13px;
      border-top: 1px solid #222;
    }
    .key-actions button {
      padding: 6px 13px;
      border-radius: 6px;
      border: 1px solid #333;
      background: transparent;
      color: #888;
      font-size: 12px;
      cursor: pointer;
    }
    .key-actions button:hover { border-color: #FF1D6C; color: #FF1D6C; }
    .key-actions button.danger:hover { border-color: #EF4444; color: #EF4444; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 21px;
      margin-bottom: 34px;
    }
    .stat-card {
      background: #111;
      border: 1px solid #333;
      border-radius: 13px;
      padding: 21px;
      text-align: center;
    }
    .stat-value {
      font-size: 34px;
      font-weight: bold;
      background: linear-gradient(135deg, #FF1D6C 0%, #F5A623 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label { color: #888; font-size: 13px; margin-top: 8px; }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal.active { display: flex; }
    .modal-content {
      background: #111;
      border: 1px solid #333;
      border-radius: 13px;
      padding: 34px;
      max-width: 500px;
      width: 100%;
    }
    .modal-title { font-size: 21px; margin-bottom: 21px; }
    .form-group { margin-bottom: 21px; }
    .form-label { display: block; margin-bottom: 8px; color: #888; font-size: 13px; }
    .form-input {
      width: 100%;
      padding: 13px;
      border-radius: 8px;
      border: 1px solid #333;
      background: #0a0a0a;
      color: #fff;
      font-size: 14px;
    }
    .form-input:focus { border-color: #FF1D6C; outline: none; }
    .checkboxes { display: flex; flex-wrap: wrap; gap: 8px; }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 13px;
      border: 1px solid #333;
      border-radius: 6px;
      cursor: pointer;
    }
    .checkbox-item:hover { border-color: #FF1D6C; }
    .checkbox-item input { accent-color: #FF1D6C; }
    .footer {
      border-top: 1px solid #333;
      padding: 21px 34px;
      text-align: center;
      color: #666;
      font-size: 13px;
    }
    .footer a { color: #FF1D6C; text-decoration: none; }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">BlackRoad API Keys</div>
    <button class="btn btn-primary" onclick="showCreateModal()">+ Create Key</button>
  </header>

  <div class="container">
    <div class="stats-grid" id="stats"></div>
    <h2 class="section-title"><span>//</span> API Keys</h2>
    <div class="keys-list" id="keys-list"></div>
  </div>

  <div class="modal" id="create-modal">
    <div class="modal-content">
      <h3 class="modal-title">Create API Key</h3>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" class="form-input" id="key-name" placeholder="My API Key">
      </div>
      <div class="form-group">
        <label class="form-label">Environment</label>
        <select class="form-input" id="key-env">
          <option value="live">Production (br_live_)</option>
          <option value="test">Development (br_test_)</option>
          <option value="ci">CI/CD (br_ci_)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Scopes</label>
        <div class="checkboxes" id="scopes-list"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Rate Limit (requests/hour)</label>
        <input type="number" class="form-input" id="key-rate" value="1000">
      </div>
      <div style="display: flex; gap: 13px; justify-content: flex-end;">
        <button class="btn" style="background: #333; color: #fff;" onclick="hideCreateModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createKey()">Create Key</button>
      </div>
    </div>
  </div>

  <footer class="footer">
    <p>Powered by <a href="https://blackroad.io">BlackRoad OS</a> &bull; <a href="https://blackroad-dev-portal.amundsonalexa.workers.dev">Developer Portal</a></p>
  </footer>

  <script>
    const scopes = ${JSON.stringify(SCOPES)};

    async function loadKeys() {
      const resp = await fetch('/api/keys');
      const data = await resp.json();

      // Stats
      const active = data.keys.filter(k => k.status === 'active').length;
      const totalUsage = data.keys.reduce((sum, k) => sum + k.usage.requests, 0);
      const hourUsage = data.keys.reduce((sum, k) => sum + k.usage.lastHour, 0);

      document.getElementById('stats').innerHTML = \`
        <div class="stat-card">
          <div class="stat-value">\${data.keys.length}</div>
          <div class="stat-label">Total Keys</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${active}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${(totalUsage / 1000).toFixed(0)}K</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${hourUsage}</div>
          <div class="stat-label">Last Hour</div>
        </div>
      \`;

      // Keys list
      document.getElementById('keys-list').innerHTML = data.keys.map(k => \`
        <div class="key-card">
          <div class="key-header">
            <div class="key-name">\${k.name}</div>
            <span class="key-status \${k.status}">\${k.status}</span>
          </div>
          <div class="key-value">
            <span>\${k.prefix}••••••••••••••••</span>
            <button class="copy-btn" onclick="copyKey('\${k.id}')">Copy</button>
          </div>
          <div class="key-meta">
            <div class="key-meta-item">
              <span class="key-meta-label">Created:</span>
              <span>\${new Date(k.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="key-meta-item">
              <span class="key-meta-label">Last used:</span>
              <span>\${k.lastUsed ? new Date(k.lastUsed).toLocaleString() : 'Never'}</span>
            </div>
            <div class="key-meta-item">
              <span class="key-meta-label">Rate limit:</span>
              <span>\${k.rateLimit.toLocaleString()}/hr</span>
            </div>
            <div class="key-meta-item">
              <span class="key-meta-label">Usage:</span>
              <span>\${k.usage.requests.toLocaleString()} requests</span>
            </div>
          </div>
          <div class="scopes">
            \${k.scopes.map(s => \`<span class="scope">\${s}</span>\`).join('')}
          </div>
          <div class="key-actions">
            <button onclick="rotateKey('\${k.id}')">Rotate</button>
            <button class="danger" onclick="revokeKey('\${k.id}')">Revoke</button>
          </div>
        </div>
      \`).join('');

      // Scopes checkboxes
      document.getElementById('scopes-list').innerHTML = scopes.map(s => \`
        <label class="checkbox-item">
          <input type="checkbox" name="scope" value="\${s.id}" \${['read', 'write'].includes(s.id) ? 'checked' : ''}>
          \${s.name}
        </label>
      \`).join('');
    }

    function showCreateModal() {
      document.getElementById('create-modal').classList.add('active');
    }

    function hideCreateModal() {
      document.getElementById('create-modal').classList.remove('active');
    }

    async function createKey() {
      const name = document.getElementById('key-name').value || 'Untitled Key';
      const env = document.getElementById('key-env').value;
      const rateLimit = parseInt(document.getElementById('key-rate').value) || 1000;
      const scopes = Array.from(document.querySelectorAll('input[name="scope"]:checked')).map(cb => cb.value);

      const resp = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, environment: env, scopes, rateLimit }),
      });

      const data = await resp.json();
      if (data.key) {
        alert('Key created! Make sure to copy it:\\n\\n' + data.key.key);
        hideCreateModal();
        loadKeys();
      }
    }

    async function copyKey(id) {
      const resp = await fetch('/api/keys/' + id);
      const data = await resp.json();
      navigator.clipboard.writeText(data.key.key);
      alert('Key copied to clipboard!');
    }

    async function rotateKey(id) {
      if (!confirm('Rotate this key? The old key will stop working immediately.')) return;
      const resp = await fetch('/api/keys/' + id + '/rotate', { method: 'POST' });
      const data = await resp.json();
      alert('Key rotated! New key:\\n\\n' + data.key.key);
      loadKeys();
    }

    async function revokeKey(id) {
      if (!confirm('Revoke this key? This action cannot be undone.')) return;
      await fetch('/api/keys/' + id, { method: 'DELETE' });
      loadKeys();
    }

    loadKeys();
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    seedKeys();
    const url = new URL(request.url);
    const method = request.method;

    // CORS
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API endpoints
    if (url.pathname === '/api/keys' && method === 'GET') {
      return Response.json({ keys: Array.from(keys.values()) }, { headers: corsHeaders });
    }

    if (url.pathname === '/api/keys' && method === 'POST') {
      const body = await request.json() as any;
      const id = generateId();
      const prefix = 'br_' + (body.environment || 'live') + '_';
      const newKey: APIKey = {
        id,
        name: body.name || 'Untitled Key',
        key: prefix + generateKey(),
        prefix,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        expiresAt: body.expiresAt || null,
        status: 'active',
        scopes: body.scopes || ['read'],
        rateLimit: body.rateLimit || 1000,
        usage: { requests: 0, lastHour: 0, lastDay: 0 },
      };
      keys.set(id, newKey);
      return Response.json({ success: true, key: newKey }, { headers: corsHeaders });
    }

    if (url.pathname.match(/^\/api\/keys\/[\w]+$/) && method === 'GET') {
      const id = url.pathname.split('/').pop()!;
      const key = keys.get(id);
      if (!key) {
        return Response.json({ error: 'Key not found' }, { status: 404, headers: corsHeaders });
      }
      return Response.json({ key }, { headers: corsHeaders });
    }

    if (url.pathname.match(/^\/api\/keys\/[\w]+$/) && method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      const key = keys.get(id);
      if (key) {
        key.status = 'revoked';
        keys.set(id, key);
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (url.pathname.match(/^\/api\/keys\/[\w]+\/rotate$/) && method === 'POST') {
      const id = url.pathname.split('/')[3];
      const key = keys.get(id);
      if (!key) {
        return Response.json({ error: 'Key not found' }, { status: 404, headers: corsHeaders });
      }
      key.key = key.prefix + generateKey();
      keys.set(id, key);
      return Response.json({ success: true, key }, { headers: corsHeaders });
    }

    if (url.pathname === '/api/scopes') {
      return Response.json({ scopes: SCOPES }, { headers: corsHeaders });
    }

    if (url.pathname === '/api/verify' && method === 'POST') {
      const body = await request.json() as any;
      const apiKey = body.key;
      const found = Array.from(keys.values()).find(k => k.key === apiKey && k.status === 'active');
      if (found) {
        found.lastUsed = new Date().toISOString();
        found.usage.requests++;
        found.usage.lastHour++;
        found.usage.lastDay++;
        return Response.json({ valid: true, scopes: found.scopes, rateLimit: found.rateLimit }, { headers: corsHeaders });
      }
      return Response.json({ valid: false }, { status: 401, headers: corsHeaders });
    }

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'healthy', version: '1.0.0' }, { headers: corsHeaders });
    }

    // Dashboard
    return new Response(dashboardHTML, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};
