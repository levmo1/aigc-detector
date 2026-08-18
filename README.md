<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a id="readme-top"></a>

[English](README.en.md) | 简体中文

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/levmo1/aigc-detector">
    <img src="assets/icon.png" alt="文脉校阅台图标" width="80" height="80">
  </a>

  <h3 align="center">AIGC 检测器 · 文脉校阅台</h3>

  <p align="center">
    面向中文论文的 AI 写作痕迹观察工具
    <br />
    本地规则优先，支持 Word / PDF、扫描件 OCR、可选模型辅助复核
    <br />
    <a href="https://github.com/levmo1/aigc-detector/issues/new?labels=bug">报告 Bug</a>
    ·
    <a href="https://github.com/levmo1/aigc-detector/issues/new?labels=enhancement">提出功能建议</a>
  </p>
</div>

> ⚠️ **仅供写作参考，不是作者身份鉴定工具**
>
> 本项目检测的是文本中的写作模式和语言线索，不是作者身份，也不提供 AI 生成概率的科学证明。人工文本可能包含相同特征，改写和风格迁移也可能绕过检测。请勿将结果用于论文提交、学术处分、作者归属、商业审核或其他高风险决定。

<!-- TABLE OF CONTENTS -->
<details>
  <summary>目录</summary>
  <ol>
    <li>
      <a href="#项目简介">项目简介</a>
      <ul>
        <li><a href="#技术栈">技术栈</a></li>
      </ul>
    </li>
    <li>
      <a href="#快速开始">快速开始</a>
      <ul>
        <li><a href="#环境要求">环境要求</a></li>
        <li><a href="#安装">安装</a></li>
      </ul>
    </li>
    <li><a href="#使用说明">使用说明</a></li>
    <li><a href="#贡献">贡献</a></li>
    <li><a href="#许可证">许可证</a></li>
    <li><a href="#联系方式">联系方式</a></li>
    <li><a href="#致谢">致谢</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## 项目简介

文脉校阅台把中文论文拆分成段落和句子，结合本地写作特征规则、统计特征和可选的模型复核，输出 AI 倾向、人工倾向和不确定三类观察结果。

### 主要功能

- **本地规则检测**：16 个规则组、106 条中文写作特征规则和 6 个统计特征；支持排除词、权重、单条规则命中上限和规则组贡献上限。
- **文档级线索聚合**：识别全文多处重复出现的模板、排比和高频表达，降低“明明有明显线索但 AI 率为 0%”的漏报。
- **多格式输入**：粘贴文本、上传 `.docx` / `.pdf`；文本型 PDF 直接解析，扫描 PDF 尝试使用简体中文 OCR。
- **Windows 原生拖入**：桌面版使用 Tauri 原生文件拖放事件，兼容 Windows WebView2 从资源管理器拖入文件。
- **报告导出**：支持 PDF、HTML 和 DOCX，保留逐句线索和建议。
- **历史记录**：检测结果保存在本机，可重新打开、删除记录和设置保留数量。
- **自定义规则**：新增、修改、删除规则，调整阈值，导入/导出 JSON，并回滚上一次保存。
- **模型辅助判断**：支持 DeepSeek、OpencodeGO 和自定义 OpenAI 兼容接口，可以自动检测模型并从下拉菜单选择。
- **模型方案管理**：支持自定义名称和 Base URL 的方案添加、删除，每个方案独立保存 API Key。

模型辅助判断是可选功能。默认的本地检测不会上传正文；只有用户主动配置并开启外部模型时，选中的片段才会发送到对应接口。

### 技术栈

- [![React][React.js]][React-url]
- [![Vite][Vite.js]][Vite-url]
- [![Node.js][Node.js]][Node-url]
- [![Tauri][Tauri.js]][Tauri-url]
- [![Hono][Hono.js]][Hono-url]
- [![tesseract.js][Tesseract.js]][Tesseract-url]

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- GETTING STARTED -->
## 快速开始

### 环境要求

- Node.js 20.19 或更高版本；
- npm 10 或更高版本；
- 构建 Windows 安装包还需要 Rust、`cargo-xwin`、`llvm-rc` 和 NSIS `makensis`。

### 安装

1. 克隆仓库：

   ```sh
   git clone https://github.com/levmo1/aigc-detector.git
   cd aigc-detector
   ```

2. 安装依赖：

   ```sh
   npm install
   ```

3. 启动本地后端（默认监听 `127.0.0.1:3210`）：

   ```sh
   npm run dev:server
   ```

4. 另开一个终端启动 Vite 前端：

   ```sh
   npm run dev
   ```

5. 打开 <http://localhost:5173>。

常用检查命令：

```sh
npm run typecheck
npm run lint
npm test -- --run
```

构建 Windows 安装包：

```sh
npm run build:win
```

