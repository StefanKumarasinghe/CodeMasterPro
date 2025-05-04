"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, Loader2, Globe, Sparkle, BrainCircuitIcon, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_ENDPOINT } from "@/config/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/utils/toast-util";
import { STORAGE_KEYS } from "@/config/constants";

const API_SERVICES = [
  { id: "gemini", name: "Gemini", icon: Globe, description: "Required to Run TARS", link: "https://aistudio.google.com/app/apikey?_gl=1*11usfy7*_ga*OTU3MDg0MDk0LjE3NDYwOTA1NzE.*_ga_P1DBVKWT6V*MTc0NjA5MDU3MS4xLjAuMTc0NjA5MDU3MS42MC4wLjMzMTEzOTAyNQ.." },
  { id: "brave", name: "Brave", icon: Sparkle, description: "Internet Access", link: "https://api-dashboard.search.brave.com/" },
  { id: "together-ai", name: "Together", icon: BrainCircuitIcon, description: "Multi-Agent", link:"https://api.together.ai"},
];

const ServiceBox = ({ service, onClick }) => (
  <div
    className="flex flex-col items-center justify-center p-6 border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out bg-card text-card-foreground cursor-pointer transform hover:scale-105"
    onClick={() => onClick(service)}
  >
    <service.icon className="w-8 h-8 mb-4 text-primary" />
    <h3 className="text-lg text-center font-semibold mb-1">{service.name}</h3>
    <p className="text-sm text-muted-foreground text-center">
      {service.description}
    </p>
  </div>
);

