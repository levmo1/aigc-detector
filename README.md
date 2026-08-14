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

  <h3 align="center">AIGC Detector（文脉校阅台）</h3>

  <p align="center">
    An AI-writing-pattern observation tool for Chinese academic papers.
    <br />
    <a href="https://github.com/your_username/aigc-detector"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/your_username/aigc-detector">View Demo</a>
    ·
    <a href="https://github.com/your_username/aigc-detector/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/your_username/aigc-detector/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

> ⚠️ **For entertainment purposes only**
>
> Detection results are **writing-pattern observations**, not authorship determination, and do **not constitute any academic or commercial conclusion**.
> Any single feature can also appear in human-written text; rewriting or style transfer can evade detection (studies report evasion rates of 90%+).
> Results of this tool are **for entertainment and writing reference only**. Do not use them for paper submission, academic review, authorship verification, or any other serious purpose.

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#development">Development</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Paste text or upload Word/PDF (including scanned PDFs with OCR), get sentence-level annotations for AI-likeness, human-likeness, and uncertain segments, and export visual reports — all powered by local rule-based detection.

Key highlights:

* **Local-first**: 16 built-in categories / 109 Chinese AI-writing feature rules + 6 statistical features run entirely on your machine; content is never uploaded
* **Multi-format input**: pasted text, Word (.docx), PDF; scanned PDFs automatically processed with Simplified Chinese OCR
* **Report export**: PDF / HTML / Word (DOCX)
* **AI-assisted review** (optional): cross-check rule results with an LLM (DeepSeek / OpencodeGO / custom)
* **Custom rules**: manage patterns and regexes, adjust weights and thresholds
* **History**: persisted locally; reopen reports, delete entries, configure retention
* **Desktop app**: Windows installer with system tray, close confirmation, and background resident

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![React][React.js]][React-url]
* [![Vite][Vite.js]][Vite-url]
* [![Node][Node.js]][Node-url]
* [![Tauri][Tauri.js]][Tauri-url]
* [![Hono][Hono.js]][Hono-url]
* [![tesseract.js][Tesseract.js]][Tesseract-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

* Node.js 20.19+
* npm 10+
* (Windows installer builds) Rust toolchain + [cargo-xwin](https://github.com/rust-cross/cargo-xwin)

### Development

1. Clone the repo
   ```sh
   git clone https://github.com/your_username/aigc-detector.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Start the backend (Hono, default `127.0.0.1:3210`)
   ```sh
   npm run dev:server
   ```
4. Start the frontend (Vite, `/api` proxied to the backend)
   ```sh
   npm run dev
   ```
5. Open `http://localhost:5173`

Checks & tests:

```sh
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm test            # unit tests (140+)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->
## Usage

**Text detection**

Paste Chinese text (≥100 chars) and click "Start detection". Sentences are segmented and annotated by AI-likeness.

**File detection**

Upload a Word (.docx) or PDF file. Text-layer PDFs are parsed directly; scanned PDFs are OCR'd with Simplified Chinese.

**Report export**

After a report is ready, export as PDF, HTML, or Word from the report page.

**Desktop app (Windows)**

The installer installs to `%LOCALAPPDATA%\Programs\AIGC检测器` (no admin required). Closing the window asks whether to exit or minimize to the system tray; double-click or right-click the tray icon to reopen or quit. Exiting terminates the background node process.

_For building the Windows installer from Linux, see `scripts/build-win.sh`._

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- PROJECT STRUCTURE -->
## Project Structure

```
frontend/     SPA (pages, components, api client, styles)
lib/          business logic (detection, OCR, parsing, export, LLM, rules)
server/       Hono backend routes
src-tauri/    Tauri desktop shell (Rust)
scripts/      build scripts (esbuild, NSIS, font subsetting, Windows packaging)
tests/        unit tests
assets/       icons & fonts
rules/        default detection rules
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap
- [x] Local rule-based detection (16 categories, 109 rules)
- [x] Text / Word / PDF input with scanned-PDF OCR
- [x] Report export (PDF / HTML / Word)
- [x] Custom rule management
- [x] History persistence
- [x] Windows desktop app (Tauri + system tray)
- [ ] More detection features / third-party detection providers
- [ ] macOS / Linux desktop builds

See the [open issues](https://github.com/your_username/aigc-detector/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement". Don't forget to give the project a star!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Private project — not open source. See `LICENSE.txt` for details if provided.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Project Link: [https://github.com/your_username/aigc-detector](https://github.com/your_username/aigc-detector)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [Tauri](https://tauri.app/)
* [Hono](https://hono.dev/)
* [tesseract.js](https://tesseract.projectnaptha.com/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
