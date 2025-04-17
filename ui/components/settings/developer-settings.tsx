"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/utils/toast-util"
import { STORAGE_KEYS } from "@/config/constants"

interface DeveloperSettings {
  fontSize: number
  theme: string
  codeBlockTheme: string
  lineHeight: number
  fontFamily: string
  showLineNumbers: boolean
  wordWrap: boolean
  autoSave: boolean
  tabSize: number
  indentWithTabs: boolean
  autoCloseBrackets: boolean
  highlightActiveLine: boolean
  highlightMatchingBrackets: boolean
}

const DEFAULT_SETTINGS: DeveloperSettings = {
  fontSize: 14,
  theme: "system",
  codeBlockTheme: "dracula",
  lineHeight: 1.5,
  fontFamily: "monospace",
  showLineNumbers: true,
  wordWrap: true,
  autoSave: true,
  tabSize: 2,
  indentWithTabs: false,
  autoCloseBrackets: true,
  highlightActiveLine: true,
  highlightMatchingBrackets: true,
}

const FONT_FAMILIES = [
  { value: "monospace", label: "Monospace" },
  { value: "fira-code", label: "Fira Code" },
  { value: "jetbrains-mono", label: "JetBrains Mono" },
  { value: "source-code-pro", label: "Source Code Pro" },
  { value: "roboto-mono", label: "Roboto Mono" },
  { value: "ubuntu-mono", label: "Ubuntu Mono" },
]

const CODE_THEMES = [
  { value: "dracula", label: "Dracula" },
  { value: "github-dark", label: "GitHub Dark" },
  { value: "github-light", label: "GitHub Light" },
  { value: "monokai", label: "Monokai" },
  { value: "nord", label: "Nord" },
  { value: "solarized-dark", label: "Solarized Dark" },
  { value: "solarized-light", label: "Solarized Light" },
  { value: "vs-dark", label: "VS Dark" },
  { value: "vs-light", label: "VS Light" },
]

export function DeveloperSettings() {
  const [settings, setSettings] = useState<DeveloperSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState("appearance")

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.DEVELOPER_SETTINGS)
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings })
      } catch (error) {
        console.error("Failed to parse developer settings:", error)
      }
    }

    // Apply font size to the document
    document.documentElement.style.setProperty("--base-font-size", `${settings.fontSize}px`)

    // Apply font family
    if (settings.fontFamily !== "monospace") {
      // This would load the font if needed
      // In a real app, you'd need to ensure these fonts are available
      document.documentElement.style.setProperty("--font-mono", settings.fontFamily)
    }
  }, [])

  // Save settings to localStorage and apply them
  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.DEVELOPER_SETTINGS, JSON.stringify(settings))

      // Apply font size to the document
      document.documentElement.style.setProperty("--base-font-size", `${settings.fontSize}px`)

      // Apply font family
      if (settings.fontFamily !== "monospace") {
        document.documentElement.style.setProperty("--font-mono", settings.fontFamily)
      }

      toast.success("Developer settings saved")
    } catch (error) {
      console.error("Failed to save developer settings:", error)
      toast.error("Failed to save settings")
    }
  }

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.removeItem(STORAGE_KEYS.DEVELOPER_SETTINGS)
    document.documentElement.style.setProperty("--base-font-size", `${DEFAULT_SETTINGS.fontSize}px`)
    document.documentElement.style.setProperty("--font-mono", "monospace")
    toast.success("Settings reset to defaults")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Developer Settings</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetSettings}>
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size ({settings.fontSize}px)</Label>
            <Slider
              id="font-size"
              min={12}
              max={24}
              step={1}
              value={[settings.fontSize]}
              onValueChange={(value) => setSettings({ ...settings, fontSize: value[0] })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="line-height">Line Height ({settings.lineHeight})</Label>
            <Slider
              id="line-height"
              min={1}
              max={2}
              step={0.1}
              value={[settings.lineHeight]}
              onValueChange={(value) => setSettings({ ...settings, lineHeight: value[0] })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Font Family</Label>
            <RadioGroup
              value={settings.fontFamily}
              onValueChange={(value) => setSettings({ ...settings, fontFamily: value })}
            >
              <div className="grid grid-cols-2 gap-2">
                {FONT_FAMILIES.map((font) => (
                  <div key={font.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={font.value} id={`font-${font.value}`} />
                    <Label htmlFor={`font-${font.value}`} className="text-sm">
                      {font.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Code Block Theme</Label>
            <RadioGroup
              value={settings.codeBlockTheme}
              onValueChange={(value) => setSettings({ ...settings, codeBlockTheme: value })}
            >
              <div className="grid grid-cols-2 gap-2">
                {CODE_THEMES.map((theme) => (
                  <div key={theme.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={theme.value} id={`theme-${theme.value}`} />
                    <Label htmlFor={`theme-${theme.value}`} className="text-sm">
                      {theme.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          <div className="space-y-2">
            <Label>Editor Preferences</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-line-numbers" className="text-sm">
                  Show Line Numbers
                </Label>
                <Switch
                  id="show-line-numbers"
                  checked={settings.showLineNumbers}
                  onCheckedChange={(checked) => setSettings({ ...settings, showLineNumbers: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="word-wrap" className="text-sm">
                  Word Wrap
                </Label>
                <Switch
                  id="word-wrap"
                  checked={settings.wordWrap}
                  onCheckedChange={(checked) => setSettings({ ...settings, wordWrap: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save" className="text-sm">
                  Auto Save
                </Label>
                <Switch
                  id="auto-save"
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoSave: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="indent-with-tabs" className="text-sm">
                  Indent with Tabs
                </Label>
                <Switch
                  id="indent-with-tabs"
                  checked={settings.indentWithTabs}
                  onCheckedChange={(checked) => setSettings({ ...settings, indentWithTabs: checked })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="tab-size">Tab Size ({settings.tabSize} spaces)</Label>
            <Slider
              id="tab-size"
              min={2}
              max={8}
              step={2}
              value={[settings.tabSize]}
              onValueChange={(value) => setSettings({ ...settings, tabSize: value[0] })}
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-2">
            <Label>Advanced Editor Features</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-close-brackets" className="text-sm">
                  Auto Close Brackets
                </Label>
                <Switch
                  id="auto-close-brackets"
                  checked={settings.autoCloseBrackets}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoCloseBrackets: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="highlight-active-line" className="text-sm">
                  Highlight Active Line
                </Label>
                <Switch
                  id="highlight-active-line"
                  checked={settings.highlightActiveLine}
                  onCheckedChange={(checked) => setSettings({ ...settings, highlightActiveLine: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="highlight-matching-brackets" className="text-sm">
                  Highlight Matching Brackets
                </Label>
                <Switch
                  id="highlight-matching-brackets"
                  checked={settings.highlightMatchingBrackets}
                  onCheckedChange={(checked) => setSettings({ ...settings, highlightMatchingBrackets: checked })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="p-4 bg-muted/50 rounded-md">
            <h3 className="text-sm font-medium mb-2">Performance Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              These settings can affect the performance of the application. Adjust them carefully.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="syntax-highlighting" className="text-sm">
                  Syntax Highlighting
                </Label>
                <Switch id="syntax-highlighting" checked={true} disabled />
              </div>

              <p className="text-xs text-muted-foreground">
                Syntax highlighting is always enabled for better code readability.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
