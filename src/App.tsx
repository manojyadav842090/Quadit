/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Languages, 
  Lightbulb, 
  ArrowRight,
  FileText,
  BrainCircuit,
  Loader2,
  RefreshCcw,
  Check,
  X,
  ClipboardPaste,
  MousePointer2,
  Copy,
  CheckCheck,
  Trash2,
  Plus,
  Layers,
  Sun,
  Moon,
  Key,
  ShieldCheck,
  History,
  LogIn,
  LogOut,
  User as UserIcon,
  Sparkles,
  Mail,
  Download,
  Cpu,
  FolderOpen,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  auditSingleQuantContent, 
  auditSingleTextContent, 
  AuditResult,
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  stripOptionsFromQuestion
} from './services/geminiService';
import { 
  auth, 
  userSignOut, 
  getUserProfile, 
  logAuditEntry, 
  isUserAdmin,
  ADMIN_EMAIL,
  UserProfile 
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AuthModal } from './components/AuthModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AdminDashboard } from './components/AdminDashboard';
import { HistoryModal } from './components/HistoryModal';
import { FormattedSolution } from './components/FormattedSolution';
import { copyFormattedText } from './lib/clipboard';
import myLogo from './assets/images/logo.png';
import myLogoNight from './assets/images/logonight.png';
import { cn } from '@/lib/utils';

type AuditItem = {
  type: 'image' | 'text';
  content: string;
};

