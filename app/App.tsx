'use client';

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { 
  Plus, 
  Send, 
  Settings, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  Brain, 
  History, 
  Database, 
  Cpu, 
  ChevronRight, 
  MoreVertical,
  Check,
  Key,
  Lock,
  Zap,
  Layers,
  Sparkles
} from "lucide-react";
import { cn } from "./lib/utils";

import { sendMessage, type ModelProvider } from "../lib/modelAdapter";
import { 
  listWorkspaces, 
  ensureDefaultWorkspace, 
  setActiveWorkspaceId, 
  getActiveWorkspaceId,
  getWorkspaceCore, 
  createWorkspace, 
  renameWorkspace, 
  deleteWorkspace, 
  getWorkspaceModel, 
  setWorkspaceModel,
  pinMemoryToCore
} from "../lib/workspaces";

import {
  storeTurn,
  getRelevantMemory,
  getWorkspaceSummary,
  getMemoryCount,
  resetSummaryOnly,
  resetSemanticMemoryOnly,
  fullWorkspaceReset,
  getWorkspaceMemories,
  getWorkspaceHistory
} from "../lib/memory";

import {
  downloadWorkspace,
  downloadAllWorkspaces,
  exportBrain,
  importBrainFromFile,
  importWorkspaceFromFile
} from "../lib/workspaceTransfer";

type Msg = { role: "user" | "assistant"; content: string };

const MAX_CORE_CHARS = 1200;
const MAX_SUMMARY_CHARS = 1000;
const MAX_MEMORY_CHARS = 2500;
const MAX_TOTAL_PROMPT_CHARS = 7000;

function trimTo(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function buildMemoryBlock(memories: string[]) {
  if (!memories.length) return "(none yet)";
  return memories.map((m, i) => `${i + 1}. ${trimTo(m, 600)}`).join("\n");
}

function buildCoreBlock(core: any) {
  if (!core || !core.data) return "(no structured state yet)";
  const entries = Object.entries(core.data);
  if (!entries.length) return "(no structured state yet)";
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

function getProviderDisplayName(model: ModelProvider): string {
  switch (model) {
    case "openai": return "OpenAI";
    case "gemini": return "Gemini";
    case "claude": return "Claude";
    case "ollama": return "Ollama";
    case "mistral": return "Mistral";
    default: return model;
  }
}

function getProviderColor(model: ModelProvider): string {
  switch (model) {
    case "openai": return "bg-blue-500";
    case "gemini": return "bg-emerald-500";
    case "claude": return "bg-orange-500";
    case "ollama": return "bg-purple-500";
    case "mistral": return "bg-pink-500";
    default: return "bg-zinc-500";
  }
}

export default function App() {
  const [model, setModel] = useState<ModelProvider>("openai");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [keys, setKeys] = useState({
    openai: "",
    gemini: "",
    claude: "",
    mistral: ""
  });

  const [savedKeys, setSavedKeys] = useState({
    openai: false,
    gemini: false,
    claude: false,
    mistral: false
  });

  const [workspaces, setWorkspaces] = useState<{ id: number; name: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);

  const [summaryView, setSummaryView] = useState("");
  const [coreView, setCoreView] = useState("");
  const [memoryCount, setMemoryCount] = useState(0);
  const [lastPromptSize, setLastPromptSize] = useState(0);

  const [memoriesView, setMemoriesView] = useState<any[]>([]);
  const [confirmCoreUpdates, setConfirmCoreUpdates] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [editingWorkspace, setEditingWorkspace] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [activeTab, setActiveTab] = useState<"memory" | "summary" | "context" | "tokens">("memory");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"API Keys" | "Workspace" | "Backups" | "Danger Zone">("API Keys");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");

  useEffect(() => {
    const checkKeys = () => {
      setSavedKeys({
        openai: !!localStorage.getItem("openai_key"),
        gemini: !!localStorage.getItem("gemini_key"),
        claude: !!localStorage.getItem("claude_key"),
        mistral: !!localStorage.getItem("mistral_key")
      });
    };
    checkKeys();
  }, []);

  useEffect(() => {

  async function verifyStoredLicense() {

    const key = localStorage.getItem("ankoryn_license_key");

    if (!key) return;

    try {

      const res = await fetch("/api/verify-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          license_key: key
        })
      });

      const data = await res.json();

      if (!data.valid) {
        localStorage.removeItem("ankoryn_license_key");
      }

    } catch (err) {
      console.error("Licence verification failed", err);
    }
  }

  verifyStoredLicense();

}, []);

