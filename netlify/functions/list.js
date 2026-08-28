// netlify/functions/list.js
const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const API_BASE = 'https://api.github.com';

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

async function getAssets() {
  const releaseId = await getOrCreateRelease();
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets`;
  const resp = await fetch(url, { headers: getHeaders() });
  if (!resp.ok) throw new Error('获取资产列表失败');
  return resp.json();
}

exports.handler = async (event) => {
  try {
    const assets = await getAssets();
    const list = assets.map(a => {
      // 修正路径：移除可能的前导斜杠，统一为相对路径
      let name = a.name;
      if (name.startsWith('/')) name = name.slice(1);
      // 构建稳定的下载链接（即使 browser_download_url 缺失也可用）
      const download_url = a.browser_download_url || 
        `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/${encodeURIComponent(name)}`;
      return {
        name: name,
        size: a.size,
        download_url: download_url
      };
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ items: list })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
