# CodeMasterPro: The Ultimate Refined Coding AI for Software Engineers

[![Docker Pulls](https://img.shields.io/docker/pulls/stefankumarasinghe/codemasterpro)](https://hub.docker.com/r/stefankumarasinghe/codemasterpro)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CodeMasterPro is an advanced AI-powered coding assistant designed to elevate the software engineering experience.

## Features

- **Understanding User** Understands user intentions - could be further enhanced
- **AI-Powered Debugging:** Identifies potential errors and suggests fixes, streamlining the debugging process.
- **Comprehensive Documentation:** Provides instant access to relevant documentation and examples, enhancing understanding and productivity.
- **Customizable Settings:** Tailor CodeMasterPro to your specific coding style and preferences.
- **Multi-Language Support:** Supports a wide range of programming languages, ensuring versatility across projects.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started): Ensure Docker is installed and running on your system.
- **Gemini API Key:** Required for core AI functionality. Obtain a free API key from [Google Gemini](https://ai.google.dev/).
- **Brave API Key (Optional):** Enhances search capabilities. Obtain a free API key from [Brave Search API](https://brave.com/search/api/).


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



### Installation

1. **Pull the Docker image:**

```shell
docker pull stefankumarasinghe/codemasterpro
```

2. **Run the Docker container:**

```shell
docker run -e GOOGLE_API_KEY=YOUR_GEMINI_API_KEY -e BRAVE_API_KEY=YOUR_BRAVE_API_KEY -p 8000:8000 stefankumarasinghe/codemasterpro
```

- Replace `YOUR_GEMINI_API_KEY` with your actual Gemini API key.
- Replace `YOUR_BRAVE_API_KEY` with your Brave API key (if you have one).

3. **Access CodeMasterPro:**

Open your web browser and navigate to `http://localhost:8000`.

## Configuration

### Environment Variables

- `GOOGLE_API_KEY`: Your Gemini API key. This is **required**.
- `BRAVE_API_KEY`: Your Brave Search API key. This is **optional** but recommended for enhanced search functionality.

### Customization

CodeMasterPro can be further customized through a configuration file (e.g., `config.ini` or `config.yaml`). Example settings include:

- **Model Selection:** Choose between different AI models for code completion and debugging.
- **Language Preferences:** Specify your preferred programming languages.
- **UI Themes:** Customize the look and feel of the CodeMasterPro interface.

## Usage

1. **Code Editor Integration:** Integrate CodeMasterPro with your favorite code editor (e.g., VS Code, Sublime Text, Atom) using the provided plugins or extensions.
2. **Real-Time Assistance:** As you type, CodeMasterPro will provide real-time code suggestions, error detection, and documentation snippets.
3. **Debugging Tools:** Utilize the AI-powered debugging tools to identify and resolve issues quickly.
4. **Documentation Lookup:** Access comprehensive documentation for various programming languages and libraries directly within the CodeMasterPro interface.

## Examples

Example 1: Code Completion
Example 2: Debugging Assistance

## Contributing

We welcome contributions to CodeMasterPro! Please follow these guidelines:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. However, you must credit me, if you are using the app

## Support

For questions, bug reports, or feature requests, please raise an issue or PR
## Acknowledgements

- Powered by Google Gemini and Brave Search API.
