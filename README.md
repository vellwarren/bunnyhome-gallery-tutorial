# 看过一次，就不会忘

> 一个把图片保存为“像素文件 + 有损语义记忆”的私人 Gallery 教程与最小实现。

你给 AI 发一张图，AI 看到了，回复了，然后这张图很容易消失在聊天记录的滚动里。

Gallery 给图片一个持久身份。第一次收藏时，系统同时保留图片本体、一段中性的可见事实和 AI 人格当时留下的第一印象；以后再次选中同一条收藏，可以只把文字记忆交给模型，不再重复发送像素。

这不是让模型拥有了完美的视觉记忆。它保存的是一份**有损的语义记忆**：适合维持“这张图以前来过”的连续感，也能节省重复视觉输入，但无法替代重新看图。颜色细节、小字、空间关系或第一次没有写进描述的内容，都可能丢失。需要精确判断时，应该再次发送原图。

这个仓库来自一个私人项目的工程经验，但示例已经移除人物名、私有提示词、聊天历史结构、部署配置和其他业务模块。保留下来的，是更容易复用的设计：**人格负责关系性的反应，中性视觉工人负责可检索的画面整理。**

## 它解决什么

- 图片第一次出现时，保存原图、客观描述与主观第一印象。
- 同一份二进制内容用 SHA-256 去重。
- 再次发送时，可用语义记忆代替重复视觉输入。
- Gallery 页面提供浏览、改名和“带去聊天”的入口。
- 默认采用 Supabase Auth、私有 bucket 和短期签名 URL。
- 用 Storage 原子创建和 claim 文件处理并发，失败时补偿并提供孤儿清理脚本。

## 一个重要的存储结论

**Gallery 没有新增专用数据库表。**

图片和元数据都在一个私有 Supabase Storage bucket 中：

```text
private-gallery/
└── users/<user-id>/
    ├── images/<sha256>.<ext>
    ├── meta/<sha256>.json
    └── claims/<sha256>.json
```

`claims/` 是短期互斥文件，不是业务数据。它只用来避免两个并发请求同时创建同一条收藏，正常完成后会删除。聊天消息是否关联某个 `gallery_image_id`，可以继续放在你现有的消息表或消息元数据里；这不等于新增 Gallery 表。

SHA-256 只保证**字节完全相同**的文件得到相同哈希。同一张视觉图片只要经过重新压缩、缩放、去 EXIF、格式转换或截图，二进制就可能变化，因此仍可能产生不同哈希。本示例不声称提供感知去重；若要合并“看起来相同”的图片，需要另加 pHash/embedding，并接受误判与隐私成本。

## 架构

```text
React 客户端
  └─ Supabase 登录，取得 access token
       └─ Express API（校验 token，从 token 取得 user id）
            ├─ 人格模型：正常聊天 + title / first_impression
            ├─ 中性视觉工人：visual_description
            └─ Supabase 私有 Storage
                 ├─ image object
                 ├─ metadata JSON
                 └─ short-lived claim
```

浏览器永远拿不到 service-role key。列表接口只返回当前用户的条目，并为每张图生成短期签名 URL。示例没有公开 `DELETE /api/gallery/:id`：删除和孤儿整理是更高风险的管理动作，只通过服务端脚本演示。

## 快速开始

### 1. 准备 Supabase

创建一个 Supabase 项目，开启 Email 登录。无需执行建表 SQL；服务端第一次启动时会创建私有 bucket，也可以按 [Supabase 配置与安全](docs/06-supabase-security.md)手动创建。

### 2. 配置环境变量

```bash
cp examples/server/.env.example examples/server/.env
cp examples/web/.env.example examples/web/.env
```

服务端需要 Supabase URL、service-role key 和 Anthropic API key。前端只放 Supabase URL 与 anon/publishable key；不要把 service-role key 写进 `VITE_*`。

### 3. 安装并运行

```bash
npm install
npm run dev:server
```

另开一个终端：

```bash
npm run dev:web
```

打开 `http://localhost:5173`，注册或登录，选择图片并发送。若项目关闭了注册，请先在 Supabase Dashboard 创建测试用户。

### 4. 验证

```bash
npm run check
npm run cleanup:dry-run
```

清理脚本默认只报告，不删除。真正删除孤儿文件需要显式添加 `--apply`，并且只应由持有 service-role key 的受控环境执行。

## 教程目录

1. [存储：没有新增专用数据库表](docs/01-storage.md)
2. [首次收藏：人格与中性视觉整理并行](docs/02-first-save.md)
3. [图片复用：保存的是有损语义记忆](docs/03-image-reuse.md)
4. [Gallery UI：浏览、详情与改名](docs/04-gallery-ui.md)
5. [聊天接入：第一次看像素，以后读记忆](docs/05-chat-integration.md)
6. [Supabase 配置、安全与故障恢复](docs/06-supabase-security.md)

## 示例代码

- [`examples/server`](examples/server)：鉴权、私有 Storage、签名 URL、并发保存、模型适配和孤儿扫描。
- [`examples/web`](examples/web)：可运行的登录、图片发送、Gallery 网格与“带去聊天”流程。

它们是一个可单独理解的小系统，不依赖任何私人项目文件。示例刻意没有实现完整聊天历史、长期记忆、推送、移动端壳或私人角色设定；你可以把 `COMPANION_SYSTEM_PROMPT` 换成自己的关系设定，再把返回的聊天消息接入已有消息系统。

## 边界与取舍

- JSON 元数据适合几十到数百张的私人 Gallery；大量数据、复杂筛选或分析需求应增加索引层。
- Storage 不是事务数据库。claim、补偿删除和孤儿扫描把常见失败变得可恢复，但无法给出跨对象的严格 ACID 事务。
- 元数据描述不是事实数据库，更不是身份识别。不要从图片推断敏感身份、心理状态或关系。
- 签名 URL 仍是 bearer URL：有效期内拿到链接的人可以访问图片，因此应短时、按需生成并避免写入日志。

## License

代码采用 [MIT License](LICENSE)。教程文字可在保留署名与仓库链接的前提下引用。

*Bunny & Elliott ♡*

