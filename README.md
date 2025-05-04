# CodeMasterPro: A Refined Coding ChatGPT for Software Engineers

[![Docker Pulls](https://img.shields.io/docker/pulls/stefankumarasinghe/codemasterpro)](https://hub.docker.com/r/stefankumarasinghe/codemasterpro)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CodeMasterPro is an advanced AI-powered coding assistant designed to elevate the software engineering experience.

## Features

- **Understanding User** Understands user intentions - could be further enhanced
- **AI-Powered Debugging:** Identifies potential errors and suggests fixes, streamlining the debugging process.
- **Comprehensive Documentation:** Provides instant access to relevant documentation and examples, enhancing understanding and productivity.
- **Customizable Settings:** Tailor CodeMasterPro to your specific coding style and preferences.
- **Multi-Language Support:** Supports a wide range of programming languages, ensuring versatility across projects.
- **Mutli-Model Support** - Requires you to have a together API to use the Reasoner pro for a diversified answer
- **Runs Python and HTML** - Allows you to directly run the codes in a safe environment
- **Memory, Internet and other tools** - Has support for many tools including internal docuemntation, web scraping of websites for effective RAG
- **Previous Chats and Snippets** - You can now choose to save chats and snippets for later use and CodeMasterPro will always save your last unsaved chat
- **Highly Customized** - You can customize the prompt and the preferences as you like that suits you

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started): Ensure Docker is installed and running on your system.
- **Gemini API Key:** Required for core AI functionality. Obtain a free API key from [Google Gemini](https://ai.google.dev/).
- **Brave API Key (Optional):** Enhances search capabilities. Obtain a free API key from [Brave Search API](https://brave.com/search/api/).
- **Together API key (Optional, required for Reasoner Pro):** Enhances the answer way more, but way slower, useful for advance coding questions. Obtain a free API key from [Together API](https://api.together.ai/)

### Available Tools

- **web** – Allows access to the internet. Prompt your queries with natural instructions like:  
  *“Search online how to create an MCP server.”*

- **stack** – Searches Stack Overflow for developer-relevant answers and code examples.  
  Great for resolving language-specific or library-related issues.

- **internal** – Searches internal documentation or knowledge bases, such as team wikis or private datasets.  
  Use when your answer likely exists within internal sources.

- **python** – Executes Python code in an isolated environment.  
  Useful for testing logic, calculations, or snippets.

- **compute** – Handles complex mathematical computations or factorial operations.  
  Example: *“What is 756!?”*

- **visualize** – Transforms raw log data into charts or graphs.  
  Example: *“Provide logs and give me a visualization of CPU usage over time.”*

- **sast** – Performs static application security testing (SAST) on Python code.  
  Detects vulnerabilities, bad patterns, and unsafe practices.

- **lightning** – Delivers very fast answers to lightweight or fact-based questions.  
  Optimized for speed over deep reasoning.
  
- **deep_analysis** - Analyses the large codes in detail, mostly 50000+ character codes
  Can you give me a deep anaysis of the code
  

## Main Chain of Thought
![image](https://github.com/user-attachments/assets/597b550e-105d-4cd0-9ee1-feac3db32f2e)

### ✅ Overview

The workflow follows a structured decision-making and response generation pipeline, enhanced by reinforcement learning and multi-model reasoning.

---

### ⚙️ 1. Tool Selection & Execution

* Checks for an appropriate tool.
* Executes it immediately if available for a fast, actionable response.

---

### 🧠 2. Sentiment & Behavior Analysis

* Evaluates user sentiment and past interactions.
* Skipped if no behavioral history exists.

---

### 🌐 3. Resource Retrieval

* Fetches additional resources (e.g., web data, Stack Overflow, internal KBs) when needed.

---

### 🧬 4. Reinforcement Learning Feedback

* Uses sentiment data to reward or penalize the RL agent.
* Influences future decisions and model behaviors.

---

### 🧾 5. Response Generation

* Combines sentiment, context, and history to produce an initial response.

---

### 🪞 6. Response Refinement

* Enhances clarity, quality, and coherence of the response.

---

### 🧠 7. Multi-Model Reasoning

* Invokes models like Gemini and others for deeper, more diverse insights based on reasoning level.

---

### ⚡ 8. Fast Path Return

* Skips validation when speed is critical and returns the response immediately.

---

### 🔁 9. Quick Reasoning Path

* Uses a lightweight reasoner.
* Validates up to 3 times using the best prior answer.
* Iterates without external model input.

---

### 🧩 10. Pro-Level Reasoning

* Engages advanced models and third-party outputs.
* Ensures broader context and selects the best response.

---

### 🧠 11. RL Agent Optimization

* Continuously tunes the RL agent via rewards/penalties.
* Chooses the optimal result after multiple iterations.

---

### 🎯 12. Greedy Optimization Strategy

* Prioritizes the best possible outcome.
* May settle early if minimum quality is met.


## Code Analyst Chain 
![image](https://github.com/user-attachments/assets/46dbc438-cb0f-4deb-9412-344c3cf74f08)

Designed for deep analysis of large codebases, **CodeAnalystPro** excels at code explanation and modification. Below is the step-by-step workflow:

### 1. **Code Chunking**

* Splits the source code into manageable segments of **2,000–5,000 characters**.

### 2. **Chunk Analysis with Retry Logic**

* Each chunk is analyzed.
* Up to **5 retry attempts** are allowed to improve accuracy.

### 3. **Context-Aware Modification**

* Modifications are made with awareness of:

  * The **current chunk**.
  * **Previously generated outputs**.
* Ensures output consistency across chunks.

### 4. **Fallback Mechanism**

* If a chunk **fails validation**:

  * The **best previous version** is reused.
  * The **context window is reduced** to limit hallucinations.

### 5. **Validation Threshold**

* Chunks must meet a **90% validation score** to proceed.
* If validation passes, the system advances to the next chunk.

### 6. **Iterative Refinement**

* Each chunk is either **corrected or explained** before moving on.

### 7. **Final Output Reconstruction**

* All chunks are reassembled into a final version.
* A **lightweight Gemini model** performs final polishing and cleanup.

## Python Chain 
![image](https://github.com/user-attachments/assets/3c6f9d3d-2f6a-4de9-b535-c2aaefe126f0)


### Installation

1. **Pull the Docker image:**

```shell
docker pull stefankumarasinghe/codemasterpro
```
Please use the relevant tags, for best performance, there is amd64, arm64 and latest which is compatible for both (but heavy)

2. **Run the Docker container:**

```shell
docker run -e GOOGLE_API_KEY=YOUR_GEMINI_API_KEY -p 8000:8000 stefankumarasinghe/codemasterpro
```
While you can also have the BRAVE_API_KEY and TOGETHER_AI_API_KEY using -e, CodeMasterPro allows you to set via the UI

- Replace `YOUR_GEMINI_API_KEY` with your actual Gemini API key.
- Replace `YOUR_BRAVE_API_KEY` with your Brave API key (if you have one).
- Replace `TOGETHER_AI_API_KEY` with your Together key

- Make sure to create an .env, if you are doing it via the terminal (root-level)
- Make sure to have the port 8000 ready as well

3. **Access CodeMasterPro:**

Open your web browser and navigate to `[CodeMasterPro](https://dwr4zchmi6x24.cloudfront.net/)`.
You need to run the docker container, you can stop when you don't need it and start it without entering the token again
## Configuration

### Environment Variables

- `GOOGLE_API_KEY`: Your Gemini API key. This is **required**.
- `BRAVE_API_KEY`: Your Brave Search API key. This is **optional** but recommended for enhanced search functionality.

### Customization

CodeMasterPro can be further customized through the UI 

- **Model Selection:** Choose between different AI models for code completion and debugging.
- **Language Preferences:** Specify your preferred programming languages.
- **UI Themes:** Customize the look and feel of the CodeMasterPro interface.
- **So much more** ...

## Usage

1. **Code Editor Integration:** Integrate CodeMasterPro with your favorite code editor (e.g., VS Code, Sublime Text, Atom) using the provided plugins or extensions.
2. **Large and Accurate Code Generations** Can produce large outputs and also take in large inputs, thanks to Gemini's 1million token window
3. **Real-Time Assistance:** As you type, CodeMasterPro will provide real-time code suggestions, error detection, and documentation snippets.
4. **Debugging Tools:** Utilize the AI-powered debugging tools to identify and resolve issues quickly.
5. **Documentation Lookup:** Access comprehensive documentation for various programming languages and libraries directly within the CodeMasterPro interface.

## Example Prompt

Example 1: Can you correct and improve this code
Example 2: Can you check for vunerabilties in the python code
Example 3: Visualize my logs please
Example 4: Give me a full working chess game in HTML with all the logic and rules
Example 5: Run this python code

## Contributing

We welcome contributions to CodeMasterPro! Please follow these guidelines:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a clear description of your changes.
4. If you were to fork this REPO, while this project is licensed under MIT, you must credit me

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. However, you must credit me, if you are using the app

## Support

For questions, bug reports, or feature requests, please raise an issue or PR
## Acknowledgements

- Powered by Google Gemini and Brave Search API and Together AI and CodeMasterPro's Chain of Thought
