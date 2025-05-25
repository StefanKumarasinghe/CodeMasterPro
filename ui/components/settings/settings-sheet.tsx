"use client";

import React, { useState } from "react";
import { Settings, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/utils/toast-util";
import { STORAGE_KEYS } from "@/config/constants";
import PromptSettingsTab from "./prompt-handler";
import ApiIntegrationContent from "./api-intergration";
import GeneralSettingsTab from "./setting";

interface CodeQualityPreferences {
  linting?: boolean;
  formatting?: boolean;
  comments?: boolean;
  typeChecking?: boolean;
  bestPractices?: boolean;
}

interface SettingsSheetProps {
  preferences: {
    inputPreference: "Autotag" | "NoTag";
    outputFormat: "codeAndExplanation" | "codeOnly" | "explanationOnly";
    codeQuality?: CodeQualityPreferences;
    freeModel?: string;
    providerModel?: string;
  };
  setPreferences: React.Dispatch<React.SetStateAction<SettingsSheetProps['preferences']>>;
  customPrompt: string;
  setCustomPrompt: React.Dispatch<React.SetStateAction<string>>;
  personalInfo: string;
  setPersonalInfo: React.Dispatch<React.SetStateAction<string>>;
}

export default function SettingsSheet({
  preferences,
  setPreferences,
  customPrompt,
  setCustomPrompt,
  personalInfo,
  setPersonalInfo,
}: SettingsSheetProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const savePreferences = () => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PREFERENCES,
        JSON.stringify(preferences)
      );
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, customPrompt || "");
      localStorage.setItem(STORAGE_KEYS.PERSONAL_INFO, personalInfo || "");
      toast.success("Preferences saved successfully (locally)");
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Failed to save preferences locally:", error);
      toast.error("Failed to save preferences locally. Please try again.");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost">
            <Settings style={{ height: "1.2rem", width: "1.2rem" }}  />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Preferences</SheetTitle>
          </SheetHeader>
          <div className="py-4 h-full flex flex-col">
            <Tabs defaultValue="prompt" className="flex flex-col flex-grow overflow-y-auto">
              <TabsList className="grid w-full grid-cols-3 gap-2">
                <TabsTrigger value="prompt"> Prompt </TabsTrigger>
                <TabsTrigger value="integration"> Integrations </TabsTrigger>
                <TabsTrigger value="settings"> Settings </TabsTrigger>
              </TabsList>
              <TabsContent value="prompt" className="space-y-4 mt-4 flex-grow overflow-y-auto pr-2">
                <PromptSettingsTab
                  customPrompt={customPrompt}
                  setCustomPrompt={setCustomPrompt}
                  personalInfo={personalInfo}
                  setPersonalInfo={setPersonalInfo}
                  inputPreference={preferences.inputPreference}
                  setInputPreference={(value) => setPreferences({...preferences, inputPreference: value})}
                />
              </TabsContent>
              <TabsContent value="integration" className="flex-grow overflow-y-auto pr-2">
                <ApiIntegrationContent />
              </TabsContent>
              <TabsContent value="settings" className="space-y-6 mt-4 flex-grow overflow-y-auto pr-2">
                <GeneralSettingsTab
                  outputFormat={preferences.outputFormat}
                  setOutputFormat={(value) => setPreferences({...preferences, outputFormat: value})}
                  providerModel={preferences.providerModel}
                  setProviderModel={(value) => setPreferences({...preferences, providerModel: value})}
                  freeModel={preferences.freeModel}
                  setFreeModel={(value) => setPreferences({...preferences, freeModel: value})}
                  codeQuality={preferences.codeQuality}
                  setCodeQuality={(value) => setPreferences({...preferences, codeQuality: value})}
                />
              </TabsContent>
            </Tabs>
            <Button className="m-3" onClick={savePreferences}>
              <Save className=" w-full h-4 w-4" />
              Save Preferences
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}