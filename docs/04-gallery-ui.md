# Gallery UI：浏览、详情与改名

示例 UI 保持轻量：登录、上传并聊天、两列图片网格、详情面板和“带去聊天”。它没有依赖私人项目的导航、样式变量或移动端壳。

## 加载列表

客户端把 Supabase access token 放进 Authorization header：

```js
const response = await fetch(`${apiUrl}/api/gallery`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

服务端验证 token 后只列出 `users/<token-user-id>/meta/`，再为当前页图片创建短期签名 URL。客户端不拼 Storage 公共地址。

## 网格

```jsx
<div className="gallery-grid">
  {items.map((item) => (
    <button key={item.id} onClick={() => setSelected(item)}>
      <img src={item.signed_url} alt={item.title || '收藏图片'} />
      <span>{item.title || '一张图片'}</span>
    </button>
  ))}
</div>
```

CSS `columns: 2` 让不同比例的图片自然填充。真实产品还应加入分页、图片懒加载、签名 URL 过期刷新、加载失败占位与键盘焦点管理。

## 详情

详情同时展示两种记忆：

- `first_description`：中性的可见事实，是复用时的有损语义替身。
- `first_impression`：人格在第一次看到时留下的主观反应。

两者要有清楚的视觉标签，避免用户把主观印象误当成图像事实。

## 改名与删除

示例提供经过鉴权的 `PATCH /api/gallery/:id`，服务端重新读取当前用户条目，只允许修改经过长度限制的标题。

示例故意没有给浏览器提供删除接口。删除涉及图片、元数据、claim、聊天引用和审计，是一个多对象操作；最小教程若给出裸 `DELETE`，很容易被无鉴权复制。生产产品需要删除时，应加入重新认证或明确确认、所有权校验、速率限制、审计记录和可恢复窗口。

