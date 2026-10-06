# 生图反向代理与中转服务排障手册

## 背景
在使用无限画布（Infinite Canvas）调用下游中转（如 CCH / One API / New API）或官方/自建 API（如 Codex2API）生成图片时，如果出现图片生成失败或特定协议报错，可参考本手册排查与解决。

---

## 经典案例：ERR_HTTP2_ERROR / Protocol error (102 Processing 导致流中断)

### 1. 现象描述
- **无限画布前端**：节点提示 `所有供应商暂时不可用，请稍后重试 (503)` 或任务直接超时失败。
- **中转站（CCH 等）日志**：
  ```text
  错误类型: provider-chain.errors.ERR_HTTP2_ERROR
  错误: Protocol error
  请求耗时: 30s ~ 45s
  含义: provider-chain.errors.ERR_HTTP2_ERROR
  ```
- **上游服务提供方（Codex2API 等）控制台**：显示生成状态为绿色的 `200 OK`，实际上在后端已经成功生成了图片并消耗了额度。

---

### 2. 根本原因剖析
1. **102 Processing 机制**：
   - Codex2API 在处理耗时较长的生图请求时，为了防止中间连接被网关超时掐断，会先发出 `102 Processing` 临时状态头保持连接。
   - 生图完成后（约 20~40 秒），再发送正式的 `200 OK` 以及 2MB~4MB 的 Base64 图片 JSON 报文。
2. **HTTP/2 客户端（Node.js / Go）兼容性 Bug**：
   - 当上游站点启用了 HTTP/2（`http2 on;`）时，客户端在同一个 HTTP/2 流中先收到 `102` 随后再收到最终的 `200` 报头，部分 HTTP/2 实现（尤其 Node.js 原生 http2 模块）会将其判定为非法状态转移或帧格式不符，触发 `PROTOCOL_ERROR (err 1)` 并主动断开连接。
3. **HTTP/1.1 完全正常**：
   - 走 HTTP/1.1 标准协议传输时，`102 Processing` 能被完全透明放行，几 MB 的大 Base64 数据返回 100% 顺畅。

---

### 3. 推荐解决措施

#### 措施一：在 Codex2API 站点关闭 HTTP/2（强制 HTTP/1.1）
如果您的 Codex2API 使用 Nginx / 宝塔面板进行反向代理：
1. 打开 Codex2API 站点的 Nginx 配置文件。
2. 将 `listen` 处的 `http2 on;` 移除或改为 `http2 off;`：
   ```nginx
   listen 80;
   listen 443 ssl;
   http2 off;
   ```
3. 保存并重载 Nginx（`nginx -s reload`）。

#### 措施二：调整 Nginx 全局大响应缓冲与超时设置
由于 AI 图片生成通常携带 2MB ~ 10MB 的 Base64 JSON 载荷，并且耗时常在 20 秒 ~ 120 秒，反向代理服务器需扩容缓冲区并拉长超时时间：
```nginx
# 允许大体积图片/素材上传与下载
client_max_body_size 200m;
client_body_buffer_size 10m;
client_header_buffer_size 64k;
large_client_header_buffers 4 128k;

# 超时时间放宽至 10 分钟（600 秒）
proxy_connect_timeout 300s;
proxy_read_timeout 600s;
proxy_send_timeout 600s;

# 启用反代缓冲并扩容，承载大 Base64 图片返回
proxy_buffering on;
proxy_buffer_size 256k;
proxy_buffers 8 512k;
proxy_busy_buffers_size 1024k;
proxy_temp_file_write_size 1024k;
proxy_max_temp_file_size 1024m;
```
