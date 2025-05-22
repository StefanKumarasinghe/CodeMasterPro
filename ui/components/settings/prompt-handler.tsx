import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PromptSettingsTabProps {
  customPrompt: string;
  setCustomPrompt: React.Dispatch<React.SetStateAction<string>>;
  personalInfo: string;
  setPersonalInfo: React.Dispatch<React.SetStateAction<string>>;
  inputPreference: "Autotag" | "NoTag";
  setInputPreference: (value: "Autotag" | "NoTag") => void;
}

const PromptSettingsTab: React.FC<PromptSettingsTabProps> = ({
  customPrompt,
  setCustomPrompt,
  personalInfo,
  setPersonalInfo,
  inputPreference,
  setInputPreference,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="custom-prompt">Custom Prompt</Label>
        <Textarea
          id="custom-prompt"
          placeholder="Add custom instructions for the AI (e.g., 'Always explain code with examples')"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="personal-info">Personal Information</Label>
        <Textarea
          id="personal-info"
          placeholder="Add personal context (e.g., 'I'm a beginner in React' or 'I use VS Code as my editor')"
          value={personalInfo}
          onChange={(e) => setPersonalInfo(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Input Preference</Label>
        <RadioGroup
          value={inputPreference}
          onValueChange={(value: "Autotag" | "NoTag") => setInputPreference(value)}
        >
          <div className="text-sm text-muted-foreground my-3">
            If you don't want CodeMasterPro to format your code,
            select "No formatting". Otherwise, select "Auto format" to
            let it format your code automatically.
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Autotag" id="input-text" />
            <Label htmlFor="input-text">Auto format</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="NoTag" id="input-code" />
            <Label htmlFor="input-code">No formatting</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default PromptSettingsTab;