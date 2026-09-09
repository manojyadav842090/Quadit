import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  History, 
  Clock, 
  FileText, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  Languages, 
  CheckCheck,
  Search,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { fetchUserAuditLogs, StoredAuditLog } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { stripOptionsFromQuestion } from '../services/geminiService';
import { FormattedSolution } from './FormattedSolution';
import { copyFormattedText } from '../lib/clipboard';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
}

export function HistoryModal({ isOpen, onClose, user }: HistoryModalProps) {
  const [logs, setLogs] = useState<StoredAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLang, setFilterLang] = useState<'both' | 'en' | 'hi'>('both');

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      fetchUserAuditLogs(user.uid)
        .then(data => {
          setLogs(data);
          if (data.length > 0) {
            setExpandedId(data[0].id); // Auto expand latest item
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const copyText = async (text: string, fieldId: string) => {
    await copyFormattedText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullBilingual = (item: StoredAuditLog) => {
    const enQ = stripOptionsFromQuestion(item.result.correctedQuestion || item.snippet || '');
    const hiQ = stripOptionsFromQuestion(item.result.hindiQuestion || '');
    const enSol = item.result.cleanSolution || '';
    const hiSol = item.result.hindiSolution || '';

    const textToCopy = `=== ENGLISH QUESTION ===\n${enQ}\n\n=== ENGLISH SOLUTION ===\n${enSol}\n\n=== HINDI QUESTION (हिन्दी प्रश्न) ===\n${hiQ}\n\n=== HINDI SOLUTION (हिन्दी हल) ===\n${hiSol}`;
    
    copyText(textToCopy, `full_${item.id}`);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const qEn = (log.result.correctedQuestion || log.snippet || '').toLowerCase();
    const qHi = (log.result.hindiQuestion || '').toLowerCase();
    const solEn = (log.result.cleanSolution || '').toLowerCase();
    const solHi = (log.result.hindiSolution || '').toLowerCase();
    const topic = (log.result.topic || '').toLowerCase();
    return qEn.includes(term) || qHi.includes(term) || solEn.includes(term) || solHi.includes(term) || topic.includes(term);
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-card-foreground"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-border bg-muted/20 shrink-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                    My Audit History
                    <Badge variant="outline" className="text-xs px-2 py-0.5 font-normal">
                      {logs.length} Questions
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Previous audited questions and step-by-step solutions (English & हिन्दी)
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar: Search and Language Switcher */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search questions or solutions in English / Hindi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Language View Filter */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setFilterLang('both')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg transition-colors",
                    filterLang === 'both' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Both (EN + HI)
                </button>
                <button
                  onClick={() => setFilterLang('en')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg transition-colors",
                    filterLang === 'en' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  English Only
                </button>
                <button
                  onClick={() => setFilterLang('hi')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg transition-colors",
                    filterLang === 'hi' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  हिन्दी Only
                </button>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {loading ? (
              <div className="py-20 text-center text-sm text-muted-foreground animate-pulse space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p>Loading your saved questions and solutions...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground space-y-2">
                <FileText className="w-12 h-12 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-sm">No audits recorded yet</p>
                <p className="text-xs max-w-sm mx-auto">
                  Jab aap koi question audit karenge, uska English aur Hindi question tatha solution yahan automatically save ho jayega.
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <p className="text-sm font-semibold">No questions match your search</p>
                <p className="text-xs mt-1">Try different search keywords.</p>
              </div>
            ) : (
              filteredLogs.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const dateStr = new Date(item.timestamp || item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const englishQuestion = stripOptionsFromQuestion(item.result.correctedQuestion || item.snippet || '');
                const hindiQuestion = stripOptionsFromQuestion(item.result.hindiQuestion || '');
                const englishSolution = item.result.cleanSolution;
                const hindiSolution = item.result.hindiSolution;

                return (
                  <div 
                    key={item.id} 
                    className="border border-border rounded-xl bg-background overflow-hidden transition-all shadow-sm hover:border-border/80"
                  >
                    {/* Collapsed Header Bar */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="truncate flex-1">
                          <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                            {englishQuestion ? englishQuestion.slice(0, 100) : (item.snippet || 'Quantitative Question')}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                            <Clock className="w-3 h-3" />
                            <span>{dateStr}</span>
                            {item.result.topic && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground/80">{item.result.topic}</span>
                              </>
                            )}
                            {item.inputType === 'image' && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted/40">
                                Image Input
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge 
                          variant={item.result.myAnswerStatus === 'correct' ? "outline" : "destructive"} 
                          className="text-[10px] h-5 capitalize"
                        >
                          {item.result.myAnswerStatus}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Detail Panel with Both English & Hindi Questions & Solutions */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 sm:p-6 bg-muted/10 space-y-6">
                        
                        {/* Action Bar for this item */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Question Details</span>
                            {item.result.markedAnswer && (
                              <span>• Marked: <b className="text-foreground">{item.result.markedAnswer}</b></span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyFullBilingual(item)}
                            className="h-7 text-xs px-2.5 font-medium border-primary/30 text-primary hover:bg-primary/10"
                          >
                            {copiedField === `full_${item.id}` ? (
                              <><CheckCheck className="w-3.5 h-3.5 mr-1 text-green-600" /> Copied Full Set</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5 mr-1" /> Copy Full Q & Sol (Bilingual)</>
                            )}
                          </Button>
                        </div>

                        {/* ================= 1. ENGLISH SECTION ================= */}
                        {(filterLang === 'both' || filterLang === 'en') && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                English
                              </Badge>
                              <div className="h-px flex-1 bg-border/60" />
                            </div>

                            {/* English Question */}
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" /> English Question
                                </span>
                                <button
                                  onClick={() => copyText(englishQuestion, `q_en_${item.id}`)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                                >
                                  {copiedField === `q_en_${item.id}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                  Copy Question
                                </button>
                              </div>
                              <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                                {englishQuestion || "Question content not available"}
                              </div>
                            </div>

                            {/* English Solution */}
                            <div className="rounded-xl border border-primary/20 bg-background p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5" /> English Clean Solution
                                </span>
                                <button
                                  onClick={() => copyText(englishSolution, `sol_en_${item.id}`)}
                                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                  {copiedField === `sol_en_${item.id}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                  Copy Solution
                                </button>
                              </div>
                              {englishSolution ? (
                                <FormattedSolution text={englishSolution} />
                              ) : (
                                <div className="text-xs text-muted-foreground italic">No solution provided</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ================= 2. HINDI SECTION ================= */}
                        {(filterLang === 'both' || filterLang === 'hi') && (
                          <div className="space-y-4 pt-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                                हिन्दी अनुवाद (Hindi)
                              </Badge>
                              <div className="h-px flex-1 bg-border/60" />
                            </div>

                            {/* Hindi Question */}
                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <Languages className="w-3.5 h-3.5" /> हिन्दी प्रश्न (Hindi Question)
                                </span>
                                {hindiQuestion && (
                                  <button
                                    onClick={() => copyText(hindiQuestion, `q_hi_${item.id}`)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                                  >
                                    {copiedField === `q_hi_${item.id}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                    Copy हिन्दी प्रश्न
                                  </button>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                                {hindiQuestion || (
                                  <span className="text-muted-foreground italic text-xs">
                                    Hindi question translation not available for this record.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Hindi Solution */}
                            <div className="rounded-xl border border-indigo-500/20 bg-background p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5" /> हिन्दी हल (Hindi Solution)
                                </span>
                                {hindiSolution && (
                                  <button
                                    onClick={() => copyText(hindiSolution, `sol_hi_${item.id}`)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                                  >
                                    {copiedField === `sol_hi_${item.id}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                    Copy हिन्दी हल
                                  </button>
                                )}
                              </div>
                              {hindiSolution ? (
                                <FormattedSolution text={hindiSolution} />
                              ) : (
                                <span className="text-muted-foreground italic text-xs">
                                  Hindi solution not available for this record.
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Audit Recommendation Note */}
                        {item.result.auditSummary && (
                          <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">Audit Feedback: </span>
                              {item.result.auditSummary}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
