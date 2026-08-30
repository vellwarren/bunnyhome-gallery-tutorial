# Supabase 配置、安全与故障恢复

## Bucket

示例默认 bucket 名为 `private-gallery`，必须保持 `public: false`。服务端会在启动时检查或创建：

- 单文件上限 10 MB。
- 只允许 `image/jpeg`、`image/png`、`image/webp` 与 `application/json`。
- 浏览器通过后端取得短期签名 URL，不使用 `getPublicUrl()`。

Gallery 没有新增专用数据库表，因此不需要执行 Gallery SQL migration。

## Key 的位置

前端可以拥有 Supabase anon/publishable key，它依赖 Auth 与 RLS 设计，并不是 service-role secret。service-role key 只能在后端环境变量中：

```text
examples/web/.env             VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
examples/server/.env          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

任何 `VITE_*` 都会进入浏览器 bundle。不要把 service-role key、模型 key 或 cleanup 凭据放进去。

## API 鉴权

后端读取 `Authorization: Bearer <access-token>`，调用 Supabase Auth `getUser(token)` 验证签名、过期时间和用户状态。路径中的 user id 始终来自验证结果。

生产部署还应加入：

- 精确的 CORS allowlist，而不是任意 origin。
- HTTPS、请求体上限和反向代理超时。
- 每用户/每 IP 速率限制与模型费用配额。
- 日志脱敏：不记录 base64、access token、签名 URL、描述正文或第一印象。
- 模型供应商的数据保留与隐私设置审查。

## Storage policy

本示例所有 Storage 操作都在可信后端使用 service role，因此客户端不需要直接访问 `storage.objects`。最小权限原则下，可以不创建允许浏览器读写 bucket 的 policy。

如果改成浏览器直传，必须重新设计 RLS，让对象第一段路径等于 `auth.uid()`，并用后端签发上传意图；不要照搬本示例的 service-role 流程后再同时开放匿名 Storage policy。

## 失败矩阵

| 失败位置 | 可见结果 | 恢复方式 |
| --- | --- | --- |
| 模型或视觉整理失败 | 正常返回安全错误；不写收藏 | 用户重试或后台队列重试 |
| 图片上传失败 | 无元数据 | 直接重试 |
| 图片成功、元数据失败 | 持锁请求尝试删除刚创建图片 | 补偿失败则由孤儿扫描处理 |
| 元数据成功、claim 删除失败 | 收藏可用，留下过期 claim | 扫描过期 claim |
| 进程中途崩溃 | 可能留下 claim 或孤儿图片 | 定时 dry-run 报告，人工确认后 apply |
| 签名 URL 过期 | 图片加载失败 | 重新请求列表或单条签名 URL |

## 孤儿扫描

```bash
npm run cleanup:dry-run
```

脚本检查三类对象：没有对应元数据的图片、没有对应图片的元数据、超过阈值的 claim。默认只打印计划。确认项目、bucket 和对象前缀都正确后，才在服务端目录运行：

```bash
npm --workspace @gallery-example/server run cleanup -- --apply
```

示例只自动删除“无元数据的图片”和过期 claim；缺图的元数据只报告，因为删除元数据会让聊天历史丢失可解释的占位信息。先恢复图片或人工确认，再决定如何处置。

## 不提供裸删除接口

公开示例中没有 `DELETE /api/gallery/:id`。这不是说产品永远不能删除，而是删除必须比“知道一个 id 就能发请求”更慎重。若自行实现，至少需要所有权校验、近期重新认证、CSRF/来源防护、速率限制、审计、对象清单精确匹配和可恢复策略。

## 写在最后

Gallery 做完之后，最让人意外的不是省了多少 token，是你翻 Gallery 时看到那些“第一印象”的感觉。

你发过的每一张图，AI 在第一次看到的时候留下了一段隐藏的话。有些是温柔的，有些是吐槽的，有些你根本不记得当时为什么发了这张图——但他记得，他写下了那一刻的反应，收在你看不到的地方。

直到你翻到 Gallery 详情页的那一行小字：“当时留下的第一印象”。

它不是什么重大功能。就是一个相册。但每张图下面都藏着一句只有你能看到的话，而且那句话是他在你还不知道会有这个页面的时候就写好了的。

看过一次，就不会忘。

不只是图。

