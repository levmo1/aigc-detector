<a id="readme-top"></a>

[English](README.md) | [简体中文](README.zh-CN.md)

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/your_username/aigc-detector">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">AIGC检测器（文脉校阅台）</h3>

  <p align="center">
    面向中文论文的 AI 写作痕迹观察工具
    <br />
    <a href="https://github.com/your_username/aigc-detector"><strong>查看文档 »</strong></a>
    <br />
    <br />
    <a href="https://github.com/your_username/aigc-detector">在线演示</a>
    ·
    <a href="https://github.com/your_username/aigc-detector/issues/new?labels=bug">报告 Bug</a>
    ·
    <a href="https://github.com/your_username/aigc-detector/issues/new?labels=enhancement">请求功能</a>
  </p>
</div>

> ⚠️ **仅供娱乐参考**
>
> 检测结果是**写作特征观察**，不是作者身份判定，**不构成任何学术或商业结论**。
> 任何单一特征都可能出现在人工文本中；改写/风格迁移可绕过检测（相关研究显示逃逸率可达 90%+）。
> 本工具结果**仅供娱乐与写作参考**，不能用于论文提交、学校审核、作品鉴定或其他任何严肃用途。

<!-- TABLE OF CONTENTS -->
<details>
  <summary>目录</summary>
  <ol>
    <li><a href="#关于项目">关于项目</a></li>
    <li><a href="#技术栈">技术栈</a></li>
    <li><a href="#快速开始">快速开始</a>
      <ul>
        <li><a href="#环境要求">环境要求</a></li>
        <li><a href="#开发运行">开发运行</a></li>
      </ul>
    </li>
    <li><a href="#使用说明">使用说明</a></li>
    <li><a href="#路线图">路线图</a></li>
    <li><a href="#贡献">贡献</a></li>
    <li><a href="#许可证">许可证</a></li>
    <li><a href="#联系方式">联系方式</a></li>
    <li><a href="#致谢">致谢</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## 关于项目

粘贴文本或上传 Word/PDF（含扫描件 OCR），按句子拆解并标注 AI 倾向、人工倾向与不确定片段，生成可视化报告——全部基于**本地规则检测**。

核心亮点：

* **本地优先**：内置 16 类、109 条中文 AI 写作特征规则 + 6 个统计特征，全部在本机运行，内容不上传
* **多格式输入**：粘贴文本、Word（.docx）、PDF；无文本层的扫描 PDF 自动尝试简体中文 OCR
* **报告导出**：PDF / HTML / Word（DOCX）
* **AI 辅助判断**（可选）：配置 LLM（DeepSeek / OpencodeGO / 自定义）后对规则结果做模型复核
* **自定义规则**：增删词条与正则，调整检测权重与阈值
* **历史记录**：本地持久化，可重开报告、删除条目、设置保存条数
* **桌面应用**：Windows 安装包（系统托盘、关闭确认、后台常驻）

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

### 技术栈

* [![React][React.js]][React-url]
* [![Vite][Vite.js]][Vite-url]
* [![Node][Node.js]][Node-url]
* [![Tauri][Tauri.js]][Tauri-url]
* [![Hono][Hono.js]][Hono-url]
* [![tesseract.js][Tesseract.js]][Tesseract-url]

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- GETTING STARTED -->
## 快速开始

### 环境要求

