"use client";

import type React from "react";
import { FaDocker } from "react-icons/fa";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {Terminal,Code,Zap,Sliders,MousePointerClick,LayoutTemplate,ShieldCheck,Lightbulb,Sparkles,Keyboard,BrainIcon,PlayCircle} from "lucide-react";
import { APP_NAME } from "@/config/constants";
import { API_ENDPOINT } from "@/config/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "@/context/chat-context";

const EXAMPLE_PROMPTS = [
  "I want a Python code that can generate an OpenSSL key pair, private and public, and print the pair.",
  "I want a Python code to print the factorial of a number.",
  "I want a comprehensive, wonderful UI snake game in HTML.",
  "Give me a code example of a simple React component.",
  "How do I create a REST API with Node.js and Express?",
  "Write a SQL query to find all users with an age greater than 30.",
  "Explain the concept of promises in JavaScript.",
  "How do I use async/await in JavaScript?",
  "Create a simple CRUD application using React and Redux.",
  "What is the difference between var, let, and const in JavaScript?",
  "Write a Python function to calculate the factorial of a number.",
  "How do I implement authentication in a Node.js application?",
  "Create a responsive layout using CSS Grid.",
  "How do I handle form validation in React?",
  "Write a JavaScript function to debounce a given function.",
  "How do I use the Fetch API to make HTTP requests?",
  "Give me some important DevOps tools to use.",
  "How do I set up a MongoDB database with Mongoose?",
  "Write a CSS rule to center an element both vertically and horizontally.",
  "How do I implement routing in a React application?",
  "How do I implement a responsive navbar with React and Tailwind?",
  "Explain the difference between useEffect and useLayoutEffect in React.",
  "Write a function to find the longest substring without repeating characters.",
  "How can I optimize the performance of my React application?",
  "Create a TypeScript interface for a user authentication system.",
  "How do I set up a custom webpack configuration for a React app?",
  "Write a Python function to merge two sorted lists into one sorted list.",
  "How can I handle errors in asynchronous JavaScript code?",
  "Explain the concept of closures in JavaScript with an example.",
  "Create a Node.js REST API using Express.js.",
  "How do I implement lazy loading in React?",
  "Write a SQL query to find the second highest salary from an employees table.",
  "How do I create a custom hook in React?",
  "How do I debug a memory leak in a Node.js application?",
  "Write a regular expression to validate an email address.",
  "Generate a QR code from a URL in Python.",
  "Create a HTML/CSS/JS stopwatch with start, stop, and reset buttons.",
  "Write a Bash script to monitor disk usage and alert if above threshold.",
  "Create a Python script that scrapes titles from a news website.",
  "Give me a template for a GitHub Actions CI/CD workflow for Node.js.",
  "Build a todo app using vanilla JavaScript and local storage.",
];

