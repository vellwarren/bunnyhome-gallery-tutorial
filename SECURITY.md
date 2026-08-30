# Security

这个仓库是教学用最小实现，不是代替安全评审的完整产品。

请不要提交 `.env`、Supabase service-role key、模型 API key、access token、签名 URL 或真实私人图片。若发现密钥已经进入 Git 历史，应先在对应服务中轮换密钥，再清理历史；仅删除文件不足以撤销已经泄露的凭据。

报告示例代码中的安全问题时，请避免在公开 issue 中附上真实项目 URL、用户 id、对象路径或请求数据。可以先提交不含敏感细节的说明，或通过仓库维护者提供的私下渠道联系。

部署前至少完成以下检查：

- bucket 保持私有，service-role key 只存在于服务端。
- CORS 只允许真实前端 origin，所有流量使用 HTTPS。
- API 有鉴权、费用限额、速率限制和脱敏日志。
- 删除与 cleanup 只在受控环境运行，先 dry-run 并保留可恢复备份。
- 对模型供应商的数据保留、训练使用和地区合规设置做独立确认。

更完整的威胁边界见 [Supabase 配置、安全与故障恢复](docs/06-supabase-security.md)。

