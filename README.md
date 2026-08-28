# 两个人的地图 · VS Code 项目

这是可长期维护的前端版本。核心功能已经保留：互动地图、地点详情、照片上传、重要日历、信件、沟通记录、时间轴、密码保护和 JSON 备份。

## 在 VS Code 中打开

1. 用 VS Code 打开本文件夹 `love-memories-vscode`。
2. 安装推荐的 **Live Server** 扩展。
3. 在 `index.html` 上右键，选择 **Open with Live Server**。

页面会在浏览器中打开；地图底图需要网络连接。由于数据采用浏览器本地存储，请始终通过相同的浏览器和地址打开这个项目，否则会看到另一份本地数据。

## 文件说明

```text
love-memories-vscode/
├── index.html      页面结构：导航、地图、日历、信件、弹窗
├── styles.css      全部视觉样式与手机适配
├── app.js          交互逻辑、地图、日历、表单、备份、密码保护
├── data.js         已整理的时间线、信件和约定；以后可继续添加
├── 聊天记录纪念索引.md  聊天记录的整理依据与待补内容
├── .vscode/
│   └── extensions.json
└── README.md
```

## 日常维护从哪里开始

- **维护回忆**：编辑 `data.js` 中的 `places`、`events`、`letters`、`conversations` 和 `wishes`。其中 `wishes` 就是首页的“约定栏”，`conversations` 是“沟通”页面的数据，`status: 'done'` 表示已经实现。
- **查看整理依据**：打开 `聊天记录纪念索引.md`，里面列出了从聊天记录提取的 22 个重要时刻、16 条约定，以及几个需要你们确认日期的地方。
- **改颜色和布局**：从 `styles.css` 顶部的颜色变量和对应组件样式开始。
- **新增功能**：在 `app.js` 添加数据字段、渲染函数和事件处理；新增字段也会被 JSON 备份保存。
- **重新载入项目初始数据**：浏览器开发者工具 → Application → Local Storage，删除 `love-memories-data-v1`；刷新后会重新载入 `data.js` 的数据。已在网页里新增过的个人内容会被保留并和新的整理数据合并。

## 重要提醒

目前密码与照片都保存在本机浏览器，适合原型和个人使用，并不是线上安全方案。`data.js` 现在含有 28 封聊天原文；在公开部署、上传 GitHub 或发给其他人之前，请先把原文迁移到受保护的数据库或移出项目。准备公开部署前，建议升级为 Next.js + Supabase Auth / Storage / Postgres，并把地图替换为高德地图或 Mapbox。
