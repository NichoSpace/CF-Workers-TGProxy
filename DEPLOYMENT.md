# Maple Notes 自动更新与部署

本 Fork 跟踪 `annpardo/CF-Workers-TGProxy` 的 `main`，为 `maple-notes` Worker 提供私人部署。

## 更新流程

1. GitHub Actions 每天约北京时间 05:17 检查上游，也可在 Actions 中手动运行 **Sync upstream safely**。
2. 仅同步上游 `telegram_webproxy.js`、`README.md` 和 `LICENSE`。本地补丁、工作流和部署配置不会从上游覆盖。
3. 构建时用 `patches/private-worker.patch` 应用当前私人修改：面板和统计接口鉴权、隐藏公开导入链接、移除第三方推广、兼容加密全局声明以及正确的监控初始化时间。
4. 补丁、测试或打包失败则不提交更新，线上继续使用上一版本；在 Actions 日志中查看失败原因。
5. 全部检查通过才提交到本仓库 `main`。配置 `CF_DEPLOY_HOOK` 时，工作流会直接请求 Cloudflare Builds；同时保留 Git 仓库连接。

## Cloudflare Builds

- Worker：`maple-notes`
- 仓库：`NichoSpace/CF-Workers-TGProxy`
- 生产分支：`main`
- 根目录：`/`
- 构建命令：`npm run verify`
- 部署命令：`npx wrangler deploy`
- Node.js：24（构建变量 `NODE_VERSION=24`；仓库 `.node-version` 同时固定主版本）
- 依赖安装：`npm ci`，使用提交的 `package-lock.json`

`SECRET` 和 `BOOT` 继续保存在 Cloudflare 的运行时 Secrets 中；仓库和工作流不需要这些值，也不会自动轮换它们。现有自定义域名在 `wrangler.jsonc` 中保留。连接后的源码以 Git 仓库为准，避免在在线编辑器中单独修改导致下次部署覆盖。

`CF_DEPLOY_HOOK` 是 GitHub Actions 的加密 Repository Secret，保存限定 `main` 分支的 Cloudflare 部署挂钩 URL。不要将实际 URL 写入代码、文档或普通 Variables。挂钩请求被接受只代表构建已排队，部署结果仍须查看 Cloudflare 部署记录。

## 手动触发自动更新

打开仓库 Actions → Sync upstream safely → Run workflow，保持分支 main 后运行。若显示 No upstream changes，表示已是当前上游版本；有更新时，通过检查后会自动提交。发布结果请在 Cloudflare 的部署记录中确认。

需要重新发布当前代码时，勾选 **Request a production build even when upstream is unchanged**（`force_build`）。检查通过后，即使上游无变化也会推送空提交，并调用已配置的部署挂钩。

若挂钩返回 HTTP 500 / Cloudflare 错误码 12001，工作流会标记失败，不能据此认为生产已更新。当前线上部署继续运行；服务恢复后可使用上述选项重试，持续失败则携错误响应和 CF-Ray 联系 Cloudflare 支持。

## 本地操作

```sh
npm ci
npm run verify
npm run check:bundle
```

手动检查上游：`npm run sync:upstream`，随后执行检查并检查差异，再提交。不要直接覆盖补丁后的构建产物；修改私人逻辑时应更新补丁和相应测试。

GitHub 的定时任务可能延迟；Fork 的 Actions 需要启用。公开仓库长时间无活动时，GitHub 可能自动停用定时任务，可在 Actions 页面重新启用。
