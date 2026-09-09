import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Key, CheckCircle2, AlertCircle, ExternalLink, Loader2, Eye, EyeOff, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateApiKey, AVAILABLE_MODELS, DEFAULT_MODEL } from '../services/geminiService';
import { saveUserApiKey } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveKey: (key: string) => void;
  user: FirebaseUser | null;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
}

export function ApiKeyModal({ 
  isOpen, 
  onClose, 
  currentApiKey, 
  onSaveKey, 
  user,
  selectedModel = DEFAULT_MODEL,
  onSelectModel
}: ApiKeyModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeModel, setActiveModel] = useState(selectedModel);

  if (!isOpen) return null;

  const handleSave = async (skipVerify: boolean = false) => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Gemini API key.' });
      return;
    }

    setIsVerifying(true);
    setStatusMessage(null);

    try {
      if (!skipVerify) {
        const isValid = await validateApiKey(trimmed, activeModel);
        if (!isValid) {
          setStatusMessage({ 
            type: 'error', 
            text: 'Key verification failed. Please ensure the API key is active in Google AI Studio.' 
          });
          setIsVerifying(false);
          return;
        }
      }

      // Save locally
      localStorage.setItem('user_gemini_api_key', trimmed);
      if (onSelectModel) {
        onSelectModel(activeModel);
      }
      localStorage.setItem('user_gemini_model', activeModel);
      
      // Save to Firebase user doc if logged in
      if (user) {
        await saveUserApiKey(user.uid, trimmed);
      }

      onSaveKey(trimmed);
      setStatusMessage({ type: 'success', text: 'API Key and Ultra-Lite model configured successfully!' });
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error saving API key.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveKey = async () => {
    localStorage.removeItem('user_gemini_api_key');
    if (user) {
      await saveUserApiKey(user.uid, '');
    }
    setApiKeyInput('');
    onSaveKey('');
    setStatusMessage({ type: 'success', text: 'API Key removed. Falling back to default.' });
  };

  const handleModelPick = (modelId: string) => {
    setActiveModel(modelId);
    if (onSelectModel) {
      onSelectModel(modelId);
    }
    localStorage.setItem('user_gemini_model', modelId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden text-card-foreground max-h-[92vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Gemini API & Ultra-Lite Model Settings</h2>
              <p className="text-xs text-muted-foreground">
                Maximum quota savings ke liye sabse lite model configure karein
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Model Selection section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>AI Model Selection (Quota Limit Saver)</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Max Quota Mode
                </span>
              </Label>
              <div className="space-y-2">
                {AVAILABLE_MODELS.map((m) => {
                  const isSelected = activeModel === m.id;
                  const isUltraLite = m.id === 'gemini-2.5-flash-lite';
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleModelPick(m.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected 
                          ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/40' 
                          : 'bg-muted/30 border-border/70 hover:bg-muted/60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{m.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isUltraLite 
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                      <div className="pt-0.5 shrink-0">
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                        }`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs leading-relaxed space-y-1 text-emerald-950 dark:text-emerald-200">
              <p className="font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kyun Gemini 2.5 Flash-Lite sabse behtar hai?</span>
              </p>
              <p className="text-[11px] opacity-90">
                Yeh Google ka sabse lightweight multimodal model hai. Free tier me iski daily limit <strong>~1,000 Requests/Day</strong> hai aur token consumption sabse low hai, jisse aap bina quota limit hit kiye continuous question audits kar sakte hain.
              </p>
            </div>

            <div>
              <Label htmlFor="gemini-key-input" className="text-xs font-semibold">Gemini API Key</Label>
              <div className="relative mt-1.5 flex items-center">
                <Input
                  id="gemini-key-input"
                  type={showKey ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="pr-20 font-mono text-sm h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>
                  {currentApiKey ? (
                    <span className="text-emerald-600 font-medium">✓ Active API Key configured</span>
                  ) : (
                    <span>No custom key set. Please set your key to proceed.</span>
                  )}
                </span>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-destructive/10 border border-destructive/20 text-destructive'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <Button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isVerifying || !apiKeyInput.trim()}
                className="w-full sm:flex-1 h-11 font-semibold cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing & Saving Key...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verify & Save Settings
                  </>
                )}
              </Button>

              {currentApiKey && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveKey}
                  disabled={isVerifying}
                  className="w-full sm:w-auto h-11 text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
                >
                  Clear Key
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
