# 首次收藏：两条线并行

用户选择“保存到 Gallery”时，有两件不同的事要完成：AI 人格自然地回应当下对话；中性视觉工人把直接可见的画面整理成稳定文字。它们同时开始，职责不混在一起。

## 人格线

人格模型看到真实图片，先生成正常的可见回复，再通过工具留下两个私有字段：短标题与第一印象。

```js
const saveTool = {
  name: 'save_gallery_metadata',
  description: [
    '先用正常的人格语气回应用户。',
    '不要把可见回复写成第三人称图片目录。',
    '最后调用一次本工具；客观视觉整理由另一位中性工人完成。',
  ].join(' '),
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'first_impression'],
    properties: {
      title: { type: 'string', maxLength: 60 },
      first_impression: { type: 'string', maxLength: 800 },
    },
  },
};
```

工具参数不应直接显示在聊天回复里。第一印象是当时的主观备注，不是永久事实，也不应该被当作未来对话必须遵循的判断。

## 中性视觉线

中性工人只看图片，不接收人格 system prompt 或完整聊天历史：

```js
const neutralDescriptionPromise = describeImageNeutral(image);
const companionReplyPromise = replyAsCompanion({ message, image, save: true });

const [description, companion] = await Promise.all([
  neutralDescriptionPromise,
  companionReplyPromise,
]);
```

中性提示词要求只描述主体、构图、颜色、光线和清晰可读文字，不推断身份、心理、关系、背景故事或意义。这样保存下来的 `first_description` 才适合作为未来的语义替身。

## 汇合与写入顺序

示例的保存顺序是：

1. 解码并验证图片类型、大小和 base64 完整性。
2. 计算 SHA-256，先查已有元数据。
3. 原子创建 claim；未取得 claim 的请求等待胜者结果。
4. 上传图片对象，`upsert: false`。
5. 原子创建元数据 JSON，`upsert: false`。
6. 最后删除 claim。

若图片上传失败，不写元数据。若本请求刚上传了图片但元数据写入失败，会在仍持有 claim 时补偿删除图片；若补偿也失败，记录错误并交给孤儿扫描脚本处理。

聊天成功而收藏失败时，接口仍返回正常聊天回复，并在 `gallery_error` 中给出可安全展示的失败状态。生产环境可以把收藏变成队列任务并重试，但不要为了收藏阻断整段聊天。

## 并发时保留谁的第一印象

同一用户对完全相同的二进制并发收藏时，取得 claim 的请求成为创建者，它的标题与第一印象被保留；其他请求读取已创建条目。这是确定且可解释的“先取得写权者胜出”，不是把两个第一印象静默拼接。