export function ChatWelcome() {
  const [serverStatus, setServerStatus] = useState(false);
  const [dockerRunCommand, setDockerRunCommand] = useState(
    "docker run -e GOOGLE_API_KEY=TOKEN -e BRAVE_API_KEY=TOKEN -p 8000:8000 stefankumarasinghe/codemasterpro"
  );
  const [activeTab, setActiveTab] = useState<"features" | "examples">(
    "features"
  );
  const [hoveredPrompt, setHoveredPrompt] = useState<number | null>(null);
  const { handleSubmit } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const usePrompt = useCallback(
    (prompt: string) => {
      handleSubmit(prompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [handleSubmit]
  );

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch(`${API_ENDPOINT}/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        setServerStatus(response.ok);
      } catch (error) {
        console.error("Error checking server status:", error);
        setServerStatus(false);
      }
    };

    const setAppropriateDockerCommand = () => {
      const platform = navigator.platform;
      let command =
        "docker run -e GOOGLE_API_KEY=TOKEN -e BRAVE_API_KEY=TOKEN -p 8000:8000 stefankumarasinghe/codemasterpro";
      if (platform.includes("Mac")) {
        command =
          "docker run -e GOOGLE_API_KEY=TOKEN -e BRAVE_API_KEY=TOKEN -p 8000:8000 stefankumarasinghe/codemasterpro:latest";
      } else if (platform.includes("Win") || platform.includes("Linux")) {
        command =
          "docker run -e GOOGLE_API_KEY=TOKEN -e BRAVE_API_KEY=TOKEN -p 8000:8000 stefankumarasinghe/codemasterpro:amd64";
      }
      setDockerRunCommand(command);
    };
    checkServerStatus();
    setAppropriateDockerCommand();
  }, []);

  const handlePromptClick = (prompt: string) => {
    usePrompt(prompt);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-full mb-8 p-4 rounded-lg flex flex-col items-center text-center gap-4 sm:p-6 sm:gap-6"
      >
        <div>
          <p className="text-sm sm:text-base">
            CodeMasterPro was developed by Stefan Kumarasinghe and is powered by
            Gemini's 4 models (lite is used for intermediate steps). CodeMasterPro is a product of Stefan Kumarasinghe
            and is not affiliated with or endorsed by any other company or
            organization. This is an open-source project and is not intended for
            commercial use. This application can be used by any software
            engineer (License: MIT). But please credit me
          </p>
          <p className="text-sm font-bold mt-5 text-red-500 sm:text-base">
            Think twice before using any code generated by Tars
          </p>
        </div>
      </motion.div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="rounded-full flex items-center justify-center mb-6"
      >
        <BrainIcon className="h-20 w-20 text-black font-light" />
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-3xl font-bold mb-2"
      >
        Hey there! I am {APP_NAME}
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-muted-foreground max-w-full mb-8"
      >
        Your AI-powered coding companion. Ask any programming question or
        request code examples to boost your productivity.
      </motion.p>
      <div className="w-full max-w-full mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-muted/50 rounded-lg p-1 flex">
            <Button
              variant={activeTab === "features" ? "default" : "ghost"}
              className="rounded-md"
              onClick={() => setActiveTab("features")}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Features
            </Button>
            <Button
              variant={activeTab === "examples" ? "default" : "ghost"}
              className="rounded-md"
              onClick={() => setActiveTab("examples")}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Example Prompts
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "features" ? (
            <motion.div
              key="features"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid justify-center grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full"
            >
              <FeatureCard
                icon={<Terminal className="h-5 w-5 text-primary" />}
                title="Code Assistant"
                description="Get help with syntax, debugging, or understanding complex concepts"
              />
              <FeatureCard
                icon={<Code className="h-5 w-5 text-primary" />}
                title="Code Generation"
                description="Code generation is run through at least 3 stages, including a validation stage"
              />
              <FeatureCard
                icon={<Zap className="h-5 w-5 text-primary" />}
                title="Reinforcement Agent (Thinker)"
                description="We use a reinforcement agent to improve the code generation process using rewards and punishments"
              />
              <FeatureCard
                icon={<Sliders className="h-5 w-5 text-primary" />}
                title="FAISS & Internet Search"
                description="Search for code snippets, libraries, and documentation from the web and save them to your local FAISS database"
              />
              <FeatureCard
                icon={<MousePointerClick className="h-5 w-5 text-primary" />}
                title="Interactive Code"
                description="Click 'Use' on any code block to instantly add it to your message input, with quick actions for easy access"
              />
              <FeatureCard
                icon={<LayoutTemplate className="h-5 w-5 text-primary" />}
                title="Run HTML codes"
                description="To get a preview of your HTML, click run"
              />
              <FeatureCard
                icon={<PlayCircle className="h-5 w-5 text-primary" />}
                title="Run Python codes"
                description="We run Python codes using a venv and return the result, the python uses a retry mechanism that self-corrects"
              />
              <FeatureCard
                icon={<ShieldCheck className="h-5 w-5 text-primary" />}
                title="Memory Management"
                description="We use a memory management system to keep track of your code and its dependencies and we analyze user intent"
              />
            </motion.div>
            ) : (
            <motion.div
              key="examples"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 max-w-2xl mx-auto"
            >
              {EXAMPLE_PROMPTS.map((prompt, index) => (
                <motion.div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer text-left flex justify-between items-center",
                    hoveredPrompt === index && "bg-accent/50"
                  )}
                  onMouseEnter={() => setHoveredPrompt(index)}
                  onMouseLeave={() => setHoveredPrompt(null)}
                  onClick={() => handlePromptClick(prompt)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <p className="text-sm">{prompt}</p>
                  <Button variant="ghost" size="sm" className="ml-2 opacity-70">
                    <Keyboard className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Use</span>
                  </Button>
                </motion.div>
              ))}
              <p className="text-xs text-muted-foreground mt-4">
                Click on a prompt to use it in your conversation
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {serverStatus ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-base  max-w-full"
        >
          <p className="mb-6 text-lg">
            TARS is running locally. You can now start using it. Please Watch
            the{" "}
            <a href="" className="text-underline text-purple-400">
              video
            </a>{" "}
            to use TARS to the fullest!
          </p>
          <p className="text-sm"> All rights reserved to Stefan Kumaraisnghe</p>
        </motion.div>
        ) : (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-base text-muted-foreground max-w-full"
        >
          <FaDocker className="h-16 w-16 text-primary inline-block mr-4" />
          <p className="mb-6 text-lg">
            You will need to download the Docker image to run the backend server
            locally.
          </p>
          <a
            href="https://hub.docker.com/repository/docker/stefankumarasinghe/codemasterpro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-bold text-lg transition-colors"
          >
            docker pull stefankumarasinghe/codemasterpro
          </a>
          <div className="flex justify-center mt-6">
            <p>{dockerRunCommand}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FeatureCard({icon,title,description}: {icon: React.ReactNode;title: string;description: string;}) {
  return (
    <motion.div
      className="bg-card border rounded-lg p-4 hover:shadow-md transition-all hover:border-primary/50"
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="bg-primary/10 p-2 rounded-full">{icon}</div>
      </div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}
