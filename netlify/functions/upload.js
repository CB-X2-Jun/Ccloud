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

// netlify/functions/upload.js
const { getOrCreateRelease, getAssets } = require('./_utils'); // 如果提取了工具，否则直接复制

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 解析 multipart/form-data
    const form = await parseMultipart(event); // 需要自己实现或使用 busboy
    // 为了简化，这里假设前端将文件作为 base64 发送（推荐用二进制上传，但 Netlify Functions 处理 multipart 较复杂）
    // 我提供一个更简单的方式：前端将文件转为 base64，通过 JSON 发送
    const { path, content } = JSON.parse(event.body);
    // 注意：path 是完整路径（如 'folder/file.txt'）
    // content 是 base64 编码的文件内容

    const releaseId = await getOrCreateRelease();

    // 检查是否存在同路径资产，若存在则删除
    const assets = await getAssets();
    const exist = assets.find(a => a.name === path);
    if (exist) {
      await fetch(`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${exist.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    }

    // 上传新资产
    const uploadUrl = `${UPLOAD_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(path)}`;
    // 需要将 base64 转为 Buffer 并作为 multipart 发送，用 FormData
    const formData = new FormData();
    const buffer = Buffer.from(content, 'base64');
    formData.append('file', new Blob([buffer]), path);

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        // 不要设置 Content-Type，让浏览器自动设置为 multipart/form-data
      },
      body: formData
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`上传失败: ${resp.status} ${errText}`);
    }
    const data = await resp.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, asset: data })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
