// netlify/functions/list.js
// 资产名为 base64url 编码的逻辑路径，这里解码后返回给前端。
// 旧版直命名资产（无法解码）原样返回，保持兼容。

const { getAssets, tryDecodePath, REPO_OWNER, REPO_NAME, RELEASE_TAG } = require('./_utils');

exports.handler = async (event) => {
  try {
    const assets = await getAssets();
    const list = assets.map(a => {
      const decoded = tryDecodePath(a.name);
      const display = decoded !== null ? decoded : String(a.name || '').replace(/^\//, '');
      return {
        name: display,           // 逻辑路径（文件夹结构包含在其中）
        size: a.size,
        download_url: a.browser_download_url ||
          `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/${encodeURIComponent(a.name)}`
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
