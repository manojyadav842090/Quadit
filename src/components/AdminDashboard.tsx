import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Users, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Download, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Eye, 
  Languages, 
  Lightbulb, 
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fetchAllAuditLogs, deleteAuditLog, StoredAuditLog } from '../lib/firebase';
import { stripOptionsFromQuestion } from '../services/geminiService';
import { FormattedSolution } from './FormattedSolution';
import { copyFormattedText } from '../lib/clipboard';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboard({ isOpen, onClose }: AdminDashboardProps) {
  const [logs, setLogs] = useState<StoredAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'wrong' | 'absurd' | 'need_change'>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAllAuditLogs(300);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Unique users list for filtering
  const uniqueUsers = Array.from(new Set(logs.map(l => l.userEmail))).filter(Boolean);

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.snippet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.result.cleanSolution.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.result.topic && log.result.topic.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesUser = selectedUserFilter === 'all' || log.userEmail === selectedUserFilter;

    let matchesStatus = true;
    if (statusFilter === 'correct') {
      matchesStatus = log.result.myAnswerStatus === 'correct';
    } else if (statusFilter === 'wrong') {
      matchesStatus = log.result.myAnswerStatus === 'wrong';
    } else if (statusFilter === 'absurd') {
      matchesStatus = log.result.isAbsurd === 'Yes';
    } else if (statusFilter === 'need_change') {
      matchesStatus = log.result.solutionShouldBeChanged.toLowerCase().startsWith('yes');
    }

    return matchesSearch && matchesUser && matchesStatus;
  });

  // Analytics Stats
  const totalAudits = logs.length;
  const totalUsers = uniqueUsers.length;
  const totalAbsurd = logs.filter(l => l.result.isAbsurd === 'Yes').length;
  const totalWrong = logs.filter(l => l.result.myAnswerStatus === 'wrong').length;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this log entry?")) {
      await deleteAuditLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    }
  };

  const copyText = async (text: string, fieldId: string) => {
    await copyFormattedText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `remix-quadit-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportToCsv = () => {
    if (logs.length === 0) return;
    const headers = [
      "ID",
      "Timestamp",
      "User Email",
      "User Name",
      "Input Type",
      "English Question",
      "Hindi Question",
      "Status",
      "Topic",
      "Clean Solution (English)",
      "Hindi Solution"
    ];

    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const rows = logs.map(log => [
      escapeCsv(log.id),
      escapeCsv(new Date(log.timestamp || log.createdAt).toLocaleString()),
      escapeCsv(log.userEmail),
      escapeCsv(log.userName),
      escapeCsv(log.inputType),
      escapeCsv(log.result.correctedQuestion || log.snippet),
      escapeCsv(log.result.hindiQuestion || ''),
      escapeCsv(log.result.myAnswerStatus),
      escapeCsv(log.result.topic || ''),
      escapeCsv(log.result.cleanSolution),
      escapeCsv(log.result.hindiSolution || '')
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `remix-quadit-audit-data-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Admin Activity & Generation Monitor
              <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground font-semibold px-2 py-0.5">
                Owner Access
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Real-time records of all user queries, prompts, and AI audited solutions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadLogs} 
            disabled={loading}
            className="text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCsv}
            disabled={logs.length === 0}
            className="text-xs h-9 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-medium"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Excel / CSV
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToJson}
            disabled={logs.length === 0}
            className="text-xs h-9"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            JSON
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-9 w-9 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Audits</p>
              <h3 className="text-2xl font-bold">{totalAudits}</h3>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Active Users</p>
              <h3 className="text-2xl font-bold">{totalUsers}</h3>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Wrong Marked</p>
              <h3 className="text-2xl font-bold">{totalWrong}</h3>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Absurd Logic</p>
              <h3 className="text-2xl font-bold">{totalAbsurd}</h3>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col md:flex-row items-center gap-4 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by user email, question text, topic or solution..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>

          {/* User Select */}
          <div className="w-full md:w-56">
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-lg bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Users ({uniqueUsers.length})</option>
              {uniqueUsers.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="text-xs h-8 px-3"
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'wrong' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('wrong')}
              className="text-xs h-8 px-3"
            >
              Wrong Marked
            </Button>
            <Button
              variant={statusFilter === 'absurd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('absurd')}
              className="text-xs h-8 px-3"
            >
              Absurd
            </Button>
            <Button
              variant={statusFilter === 'need_change' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('need_change')}
              className="text-xs h-8 px-3"
            >
              Needs Change
            </Button>
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Showing {filteredLogs.length} of {logs.length} logged activities</span>
            {loading && <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Fetching database...</span>}
          </div>

          {filteredLogs.length === 0 && !loading ? (
            <div className="p-12 text-center rounded-2xl bg-muted/20 border border-dashed border-border">
              <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold">No Audit Records Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {logs.length === 0 
                  ? "Jab koi user audits run karega, unki saari queries aur outputs yahan automatically record ho jayenge." 
                  : "No logs matched your current search filters."}
              </p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              const formattedDate = new Date(log.timestamp || log.createdAt).toLocaleString();

              return (
                <div 
                  key={log.id} 
                  className="rounded-xl border border-border bg-card shadow-sm transition-all overflow-hidden"
                >
                  {/* Summary Bar (Clickable) */}
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                        {log.userName ? log.userName.slice(0, 2) : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{log.userName}</span>
                          <span className="text-xs text-muted-foreground">({log.userEmail})</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                            {log.inputType === 'image' ? 'Image Upload' : 'Text Input'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formattedDate}</span>
                          {log.result.topic && (
                            <>
                              <span>•</span>
                              <span className="text-primary font-medium">{log.result.topic}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                      <Badge 
                        variant={log.result.myAnswerStatus === 'correct' ? "outline" : "destructive"} 
                        className="text-[10px] h-5"
                      >
                        Ans: {log.result.myAnswerStatus}
                      </Badge>

                      {log.result.isAbsurd === 'Yes' && (
                        <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
                          Absurd Alert
                        </Badge>
                      )}

                      <Badge 
                        variant={log.result.solutionShouldBeChanged.toLowerCase().startsWith('no') ? "secondary" : "destructive"} 
                        className="text-[10px] h-5"
                      >
                        Change Sol: {log.result.solutionShouldBeChanged}
                      </Badge>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => handleDelete(log.id, e)}
                        title="Delete log record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-border p-6 bg-muted/10 space-y-6">
                      {/* Snippet / Original question */}
                      <div>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2 flex items-center justify-between">
                          <span>Original Input Snippet</span>
                          <button
                            onClick={() => copyText(log.snippet, `snippet_${log.id}`)}
                            className="text-[11px] text-primary hover:underline flex items-center gap-1"
                          >
                            {copiedField === `snippet_${log.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Copy Input
                          </button>
                        </h4>
                        <div className="p-3 rounded-lg bg-background border border-border text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {log.snippet}
                        </div>
                      </div>

                      {/* Audit Metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border text-xs">
                          <span className="text-muted-foreground font-semibold">Marked Answer in Test</span>
                          <p className="text-sm font-bold mt-1 text-foreground">{log.result.markedAnswer || 'N/A'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border text-xs">
                          <span className="text-muted-foreground font-semibold">Question Change Recommendation</span>
                          <p className="text-sm font-bold mt-1 text-foreground">{log.result.questionShouldBeChanged || 'No'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border text-xs">
                          <span className="text-muted-foreground font-semibold">Solution Change Recommendation</span>
                          <p className="text-sm font-bold mt-1 text-foreground">{log.result.solutionShouldBeChanged || 'No'}</p>
                        </div>
                      </div>

                      {/* Questions Section: English & Hindi */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* English Question */}
                        <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4" />
                              English Question (Bank Exam Standard)
                            </h4>
                            <button
                              onClick={() => copyText(stripOptionsFromQuestion(log.result.correctedQuestion || log.snippet || ''), `q_en_${log.id}`)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              {copiedField === `q_en_${log.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy
                            </button>
                          </div>
                          <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans max-h-48 overflow-y-auto">
                            {stripOptionsFromQuestion(log.result.correctedQuestion || log.snippet || '') || 'No question text'}
                          </div>
                        </div>

                        {/* Hindi Question */}
                        <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                              <Languages className="w-4 h-4" />
                              हिन्दी प्रश्न (Hindi Question)
                            </h4>
                            {log.result.hindiQuestion && (
                              <button
                                onClick={() => copyText(stripOptionsFromQuestion(log.result.hindiQuestion || ''), `q_hi_${log.id}`)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                {copiedField === `q_hi_${log.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                Copy
                              </button>
                            )}
                          </div>
                          <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans max-h-48 overflow-y-auto">
                            {stripOptionsFromQuestion(log.result.hindiQuestion || '') || <span className="text-muted-foreground italic">Hindi translation not available for this entry</span>}
                          </div>
                        </div>
                      </div>

                      {/* Clean Solution */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase text-primary tracking-wider flex items-center gap-1.5">
                            <Lightbulb className="w-4 h-4" />
                            Generated Clean Solution (English)
                          </h4>
                          <button
                            onClick={() => copyText(log.result.cleanSolution, `sol_${log.id}`)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            {copiedField === `sol_${log.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            Copy Solution
                          </button>
                        </div>
                        <div className="p-4 rounded-xl bg-background border border-border">
                          <FormattedSolution text={log.result.cleanSolution} />
                        </div>
                      </div>

                      {/* Hindi Solution */}
                      {log.result.hindiSolution && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase text-indigo-500 tracking-wider flex items-center gap-1.5">
                              <Languages className="w-4 h-4" />
                              Hindi Translation Solution (हिन्दी समाधान)
                            </h4>
                            <button
                              onClick={() => copyText(log.result.hindiSolution, `hindi_${log.id}`)}
                              className="text-xs text-indigo-500 hover:underline flex items-center gap-1 font-medium"
                            >
                              {copiedField === `hindi_${log.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy Hindi
                            </button>
                          </div>
                          <div className="p-4 rounded-xl bg-background border border-border">
                            <FormattedSolution text={log.result.hindiSolution} />
                          </div>
                        </div>
                      )}

                      {/* Audit Summary & Feedback */}
                      {log.result.auditSummary && (
                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-foreground space-y-1">
                          <span className="font-bold text-orange-500 uppercase tracking-wider">AI Audit Evaluation Feedback</span>
                          <p className="text-sm mt-1">{log.result.auditSummary}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
