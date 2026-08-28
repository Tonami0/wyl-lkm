const CLOUD_CONFIG_KEY = 'love-memories-cloud-config-v1';
const CLOUD_PROVIDER_KEY = 'love-memories-cloud-provider-v1';
const DEFAULT_SUPABASE_TABLE = 'love_memories';
const DEFAULT_RECORD_ID = 'default';

function normalizeUrl(value) {
  return (value || '').trim().replace(/\/$/, '');
}

function readStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || 'null');
  } catch {
    return null;
  }
}

function buildSupabaseConfig(raw) {
  const url = normalizeUrl(raw?.url || '');
  const key = (raw?.key || '').trim();
  const table = (raw?.table || DEFAULT_SUPABASE_TABLE).trim() || DEFAULT_SUPABASE_TABLE;
  const recordId = (raw?.recordId || DEFAULT_RECORD_ID).trim() || DEFAULT_RECORD_ID;
  return {
    provider: 'supabase',
    enabled: Boolean(url && key),
    url,
    key,
    table,
    recordId,
  };
}

function buildJsonblobConfig(raw) {
  const url = normalizeUrl(raw?.url || '');
  return {
    provider: 'jsonblob',
    enabled: Boolean(url),
    url,
  };
}

export function getCloudConfig(search = window.location.search) {
  const params = new URLSearchParams(search);
  const stored = readStoredConfig();
  const provider = (params.get('provider') || stored?.provider || localStorage.getItem(CLOUD_PROVIDER_KEY) || 'supabase').toLowerCase();

  if (provider === 'supabase') {
    return buildSupabaseConfig({
      url: params.get('supabaseUrl') || stored?.url || '',
      key: params.get('supabaseKey') || stored?.key || '',
      table: params.get('supabaseTable') || stored?.table || DEFAULT_SUPABASE_TABLE,
      recordId: params.get('supabaseRecordId') || stored?.recordId || DEFAULT_RECORD_ID,
    });
  }

  if (provider === 'jsonblob' || provider === 'legacy') {
    return buildJsonblobConfig({
      url: params.get('store') || stored?.url || '',
    });
  }

  return buildSupabaseConfig({
    url: params.get('supabaseUrl') || stored?.url || '',
    key: params.get('supabaseKey') || stored?.key || '',
  });
}

export function setCloudConfig(config) {
  const provider = (config?.provider || 'supabase').toLowerCase();
  const normalized = provider === 'supabase' ? buildSupabaseConfig(config) : buildJsonblobConfig(config);
  localStorage.setItem(CLOUD_PROVIDER_KEY, normalized.provider);
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCloudConfig() {
  localStorage.removeItem(CLOUD_CONFIG_KEY);
  localStorage.removeItem(CLOUD_PROVIDER_KEY);
}

export function describeCloudConfig(config) {
  if (!config?.enabled) {
    return '尚未配置云同步；当前仅保存在本地浏览器。';
  }
  if (config.provider === 'supabase') {
    return `已配置 Supabase 同步：${config.url || 'Supabase 项目'}`;
  }
  return `已配置 JSONBlob 同步：${config.url}`;
}

function buildHeaders(config) {
  const headers = { Accept: 'application/json' };
  if (config.provider === 'supabase') {
    headers['apikey'] = config.key;
    headers['Authorization'] = `Bearer ${config.key}`;
  }
  return headers;
}

export async function loadCloudData(config) {
  if (!config?.enabled) return null;
  try {
    if (config.provider === 'supabase') {
      const endpoint = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?id=eq.${encodeURIComponent(config.recordId)}`;
      const response = await fetch(endpoint, { method: 'GET', headers: buildHeaders(config), cache: 'no-store' });
      if (!response.ok) return null;
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length) return null;
      return rows[0]?.payload ?? rows[0];
    }

    const response = await fetch(config.url, { cache: 'no-store' });
    if (!response.ok) return null;
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCloudData(config, snapshot) {
  if (!config?.enabled) return false;
  try {
    if (config.provider === 'supabase') {
      const tableEndpoint = `${config.url}/rest/v1/${encodeURIComponent(config.table)}`;
      const lookupEndpoint = `${tableEndpoint}?id=eq.${encodeURIComponent(config.recordId)}`;
      const lookupResponse = await fetch(lookupEndpoint, { method: 'GET', headers: buildHeaders(config), cache: 'no-store' });
      if (!lookupResponse.ok) return false;
      const rows = await lookupResponse.json();
      const body = { id: config.recordId, payload: snapshot };
      const headers = {
        ...buildHeaders(config),
        'Content-Type': 'application/json',
      };
      if (Array.isArray(rows) && rows.length) {
        const response = await fetch(lookupEndpoint, { method: 'PATCH', headers, body: JSON.stringify({ payload: snapshot }), cache: 'no-store' });
        return response.ok;
      }
      const response = await fetch(tableEndpoint, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
      return response.ok;
    }

    const response = await fetch(config.url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}
