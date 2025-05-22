import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FREE_MODELS } from "@/config/constants";

interface CodeQualityPreferences {
  linting?: boolean;
  formatting?: boolean;
  comments?: boolean;
  typeChecking?: boolean;
  bestPractices?: boolean;
}

interface GeneralSettingsTabProps {
  outputFormat: "codeAndExplanation" | "codeOnly" | "explanationOnly";
  setOutputFormat: (value: "codeAndExplanation" | "codeOnly" | "explanationOnly") => void;
  providerModel?: string;
  setProviderModel: (value: string) => void;
  freeModel?: string;
  setFreeModel: (value: string) => void;
  codeQuality?: CodeQualityPreferences;
  setCodeQuality: (value: CodeQualityPreferences) => void;
}

  const PROVIDER_MODELS = [
    { id: "chatgpt", name: "ChatGPT (OpenAI)" },
    { id: "claude", name: "Claude (Anthropic)" },
    { id: "gemini", name: "Gemini (Google)" }
  ];


const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  outputFormat,
  setOutputFormat,
  providerModel,
  setProviderModel,
  freeModel,
  setFreeModel,
  codeQuality,
  setCodeQuality,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Output Format</Label>
        <RadioGroup
          value={outputFormat}
          onValueChange={(value: "codeAndExplanation" | "codeOnly" | "explanationOnly") =>
            setOutputFormat(value)
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="codeAndExplanation" id="r1" />
            <Label htmlFor="r1">Balanced</Label>
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

      <div className="space-y-3">
        <Label>Provider Model</Label>
        <Select
          value={providerModel || ""}
          onValueChange={(value) => setProviderModel(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a provider model" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Choose your preferred AI provider for code analysis and generation.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Free Model Selection</Label>
        <Select
          value={freeModel || ""}
          onValueChange={(value) => setFreeModel(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a free model" />
          </SelectTrigger>
          <SelectContent>
            {FREE_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Choose your preferred free model for code analysis and generation.
        </p>
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
            <div key={field} className="flex items-center justify-between">
              <Label htmlFor={field} className="text-sm">
                {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1")}
              </Label>
              <Switch
                id={field}
                checked={codeQuality?.[field as keyof CodeQualityPreferences] || false}
                onCheckedChange={(checked) =>
                  setCodeQuality({
                    ...(codeQuality || {}),
                    [field]: checked,
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
    </div>
  );
};

export default GeneralSettingsTab;