useEffect(() => {

  // Detect Stripe success redirect
  const params = new URLSearchParams(window.location.search);

  if (params.get("success") === "true") {

    alert("🎉 Purchase successful! Check your email for your Ankoryn licence key.");

    // Clean URL so it doesn't trigger again
    window.history.replaceState({}, "", "/");
  }

  (async () => {
    let activeId = await getActiveWorkspaceId();
    if (!activeId) activeId = await ensureDefaultWorkspace();

    const ws = await listWorkspaces();
    setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
    setWorkspaceId(activeId);

    const history = await getWorkspaceHistory(activeId);
    setMessages(history);

    const modelConfig = await getWorkspaceModel(activeId);
    if (modelConfig) {
      setModel(modelConfig.provider as ModelProvider);
    }

    refreshTransparency(activeId);
  })();

}, []);

  useEffect(() => {
    if (workspaceId) refreshTransparency();
  }, [workspaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (model !== "ollama") return;
    (async () => {
      try {
        const res = await fetch("/api/ollama-models");
        const data = await res.json();
        const models = Array.isArray(data?.models) ? data.models : [];
        setOllamaModels(models);
        if (models.length > 0 && !models.includes(ollamaModel)) {
          setOllamaModel(models[0]);
        }
      } catch (err) {
        console.error("Failed to fetch Ollama models:", err);
        setOllamaModels([]);
      }
    })();
  }, [model]);

  async function refreshTransparency(id?: number) {
    const wid = id ?? workspaceId;
    if (!wid) return;

    const [summary, core, count, memories] = await Promise.all([
      getWorkspaceSummary(wid),
      getWorkspaceCore(wid),
      getMemoryCount(wid),
      getWorkspaceMemories(wid)
    ]);

    setSummaryView(summary);
    setCoreView(buildCoreBlock(core));
    setMemoryCount(count);
    setMemoriesView(memories);
  }

  const saveKey = (provider: keyof typeof keys) => {
    const k = keys[provider].trim();
    if (!k) return;
    localStorage.setItem(`${provider}_key`, k);
    setKeys(prev => ({ ...prev, [provider]: "" }));
    setSavedKeys(prev => ({ ...prev, [provider]: true }));
  };

  async function upgrade() {
  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
    });

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert("Checkout failed.");
    }

  } catch (err) {
    console.error(err);
    alert("Unable to start checkout.");
  }
}