const ApiIntegrationContent = () => {
  const [selectedService, setSelectedService] = useState(null);
  const [modalView, setModalView] = useState("initial");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [fetchedApiKey, setFetchedApiKey] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!selectedService) {
      setModalView("initial");
      setApiKeyInput("");
      setIsLoading(false);
      setSubmissionStatus(null);
      setFetchedApiKey(null);
      setFetchError(null);
    }
  }, [selectedService]);


  const handleServiceBoxClick = (service) => {
    setSelectedService(service);
  };

  const handleViewOldClick = async () => {
    if (!selectedService) return;

    setModalView("view");
    setIsLoading(true);
    setFetchedApiKey(null);
    setFetchError(null);

    console.log(`Attempting to fetch key for ${selectedService.name}...`);

    try {
      const response = await fetch(`${API_ENDPOINT}/get_api_keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceId: selectedService.id }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to fetch key for ${selectedService.name}. Status: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData) {
                errorMessage = JSON.stringify(errorData);
            }
        } catch (jsonError) {
            console.error("Failed to parse error JSON:", jsonError);
        }
        console.error("Fetch API Key Error:", errorMessage);
        setFetchError(errorMessage);
        toast.error(`Error fetching ${selectedService.name} API Key.`);
        return;
      }

      const data = await response.json();
      console.log("Fetch API Key Success:", data);

      if (data && data.apiKey) {
        setFetchedApiKey(data.apiKey);
        toast.success(`${selectedService.name} API Key fetched!`);
      } else {
        setFetchedApiKey("No key found for this service.");
        toast.info(`No ${selectedService.name} API Key found.`);
      }

    } catch (error) {
      console.error("Error during API key fetch:", error);
      setFetchError(`Network or unexpected error: ${error.message}`);
      toast.error(`Error fetching ${selectedService.name} API Key.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitNewClick = () => {
    setModalView("submit");
    setApiKeyInput("");
    setSubmissionStatus(null);
  };

  const handleBackToInitial = () => {
    setModalView("initial");
    setApiKeyInput("");
    setSubmissionStatus(null);
    setFetchedApiKey(null);
    setFetchError(null);
    setIsLoading(false);
  };

  const handleModalClose = () => {
    setSelectedService(null);
  };

  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setSubmissionStatus("error");
      toast.error("API Key input is empty!");
      return;
    }
    if (!selectedService) return;

    setIsLoading(true);
    setSubmissionStatus(null);

    try {
      const response = await fetch(`${API_ENDPOINT}/save_api_keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          apiKey: apiKeyInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(`Failed to save ${selectedService.name} API Key, ${errorData.detail || "Unknown error"}`);
        return;
      }

      const data = await response.json();
      console.log("Save API Key Success:", data);

      setSubmissionStatus("success");
      toast.success(`${selectedService.name} API Key saved!`);
      setApiKeyInput("");

    } catch (error) {
      console.error("Error during API key submission:", error);
      setSubmissionStatus("error");
      toast.error(`Error saving ${selectedService.name} API Key: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isModalOpen = selectedService !== null;

  return (
    <div className="space-y-6 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {API_SERVICES.map((service) => (
          <ServiceBox
            key={service.id}
            service={service}
            onClick={handleServiceBoxClick}
          />
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Click on a service to manage your API key.
      </p>
      <Separator className="my-6" />
      <p className="text-center text-green-400 text-sm">
        API Keys are not shared with any model. If you save a key, you need to restart the app to use it.
      </p>


      <Dialog open={isModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            {selectedService && modalView === "initial" && (
              <>
                <DialogTitle>{selectedService.name} API Key Management</DialogTitle>
                <DialogDescription>
                  Manage your API key for {selectedService.name}.
                </DialogDescription>
              </>
            )}
            {selectedService && modalView === "submit" && (
              <DialogTitle>Submit New {selectedService.name} API Key</DialogTitle>
            )}
            {selectedService && modalView === "view" && (
              <DialogTitle>View Saved {selectedService.name} API Key</DialogTitle>
            )}
          </DialogHeader>

          <div className="py-2">
            {modalView === "initial" && selectedService && (
                <p className="text-muted-foreground text-center md:text-left">
                  You can get an API KEY for {selectedService?.name} at{" "}
                    <a
                    href={selectedService?.link}
                    className="text-blue-500 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    >
                    {selectedService?.link?.length > 30
                    ? `${selectedService?.link.substring(0, 30)}...`
                    : selectedService?.link}
                    </a>
                </p>
            )}
            {modalView === "submit" && selectedService && (
              <form onSubmit={handleApiKeySubmit} className="grid gap-4 py-4">
                <div className="grid grid-cols-5 justify-start items-center gap-4">
                  <Label htmlFor="apiKey" className="text-right">
                  API Key
                  </Label>
                  <Input
                  id="apiKey"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="col-span-4"
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck="false"
                  autoCapitalize="none"
                  placeholder={`Enter your ${selectedService.name} API key`}
                  disabled={isLoading}
                  type="password"
                  />
                </div>

                {isLoading && (
                  <div className="flex items-center justify-center text-primary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </div>
                )}
                 {submissionStatus === "success" && (
                  <div className="text-center text-green-500">Key saved successfully!</div>
                )}
                {submissionStatus === "error" && (
                  <div className="text-center text-red-500">Failed to save key. Check console for details.</div>
                )}
                 {!apiKeyInput.trim() && submissionStatus === 'error' && (
                     <div className="text-center text-red-500 text-sm">API Key cannot be empty.</div>
                 )}
              </form>
            )}
            {modalView === "view" && selectedService && (
              <div className="text-muted-foreground">
                {isLoading ? (
                   <div className="flex items-center justify-center text-primary">
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching key...
                   </div>
                ) : fetchError ? (
                  <div className="text-red-500">
                    Error: {fetchError}
                    <p className="text-sm text-muted-foreground mt-2">Could not retrieve the saved key.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      This is your saved API key:
                      <div className="flex items-center justify-between mt-2">
                        <span>{selectedService.name} Key:</span>
                        {fetchedApiKey && fetchedApiKey !== "No key found for this service." && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(fetchedApiKey);
                                toast.success("Copied to clipboard!");
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copy
                            </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-green-600 rounded-md text-left bg-secondary/20 break-all text-wrap">
                      <p>
                        {fetchedApiKey || "Fetching..."}
                      </p>
                    </div>
                  </>
                )}
                 {fetchedApiKey === "No key found for this service." && !isLoading && !fetchError && (
                     <p className="text-center text-muted-foreground mt-4">
                         No API key was found for {selectedService.name}. You can submit a new one.
                     </p>
                 )}
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-3">
            {modalView === "initial" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleViewOldClick}
                  className="w-full sm:w-auto"
                  disabled={isLoading}
                >
                   {isLoading && modalView === 'view' ? (
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   ) : (
                     <></>
                   )}
                  View Saved API Key
                </Button>
                <Button onClick={handleSubmitNewClick} className="w-full sm:w-auto" disabled={isLoading}>
                  Submit New API Key
                </Button>
              </>
            )}
            {modalView === "submit" && (
                <div className="flex flex-col sm:flex-row gap-3 w-full items-center justify-center">
                  <Button
                    variant="outline"
                    onClick={handleBackToInitial}
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="w-full"
                    onClick={handleApiKeySubmit}
                    disabled={isLoading || !apiKeyInput.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {isLoading ? "Submitting..." : "Submit Key"}
                  </Button>
                </div>
            )}
             {modalView === "view" && (
                <div className="flex flex-col sm:flex-row gap-3 w-full items-center justify-start">
                  <Button
                    variant="outline"
                    onClick={handleBackToInitial}
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                   {!isLoading && (
                       <Button onClick={handleSubmitNewClick} className="w-full sm:w-auto">
                         Submit New Key
                       </Button>
                   )}
                </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SettingsSheetProps {
  preferences: {
    inputPreference: "Autotag" | "NoTag";
    outputFormat: "codeAndExplanation" | "codeOnly" | "explanationOnly";
    codeQuality?: {
      linting?: boolean;
      formatting?: boolean;
      comments?: boolean;
      typeChecking?: boolean;
      bestPractices?: boolean;
    };
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
    <div className="flex items-center gap-2">
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Preferences</SheetTitle>
          </SheetHeader>
          <div className="py-4 h-full flex flex-col">
            <Tabs defaultValue="prompt" className="flex flex-col flex-grow overflow-y-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="integration">Integrations</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="prompt" className="space-y-4 mt-4 flex-grow overflow-y-auto pr-2">
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
                    value={preferences.inputPreference}
                    onValueChange={(value) =>
                      setPreferences({
                        ...preferences,
                        inputPreference: value as "Autotag" | "NoTag",
                      })
                    }
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
              </TabsContent>
              <TabsContent value="integration" className="flex-grow overflow-y-auto pr-2">
                <ApiIntegrationContent />
              </TabsContent>
              <TabsContent value="settings" className="space-y-6 mt-4 flex-grow overflow-y-auto pr-2">
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