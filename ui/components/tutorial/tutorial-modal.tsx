import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

import {
  Code,
  MousePointerClick,
  LayoutTemplate,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  PlayCircle,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Github,
  FileText,
} from "lucide-react";

const TUTORIAL_STEPS = [
  {
    title: "✨ Welcome to CodeMasterPro",
    description:
      "Hey CodeMaster! 🚀 I’m here to help you build faster, smarter, and cleaner. Whether you're coding from scratch or refining old code, just ask — I’ve got your back every step of the way.",
    icon: <Sparkles className="h-6 w-6 text-primary" />,
    gif: "/welcome.gif",
  },
  {
    title: "🎬 Getting Started",
    description:
      "Click around and explore the interface — no worries, nothing breaks! 🖱️ Look out for tooltips and try features like 💡 prompt suggestions or 🛠️ code actions.",
    icon: <PlayCircle className="h-6 w-6 text-primary" />,
  },
  {
    title: "🤖 Smart Code Generation",
    description:
      "Need a function or a full component? Just ask! ✍️ CodeMasterPro understands and generates clean, efficient, and readable code tailored to your request.",
    icon: <Code className="h-6 w-6 text-primary" />,
  },
  {
    title: "⚡ Quick Code Actions",
    description:
      "Hover over code snippets to unlock instant actions: 🧠 Explain, 🐞 Debug, 🚀 Optimize, or 💬 Comment. You can even run 🐍 Python and 🌐 HTML snippets right away!",
    icon: <MousePointerClick className="h-6 w-6 text-primary" />,
  },
  {
    title: "📄 Custom Documentation",
    description:
      "Upload your own files or links using the Documentation tab 📁. This helps the AI understand your stack and APIs better for tailored assistance.",
    icon: <LayoutTemplate className="h-6 w-6 text-primary" />,
  },
  {
    title: "🧠 Memory & Context Awareness",
    description:
      "Conversations are remembered! 📝 Use the 🧠 icon to manage memory and view current context. Each browser tab has its own memory — perfect for multitasking and parallel conversations!",
    icon: <ShieldCheck className="h-6 w-6 text-primary" />,
  },
  {
    title: "🐙 GitHub Integration",
    description:
      "Upload GitHub files or repo links via the GitHub tab. 🔗 This gives the AI deeper context and improves answer quality using relevant examples.",
    icon: <Github className="h-6 w-6 text-primary" />,
  },
  {
    title: "📦 Project Context",
    description:
      "Drop your project zip files in the Project Context tab to provide full codebase understanding. 🧰 This helps tailor smarter and more accurate solutions.",
    icon: <FileText className="h-6 w-6 text-primary" />,
  },
  {
    title: "🧩 MCP-like Integration",
    description:
      "Use the MCP tab to enable tools like 🖥️ Computer, 🌐 Browser, or ❓ StackOverflow. Boosts context-awareness for even smarter assistance.",
    icon: <MousePointerClick className="h-6 w-6 text-primary" />,
  },
  {
    title: "💡 Tips & Best Practices",
    description: `
      1️⃣ Be clear and specific in your prompts  
      2️⃣ Explore example prompts to spark ideas  
      3️⃣ Save helpful code with the 💾 icon  
      4️⃣ Upload your docs early for smarter answers  
      5️⃣ Use code actions instead of typing repetitive tasks  
      6️⃣ Use the 🐍 Python shell to run code directly  
      7️⃣ Upload docs via the 📄 Documentation tab  
      8️⃣ Manage memory with the 🧠 Memory tab  
      9️⃣ Tweak preferences in ⚙️ Settings  
      🔟 Edit code snippets right in the chat!`,
    icon: <Lightbulb className="h-6 w-6 text-primary" />,
  },
];

  
interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = TUTORIAL_STEPS.length;

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  const stepVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">CodeMasterPro Tutorial</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <motion.div
              className="w-full h-1.5 bg-muted"
            >
              <motion.div
                className="h-1.5 bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </motion.div>

            <div className="p-6 my-4 flex-grow overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  {TUTORIAL_STEPS[currentStep] ? (
                    <div className="flex items-start gap-4">
                      <div className="mt-1 shrink-0">{TUTORIAL_STEPS[currentStep].icon}</div>
                      <div>
                        <h3 className="text-lg font-medium mb-2">
                          {TUTORIAL_STEPS[currentStep].title}
                        </h3>
                        <p className="text-muted-foreground whitespace-pre-line">
                          {TUTORIAL_STEPS[currentStep].description}
                        </p>
                        {TUTORIAL_STEPS[currentStep].gif && (
                          <img
                            src={TUTORIAL_STEPS[currentStep].gif}
                            alt={TUTORIAL_STEPS[currentStep].title}
                            className="rounded-md mt-4"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      Tutorial step not found.
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="p-6 pt-4 border-t flex justify-between items-center">
              <div className="flex gap-2">
                {currentStep === 0 && (
                  <Button variant="ghost" onClick={onClose}>
                    Skip Tutorial
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={previousStep}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
              </div>
              {currentStep === totalSteps - 1 ? (
                <Button variant="default" onClick={onClose}>
                  Finish
                </Button>
              ) : (
                <Button variant="default" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}