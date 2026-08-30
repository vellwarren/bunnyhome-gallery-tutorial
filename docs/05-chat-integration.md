# 聊天接入：第一次看像素，以后读记忆

聊天输入只需要增加三个状态：待发送的新图片、是否收藏、从 Gallery 选中的条目 id。

```js
const body = galleryItem
  ? { message, gallery_image_id: galleryItem.id }
  : { message, image: preparedImage, save_to_gallery: saveToGallery };
```

不要让客户端提交 `first_description`、`storage_path` 或 `user_id`。这些字段都由经过鉴权的服务端读取或生成。

## 新图片

当 `save_to_gallery` 为真：

1. 人格模型使用图片正常回应，并调用私有元数据工具。
2. 中性视觉请求并行整理图片。
3. 两边成功后保存 Gallery；保存失败不抹掉正常聊天回复。
4. 返回 `gallery_saved`，客户端刷新列表。

若用户没有收藏，图片只参与当前轮模型请求，不写 Storage。

## 已有 Gallery 图片

服务端根据 token 的 user id 和 `gallery_image_id` 读取元数据。第一次发送下载私有图片；之后默认只注入语义记忆。客户端传来的 `isFirstSend` 只能用于界面提示，不能成为服务端判定依据。

## 人格与整理的边界

人格可以说“又看到它了”，也可以对当下语境产生新的反应；但它不应该把 `first_impression` 当作必须重复的台词。中性描述也不应该进入可见回复成为生硬目录。

真正要保留的是两个层次：稳定、有限、可检索的视觉整理；以及会随关系和当下语境变化的人格反应。

## 与现有消息系统连接

这个示例不创建消息表。你的聊天系统若已经有 `messages` 表，可以在用户消息的 JSON 元数据中保存 `gallery_image_id`。历史加载时再按 id 水合 Gallery 条目；找不到就返回 `{ deleted: true }` 占位。

如果你没有消息持久化，也可以只运行本示例：当前聊天显示在浏览器内存里，Gallery 本身仍会持久保存。

