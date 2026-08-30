# 存储：没有新增专用数据库表

Gallery 没有新增专用数据库表。它使用一个私有 Supabase Storage bucket，同时保存图片和 JSON 元数据。

```text
private-gallery/users/<user-id>/
├── images/<sha256>.<ext>
├── meta/<sha256>.json
└── claims/<sha256>.json
```

每个对象都放在 `users/<user-id>/` 下。即使后端路径拼装出现疏漏，代码也更容易审计出跨用户访问；所有列表、下载、改名与复用操作都从已验证 access token 中取得 user id，而不是信任请求 body 里的 `userId`。

## 元数据

```json
{
  "id": "a3f8c1…",
  "content_hash": "a3f8c1…",
  "storage_path": "users/<uid>/images/a3f8c1….jpg",
  "media_type": "image/jpeg",
  "width": 1280,
  "height": 960,
  "title": "窗台上的橘猫",
  "first_description": "画面中央是一只橘色短毛猫……",
  "first_impression": "今天看到它的时候，我忽然安静了一点。",
  "first_sent_at": null,
  "send_count": 0,
  "created_at": "2026-08-30T00:00:00.000Z",
  "updated_at": "2026-08-30T00:00:00.000Z"
}
```

元数据不保存永久公开 URL。`GET /api/gallery` 每次读取元数据后生成短期 `signed_url`，过期后客户端重新加载即可。

## 为什么 JSON 足够

对几十到几百张私人收藏，目录列表加 JSON 下载足够直观，也省掉一套表、迁移和行级策略。但它有明确代价：列表要读取多个对象、按字段筛选很弱、计数更新需要额外并发控制。

当数量进入数千、需要全文搜索或多条件筛选时，可以增加一张索引表或外部搜索索引。图片本体仍放 Storage。那是规模带来的演进，不应被包装成“永远不需要数据库”。

## 哈希能做什么，不能做什么

`sha256(buffer)` 对完全相同的字节稳定，因此可以作为对象名和精确去重键。它不理解视觉内容：同一张图经过 JPEG 重新压缩、PNG 转 WebP、缩放、旋转、去 EXIF 或截图后，字节改变，哈希也会改变。

如果产品需要“视觉相同”去重，可另做感知哈希或 embedding 相似度，并把它作为候选提示而不是自动删除依据。相似图并不一定是重复图，误合并通常比多存一份更难恢复。

## 为什么还有 claims

两个请求可能同时发现 `meta/<hash>.json` 不存在。示例用 `upload(..., { upsert: false })` 原子创建 `claims/<hash>.json`：只有一个请求成为写入者，其他请求短暂轮询元数据。

claim 在成功或已处理的失败后删除。进程若中途崩溃，会留下过期 claim 或孤儿图片；[安全与故障恢复](06-supabase-security.md)中的脚本负责报告和清理。

