# Maple Notes 自动更新与部署

本 Fork 跟踪 `annpardo/CF-Workers-TGProxy` 的 `main`，为 `maple-notes` Worker 提供私人部署。

## 更新流程

1. GitHub Actions 每天约北京时间 05:17 检查上游，也可在 Actions 中手动运行 **Sync upstream safely**。
2. 仅同步上游 `telegram_webproxy.js`、`README.md` 和 `LICENSE`。本地补丁、工作流和部署配置不会从上游覆盖。
3. 构建时用 `patches/private-worker.patch` 应用当前私人修改：面板和统计接口鉴权、隐藏公开导入链接、移除第三方推广、兼容加密全局声明以及正确的监控初始化时间。
4. 补丁、测试或打包失败则不提交更新，线上继续使用上一版本；在 Actions 日志中查看失败原因。
5. 全部检查通过才提交到本仓库 `main`，由 Cloudflare Builds 构建和部署现有 Worker。

## Cloudflare Builds

- Worker：`maple-notes`
- 仓库：`NichoSpace/CF-Workers-TGProxy`
- 生产分支：`main`
- 根目录：`/`
- 构建命令：`npm run verify`
- 部署命令：`npx wrangler deploy`
- Node.js：24（可在构建变量中设置 `NODE_VERSION=24`）
- 依赖安装：`npm ci`，使用提交的 `package-lock.json`

`SECRET` 和 `BOOT` 继续保存在 Cloudflare 的运行时 Secrets 中；仓库和工作流不需要这些值，也不会自动轮换它们。现有自定义域名在 `wrangler.jsonc` 中保留。连接后的源码以 Git 仓库为准，避免在在线编辑器中单独修改导致下次部署覆盖。

## 本地操作

```sh
npm ci
npm run verify
npm run check:bundle
```

手动检查上游：`npm run sync:upstream`，随后执行检查并检查差异，再提交。不要直接覆盖补丁后的构建产物；修改私人逻辑时应更新补丁和相应测试。

GitHub 的定时任务可能延迟；Fork 的 Actions 需要启用。公开仓库长时间无活动时，GitHub 可能自动停用定时任务，可在 Actions 页面重新启用。
