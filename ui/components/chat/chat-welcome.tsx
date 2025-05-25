"use client";

import type React from "react";
import { FaDocker } from "react-icons/fa";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { API_ENDPOINT } from "@/config/constants";
import BinaryCodeBrainEffect from "@/components/ui/brain";
import { useChat } from "@/context/chat-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 40, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      damping: 10,
      stiffness: 100,
    },
  },
};

export function ChatWelcome() {
  const [serverStatus, setServerStatus] = useState(false);
  const [dockerRunCommand, setDockerRunCommand] = useState(
    "docker run -e GOOGLE_API_KEY=TOKEN -p 8000:8000 stefankumarasinghe/codemasterpro"
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

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[calc(90vh-200px)] text-center px-4 relative overflow-hidden  text-white p-8 "
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <BinaryCodeBrainEffect/>
      </motion.div>
      <motion.h1
        variants={itemVariants}
        style={{
          WebkitTextStroke: '2px white',
        }}
        className="lg:text-5xl md:text-4xl text-3xl hidden dark:block md:text-6xl font-extrabold my-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500"
      >
        The CodeMaster Returns
      </motion.h1>
            <motion.h1
        variants={itemVariants}
        style={{
          WebkitTextStroke: '2px black',
        }}
        className="text-5xl block dark:hidden md:text-6xl font-extrabold my-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500"
      >
        The CodeMaster Returns
      </motion.h1>
      <motion.p
        variants={itemVariants}
        className="text-black dark:text-white text-lg md:text-xl max-w-4xl my-2 mb-10"
      >
        Your GPT for coding. Contextualize your codebase with a powerfully chained AI
      </motion.p>
      {serverStatus ? (
        <motion.div
          variants={itemVariants}
          className="text-base max-w-full text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500"
        >
          <p className="text-md"> All rights reserved to Stefan Kumarasinghe. Happy Coding...</p>
        </motion.div>
      ) : (
        <motion.div
          variants={itemVariants}
          className="text-base text-muted-foreground max-w-full mt-8 p-6 rounded-lg"
        >
          <FaDocker className="h-16 w-16 text-blue-500  font-mono inline-block mr-4 mb-4" />
          <p className="mb-6 text-sm md:text-lg ">
            You will need to download the Docker image to run the backend server
            locally.
          </p>
          <a
            href="https://hub.docker.com/repository/docker/stefankumarasinghe/codemasterpro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-mono text-xs md:text-lg transition-colors"
          >
            docker pull stefankumarasinghe/codemasterpro
          </a>
          <p className="text-green-800 text-xs md:text-lg my-4 dark:text-green-300 font-mono">{dockerRunCommand}</p>
        </motion.div>
      )}
    </motion.div>
  );
}