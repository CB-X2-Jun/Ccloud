// utils.js 可单独提取，但为减少文件，这里在每个函数中复制基础工具函数

const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const API_BASE = 'https://api.github.com';
const UPLOAD_BASE = 'https://uploads.github.com';

// 通用请求头
function getHeaders(additional = {}) {
  return {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    ...additional
  };
}

// 获取或创建 Release（返回 release id）
async function getOrCreateRelease() {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`;
  let resp = await fetch(url, { headers: getHeaders() });
  if (resp.ok) {
    const data = await resp.json();
    return data.id;
  }
  // 创建
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
  if (!resp.ok) throw new Error('创建 Release 失败');
  const data = await resp.json();
  return data.id;
}

// 获取所有资产
async function getAssets() {
  const releaseId = await getOrCreateRelease();
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets`;
  const resp = await fetch(url, { headers: getHeaders() });
  if (!resp.ok) throw new Error('获取资产列表失败');
  return resp.json();
}
// netlify/functions/delete.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { path, password } = JSON.parse(event.body);
    if (password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 403, body: JSON.stringify({ error: '密码错误' }) };
    }

    const assets = await getAssets();
    const exist = assets.find(a => a.name === path);
    if (!exist) {
      return { statusCode: 404, body: JSON.stringify({ error: '文件不存在' }) };
    }

    const delUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${exist.id}`;
    const resp = await fetch(delUrl, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!resp.ok) throw new Error('删除失败');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
