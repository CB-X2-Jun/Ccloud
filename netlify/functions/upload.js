// netlify/functions/upload.js
// 修复说明：
// 旧版用 FormData（multipart/form-data）上传，GitHub uploads 端点
// 不解析 multipart，会把整个报文（含 formdata-undici 边界、
// Content-Disposition 头）原样存成文件内容，导致文件头尾被污染。
// GitHub 官方文档要求：资产数据必须以 raw binary 作为请求体，
// 并设置 Content-Type: application/octet-stream。
// 另外资产名采用 base64url 编码的完整路径，规避 GitHub 对资产名中
// 斜杠/特殊字符的强制改名。

const {
  REPO_OWNER,
  REPO_NAME,
  API_BASE,
  UPLOAD_BASE,
  getHeaders,
  getOrCreateRelease,
  getAssets,
  encodePath,
  findAssetByPath,
  isValidPath
} = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { path, content } = JSON.parse(event.body);
    if (!path || content === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: '缺少 path 或 content 字段' }) };
    }
    if (!isValidPath(path)) {
      return { statusCode: 400, body: JSON.stringify({ error: '非法路径' }) };
    }

    const releaseId = await getOrCreateRelease();

    // 同名资产（含旧版直命名）存在则先删除，避免 422 冲突
    const assets = await getAssets();
    const exist = findAssetByPath(assets, path);
    if (exist) {
      await fetch(`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${exist.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    }

    // base64 -> 二进制缓冲
    const buffer = Buffer.from(content, 'base64');

    // 资产名 = base64url(逻辑路径)，只含 [A-Za-z0-9_-]，GitHub 不会改名
    const assetName = encodePath(path);
    const uploadUrl = `${UPLOAD_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;

    // 关键修复：raw binary 直传（不要用 FormData / multipart）
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/octet-stream' }),
      body: buffer
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`上传失败 (${resp.status}): ${errText.slice(0, 300)}`);
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