生成的 NSIS 安装包位于：

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```

Linux 交叉构建依赖 `cargo-xwin` 和 Windows 资源编译工具；如果只开发前端或后端，不需要执行 Windows 打包命令。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- USAGE -->
## 使用说明

### 文本和文件检测

在首页选择“粘贴文字”，粘贴正文后点击“开始检测”。建议输入至少 300 个有效字符；内容过短时，统计特征和文档级线索都不稳定。

选择“上传文件”后，可以点击区域选择文件，也可以从 Windows 文件管理器直接拖入 `.docx` 或 `.pdf`。扫描 PDF 会尝试 OCR，识别结果可能受图片清晰度、排版和字体影响。

### 模型辅助判断

模型设置包含两个开关：

| 模型辅助判断 | 单模型二次复核 | 使用方式 |
| --- | --- | --- |
| 关闭 | 任意 | 只使用本地规则，不调用外部模型 |
| 开启 | 关闭 | 使用原来的模型辅助判断流程 |
| 开启 | 开启 | 使用更省 Token 的单模型二次复核流程，优先检查高价值片段 |

单模型二次复核默认关闭。开启后默认最多复核 6 个片段，可以在“二次复核预算”中选择 3、6、10、15 或 30 个片段。报告会显示请求片段数和实际完成数。

配置 OpenAI 兼容接口时：

1. 打开“模型设置”；
2. 选择内置方案，或点击“＋ 添加方案”；
3. 填写 Base URL 和 API Key；
4. 点击“自动检测模型”，从下拉菜单选择模型；
5. 根据需要打开两个模型开关；
6. 点击“测试连接”和“保存设置”。

OpencodeGO 的多种模型可能返回推理内容。应用会针对该网关尝试关闭不必要的推理；如果接口不接受该参数，会自动回退；如果 JSON 因输出长度被截断，也会自动增加预算重试。其他 OpenAI 兼容接口不会强行发送网关专用参数。

API Key 只保存在本机配置目录，不应提交到 Git，也不要粘贴到 Issue、README 或日志中。使用第三方模型时，请确认服务商的数据保留和隐私政策。

### 自定义规则

在“自定义规则”页面可以：

- 编辑规则组名称、权重和最大贡献分；
- 添加普通文本规则或安全的正则表达式；
- 为规则设置最大命中次数和排除词；
- 调整 AI / 不确定阈值；
- 查看规则预览和当前修订号；
- 导出规则 JSON、导入备份或回滚上一次保存。

规则是可解释的写作线索，不是黑盒分类器。提高规则权重和降低阈值会增加召回率，也可能增加误报，修改后建议使用多篇人工文本和 AI 文本对照验证。

### 查看和导出报告

报告页包含：

- AI、人工和不确定片段的字符占比；
- 逐句高亮和规则命中原因；
- 模型辅助复核结果、复核覆盖率和模型建议（如已开启）；
- PDF、HTML、DOCX 导出入口。

报告里的“AI 倾向”表示线索强弱，不是准确率，也不是作者身份概率。对单篇文章的结论应结合原始资料、引用来源和人工复核。

### Windows 桌面版

安装包默认安装到：

```text
%LOCALAPPDATA%\Programs\AIGC检测器
```

程序使用系统托盘。关闭窗口时可以选择退出或最小化到托盘；从托盘退出会同时停止后台 Node 服务。

卸载程序会清理安装目录中由应用运行时创建的 `config`、`data`、`rules`、`logs` 和 `tesseract-data` 目录。升级安装会保留这些目录，以便保留配置、历史记录和自定义规则。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- CONTRIBUTING -->
## 贡献

欢迎提交 Issue 和 Pull Request。提交前请至少运行：

```sh
npm run typecheck
npm run lint
npm test -- --run
```

涉及检测规则时，请说明预期减少的误报或漏报，并提供脱敏示例。不要在提交中包含 API Key、论文原文或其他私人数据。

1. Fork 本项目；
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）；
3. 提交改动（`git commit -m "Add some AmazingFeature"`）；
4. 推送分支（`git push origin feature/AmazingFeature`）；
5. 创建 Pull Request。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- LICENSE -->
## 许可证

本项目采用 [MIT License](LICENSE)。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- CONTACT -->
## 联系方式

项目地址：<https://github.com/levmo1/aigc-detector>

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## 致谢

- [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
- [Tauri](https://tauri.app/)
- [Hono](https://hono.dev/)
- [tesseract.js](https://tesseract.projectnaptha.com/)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/levmo1/aigc-detector.svg?style=for-the-badge
[contributors-url]: https://github.com/levmo1/aigc-detector/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/levmo1/aigc-detector.svg?style=for-the-badge
[forks-url]: https://github.com/levmo1/aigc-detector/network/members
[stars-shield]: https://img.shields.io/github/stars/levmo1/aigc-detector.svg?style=for-the-badge
[stars-url]: https://github.com/levmo1/aigc-detector/stargazers
[issues-shield]: https://img.shields.io/github/issues/levmo1/aigc-detector.svg?style=for-the-badge
[issues-url]: https://github.com/levmo1/aigc-detector/issues
[license-shield]: https://img.shields.io/github/license/levmo1/aigc-detector.svg?style=for-the-badge
[license-url]: https://github.com/levmo1/aigc-detector/blob/main/LICENSE
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[Vite.js]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Tauri.js]: https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white
[Tauri-url]: https://tauri.app/
[Hono.js]: https://img.shields.io/badge/Hono-E36002?style=for-the-badge
[Hono-url]: https://hono.dev/
[Tesseract.js]: https://img.shields.io/badge/tesseract.js-5B6C7D?style=for-the-badge
[Tesseract-url]: https://tesseract.projectnaptha.com/
