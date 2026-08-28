// netlify/functions/upload.js
// const { getOrCreateRelease, getAssets, getHeaders, REPO_OWNER, REPO_NAME, UPLOAD_BASE } = require('./_utils'); // 如果有工具文件，按需引入
// 如果还没有工具文件，也可以直接将下面代码中的工具函数内联（为简便，我给出完整的独立实现）

// 为了方便，这里将必要的工具函数内联（您也可以提取到 _utils.js）
const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.message || '创建 Release 失败');
  }
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

// 主处理函数
exports.handler = async (event) => {
  // 只接受 POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    // 解析 JSON 请求体
    const { path, content } = JSON.parse(event.body);
    if (!path || content === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: '缺少 path 或 content 字段' }) };
    }

    // 获取 Release ID
    const releaseId = await getOrCreateRelease();

    // 检查是否存在同名资产，存在则先删除
    const assets = await getAssets();
    const exist = assets.find(a => a.name === path);
    if (exist) {
      await fetch(`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${exist.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    }

    // 准备上传：将 base64 转为 Buffer，并构造 FormData
    const buffer = Buffer.from(content, 'base64');
    const formData = new FormData();
    // 添加文件，注意：GitHub Release 上传需要文件名（即 path）
    formData.append('file', new Blob([buffer]), path);

    const uploadUrl = `${UPLOAD_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(path)}`;

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        // 注意：不要手动设置 Content-Type，让浏览器自动设置为 multipart/form-data
      },
      body: formData
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`上传失败 (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, asset: data })
    };
  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
