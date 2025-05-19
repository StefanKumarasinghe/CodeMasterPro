"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Copy, Zap, Feather, Globe, Sparkle, BrainCircuitIcon, Github, Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/utils/toast-util";
import { API_ENDPOINT } from "@/config/constants";
import ServiceBox from "./ServiceBox";

interface Service {
  id: string;
  name: string;
  icon: Icon;
  description: string;
  link: string;
}

const API_SERVICES: Service[] = [
  { id: "openai", name: "ChatGPT (OpenAI)", icon: Zap, description: "o3 and Turbo Model", link: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic Claude", icon: Feather, description: "Sonnet Model", link: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", name: "Gemini", icon: Sparkle, description: "Gemini Models", link: "https://aistudio.google.com/app/apikey?_gl=1*11usfy7*_ga*OTU3MDg0MDk0LjE3NDYwONENTcw.*_ga_P1DBVKWT6V*MTc0NjA5MDU3MS4xLjAuMTc0NjA5MDU3MS42MC4wLjMzMTEzOTAyNQ.." },
  { id: "brave", name: "Brave", icon: Globe, description: "Internet Access", link: "https://api-dashboard.search.brave.com/" },
  { id: "together-ai", name: "Together", icon: BrainCircuitIcon, description: "Multi-Agent", link:"https://api.together.ai"},
  { id: "github", name: "GitHub", icon: Github, description: "GitHub Access", link: "https://github.com/settings/tokens" },
];

const ApiIntegrationContent = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [modalView, setModalView] = useState("initial");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [fetchedApiKey, setFetchedApiKey] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const handleServiceBoxClick = (service: Service) => {
    setSelectedService(service);
  };

  const handleViewOldClick = async () => {
    if (!selectedService) return;

    setModalView("view");
    setIsLoading(true);
    setFetchedApiKey(null);
    setFetchError(null);

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
        setFetchError(errorMessage);
        toast.error(`Error fetching ${selectedService.name} API Key.`);
        return;
      }

      const data = await response.json();

      if (data && data.apiKey) {
        setFetchedApiKey(data.apiKey);
        toast.success(`${selectedService.name} API Key fetched!`);
      } else {
        setFetchedApiKey("No key found for this service.");
        toast.info(`No ${selectedService.name} API Key found.`);
      }

    } catch (error: any) {
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

  const handleApiKeySubmit = async (e: React.FormEvent) => {
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
        setSubmissionStatus("error");
        return;
      }

      const data = await response.json();

      setSubmissionStatus("success");
      toast.success(`${selectedService.name} API Key saved!`);
      setApiKeyInput("");

    } catch (error: any) {
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
      <p className="text-center dark:text-green-400 text-black text-sm">
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
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

export default ApiIntegrationContent;