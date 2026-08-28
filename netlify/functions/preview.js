// netlify/functions/preview.js
const REPO_OWNER = process.env.REPO_OWNER || 'CB-X2-Jun';
const REPO_NAME = process.env.REPO_NAME || 'Ccloud-files';
const RELEASE_TAG = process.env.RELEASE_TAG || 'cloud-files';

exports.handler = async (event) => {
    const { path } = event.queryStringParameters || {};
    if (!path) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少 path 参数' }) };
    }

    try {
        // 构造下载 URL
        const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/${encodeURIComponent(path)}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`获取文件失败 (${resp.status})`);
        }

        // 获取文件内容为 ArrayBuffer（二进制安全）
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 根据文件扩展名设置 Content-Type
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const contentTypeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon',
            'txt': 'text/plain',
            'log': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'py': 'text/x-python',
            'cpp': 'text/x-c++src',
            'hpp': 'text/x-c++hdr',
            'java': 'text/x-java',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            },
            // 返回二进制数据（Base64 编码，Netlify Functions 要求）
            body: buffer.toString('base64'),
            isBase64Encoded: true,  // 关键！告诉 Netlify 这是 Base64 编码的二进制数据
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
