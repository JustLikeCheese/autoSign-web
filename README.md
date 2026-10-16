# AutoSign Web

Bugku 签到的 GitHub Pages 前端面板。使用原生 HTML、CSS、JavaScript，无第三方运行时、统计脚本或 CDN。

## 数据边界

- 本仓库为 Public；只发布前端代码和经过白名单校验的签到状态。
- 签到逻辑与账号密码保存在私有 `autoSign` 仓库及其 Actions Secrets 中。
- `public/status.json` 只含运行编号、时间、结果、步骤状态及固定日志代码。网页将固定代码翻译为日志摘要，不展示原始日志内容。
- 网页不要求输入账号、密码、Cookie 或 GitHub Token；完整日志入口由 GitHub 的私有仓库权限保护。
- 签到工作流在推送数据前检测真实凭据及其常见编码形式，命中时拒绝发布。

## 发布与预览

GitHub Pages 从 `public/` 发布。每次更新页面或状态文件后，Pages 工作流自动部署。

本地预览：`python -m http.server 4173 --directory public`，打开 `http://127.0.0.1:4173`。

网页每 60 秒重新读取一次已经发布的状态；签到计划为每天 08:17（UTC+8）。Pages 发布可能有延迟。

## 页面与主题

- 单页布局，直接展示最近签到状态、历史记录和脱敏日志。
- 默认跟随系统明暗主题；页面右上角也可手动选择深色或浅色。只有主题偏好保存在当前浏览器。
- 主题菜单使用页面自定义样式，支持方向键、Enter 和 Escape。手动刷新显示同步状态及 Toast 提示，失败后可直接重试；自动同步不弹出提示。
- 使用本地托管的 Geist、Noto Sans SC 字体子集及 Lucide SVG 图标，无运行时第三方资源请求。许可证位于 `public/licenses/`。
- 所有时间使用台北时间（`Asia/Taipei`），每天 08:17 自动签到。