async function activateLicense() {
  try {
    const key = licenseKeyInput.trim();

    if (!key) {
      alert("Please enter a licence key.");
      return;
    }

    const res = await fetch("/api/verify-license", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  action: "verify",
  license_key: key
})
    });

    const data = await res.json();

    if (data.valid) {
      localStorage.setItem("ankoryn_unlocked", "true");
      localStorage.setItem("ankoryn_license_key", key);

      alert("🎉 Ankoryn Pro unlocked!");

      setShowUpgradeModal(false);
      location.reload();
      return;
    }

    alert("Invalid licence key.");

  } catch (err) {
    console.error(err);
    alert("Unable to verify licence.");
  }
}

  async function handleSend() {
    const text = input.trim();
    if (!text || !workspaceId) return;

    setLoading(true);
    try {
      setMessages(prev => [...prev, { role: "user", content: text }]);
      setInput("");

      const memory = await getRelevantMemory(workspaceId, text);
      const summaryRaw = await getWorkspaceSummary(workspaceId);
      const coreRaw = await getWorkspaceCore(workspaceId);

      const coreBlock = trimTo(buildCoreBlock(coreRaw), MAX_CORE_CHARS);
      const summary = trimTo(summaryRaw || "(none yet)", MAX_SUMMARY_CHARS);
      const memoryBlock = trimTo(buildMemoryBlock(memory), MAX_MEMORY_CHARS);

      let prompt = [
        "SYSTEM IDENTITY LAYER",
        "You are Ankoryn, an AI workspace assistant designed to help users build projects, organise ideas, and maintain long-term context.",
        "Use the workspace context below to personalise responses.",
        "",
        "WORKSPACE CORE STATE",
        coreBlock,
        "",
        "WORKSPACE SUMMARY (REFERENCE ONLY)",
        summary,
        "",
        "RELEVANT MEMORIES",
        memoryBlock,
        "",
        "CURRENT MESSAGE",
        `User: ${text}`,
        "",
        "Respond to the user normally."
      ].join("\n");

      prompt = trimTo(prompt, MAX_TOTAL_PROMPT_CHARS);
      setLastPromptSize(prompt.length);

      const assistant = await sendMessage(
        model,
        prompt,
        model === "ollama" ? ollamaModel : undefined
      );

      setMessages(prev => [...prev, { role: "assistant", content: assistant }]);
      await storeTurn(workspaceId, `User: ${text}`, `Assistant: ${assistant}`);
      await refreshTransparency();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-72 flex flex-col border-r border-white/5 bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
                    <img
            src="/logo.png"
            alt="Ankoryn"
            className="w-8 h-8 rounded-lg object-contain"
            />
          <span className="text-xl font-bold tracking-tight">Ankoryn</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Workspaces</h3>
            <button 
              onClick={async () => {
  try {
    const id = await createWorkspace("New Workspace");

    const ws = await listWorkspaces();
    setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));

    setWorkspaceId(id);
    setEditingWorkspace(id);
    setRenameValue("New Workspace");
    setMessages([]);

    refreshTransparency(id);

  } catch (err: any) {

    if (err?.message === "WORKSPACE_LIMIT_REACHED") {
  setShowUpgradeModal(true);
  return;
}

    console.error(err);
  }
}}
              className="p-1 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            {workspaces.map((w) => {
              const isActive = w.id === workspaceId;
              const isEditing = editingWorkspace === w.id;

              return (
                <div
                  key={w.id}
                  onClick={async () => {
                    if (isEditing) return;
                    setWorkspaceId(w.id);
                    await setActiveWorkspaceId(w.id);
                    const history = await getWorkspaceHistory(w.id);
                    setMessages(history);
                    const modelConfig = await getWorkspaceModel(w.id);
                    if (modelConfig) setModel(modelConfig.provider as ModelProvider);
                    refreshTransparency(w.id);
                  }}
                  onDoubleClick={() => {
                    setEditingWorkspace(w.id);
                    setRenameValue(w.name);
                  }}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                    isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Database size={16} className={isActive ? "text-emerald-400" : "text-zinc-500"} />
                    {isEditing ? (
                      <input
                        className="bg-transparent border-none outline-none text-white w-full"
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={async () => {
                          if (renameValue.trim()) await renameWorkspace(w.id, renameValue.trim());
                          const ws = await listWorkspaces();
                          setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
                          setEditingWorkspace(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            if (renameValue.trim()) await renameWorkspace(w.id, renameValue.trim());
                            const ws = await listWorkspaces();
                            setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
                            setEditingWorkspace(null);
                          }
                          if (e.key === "Escape") setEditingWorkspace(null);
                        }}
                      />
                    ) : (
                      <span className="truncate text-sm font-medium">{w.name}</span>
                    )}
                  </div>
                  {isActive && !isEditing && <Check size={14} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col relative bg-black">
        {/* HEADER */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Layers size={16} />
              <span className="text-xs font-semibold uppercase tracking-widest">Workspace</span>
            </div>
            <ChevronRight size={14} className="text-zinc-700" />
            <span className="text-sm font-bold text-white">
              {workspaces.find(w => w.id === workspaceId)?.name || "Ankoryn"}
            </span>
          </div>

          {/* MODEL SWITCHER - THE CORE FEATURE */}
          <div className="flex items-center bg-zinc-900/50 p-1 rounded-full border border-white/5">
            {(["openai", "gemini", "claude", "mistral", "ollama"] as ModelProvider[]).map((p) => (
              <button
                key={p}
                onClick={async () => {
                  setModel(p);
                  if (workspaceId) await setWorkspaceModel(workspaceId, p, p === "ollama" ? ollamaModel : p);
                }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2",
                  model === p 
                    ? cn(getProviderColor(p), "text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-white/20") 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                {getProviderDisplayName(p)}
                {p === model && (
                  <span className="flex items-center gap-1.5 ml-1 pl-2 border-l border-white/20">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase tracking-tighter opacity-80">Active</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* CHAT MESSAGES */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20"
              >
                <Brain size={40} className="text-emerald-400" />
              </motion.div>
              <div className="space-y-4">
                <h2 className="text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                  Switch AI models without losing context
                </h2>
                <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
                  Ankoryn keeps the memory of your workspace so conversations continue even when you switch between GPT, Claude, Gemini, Mistral or local models.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {[
                  { icon: <Zap size={18} />, text: "Summarise this workspace", prompt: "Summarise this workspace" },
                  { icon: <Brain size={18} />, text: "Suggest core facts", prompt: "What important facts should be stored as core state?" },
                  { icon: <RefreshCw size={18} />, text: "Compare AI models", prompt: "How do different models handle this workspace context?" },
                  { icon: <History size={18} />, text: "Recall last session", prompt: "What were we working on last time?" }
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s.prompt);
                      handleSend();
                    }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/30 hover:bg-zinc-900/60 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform text-emerald-400">
                      {s.icon}
                    </div>
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-12">
              {messages.map((m, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-6",
                    m.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                    m.role === "assistant" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-zinc-900 border-white/10 text-zinc-400"
                  )}>
                    {m.role === "assistant" ? <Brain size={20} /> : <div className="font-bold text-xs">YOU</div>}
                  </div>
                  <div className={cn(
                    "space-y-2 max-w-[85%]",
                    m.role === "user" ? "text-right" : "text-left"
                  )}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      {m.role === "assistant" ? "Ankoryn Intelligence" : "User Session"}
                    </div>
                    <div className={cn(
                      "p-6 rounded-3xl text-sm leading-relaxed",
                      m.role === "assistant" ? "bg-zinc-900/40 border border-white/5 text-zinc-200" : "bg-emerald-500 text-black font-medium"
                    )}>
                      <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5">
                        <ReactMarkdown>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-6">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Brain size={20} className="animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Thinking...</div>
                    <div className="flex gap-1.5 p-4 bg-zinc-900/40 border border-white/5 rounded-2xl">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-8 pt-0">
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center gap-4 bg-zinc-900/80 border border-white/10 p-2 pl-6 rounded-[1.8rem] backdrop-blur-xl focus-within:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full border border-white/5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {getProviderDisplayName(model)}
              </div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message Ankoryn via ${getProviderDisplayName(model)}...`}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm py-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && input.trim()) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  input.trim() ? "bg-white text-black hover:scale-105" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500/60">
                <Database size={10} /> Your workspace data stays in your browser
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> {getProviderDisplayName(model)} Active
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
  {showUpgradeModal && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-8"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl p-8 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Lock size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Unlock Unlimited Workspaces</h2>
            <p className="text-sm text-zinc-400">You’ve reached the free workspace limit.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 space-y-3">
          <p className="text-sm text-zinc-300 leading-relaxed">
            The free plan includes <span className="font-bold text-white">2 workspaces</span>.
            Upgrade to unlock:
          </p>

          <div className="space-y-2 text-sm text-zinc-300">
            <div>• Unlimited workspaces</div>
            <div>• Persistent AI project separation</div>
            <div>• Lifetime access</div>
          </div>

          <div className="pt-2 text-lg font-bold text-white">
            £29 one-time
          </div>
        </div>

<div className="space-y-4">

  <input
    value={licenseKeyInput}
    onChange={(e) => setLicenseKeyInput(e.target.value)}
    placeholder="Enter your licence key"
    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-emerald-500/50"
  />

  <div className="flex gap-3">

    <button
      onClick={() => setShowUpgradeModal(false)}
      className="flex-1 px-5 py-3 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition-all"
    >
      Cancel
    </button>

    <button
      onClick={activateLicense}
      className="flex-1 px-5 py-3 rounded-xl border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all"
    >
      Enter Licence
    </button>

    <button
      onClick={() => {
        setShowUpgradeModal(false);
        upgrade();
      }}
      className="flex-1 px-5 py-3 rounded-xl bg-white text-black font-bold hover:scale-[1.02] transition-all"
    >
      Upgrade £29
    </button>

  </div>
</div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

        {/* SETTINGS OVERLAY */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex h-[80vh]"
              >
                {/* SETTINGS SIDEBAR */}
                <div className="w-64 border-r border-white/5 p-8 space-y-8">
                  <h2 className="text-xl font-bold">Settings</h2>
                  <nav className="space-y-2">
                    {["API Keys", "Workspace", "Backups", "Danger Zone"].map((t) => (
                      <button 
                        key={t} 
                        onClick={() => setSettingsTab(t as any)}
                        className={cn(
                          "w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          settingsTab === t 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </nav>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full bg-white text-black py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform"
                  >
                    Close
                  </button>
                </div>

                {/* SETTINGS CONTENT */}
                <div className="flex-1 overflow-y-auto p-12 space-y-12">
                  {settingsTab === "API Keys" && (
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Key className="text-emerald-400" size={24} />
                        <h3 className="text-2xl font-bold">API Keys</h3>
                      </div>
                      <p className="text-zinc-500 text-sm">Your keys are stored locally in your browser and never sent to our servers.</p>
                      
                      <div className="grid grid-cols-1 gap-6">
                        {(["openai", "gemini", "claude", "mistral"] as const).map((p) => (
                          <div key={p} className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{getProviderDisplayName(p)} Key</label>
                            <div className="flex gap-3">
                              <input
                                type="password"
                                value={keys[p]}
                                onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                                placeholder={savedKeys[p] ? "••••••••••••••••" : "Paste your key here"}
                                className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-all"
                              />
                              <button 
                                onClick={() => saveKey(p)}
                                className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {settingsTab === "Workspace" && (
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Database className="text-emerald-400" size={24} />
                        <h3 className="text-2xl font-bold">Workspace Management</h3>
                      </div>
                      <p className="text-zinc-500 text-sm">Manage the current workspace settings and metadata.</p>
                      
                      <div className="space-y-4">
                        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Workspace Name</label>
                            <div className="flex gap-3">
                              <input
                                value={renameValue || workspaces.find(w => w.id === workspaceId)?.name || ""}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-all"
                              />
                              <button 
                                onClick={async () => {
                                  if (workspaceId && renameValue.trim()) {
                                    await renameWorkspace(workspaceId, renameValue.trim());
                                    const ws = await listWorkspaces();
                                    setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
                                    setRenameValue("");
                                  }
                                }}
                                className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                              >
                                Rename
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-1">
                            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Workspace ID</div>
                            <div className="text-sm font-mono">{workspaceId}</div>
                          </div>
                          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-1">
                            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Memory Count</div>
                            <div className="text-sm font-mono">{memoryCount} entries</div>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {settingsTab === "Backups" && (
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Download className="text-blue-400" size={24} />
                        <h3 className="text-2xl font-bold">Backups & Portability</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => workspaceId && downloadWorkspace(workspaceId)}
                          className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-blue-500/30 transition-all text-left space-y-2"
                        >
                          <Download size={20} className="text-blue-400" />
                          <div className="font-bold">Export Current</div>
                          <div className="text-xs text-zinc-500">Download active workspace data</div>
                        </button>
                        <button 
                          onClick={downloadAllWorkspaces}
                          className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-blue-500/30 transition-all text-left space-y-2"
                        >
                          <Layers size={20} className="text-blue-400" />
                          <div className="font-bold">Export All</div>
                          <div className="text-xs text-zinc-500">Download all workspaces</div>
                        </button>
                        <button 
                          onClick={() => document.getElementById("workspaceImport")?.click()}
                          className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/30 transition-all text-left space-y-2"
                        >
                          <Upload size={20} className="text-emerald-400" />
                          <div className="font-bold">Import Workspace</div>
                          <div className="text-xs text-zinc-500">Upload a workspace JSON</div>
                        </button>
                        <button 
                          onClick={exportBrain}
                          className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-purple-500/30 transition-all text-left space-y-2"
                        >
                          <Brain size={20} className="text-purple-400" />
                          <div className="font-bold">Export Brain</div>
                          <div className="text-xs text-zinc-500">Full local storage backup</div>
                        </button>

                        <button 
                        onClick={() => document.getElementById("brainImport")?.click()}
                        className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-purple-500/30 transition-all text-left space-y-2"
                        >
                        <Upload size={20} className="text-purple-400" />
                        <div className="font-bold">Import Brain</div>
                        <div className="text-xs text-zinc-500">Restore full workspace memory</div>
                        </button>
                      </div>
                      <input 
                        id="workspaceImport" 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            const newId = await importWorkspaceFromFile(e.target.files[0]);
                            const ws = await listWorkspaces();
                            setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
                            setWorkspaceId(newId);
                            setMessages(await getWorkspaceHistory(newId));
                            refreshTransparency(newId);
                          }
                        }} 
                      />
                      <input
                        id="brainImport"
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={async (e) => {
                            if (e.target.files?.[0]) {
                            await importBrainFromFile(e.target.files[0]);
                            location.reload();
                            }
                        }}
                        />
                    </section>
                  )}

                  {settingsTab === "Danger Zone" && (
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Trash2 className="text-red-500" size={24} />
                        <h3 className="text-2xl font-bold text-red-500">Danger Zone</h3>
                      </div>
                      <p className="text-zinc-500 text-sm">Destructive actions that cannot be undone. Please be careful.</p>
                      <div className="flex gap-4">
                        <button 
                          onClick={async () => {
                            if (!workspaceId || !confirm("Reset workspace? This will clear history, memories, and core state.")) return;
                            await fullWorkspaceReset(workspaceId);
                            setMessages([]);
                            refreshTransparency();
                          }}
                          className="px-6 py-3 border border-red-500/20 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500/10 transition-all"
                        >
                          Reset Workspace
                        </button>
                        <button 
                          onClick={async () => {
                            if (!workspaceId || !confirm("Delete workspace? This action is permanent.")) return;
                            await deleteWorkspace(workspaceId);
                            const ws = await listWorkspaces();
                            setWorkspaces(ws.map(w => ({ id: w.id!, name: w.name })));
                            const newActive = await ensureDefaultWorkspace();
                            setWorkspaceId(newActive);
                            setMessages(await getWorkspaceHistory(newActive));
                            refreshTransparency(newActive);
                          }}
                          className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                        >
                          Delete Workspace
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CONTEXT PANEL */}
      <aside className="w-80 border-l border-white/5 bg-zinc-950/50 backdrop-blur-xl flex flex-col">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2 text-zinc-400 mb-6">
            <Brain size={16} />
            <span className="text-xs font-semibold uppercase tracking-widest">Memory Engine</span>
          </div>
          
          <div className="flex p-1 bg-zinc-900 rounded-xl border border-white/5">
            {(["memory", "summary", "context"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  activeTab === t ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "memory" && (
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Core Facts</h4>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 font-mono text-[11px] leading-relaxed text-emerald-400/80">
                  {coreView || "// No core facts captured yet. Ask Ankoryn to suggest facts from your conversation."}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Semantic Memory</h4>
                <div className="space-y-3">
                  {memoriesView.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-white/5 text-zinc-600 text-[11px] leading-relaxed italic">
                      Semantic memories will appear here as your workspace learns from conversations.
                    </div>
                  ) : (
                    memoriesView.map((m) => (
                      <div key={m.id} className="group p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-emerald-500/30 transition-all space-y-3">
                        <p className="text-xs text-zinc-400 leading-relaxed">{m.content}</p>
                        <button 
                          onClick={async () => {
                            if (!workspaceId) return;
                            await pinMemoryToCore(workspaceId, m.content);
                            refreshTransparency();
                          }}
                          className="opacity-0 group-hover:opacity-100 w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                        >
                          Pin to Core
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "summary" && (
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Workspace Summary</h4>
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 text-sm text-zinc-300 leading-relaxed italic">
                {summaryView || "The workspace summary is generated automatically as you chat."}
              </div>
              <button 
                onClick={async () => {
                  if (!workspaceId) return;
                  await resetSummaryOnly(workspaceId);
                  refreshTransparency();
                }}
                className="w-full py-3 rounded-xl border border-white/5 text-zinc-500 text-xs font-bold hover:text-white hover:bg-white/5 transition-all"
              >
                Clear Summary
              </button>
            </div>
          )}

          {activeTab === "context" && (
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Context Injection</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Memory Count</span>
                  <span className="text-sm font-bold text-white">{memoryCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Last Prompt</span>
                  <span className="text-sm font-bold text-white">{lastPromptSize} chars</span>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Token Budget</span>
                    <span className="text-xs font-bold text-emerald-400">{Math.round((lastPromptSize / 7000) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${Math.min(100, (lastPromptSize / 7000) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
