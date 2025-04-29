
# CodeMasterPro

**Tars** is the ultimate AI-powered coding companion for software engineers—refined, multi-stage code generation and validation, plus reinforcement learning to continuously improve your results.

[![Docker Pulls](https://img.shields.io/docker/pulls/stefankumarasinghe/codemasterpro)](https://hub.docker.com/r/stefankumarasinghe/codemasterpro) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

CodeMasterPro v1.1.1

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

- **StackOverflow Integration**
  Allows you to search with StackOverflow for quick snippets and answers

- **Chat History & Restorations**
  Allows you to save chats for later use or restore recent messages (for protection)

- **Fully Customizable**
  Can set custom prompts, request the type of code, any add other preferences

- **Gemini 3 models**
  Allows you to choose from 3 models based on the speed and accuracy

- **FAISS & Web Integration**  
  Instantly search StackOverflow, internals, or Brave Search, and cache results locally.

- **Interactive Code Blocks**  
  Click **Use** on any sample to inject it into your prompt. Quick actions make editing a breeze.

- **Saved Snippets**
  Allows you to save snippets for later and quick use

- **Manual Documentation and Automated Web Scaping**
  Allows you to add documentation links or documentations to your local system, links are used to webscrape public and accessible links
  Then it saves to FAISS for quick access

- **Live HTML & Python Execution**  
  Preview HTML in-browser. Run Python in an isolated venv with retry & self-correction.

- **Contextual Memory**  
  Intelligent memory decay and embeddings keep track of your code, dependencies, and intent.

---

## 📦 Requirements

- **Docker** (20.10+)  
- **Google API Key** (required for Gemini models Unlimited )  
- **Brave API Key** (optional, for web search 2000/per month free

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
   docker run -e GOOGLE_API_KEY=<YOUR_GOOGLE_API_KEY> -e BRAVE_API_KEY=<YOUR_BRAVE_API_KEY> -p 8000:8000 stefankumarasinghe/codemasterpro:tagname
   ```

---

## 🔧 Configuration

| Env Variable      | Required | Description                                  |
| ----------------- | -------- | -------------------------------------------- |
| `GOOGLE_API_KEY`  | Yes      | Your Gemini (Google Generative AI) API key.  |
| `BRAVE_API_KEY`   | No       | Token for Brave Search integration.          |

---

## 🎉 Usage

1. Visit: `[https://dwr4zchmi6x24.cloudfront.net/](https://dwr4zchmi6x24.cloudfront.net/)`  
2. Say **Hello** to Tars:  
   > “Hey Tars, explain how async/await works in JavaScript.”  
3. Copy, refine, and run code directly in the UI.
4. Or run HTML and Python directly using Tars

---

## 💬 Example Prompts

- **Syntax & Debugging**  
  > “Why am I getting `TypeError: undefined` in this snippet?”


- **Optimization Tips**  
  > "Can you give me an MCP server using the documentation in my internal resources"

---

## LangChain (Process Chain)

1. Fetches resources
2. Fetches Memory (Decay Memory and summary of history)
3. Understands user sentiment, if happy with previous answer or not
4. Rewards or punishes the RL agent
5. First is the generation chain, passes in all relevant and the user sentiment
6. Next is the refinement stage
7. lastly is the quick validation chain
8. If not thinker, then it returns the answer, but it first will save to memory, reward or punish the RL agent based on semantic score and validation score
9. If thinker, the RL agent may be greedy and look for a better solution while expanding its memory to get more context, even if reward is high and validation is high. After exhasting 2-4 times, it will get the best outcome and update q value.
10. Returns an optimized answer that is then cleaned

## LangChain (CodeAnalystPro Chain)

1. This is for tokens more than 25000 characters or around 500+ lines of code
2. Breaks the code into several chunks 2000-5000 character aim
3. Process each with context of the code and generated code, starts from top to bottom.
4. Retries if validation score is less than 90 out of 100, maximum is 5. Each reducing the context size and reducing noise and sending feedback
5. After processing the chunks, the code is constructed to make the big code
6. Then it is passed into a lite Gemini model to do basic checks and then it will output the code or analysis

## Langchain Python Shell 

1. First checks if code is runnable using a Chain, if not then makes it self-contained
2. Then runs through a chain to get the pip installs
3. Then it runs the code, if fails it will send error to the chain as feedback
4. A closed feedback loop of max tries 5 will occur. Until code is running without errors, does not check for logical issues like lack of features
5. Returns the output and the corrected final code


## 🙌 Contribution

This project is **MIT-licensed** and open to all.  
Feel free to file issues, submit PRs, or suggest new features—just give credit where it’s due!
Upto CodeMaster 1.1.1 was developed soley by Stefan Kumarasinghe

---

## 📄 License

MIT © Stefan Kumarasinghe  
> *This project is not affiliated with or endorsed by any company or organization.*

---

## ⚠️ Disclaimer

Tars generates code using AI—always **review and test** before using in production.  
Use at your own risk; no warranty is provided.

---