export default function App() {
  const [pastedItems, setPastedItems] = useState<AuditItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentAuditIndex, setCurrentAuditIndex] = useState<number>(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // New UI controls for a classy and happening experience
  const [inputTab, setInputTab] = useState<'screenshot' | 'text'>('screenshot');
  const [rawTextInput, setRawTextInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [resultLangFilter, setResultLangFilter] = useState<'both' | 'en' | 'hi'>('both');

  // User Authentication & Custom API Key & Lite Model states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('user_gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('user_gemini_model') || DEFAULT_MODEL;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('user_gemini_model', modelId);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
          if (profile?.geminiApiKey && !customApiKey) {
            setCustomApiKey(profile.geminiApiKey);
            localStorage.setItem('user_gemini_api_key', profile.geminiApiKey);
          }
        } catch (err) {
          console.error("Profile load error:", err);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, [customApiKey]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFound = false;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            imageFound = true;
            const blob = items[i].getAsFile();
            if (!blob) continue;

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                const base64Data = base64String.split(',')[1];
                setPastedItems(prev => {
                    if (prev.length >= 50) return prev;
                    return [...prev, { type: 'image', content: base64Data }];
                });
            };
            reader.readAsDataURL(blob);
        }
    }

    if (!imageFound) {
        const text = e.clipboardData?.getData('text');
        if (text && text.trim()) {
            setPastedItems(prev => {
                if (prev.length >= 50) return prev;
                return [...prev, { type: 'text', content: text.trim() }];
            });
        }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files: File[] = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string)?.split(',')[1];
          if (base64) {
            setPastedItems(prev => prev.length < 50 ? [...prev, { type: 'image', content: base64 }] : prev);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string)?.split(',')[1];
          if (base64) {
            setPastedItems(prev => prev.length < 50 ? [...prev, { type: 'image', content: base64 }] : prev);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleAddTextToQueue = () => {
    if (!rawTextInput.trim()) return;
    setPastedItems(prev => [...prev, { type: 'text', content: rawTextInput.trim() }]);
    setRawTextInput('');
  };

  const loadSampleQuestion = () => {
    const sample = `Question:
A and B together can complete a piece of work in 12 days. B and C together can complete the same work in 15 days, while C and A together can do it in 20 days. If they all work together for 5 days, what fraction of the work will remain unfinished?
Options:
A) 1/2
B) 1/4
C) 3/8
D) 5/12
E) None of these

Marked Answer: Option A (1/2)

Provided Solution:
2 * (A + B + C)'s 1 day work = 1/12 + 1/15 + 1/20 = (5 + 4 + 3)/60 = 12/60 = 1/5.
So (A + B + C)'s 1 day work = 1/10.
In 5 days, work done = 5 * (1/10) = 1/2.
Remaining work = 1 - 1/2 = 1/2.
Hence Option A is correct.`;
    setPastedItems(prev => [...prev, { type: 'text', content: sample }]);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await copyFormattedText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const removeItem = (index: number) => {
    setPastedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (pastedItems.length === 0) {
      setError("Please paste at least one screenshot or text block containing a question and its solution.");
      return;
    }

    // 1. Mandatory login check: Users must login so their activity is registered & saved
    if (!user) {
      setError("Auditing ke liye pehle Login karein. Aapka audit data aapke account me save hoga.");
      setIsAuthModalOpen(true);
      return;
    }

    // 2. Mandatory or user-provided Gemini API key check
    const activeKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!activeKey) {
      setError("Apna Google Gemini API key set karein audits run karne ke liye.");
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults([]);
    setCurrentAuditIndex(0);

    try {
      const allResults: AuditResult[] = [];
      for (let i = 0; i < pastedItems.length; i++) {
        setCurrentAuditIndex(i + 1);
        const item = pastedItems[i];
        let auditResult: AuditResult;
        
        if (item.type === 'image') {
          auditResult = await auditSingleQuantContent(item.content, customApiKey || undefined, selectedModel);
        } else {
          auditResult = await auditSingleTextContent(item.content, customApiKey || undefined, selectedModel);
        }
        
        allResults.push(auditResult);

        // Store each audit log in Firestore for admin oversight and user history
        if (user) {
          try {
            await logAuditEntry({
              user,
              inputType: item.type,
              rawSnippet: item.type === 'text' ? item.content : 'Image Question & Solution',
              result: auditResult
            });
          } catch (logErr) {
            console.warn("Failed to write to audit log:", logErr);
          }
        }
      }
      setResults(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
      setCurrentAuditIndex(0);
    }
  };

  const exportCurrentBatchCsv = () => {
    if (results.length === 0) return;
    const headers = [
      "Index",
      "Topic",
      "Language Quality",
      "Marked Answer",
      "Marked Status",
      "Needs Change",
      "Absurd Logic Alert",
      "English Question",
      "English Clean Solution",
      "Hindi Question",
      "Hindi Solution"
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = results.map((r, i) => [
      i + 1,
      escapeCsv(r.topic),
      escapeCsv(r.questionLanguageQuality),
      escapeCsv(r.markedAnswer),
      escapeCsv(r.myAnswerStatus),
      escapeCsv(r.solutionShouldBeChanged),
      escapeCsv(r.isAbsurd),
      escapeCsv(stripOptionsFromQuestion(r.correctedQuestion || r.englishSnippet || '')),
      escapeCsv(r.cleanSolution ? r.cleanSolution.replace(/\*\*/g, '') : ''),
      escapeCsv(stripOptionsFromQuestion(r.hindiQuestion || '')),
      escapeCsv(r.hindiSolution ? r.hindiSolution.replace(/\*\*/g, '') : '')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quant_Audit_Batch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setPastedItems([]);
    setResults([]);
    setError(null);
  };

  const handleSignOut = async () => {
    await userSignOut();
  };

  const isAdmin = isUserAdmin(user?.email) || userProfile?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground font-sans selection:bg-primary/20 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md min-h-[64px] py-2">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1880px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center overflow-hidden h-11 sm:h-12">
              <img src={isDarkMode ? myLogoNight : myLogo} alt="Logo" className="h-full w-auto object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Admin Monitor Button (Visible to owner my8420090713@gmail.com) */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdminDashboardOpen(true)}
                className="bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 font-semibold h-8 text-xs px-2.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                <span>Admin Monitor</span>
                <Badge variant="default" className="ml-1 text-[9px] px-1 py-0 h-3.5 bg-primary">
                  Owner
                </Badge>
              </Button>
            )}

            {/* My History (if logged in) */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHistoryModalOpen(true)}
                className="h-8 text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                History
              </Button>
            )}

            {/* User Account Login / Profile */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-border/50">
                <div 
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
                  onClick={() => setIsHistoryModalOpen(true)}
                  title={user.email || 'Logged in user'}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase overflow-hidden ring-1 ring-primary/30">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (user.displayName || user.email || 'U').slice(0, 2)
                    )}
                  </div>
                  <span className="text-xs font-semibold max-w-[110px] truncate hidden md:inline">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="h-8 text-xs font-semibold shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 mr-1" />
                Sign In
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground h-8 px-2">
              <RefreshCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="text-muted-foreground hover:text-foreground h-8 w-8">
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1720px] 2xl:max-w-[1880px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 space-y-6">
        {/* Sleek Executive Console Status Strip */}
        <div className="bg-card/70 backdrop-blur-md rounded-2xl border border-border/80 p-3.5 sm:p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Gmail & Cloud Sync */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-colors",
                user 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                  : "bg-muted border-border text-muted-foreground"
              )}>
                {user ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cloud Account</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                    user 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                      : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", user ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                    {user ? "Connected" : "Guest Mode"}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground truncate mt-0.5">
                  {user ? (
                    <span className="font-mono text-[11px]">{user.email}</span>
                  ) : (
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-primary hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      Login with Gmail to sync & view history <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </p>
              </div>
            </div>

            <div className="hidden lg:block h-8 w-px bg-border/80" />

            {/* Middle: API Key Quota Status & Ultra-Lite Model */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-colors",
                customApiKey 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              )}>
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lite AI Core</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ultra-Lite Active
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs font-bold text-foreground">
                    {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "Gemini 2.5 Flash-Lite"}
                  </span>
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Max Quota (~1,000 RPD)
                  </span>
                  <button
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:underline ml-1 cursor-pointer"
                  >
                    {customApiKey ? "Switch Model" : "Add Key"}
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden lg:block h-8 w-px bg-border/80" />

            {/* Right: Exam Standard & Quota Saver Pill */}
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3 text-primary" />
                  IBPS & SBI PO Benchmark
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ⚡ Lowest Token Cost • High Speed
                </span>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                title="Gemini Quota & Model Settings"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                Quota / Model
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid: Left (Input Console) & Right (Output Cockpit) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          
          {/* Left Column: Input Studio */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs space-y-4">
              {/* Studio Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ClipboardPaste className="w-4 h-4 text-primary" />
                    Input Ingestion Console
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Paste screenshots or text. Each item must have Question + Solution.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
                  {pastedItems.length} Queued
                </Badge>
              </div>

              {/* Input Mode Toggle (Screenshot vs Direct Text) */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setInputTab('screenshot')}
                  className={cn(
                    "py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    inputTab === 'screenshot' 
                      ? "bg-background text-foreground shadow-xs font-semibold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  Screenshots (Images)
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('text')}
                  className={cn(
                    "py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    inputTab === 'text' 
                      ? "bg-background text-foreground shadow-xs font-semibold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Direct Text / OCR
                </button>
              </div>

              {/* Tab 1: Screenshot & Clipboard Zone */}
              {inputTab === 'screenshot' && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "p-6 rounded-2xl border-2 border-dashed transition-all duration-300 text-center flex flex-col items-center justify-center relative group",
                    isDragging 
                      ? "border-primary bg-primary/10 scale-[0.99]" 
                      : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Paste or Drag Screenshot Here
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xs mb-4">
                    Press <span className="font-semibold text-foreground">Ctrl+V / ⌘V</span> anywhere on this screen, or drop question images here.
                  </p>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={handleFileInput} 
                        className="hidden" 
                      />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Browse Files
                      </span>
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadSampleQuestion}
                      className="h-8 text-xs font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                      Try Sample
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Direct Text Input */}
              {inputTab === 'text' && (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={rawTextInput}
                    onChange={(e) => setRawTextInput(e.target.value)}
                    placeholder="Paste Question, Options, and Solution text directly here...&#10;&#10;Example:&#10;Q: A can do a work in 10 days...&#10;Marked Answer: Option B&#10;Solution: Let total work = 30..."
                    className="w-full p-3 rounded-xl border border-border bg-background text-xs leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-primary/40 font-mono resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={loadSampleQuestion}
                      className="text-xs text-muted-foreground hover:text-foreground h-8"
                    >
                      <Sparkles className="w-3 h-3 mr-1 text-primary" />
                      Load Sample Question
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddTextToQueue}
                      disabled={!rawTextInput.trim()}
                      className="h-8 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add to Queue
                    </Button>
                  </div>
                </div>
              )}

              {/* Queued Items Gallery */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                  <span>Queued Items ({pastedItems.length})</span>
                  {pastedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPastedItems([])}
                      className="text-destructive hover:underline text-[11px] cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {pastedItems.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border/80 text-center bg-muted/10">
                    <p className="text-xs text-muted-foreground">
                      No questions queued yet. Paste screenshots or click <span className="font-semibold text-foreground">"Try Sample"</span> above to test.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[260px] pr-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <AnimatePresence>
                        {pastedItems.map((item, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative group aspect-video rounded-xl overflow-hidden border border-border/80 bg-background shadow-xs"
                          >
                            {item.type === 'image' ? (
                              <img 
                                src={`data:image/png;base64,${item.content}`} 
                                alt={`Queued Item ${idx + 1}`} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full p-2.5 bg-muted/20 flex flex-col justify-between">
                                <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                                  <FileText className="w-3 h-3" />
                                  <span>Text Question</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-3 leading-tight font-mono">
                                  {item.content}
                                </p>
                                <span className="text-[9px] text-muted-foreground/60">Ready to audit</span>
                              </div>
                            )}

                            {/* Remove Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-7 w-7 rounded-lg"
                                onClick={() => removeItem(idx)}
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* Badge */}
                            <div className="absolute bottom-1.5 left-1.5">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-xs">
                                #{idx + 1} • {item.type === 'image' ? 'Image' : 'Text'}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Error Message if any */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-xs text-destructive font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Primary Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || pastedItems.length === 0}
                  className="w-full h-11 text-sm font-bold shadow-md relative overflow-hidden group cursor-pointer"
                >
                  {isAnalyzing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Auditing Question {currentAuditIndex} of {pastedItems.length}...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 w-full">
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>
                        {pastedItems.length === 0 
                          ? "Add Questions to Start Audit" 
                          : `Audit ${pastedItems.length} Question${pastedItems.length > 1 ? 's' : ''} (Ultra-Lite • Quota Saver)`}
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Audit Results & Intelligence Cockpit */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {results.length === 0 && !isAnalyzing ? (
                /* Classy Empty State Showcase */
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-card rounded-2xl border border-border/80 p-8 sm:p-12 shadow-xs space-y-8"
                >
                  <div className="text-center max-w-lg mx-auto space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                      <BrainCircuit className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground tracking-tight">
                      Quant Intelligence & Audit Cockpit
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Built for Bank PO & Insurance Content Developers. Paste your question and solution on the left to execute comprehensive mathematical validation.
                    </p>
                  </div>

                  {/* 4 Core Pillars of the Engine */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
                    <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Step Calculation Proof</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Verifies arithmetic, equations, formulas, and tests if the marked answer matches the mathematical solution.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Exam Tone Standardization</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Rewrites colloquial or awkward phrasing into high-precision IBPS/SBI PO English question language.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <Languages className="w-4 h-4 text-indigo-500" />
                        <span>हिन्दी (Hindi) Translation</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Generates verified Hindi Question & Solution with exact banking terminology in clean Devanagari.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        <span>Absurdity ("Uttpatang") Filter</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Detects impossible values (negative ages, speeds &gt; realistic limits, contradictory data points).
                      </p>
                    </div>
                  </div>

                  {/* Quick Guide Footer */}
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>Ready for high-throughput batch auditing (up to 50 items)</span>
                    </span>
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={loadSampleQuestion}
                      className="h-auto p-0 text-xs font-semibold text-primary"
                    >
                      Load Sample Question →
                    </Button>
                  </div>
                </motion.div>
              ) : isAnalyzing ? (
                /* Scanning Progress Screen */
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-card rounded-2xl border border-border/80 p-12 text-center space-y-6 shadow-xs"
                >
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <BrainCircuit className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="space-y-2 max-w-sm mx-auto">
                    <h3 className="text-lg font-bold text-foreground">Processing Quant Content</h3>
                    <p className="text-xs text-muted-foreground animate-pulse">
                      Executing mathematical proof and bilingual translation for Item #{currentAuditIndex} of {pastedItems.length}...
                    </p>
                  </div>
                  <div className="w-48 mx-auto bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${(currentAuditIndex / Math.max(pastedItems.length, 1)) * 100}%` }}
                    />
                  </div>
                </motion.div>
              ) : (
                /* Audit Results Section */
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Results Metric Header */}
                  <div className="bg-card rounded-2xl border border-border/80 p-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-foreground">
                            Audit Batch Completed
                          </h2>
                          <p className="text-[11px] text-muted-foreground">
                            {results.length} questions audited and verified
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportCurrentBatchCsv}
                          className="h-8 text-xs font-semibold border-border"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    {/* Quick Metric Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Audited</span>
                        <p className="text-base font-bold text-foreground mt-0.5">{results.length}</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Marked Correct</span>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {results.filter(r => r.myAnswerStatus?.toLowerCase() === 'correct').length}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Needs Change</span>
                        <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          {results.filter(r => r.solutionShouldBeChanged?.toLowerCase().startsWith('yes')).length}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
                        <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Absurdities</span>
                        <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                          {results.filter(r => r.isAbsurd === 'Yes').length}
                        </p>
                      </div>
                    </div>

                    {/* Language Filter Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40 mt-3 text-xs">
                      <span className="text-muted-foreground font-medium text-[11px]">View Mode:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setResultLangFilter('both')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
                            resultLangFilter === 'both' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Both (EN + HI)
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultLangFilter('en')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
                            resultLangFilter === 'en' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          English Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultLangFilter('hi')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
                            resultLangFilter === 'hi' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          हिन्दी Only
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Accordion List for Audited Questions */}
                  <Accordion className="w-full space-y-3 border-none">
                    {results.map((res, idx) => (
                      <AccordionItem 
                        key={idx} 
                        value={`q-${idx}`}
                        className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs hover:border-primary/40 transition-all duration-200"
                      >
                        <AccordionTrigger className="px-5 py-4 hover:no-underline">
                          <div className="flex items-center gap-3.5 text-left w-full">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 text-sm border border-primary/20">
                              #{idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-foreground flex items-center gap-2 flex-wrap">
                                <span>Question {idx + 1}</span>
                                {res.topic && (
                                  <Badge variant="outline" className="text-[10px] font-medium border-border py-0">
                                    {res.topic}
                                  </Badge>
                                )}
                                {res.isAbsurd === 'Yes' && (
                                  <Badge variant="destructive" className="animate-pulse text-[10px] py-0 h-4 px-1.5 font-bold">
                                    UTS-ALERT: Absurd Logic
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                  res.myAnswerStatus === 'correct' 
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                                    : "bg-destructive/10 border-destructive/30 text-destructive"
                                )}>
                                  Ans: {res.myAnswerStatus}
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
                                  Marked: {res.markedAnswer || 'N/A'}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                                  res.solutionShouldBeChanged.toLowerCase().startsWith('no') 
                                    ? "bg-muted border-border text-muted-foreground" 
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold"
                                )}>
                                  Change: {res.solutionShouldBeChanged}
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-5 pb-6 pt-2">
                          <div className="space-y-6">
                            <Separator className="opacity-60" />
                            
                            {/* Key Indicators Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Question Language</p>
                                <p className="text-xs font-semibold text-foreground mt-0.5">
                                  {res.questionLanguageQuality || (res.correctedQuestion ? "Audited & Enhanced" : "Original OK")}
                                </p>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Marked Option</p>
                                <p className="text-xs font-semibold text-foreground mt-0.5">{res.markedAnswer || "Not Identified"}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Solution Needs Change?</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {res.solutionShouldBeChanged.toLowerCase().startsWith('yes') ? (
                                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                  <p className="text-xs font-bold">{res.solutionShouldBeChanged}</p>
                                </div>
                              </div>
                              <div className={cn(
                                "p-3 rounded-xl border",
                                res.isAbsurd === 'Yes' 
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" 
                                  : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              )}>
                                <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Absurdity Indicator</p>
                                <p className="text-xs font-bold mt-0.5">
                                  {res.isAbsurd === 'Yes' ? "Weird / Absurd Logic Detected" : "No Absurdities Found"}
                                </p>
                              </div>
                            </div>

                            {/* Questions Comparison (Side-by-Side on XL screens) */}
                            <div className={cn(
                              "grid gap-4",
                              resultLangFilter === 'both' ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                            )}>
                              {/* English Question */}
                              {(resultLangFilter === 'both' || resultLangFilter === 'en') && (
                                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5" />
                                      English Question (Bank Exam Standard)
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(stripOptionsFromQuestion(res.correctedQuestion || ''), `en_q_${idx}`)}
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {copiedField === `en_q_${idx}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                      {copiedField === `en_q_${idx}` ? "Copied" : "Copy"}
                                    </Button>
                                  </div>
                                  <p className="text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                    {stripOptionsFromQuestion(res.correctedQuestion || '') || "Original question statement verified."}
                                  </p>
                                </div>
                              )}

                              {/* Hindi Question */}
                              {(resultLangFilter === 'both' || resultLangFilter === 'hi') && (
                                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                      <Languages className="w-3.5 h-3.5" />
                                      हिन्दी प्रश्न (Hindi Question)
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(stripOptionsFromQuestion(res.hindiQuestion || ''), `hi_q_${idx}`)}
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {copiedField === `hi_q_${idx}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                      {copiedField === `hi_q_${idx}` ? "Copied" : "Copy"}
                                    </Button>
                                  </div>
                                  <p className="text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                    {stripOptionsFromQuestion(res.hindiQuestion || '')}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Solutions Comparison (Side-by-Side on XL screens) */}
                            <div className={cn(
                              "grid gap-4",
                              resultLangFilter === 'both' ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                            )}>
                              {/* English Clean Solution */}
                              {(resultLangFilter === 'both' || resultLangFilter === 'en') && (
                                <div className="p-4 rounded-xl bg-muted/20 border border-border/80 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                      <Lightbulb className="w-3.5 h-3.5" />
                                      English Step-by-Step Clean Solution
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(res.cleanSolution, `clean_sol_${idx}`)}
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {copiedField === `clean_sol_${idx}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                      {copiedField === `clean_sol_${idx}` ? "Copied" : "Copy Solution"}
                                    </Button>
                                  </div>
                                  <FormattedSolution text={res.cleanSolution} />
                                </div>
                              )}

                              {/* Hindi Clean Solution */}
                              {(resultLangFilter === 'both' || resultLangFilter === 'hi') && (
                                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                      <Lightbulb className="w-3.5 h-3.5" />
                                      हिन्दी हल (Hindi Clean Solution)
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(res.hindiSolution || '', `hi_sol_${idx}`)}
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {copiedField === `hi_sol_${idx}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                      {copiedField === `hi_sol_${idx}` ? "Copied" : "Copy Solution"}
                                    </Button>
                                  </div>
                                  <FormattedSolution text={res.hindiSolution || ''} />
                                </div>
                              )}
                            </div>

                            {/* Summary & Recommendations Panel */}
                            {res.auditSummary && (
                              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  Audit Mathematical Proof & Recommendation
                                </h4>
                                <p className="text-xs text-foreground/80 leading-relaxed">
                                  {res.auditSummary}
                                </p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Custom API Key & Model Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        user={user}
        currentApiKey={customApiKey}
        onSaveKey={(key) => setCustomApiKey(key)}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
      />

      {/* Admin Monitoring Dashboard */}
      <AdminDashboard
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />

      {/* User Personal History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        user={user}
      />
    </div>
  );
}

function StatusCard({ title, isValid, icon, label }: { title: string, isValid: boolean, icon: React.ReactNode, label: string }) {
  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-2",
      isValid 
        ? "bg-green-500/5 border-green-500/20 text-green-700" 
        : "bg-destructive/5 border-destructive/20 text-destructive"
    )}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{title}</span>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{label}</span>
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center",
          isValid ? "bg-green-500/20" : "bg-destructive/20"
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
