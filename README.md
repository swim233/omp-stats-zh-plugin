# omp-stats-zh-plugin

Oh My Pi Stats 中文本地化插件，提供 `/stats-zh` 指令和仅监听本机的中文统计面板。

## 功能

- 注册 `/stats-zh` 指令
- 默认打开 `http://localhost:3947/`
- 汉化概览、请求、错误、模型、提供商、工具、费用、行为、项目和收益页面
- 动态翻译更新时间、相对时间、状态和表格字段
- Token 数量使用 `K`、`M`，不使用“万”“亿”
- 优先复用已经运行的 `http://localhost:3847/`
- 3847 未运行时自动启动随插件安装的 Stats 后端
- 所有服务仅绑定 `127.0.0.1`

## 要求

- Oh My Pi 17.2.1 或更高版本
- Bun 1.3.14 或更高版本

## 从压缩包安装

OMP 会把本地路径作为目录插件链接，因此先解压 npm 压缩包：

```bash
mkdir omp-stats-zh
tar -xzf omp-stats-zh-plugin-1.0.0.tgz -C omp-stats-zh
cd omp-stats-zh/package
bun install --production
omp plugin link .
```

安装后重新启动 OMP，然后执行：

```text
/stats-zh
```

## 从 npm 或 Git 仓库安装

发布到 npm 后：

```bash
omp plugin install omp-stats-zh-plugin
```

托管到 GitHub 后也可以直接安装：

```bash
omp plugin install github:YOUR_NAME/omp-stats-zh-plugin
```

## 本地开发或目录安装

```bash
cd /path/to/omp-stats-zh-plugin
bun install
omp plugin link .
```

## 自定义端口

默认端口是 3947。启动 OMP 前可通过环境变量覆盖：

```bash
OMP_STATS_ZH_PORT=4947 omp
```

## 卸载

```bash
omp plugin uninstall omp-stats-zh-plugin
```

## 隐私

插件只读取 OMP Stats 已有的本地统计数据，不向外部服务上传会话或统计信息。

## 许可证

MIT
