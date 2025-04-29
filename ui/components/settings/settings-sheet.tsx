"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetTrigger} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/utils/toast-util";
import type { Preferences } from "@/types";
import { STORAGE_KEYS } from "@/config/constants";

interface SettingsSheetProps {
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  personalInfo: string;
  setPersonalInfo: (info: string) => void;
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
      toast.success("Preferences saved successfully");
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences. Please try again.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Preferences</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <Tabs defaultValue="prompt">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="prompt" className="space-y-4 mt-4">
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
                <div className="text-sm text-muted-foreground">
                  This information helps the AI understand your preferences. It
                  will not be shared with anyone. I would use it to say don't
                  add comments or give me the full code in one go.
                </div>
              </TabsContent>
              <TabsContent value="personal" className="space-y-4 mt-4">
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
                <div className="text-sm text-muted-foreground">
                  This information helps the AI provide more relevant responses.
                  It will not be shared with anyone.
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Input Preference</Label>
                  <RadioGroup
                    value={preferences.inputPreference}
                    onValueChange={(value) =>
                      setPreferences({
                        ...preferences,
                        inputPreference: value as "Autotag" | "NoTag",
                      })
                    }
                  >
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
                <div className="text-sm text-muted-foreground">
                  Auto format will automatically format your code snippets by
                  enclosing them in code blocks. No formatting will not apply
                  any formatting to your code snippets.
                </div>
              </TabsContent>
              <TabsContent value="settings" className="space-y-6 mt-4">
                <div className="space-y-3">
                  <Label>Output Format</Label>
                  <RadioGroup
                    value={preferences.outputFormat}
                    onValueChange={(value) =>
                      setPreferences({
                        ...preferences,
                        outputFormat: value as
                          | "codeAndExplanation"
                          | "codeOnly"
                          | "explanationOnly",
                      })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="codeAndExplanation" id="r1" />
                      <Label htmlFor="r1">Code with Explanation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="codeOnly" id="r2" />
                      <Label htmlFor="r2">Code Only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="explanationOnly" id="r3" />
                      <Label htmlFor="r3">Explanation Only</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    While CodeMasterPro may not always stick to the output
                    format, it will try its best to follow it. It is designed to
                    also understand context and provide relevant responses.
                  </p>
                </div>
                <Separator />

                <div className="space-y-3">
                  <Label>Code Quality Preferences</Label>
                  <div className="space-y-2">
                    {[
                      "linting",
                      "formatting",
                      "comments",
                      "typeChecking",
                      "bestPractices",
                    ].map((field) => (
                      <div
                        key={field}
                        className="flex items-center justify-between"
                      >
                        <Label htmlFor={field} className="text-sm">
                          {field.charAt(0).toUpperCase() +
                            field.slice(1).replace(/([A-Z])/g, " $1")}
                        </Label>
                        <Switch
                          id={field}
                          checked={
                            preferences?.codeQuality?.[
                              field as keyof typeof preferences.codeQuality
                            ] || false
                          }
                          onCheckedChange={(checked) =>
                            setPreferences({
                              ...preferences,
                              codeQuality: {
                                ...(preferences?.codeQuality || {}),
                                [field]: checked,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    This information helps the AI provide more relevant
                    responses. It will not be shared with anyone.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            <Button className="w-full mt-6" onClick={savePreferences}>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
