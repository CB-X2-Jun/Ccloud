// netlify/functions/preview.js
const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

exports.handler = async (event) => {
  const { path } = event.queryStringParameters || {};
  if (!path) {
    return { statusCode: 400, body: JSON.stringify({ error: '缺少 path 参数' }) };
  }

  try {
    // 构造下载 URL（使用固定格式，无需 token）
    const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/${encodeURIComponent(path)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`获取文件失败 (${resp.status})`);
    }
    const content = await resp.text();
    return {
      statusCode: 200,
      body: JSON.stringify({ content })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
