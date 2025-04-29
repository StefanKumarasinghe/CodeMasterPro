
# CodeMasterPro

**Tars** is the ultimate AI-powered coding companion for software engineers—refined, multi-stage code generation and validation, plus reinforcement learning to continuously improve your results.

[![Docker Pulls](https://img.shields.io/docker/pulls/stefankumarasinghe/codemasterpro)](https://hub.docker.com/r/stefankumarasinghe/codemasterpro) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## 🚀 Table of Contents
- [Features](#features)  
- [Requirements](#requirements)  
- [Installation](#installation)  
- [Configuration](#configuration)  
- [Usage](#usage)  
- [Example Prompts](#example-prompts)  
- [Contribution](#contribution)  
- [License](#license)  
- [Disclaimer](#disclaimer)  

---

## ✨ Features

- **Code Assistant**  
  Syntax help, debugging tips, and deep dives into tricky concepts.

- **Multi-Stage Generation**  
  Every snippet runs through three stages (draft → refine → validate) to catch errors early.

- **Reinforcement Learning “Thinker”**  
  Tars learns from your feedback—rewarding good answers and penalizing bad ones.

- **FAISS & Web Integration**  
  Instantly search StackOverflow, internals, or Brave Search, and cache results locally.

- **Interactive Code Blocks**  
  Click **Use** on any sample to inject it into your prompt. Quick actions make editing a breeze.

- **Live HTML & Python Execution**  
  Preview HTML in-browser. Run Python in an isolated venv with retry & self-correction.

- **Contextual Memory**  
  Intelligent memory decay and embeddings keep track of your code, dependencies, and intent.

---

## 📦 Requirements

- **Docker** (20.10+)  
- **Google API Key** (required for Gemini models)  
- **Brave API Key** (optional, for web search)

---

## ⚙️ Installation

1. **Pull the Docker image**  
   ```bash
   # macOS (arm64)
   docker pull stefankumarasinghe/codemasterpro:latest
   ```

   ```bash
   # Windows (amd64)
   docker pull stefankumarasinghe/codemasterpro:amd64
   ```

2. **Run the container**  
   ```bash
   docker run \
     -e GOOGLE_API_KEY=<YOUR_GOOGLE_API_KEY> \
     -e BRAVE_API_KEY=<YOUR_BRAVE_API_KEY> \
     -p 8000:8000 \
     stefankumarasinghe/codemasterpro:latest
   ```

---

## 🔧 Configuration

| Env Variable      | Required | Description                                  |
| ----------------- | -------- | -------------------------------------------- |
| `GOOGLE_API_KEY`  | Yes      | Your Gemini (Google Generative AI) API key.  |
| `BRAVE_API_KEY`   | No       | Token for Brave Search integration.          |

---

## 🎉 Usage

1. Visit: `[http://localhost:8000](https://dwr4zchmi6x24.cloudfront.net/)`  
2. Say **Hello** to Tars:  
   > “Hey Tars, explain how async/await works in JavaScript.”  
3. Copy, refine, and run code directly in the UI.

---

## 💬 Example Prompts

- **Syntax & Debugging**  
  > “Why am I getting `TypeError: undefined` in this snippet?”

- **Code Generation**  
  > “Generate a Python function that reads a CSV into a pandas DataFrame.”

- **Optimization Tips**  
  > “How can I speed up this SQL JOIN on a million-row table?”

---

## 🙌 Contribution

This project is **MIT-licensed** and open to all.  
Feel free to file issues, submit PRs, or suggest new features—just give credit where it’s due!

---

## 📄 License

MIT © Stefan Kumarasinghe  
> *This project is not affiliated with or endorsed by any company or organization.*

---

## ⚠️ Disclaimer

Tars generates code using AI—always **review and test** before using in production.  
Use at your own risk; no warranty is provided.

---
