# Ccloud — 基于 GitHub Release + Netlify Functions 的个人云盘

前端（index.html）+ Netlify Functions（netlify/functions/）+ GitHub Release 资产存储。

## 环境变量（Netlify 后台配置）

| 变量 | 说明 |
|---|---|
| `GITHUB_TOKEN` | 具有 Ccloud-files 仓库写权限的 PAT |
| `ADMIN_PASSWORD` | 删除文件的密码 |
| `REPO_OWNER` / `REPO_NAME` / `RELEASE_TAG` | 可选，默认 `CB-X2-Jun` / `Ccloud-files` / `cloud-files` |

## 存储架构（重要）

- **资产名 = base64url(完整逻辑路径)**。GitHub 会强制改名含斜杠/特殊字符的资产文件名
  （例如 `docs/.keep` 会被改成 `docs.keep`），因此路径必须整体编码为
  只含 `[A-Za-z0-9_-]` 的 base64url 字符串再上传，读取时解码还原。
- **上传必须用 raw binary**（`Content-Type: application/octet-stream` + 原始字节体）。
  GitHub uploads 端点不解析 multipart/form-data，用 FormData 上传会把整个
  multipart 报文（含 formdata-undici 边界、Content-Disposition 头）存进文件内容，
  造成文件头尾污染。旧版因此损坏过所有文件。
- **文件夹**通过 `.keep` 占位资产实现（路径 `文件夹名/.keep` 编码后上传）。
- 旧版直命名资产（未编码）在 list.js 中原样显示，仍可删除/覆盖。

## 已知限制

- Netlify Function 请求/响应体上限约 6MB，base64 膨胀 1/3 后，
  **单文件上传/代理下载上限约 4MB**；更大文件回退 GitHub 直链下载
  （直链保存的文件名会是编码后的资产名）。
- Release 资产列表已做分页（每页 100，最多 50 页）。
