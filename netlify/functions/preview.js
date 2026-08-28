// netlify/functions/preview.js
// 通过 GitHub API（带鉴权）按逻辑路径查找资产，
// 用 Accept: application/octet-stream 直接取回二进制内容，
// 避免拼接下载 URL 时资产名编码不一致的问题。

const {
  getAssets,
  getHeaders,
  findAssetByPath,
  isValidPath
} = require('./_utils');

// 根据扩展名返回 Content-Type
const CONTENT_TYPE_MAP = {
  'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'jpe': 'image/jpeg', 'jfif': 'image/jpeg',
  'png': 'image/png', 'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp',
  'bmp': 'image/bmp', 'ico': 'image/x-icon', 'tif': 'image/tiff', 'tiff': 'image/tiff',
  'avif': 'image/avif', 'heic': 'image/heic', 'heif': 'image/heif',
  'txt': 'text/plain; charset=utf-8', 'log': 'text/plain; charset=utf-8',
  'md': 'text/markdown; charset=utf-8', 'csv': 'text/csv; charset=utf-8',
  'json': 'application/json; charset=utf-8', 'xml': 'application/xml; charset=utf-8',
  'html': 'text/html; charset=utf-8', 'htm': 'text/html; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'js': 'text/javascript; charset=utf-8', 'mjs': 'text/javascript; charset=utf-8',
  'ts': 'text/plain; charset=utf-8', 'jsx': 'text/plain; charset=utf-8',
  'tsx': 'text/plain; charset=utf-8', 'vue': 'text/plain; charset=utf-8',
  'py': 'text/plain; charset=utf-8', 'java': 'text/plain; charset=utf-8',
  'c': 'text/plain; charset=utf-8', 'h': 'text/plain; charset=utf-8',
  'cpp': 'text/plain; charset=utf-8', 'hpp': 'text/plain; charset=utf-8',
  'cc': 'text/plain; charset=utf-8', 'hh': 'text/plain; charset=utf-8',
  'cs': 'text/plain; charset=utf-8', 'go': 'text/plain; charset=utf-8',
  'rs': 'text/plain; charset=utf-8', 'php': 'text/plain; charset=utf-8',
  'rb': 'text/plain; charset=utf-8', 'swift': 'text/plain; charset=utf-8',
  'kt': 'text/plain; charset=utf-8', 'kts': 'text/plain; charset=utf-8',
  'dart': 'text/plain; charset=utf-8', 'lua': 'text/plain; charset=utf-8',
  'r': 'text/plain; charset=utf-8', 'sql': 'text/plain; charset=utf-8',
  'sh': 'text/plain; charset=utf-8', 'bash': 'text/plain; charset=utf-8',
  'zsh': 'text/plain; charset=utf-8', 'ps1': 'text/plain; charset=utf-8',
  'bat': 'text/plain; charset=utf-8', 'cmd': 'text/plain; charset=utf-8',
  'asm': 'text/plain; charset=utf-8', 's': 'text/plain; charset=utf-8',
  'pl': 'text/plain; charset=utf-8', 'pm': 'text/plain; charset=utf-8',
  'scala': 'text/plain; charset=utf-8', 'groovy': 'text/plain; charset=utf-8',
  'gradle': 'text/plain; charset=utf-8', 'ini': 'text/plain; charset=utf-8',
  'conf': 'text/plain; charset=utf-8', 'cfg': 'text/plain; charset=utf-8',
  'yaml': 'text/yaml; charset=utf-8', 'yml': 'text/yaml; charset=utf-8',
  'toml': 'text/plain; charset=utf-8', 'properties': 'text/plain; charset=utf-8',
  'env': 'text/plain; charset=utf-8', 'makefile': 'text/plain; charset=utf-8',
  'mk': 'text/plain; charset=utf-8', 'cmake': 'text/plain; charset=utf-8',
  'dockerfile': 'text/plain; charset=utf-8',
  'tex': 'application/x-tex', 'bib': 'text/plain; charset=utf-8',
  'srt': 'text/plain; charset=utf-8', 'ass': 'text/plain; charset=utf-8',
  'vtt': 'text/vtt; charset=utf-8',
  'pdf': 'application/pdf',
  'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
  'aac': 'audio/aac', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
  'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
  'mkv': 'video/x-matroska', 'avi': 'video/x-msvideo',
};

exports.handler = async (event) => {
  const { path } = event.queryStringParameters || {};
  if (!path) {
    return { statusCode: 400, body: JSON.stringify({ error: '缺少 path 参数' }) };
  }
  if (!isValidPath(path)) {
    return { statusCode: 400, body: JSON.stringify({ error: '非法路径' }) };
  }

  try {
    const assets = await getAssets();
    const asset = findAssetByPath(assets, path);
    if (!asset) {
      return { statusCode: 404, body: JSON.stringify({ error: '文件不存在' }) };
    }

    // 通过资产 API 地址取原始二进制（Accept: octet-stream）
    const resp = await fetch(asset.url, {
      headers: getHeaders({ 'Accept': 'application/octet-stream' })
    });
    if (!resp.ok) {
      throw new Error(`获取文件内容失败 (${resp.status})`);
    }

    const buffer = Buffer.from(await resp.arrayBuffer());

    const ext = path.split('.').pop()?.toLowerCase() || '';
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
