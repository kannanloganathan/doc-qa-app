import { useState, useRef, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function chunkText(text, size = 1500, overlap = 100) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
    if (i >= text.length) break;
  }
  return chunks;
}

async function extractTextFromPDF(file) {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((s) => s.str).join(" ") + "\n\n";
        }
        resolve(fullText.trim());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (data.type !== "overloaded_error") return data;
    await new Promise((r) => setTimeout(r, (i + 1) * 2000));
  }
  throw new Error("API is overloaded, please try again in a moment");
};

const EXAMPLES = [
  "What is the main topic of this document?",
  "Summarise the key points",
  "What are the most important dates or deadlines?",
  "Who are the key people mentioned?",
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: "Upload any document",
    desc: "Supports PDF and plain text files up to any length",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: "Ask in plain English",
    desc: "No special syntax — just ask like you'd ask a colleague",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
    title: "Cited answers",
    desc: "Every answer references the exact section it came from",
  },
];

function Landing({ onUpload, isProcessing, error }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    if (file.type === "application/pdf") onUpload(file, "pdf");
    else if (file.type === "text/plain") onUpload(file, "txt");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#f0efe8", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-1 { animation: fadeUp 0.6s ease forwards; }
        .fade-2 { animation: fadeUp 0.6s 0.15s ease both; }
        .fade-3 { animation: fadeUp 0.6s 0.3s ease both; }
        .fade-4 { animation: fadeUp 0.6s 0.45s ease both; }
        .upload-zone:hover { border-color: #c8b87a !important; background: rgba(200,184,122,0.05) !important; }
        .example-chip:hover { background: rgba(200,184,122,0.15) !important; border-color: rgba(200,184,122,0.4) !important; color: #c8b87a !important; cursor: pointer; }
        .glow { position:absolute; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle, rgba(200,184,122,0.08) 0%, transparent 70%); pointer-events:none; top:-200px; left:50%; transform:translateX(-50%); }
      `}</style>

      <div style={{ position: "relative", overflow: "hidden" }}>
        <div className="glow" />

        {/* Nav */}
        <nav className="fade-1" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #c8b87a, #a89050)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2" fill="none"/></svg>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>DocQA</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
            Powered by Claude AI
          </div>
        </nav>

        {/* Hero */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
          <div className="fade-1" style={{ display: "inline-block", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", color: "#c8b87a", background: "rgba(200,184,122,0.1)", border: "1px solid rgba(200,184,122,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 28, textTransform: "uppercase" }}>
            AI Document Assistant
          </div>

          <h1 className="fade-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
            Ask anything about<br />
            <em style={{ fontStyle: "italic", fontWeight: 400, color: "#c8b87a" }}>any document</em>
          </h1>

          <p className="fade-3" style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 auto 48px", maxWidth: 480, fontWeight: 300 }}>
            Upload a PDF or text file. Ask questions in plain English. Get answers with exact citations — instantly.
          </p>

          {/* Upload zone */}
          <div className="fade-4">
            {error && (
              <div style={{ background: "rgba(220,60,60,0.1)", border: "1px solid rgba(220,60,60,0.3)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#ff8080", marginBottom: 16, textAlign: "left" }}>
                {error}
              </div>
            )}

            <div
              className="upload-zone"
              onClick={() => !isProcessing && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                border: `1.5px dashed ${dragging ? "#c8b87a" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 16,
                padding: "48px 32px",
                cursor: isProcessing ? "wait" : "pointer",
                background: dragging ? "rgba(200,184,122,0.05)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s",
                position: "relative",
              }}
            >
              <input ref={inputRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

              {isProcessing ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, border: "2px solid rgba(200,184,122,0.2)", borderTop: "2px solid #c8b87a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>Reading your document...</p>
                </div>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(200,184,122,0.1)", border: "1px solid rgba(200,184,122,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#c8b87a" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p style={{ fontWeight: 500, fontSize: 16, margin: "0 0 6px", color: "#f0efe8" }}>Drop your file here</p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: "0 0 20px" }}>PDF or TXT · Any size</p>
                  <div style={{ display: "inline-block", background: "#c8b87a", color: "#0a0a0f", fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 8 }}>
                    Browse files
                  </div>
                </>
              )}
            </div>

            {/* Example chips */}
            <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", alignSelf: "center", marginRight: 4 }}>Try asking:</span>
              {EXAMPLES.map((ex) => (
                <span key={ex} className="example-chip" style={{ fontSize: 12, padding: "6px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", background: "transparent", transition: "all 0.15s" }}>
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 100px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "24px 20px" }}>
              <div style={{ color: "#c8b87a", marginBottom: 12 }}>{f.icon}</div>
              <p style={{ fontWeight: 500, fontSize: 15, margin: "0 0 6px" }}>{f.title}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatView({ docName, chunks, onReset }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `I have read **${docName}** (${chunks.length} sections). What would you like to know?`,
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    setIsLoading(true);
    setError(null);

    const context = chunks.map((c, i) => `[Section ${i + 1}]:\n${c}`).join("\n\n---\n\n");
    const prompt = `You are a helpful document assistant. Answer the user's question using ONLY the document sections below.
Always cite which section(s) support your answer (e.g. "According to [Section 3]...").
If the answer is not in the document, say so clearly.
Keep answers concise and well-structured.

Document: "${docName}"
${context}

Question: ${q}`;

    const newMessages = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    const assistantIndex = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "", loading: true }]);

    try {
      const data = await fetchWithRetry("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const fullText = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("") || "No response received.";
      setMessages((prev) => prev.map((m, i) => i === assistantIndex ? { ...m, content: fullText, loading: false } : m));
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((_, i) => i !== assistantIndex));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#f0efe8", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .msg { animation: fadeUp 0.25s ease forwards; }
        .send-btn:hover:not(:disabled) { background: #d4c48a !important; }
        .send-btn:disabled { opacity: 0.4; cursor: default; }
        textarea:focus { outline: none; }
        textarea::placeholder { color: rgba(255,255,255,0.25); }
        .new-doc:hover { border-color: rgba(200,184,122,0.4) !important; color: #c8b87a !important; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #c8b87a, #a89050)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2" fill="none"/></svg>
          </div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>DocQA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "4px 12px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {docName}
          </div>
          <button className="new-doc" onClick={onReset} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s" }}>
            New document
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", maxWidth: 760, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {messages.map((msg, i) => (
          <div key={i} className="msg" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 16, gap: 10, alignItems: "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #c8b87a, #a89050)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14h-2v-4h2v4zm0-6h-2V8h2v2z"/></svg>
              </div>
            )}
            <div style={{
              maxWidth: "78%",
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
              background: msg.role === "user" ? "#c8b87a" : "rgba(255,255,255,0.05)",
              color: msg.role === "user" ? "#0a0a0f" : "#f0efe8",
              fontSize: 14,
              lineHeight: 1.7,
              border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.07)" : "none",
              whiteSpace: "pre-wrap",
            }}>
              {msg.loading ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8b87a", animation: `spin 1s ${d}s ease-in-out infinite`, opacity: 0.6 }} />
                  ))}
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {error && (
          <div style={{ background: "rgba(220,60,60,0.1)", border: "1px solid rgba(220,60,60,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff8080", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 24px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, display: "flex", alignItems: "flex-end", gap: 10, padding: "12px 14px", transition: "border-color 0.2s" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
            placeholder="Ask a question about your document..."
            rows={1}
            style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: "#f0efe8", fontSize: 14, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", padding: 0 }}
          />
          <button
            className="send-btn"
            onClick={handleAsk}
            disabled={!input.trim() || isLoading}
            style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "#c8b87a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          >
            {isLoading ? (
              <div style={{ width: 14, height: 14, border: "2px solid rgba(10,10,15,0.3)", borderTop: "2px solid #0a0a0f", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#0a0a0f"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            )}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", margin: "10px 0 0" }}>
          Answers are grounded in your document · Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [doc, setDoc] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (file, type) => {
    setIsProcessing(true);
    setError(null);
    try {
      let text = "";
      if (type === "pdf") text = await extractTextFromPDF(file);
      else text = await file.text();
      if (!text || text.length < 20) throw new Error("Could not extract text from this file.");
      const chunks = chunkText(text);
      setDoc({ name: file.name, chunks });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (doc) return <ChatView docName={doc.name} chunks={doc.chunks} onReset={() => setDoc(null)} />;
  return <Landing onUpload={handleUpload} isProcessing={isProcessing} error={error} />;
}
