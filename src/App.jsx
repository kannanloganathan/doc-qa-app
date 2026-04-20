import { useState, useRef, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
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

function UploadZone({ onUpload, isLoading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type === "application/pdf") {
      onUpload(file, "pdf");
    } else if (file.type === "text/plain") {
      onUpload(file, "txt");
    }
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? "#378ADD" : "var(--color-border-secondary, #ccc)"}`,
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
        cursor: isLoading ? "wait" : "pointer",
        background: dragging ? "#E6F1FB" : "transparent",
        transition: "all 0.2s",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: "0 auto 12px", display: "block" }}>
        <rect x="6" y="4" width="28" height="34" rx="4" stroke="#888" strokeWidth="1.5" fill="none"/>
        <path d="M13 4v8h14" stroke="#888" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
        <path d="M20 20v8M17 23l3-3 3 3" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {isLoading ? (
        <p style={{ color: "#888", fontSize: 14 }}>Processing document...</p>
      ) : (
        <>
          <p style={{ fontWeight: 500, marginBottom: 4, fontSize: 15 }}>Drop your PDF or TXT here</p>
          <p style={{ color: "#888", fontSize: 13 }}>or click to browse</p>
        </>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "#E6F1FB", display: "flex", alignItems: "center",
          justifyContent: "center", marginRight: 8, flexShrink: 0, marginTop: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#185FA5">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 10a6 6 0 01-4.33-1.86A5.5 5.5 0 0110 11.5a5.5 5.5 0 014.33 1.64A6 6 0 0110 15z"/>
          </svg>
        </div>
      )}
      <div style={{
        maxWidth: "75%",
        padding: "10px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? "#185FA5" : "var(--color-background-secondary, #f5f5f5)",
        color: isUser ? "#fff" : "inherit",
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
        {msg.streaming && (
          <span style={{ display: "inline-block", width: 6, height: 14, background: "currentColor", marginLeft: 2, borderRadius: 1, animation: "blink 1s infinite" }}/>
        )}
      </div>
    </div>
  );
}

export default function DocQA() {
  const [docText, setDocText] = useState(null);
  const [docName, setDocName] = useState("");
  const [chunks, setChunks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (file, type) => {
    setIsProcessing(true);
    setError(null);
    try {
      let text = "";
      if (type === "pdf") {
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      if (!text || text.length < 20) throw new Error("Could not extract text from this file.");
      const c = chunkText(text);
      setDocText(text);
      setChunks(c);
      setDocName(file.name);
      setMessages([{
        role: "assistant",
        content: `Document loaded: "${file.name}" (${c.length} sections, ~${text.length.toLocaleString()} characters).\n\nAsk me anything about it!`,
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || isLoading || !chunks.length) return;
    setInput("");
    setIsLoading(true);
    setError(null);

    const newMessages = [...messages, { role: "user", content: q }];
    setMessages(newMessages);

    const context = chunks.map((c, i) => `[Section ${i + 1}]:\n${c}`).join("\n\n---\n\n");
    const prompt = `You are a helpful document assistant. Answer the user's question using ONLY the document sections provided below.
Always cite which section(s) support your answer (e.g. "According to [Section 3]...").
If the answer is not found in the document, clearly say so — do not make things up.
Keep answers concise and well-structured.

Document: "${docName}"
${context}

Question: ${q}`;

    const assistantIndex = newMessages.length;
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    // try {
    //   const response = await fetch("/api/ask", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json", 
    //     "x-api-key": API_KEY,
    //     "anthropic-version": "2023-06-01",
    //     },
    //     body: JSON.stringify({
    //       model: ANTHROPIC_MODEL,
    //       max_tokens: 1000,
    //       stream: true,
    //       messages: [{ role: "user", content: prompt }],
    //     }),
    //   });

    //   const reader = response.body.getReader();
    //   const decoder = new TextDecoder();
    //   let accumulated = "";

    //   while (true) {
    //     const { done, value } = await reader.read();
    //     if (done) break;
    //     const lines = decoder.decode(value).split("\n");
    //     for (const line of lines) {
    //       if (!line.startsWith("data: ")) continue;
    //       const data = line.slice(6).trim();
    //       if (data === "[DONE]") continue;
    //       try {
    //         const parsed = JSON.parse(data);
    //         if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
    //           accumulated += parsed.delta.text;
    //           setMessages(prev => prev.map((m, i) =>
    //             i === assistantIndex ? { ...m, content: accumulated } : m
    //           ));
    //         }
    //       } catch {}
    //     }
    //   }

    //   setMessages(prev => prev.map((m, i) =>
    //     i === assistantIndex ? { ...m, streaming: false } : m
    //   ));
    // } catch (err) {
    //   setError("Failed to get a response. Please try again.");
    //   setMessages(prev => prev.filter((_, i) => i !== assistantIndex));
    // } finally {
    //   setIsLoading(false);
    //   setTimeout(() => inputRef.current?.focus(), 50);
    // }
try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        stream:false,
        messages: [{ role: "user", content: prompt }],
      }),
      
    });
  
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "API error");
    }
  
    const data = await response.json();
    console.log("API response:", data); // helps debug - check browser console
  
    const fullText = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");
  
    setMessages(prev => prev.map((m, i) =>
      i === assistantIndex
        ? { ...m, content: fullText, streaming: false }
        : m
    ));
  
  } catch (err) {
    console.error("Error:", err);
    setError(err.message || "Failed to get a response. Please try again.");
    setMessages(prev => prev.filter((_, i) => i !== assistantIndex));
  }
  };

  const handleReset = () => {
    setDocText(null);
    setDocName("");
    setChunks([]);
    setMessages([]);
    setInput("");
    setError(null);
  };

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; }
        textarea:focus { outline: none; }
      `}</style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="#185FA5">
                <path d="M4 2h8l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm7 0v4h4M7 11h6M7 14h4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>Document Q&amp;A</div>
              {docName && <div style={{ fontSize: 11, color: "#888" }}>{docName} · {chunks.length} sections</div>}
            </div>
          </div>
          {docText && (
            <button onClick={handleReset} style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 8,
              border: "0.5px solid #ccc", background: "transparent", cursor: "pointer", color: "#666",
            }}>
              New document
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#A32D2D", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Upload or Chat */}
        {!docText ? (
          <UploadZone onUpload={handleUpload} isLoading={isProcessing} />
        ) : (
          <div style={{ border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
            {/* Messages */}
            <div style={{ height: 420, overflowY: "auto", padding: "16px 16px 8px" }}>
              {messages.map((msg, i) => <Message key={i} msg={msg} />)}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: "0.5px solid #e0e0e0", padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-end", background: "var(--color-background-primary, #fff)" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }}}
                placeholder="Ask a question about your document..."
                rows={1}
                style={{
                  flex: 1, resize: "none", border: "none", fontSize: 14,
                  lineHeight: 1.5, padding: "6px 4px", background: "transparent",
                  color: "var(--color-text-primary)", fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleAsk}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 34, height: 34, borderRadius: 8, border: "none",
                  background: (!input.trim() || isLoading) ? "#e0e0e0" : "#185FA5",
                  cursor: (!input.trim() || isLoading) ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 0.2s",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="white">
                  <path d="M3 10l14-7-7 14V11L3 10z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Footer tip */}
        <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 12 }}>
          Supports PDF and plain text · Answers are grounded in your document
        </p>
      </div>
    </>
  );
}