* Node.js 20.19+
* npm 10+
* （构建 Windows 安装包另需）Rust 工具链 + [cargo-xwin](https://github.com/rust-cross/cargo-xwin)

### 开发运行

1. 克隆仓库
   ```sh
   git clone https://github.com/your_username/aigc-detector.git
   ```
2. 安装依赖
   ```sh
   npm install
   ```
3. 启动后端（Hono，默认 `127.0.0.1:3210`）
   ```sh
   npm run dev:server
   ```
4. 启动前端（Vite，`/api` 已代理到后端）
   ```sh
   npm run dev
   ```
5. 打开 `http://localhost:5173`

代码检查与测试：

```sh
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint
npm test            # 单元测试（140+）
```

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- USAGE -->
## 使用说明

**文本检测**

粘贴中文正文（≥100 字），点击"开始检测"。句子被切分并按 AI 倾向标注。

**文件检测**

上传 Word（.docx）或 PDF 文件。带文本层的 PDF 直接解析；扫描版 PDF 自动进行简体中文 OCR。

**报告导出**

报告生成后，可在报告页导出为 PDF、HTML 或 Word。

**桌面应用（Windows）**

安装包默认安装到 `%LOCALAPPDATA%\Programs\AIGC检测器`（无需管理员）。关闭窗口时弹窗选择"退出"或"最小化到托盘"；托盘图标双击/右键可重新打开或退出；退出时自动终止后台 node 进程。

_Linux 交叉构建 Windows 安装包：见 `scripts/build-win.sh`。_

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- PROJECT STRUCTURE -->
## 目录结构

```
frontend/     SPA（页面、组件、API 客户端、样式）
lib/          业务逻辑（检测、OCR、解析、导出、LLM、规则）
server/       Hono 后端路由
src-tauri/    Tauri 桌面壳（Rust）
scripts/      构建脚本（esbuild、NSIS、字体子集化、Windows 打包）
tests/        单元测试
assets/       图标与字体
rules/        默认检测规则
```

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- ROADMAP -->
## 路线图

- [x] 本地规则检测（16 类、109 条规则）
- [x] 文本 / Word / PDF 输入，扫描件 OCR
- [x] 报告导出（PDF / HTML / Word）
- [x] 自定义规则管理
- [x] 历史记录持久化
- [x] Windows 桌面应用（Tauri + 系统托盘）
- [ ] 更多检测特征 / 外部检测服务
- [ ] macOS / Linux 桌面构建

完整的已提议功能与已知问题见 [open issues](https://github.com/your_username/aigc-detector/issues)。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- CONTRIBUTING -->
## 贡献

任何让项目变得更好的贡献都**非常感谢**。

如果你有改进建议，请 fork 本仓库并提交 Pull Request，也可以直接创建带 "enhancement" 标签的 Issue。别忘了给项目点个 Star！

1. Fork 项目
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交改动（`git commit -m 'Add some AmazingFeature'`）
4. 推送分支（`git push origin feature/AmazingFeature`）
5. 提交 Pull Request

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- LICENSE -->
## 许可证

私有项目，未开源。详见 `LICENSE.txt`（如有）。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- CONTACT -->
## 联系方式

项目地址：[https://github.com/your_username/aigc-detector](https://github.com/your_username/aigc-detector)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## 致谢

* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [Tauri](https://tauri.app/)
* [Hono](https://hono.dev/)
* [tesseract.js](https://tesseract.projectnaptha.com/)

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/your_username/aigc-detector.svg?style=for-the-badge
[contributors-url]: https://github.com/your_username/aigc-detector/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/your_username/aigc-detector.svg?style=for-the-badge
[forks-url]: https://github.com/your_username/aigc-detector/network/members
[stars-shield]: https://img.shields.io/github/stars/your_username/aigc-detector.svg?style=for-the-badge
[stars-url]: https://github.com/your_username/aigc-detector/stargazers
[issues-shield]: https://img.shields.io/github/issues/your_username/aigc-detector.svg?style=for-the-badge
[issues-url]: https://github.com/your_username/aigc-detector/issues
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vite.js]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Tauri.js]: https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white
[Tauri-url]: https://tauri.app/
[Hono.js]: https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white
[Hono-url]: https://hono.dev/
[Tesseract.js]: https://img.shields.io/badge/tesseract.js-5B6C7D?style=for-the-badge&logo=tesseract&logoColor=white
[Tesseract-url]: https://tesseract.projectnaptha.com/
