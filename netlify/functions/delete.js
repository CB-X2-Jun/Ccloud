// netlify/functions/delete.js
// 按逻辑路径删除资产（base64url 编码匹配，兼容旧版直命名资产）

const {
  REPO_OWNER,
  REPO_NAME,
  API_BASE,
  getHeaders,
  getAssets,
  findAssetByPath,
  isValidPath
} = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { path, password } = JSON.parse(event.body);
    if (password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 403, body: JSON.stringify({ error: '密码错误' }) };
    }
    if (!isValidPath(path)) {
      return { statusCode: 400, body: JSON.stringify({ error: '非法路径' }) };
    }

    const assets = await getAssets();
    const exist = findAssetByPath(assets, path);
    if (!exist) {
      return { statusCode: 404, body: JSON.stringify({ error: '文件不存在' }) };
    }

    const delUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${exist.id}`;
    const resp = await fetch(delUrl, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!resp.ok) throw new Error(`删除失败 (${resp.status})`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
