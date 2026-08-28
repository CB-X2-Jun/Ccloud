// netlify/functions/_utils.js
// 共享工具模块（文件名以下划线开头，Netlify 不会将其暴露为 Function）
//
// 【架构说明】
// GitHub Release 资产名会被 GitHub 自动改名（删除斜杠、替换特殊字符、
// 去掉首尾句点），因此「直接用 路径/文件名 作为资产名」不可行。
// 解决方案：把完整的逻辑路径（如 "docs/照片.jpg"）用 base64url 编码后
// 作为资产名上传。base64url 只含 [A-Za-z0-9_-]，GitHub 不会改动它，
// 从而实现无损往返。

const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const API_BASE = 'https://api.github.com';
const UPLOAD_BASE = 'https://uploads.github.com';

function getHeaders(additional = {}) {
  return {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    ...additional
  };
}

async function getOrCreateRelease() {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`;
  let resp = await fetch(url, { headers: getHeaders() });
  if (resp.ok) {
    const data = await resp.json();
    return data.id;
  }
  // 不存在则创建
  const createUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
  const body = {
    tag_name: RELEASE_TAG,
    name: `Cloud Files (${RELEASE_TAG})`,
    body: '自动创建，用于云盘存储',
    draft: false,
    prerelease: false
  };
  resp = await fetch(createUrl, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    let msg = '创建 Release 失败';
    try {
      const err = await resp.json();
      msg = err.message || msg;
    } catch (_) { /* ignore */ }
    throw new Error(`${msg} (${resp.status})`);
  }
  const data = await resp.json();
  return data.id;
}

// 获取全部资产（自动分页，GitHub 单页最多 100 条）
async function getAssets() {
  const releaseId = await getOrCreateRelease();
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?per_page=100&page=${page}`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) throw new Error(`获取资产列表失败 (${resp.status})`);
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

// 逻辑路径 -> 资产名（base64url，GitHub 改名规则无法破坏）
function encodePath(path) {
  return Buffer.from(String(path), 'utf8').toString('base64url');
}

// 资产名 -> 逻辑路径；如果不是合法的 base64url 编码（如旧版直命名资产），返回 null
function tryDecodePath(name) {
  if (typeof name !== 'string' || !name || !/^[A-Za-z0-9_-]+$/.test(name)) return null;
  try {
    const decoded = Buffer.from(name, 'base64url').toString('utf8');
    // 往返校验：重新编码后必须与原名一致，否则视为普通文件名
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== name) return null;
    if (decoded.includes('\uFFFD')) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

// 资产的显示名（逻辑路径）；旧版资产退回原始名
function displayNameOf(asset) {
  const decoded = tryDecodePath(asset.name);
  if (decoded !== null) return decoded;
  return String(asset.name || '').replace(/^\//, '');
}

// 按逻辑路径查找资产（兼容旧版直命名资产）
function findAssetByPath(assets, path) {
  const encoded = encodePath(path);
  return assets.find(a => a.name === encoded || a.name === path ||
    tryDecodePath(a.name) === path);
}

// 校验逻辑路径合法性（防注入 / 防路径穿越）
function isValidPath(path) {
  if (typeof path !== 'string' || !path || path.length > 500) return false;
  if (path.startsWith('/') || path.endsWith('/')) return false;
  const parts = path.split('/');
  return parts.every(p => p !== '' && p !== '.' && p !== '..');
}

module.exports = {
  REPO_OWNER,
  REPO_NAME,
  RELEASE_TAG,
  GITHUB_TOKEN,
  ADMIN_PASSWORD,
  API_BASE,
  UPLOAD_BASE,
  getHeaders,
  getOrCreateRelease,
  getAssets,
  encodePath,
  tryDecodePath,
  displayNameOf,
  findAssetByPath,
  isValidPath
};
