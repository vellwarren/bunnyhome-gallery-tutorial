# 图片复用：保存的是有损语义记忆

Gallery 最省成本的部分发生在第二次。

## 第一次带去聊天

仅收藏、尚未进入聊天的条目，`first_sent_at` 为 `null`。第一次点击“带去聊天”时，后端从私有 Storage 下载原图并把像素交给模型。模型成功处理后，后端在互斥锁内更新：

```js
first_sent_at = first_sent_at ?? now;
send_count += 1;
```

更新也需要 claim，否则两个并发发送可能丢失一次计数。

## 再次带去聊天

已有 `first_sent_at` 时，示例默认不下载原图，而是注入如下私有上下文：

```text
[saved gallery image — previously seen]
The user sent the saved image “窗台上的橘猫”.
Lossy semantic memory from its first viewing: 画面中央是一只橘色短毛猫……
Treat it as the same saved item returning. Do not claim to be inspecting pixels now.
```

这里故意写 `Lossy semantic memory`。模型不是“仍然看见每一个像素”，只是读到第一次整理出的有限描述。这个区分能避免两种夸张：一是声称模型拥有无损视觉记忆，二是让模型在没有图片时假装重新检查了细节。

## 什么时候必须重发原图

- 用户问第一次描述没有覆盖的小字、颜色或角落细节。
- 图片可能在收藏后被外部替换或编辑。
- 任务涉及 OCR、计数、测量、医学、法律或其他高准确性判断。
- 用户明确要求“再看一次原图”。

可以在产品里提供“重新看原图”按钮，让用户主动选择精度与成本。重新看不必覆盖 `first_description`；更安全的做法是保留初见记录，另存一次新的观察或只用于本轮回答。

## 删除后的历史

本示例不暴露删除 HTTP 接口。若管理员通过受控脚本移除条目，聊天消息中的 `gallery_image_id` 仍可能存在。加载历史时应把缺失条目渲染成“图片已不可用”，不要让整段消息加载失败，也不要把旧的签名 URL 当成永久备份。

