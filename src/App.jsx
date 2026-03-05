import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres un tutor clínico especializado en odontología, diseñado para ayudar a estudiantes a desarrollar su razonamiento diagnóstico. Tu rol NO es dar respuestas directas, sino guiar al estudiante a través del proceso clínico de forma socrática.

## TU PERSONALIDAD
- Eres paciente, alentador y riguroso
- Celebras el razonamiento correcto, no solo la respuesta correcta
- Cuando el estudiante se equivoca, no lo corriges de golpe: haces preguntas que lo lleven a descubrir el error
- Usas lenguaje clínico apropiado pero accesible para estudiantes en formación

## ÁREAS QUE MANEJAS
1. Diagnóstico oral general
2. Patología oral (lesiones, tumores, infecciones, enfermedades sistémicas con manifestación oral)
3. Radiología dental (interpretación de hallazgos radiográficos)
4. Urgencias y dolor agudo (pulpitis, abscesos, pericoronaritis, trauma, etc.)

## FLUJO DE INTERACCIÓN

### PASO 1 — RECEPCIÓN DEL CASO
Cuando el estudiante presente un caso, responde con un breve reconocimiento y la primera pregunta clínica.

### PASO 2 — GUÍA SOCRÁTICA
Haz preguntas secuenciales sobre: anamnesis, hallazgos clínicos, hallazgos radiográficos, historia médica. No hagas más de 2 preguntas a la vez.

### PASO 3 — DIAGNÓSTICO DIFERENCIAL
Pide al estudiante que proponga su diagnóstico diferencial y evalúa su razonamiento.

### PASO 4 — RETROALIMENTACIÓN Y CIERRE
Al final entrega:
1. ✅ Diagnóstico más probable con justificación
2. 📋 Diagnósticos diferenciales con criterios de diferenciación
3. 🔬 Exámenes complementarios recomendados
4. 💊 Orientación de manejo general
5. 📚 Un concepto clave para reforzar el aprendizaje

## REGLAS
- NUNCA des el diagnóstico final antes de que el estudiante haya razonado
- Si pide la respuesta directa, motívalo a intentarlo primero
- Siempre aclara que tus respuestas son con fines educativos
- Si hay riesgo vital, orienta siempre a derivación inmediata
- Responde siempre en español`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: `¡Hola! Soy tu tutor clínico de odontología 🦷

Estoy aquí para ayudarte a desarrollar tu razonamiento diagnóstico de forma práctica y socrática — no te voy a dar las respuestas directas, sino que vamos a razonar juntos como en una discusión clínica real.

**Puedes presentarme un caso de cualquiera de estas áreas:**
- 🔍 Diagnóstico oral general
- 🧫 Patología oral
- 📷 Radiología dental
- 🚨 Urgencias y dolor agudo

Cuéntame el caso clínico con los datos que tienes y empezamos. ¿Listo?`
};

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 18px", background: "rgba(255,255,255,0.06)", borderRadius: 16, borderBottomLeftRadius: 4, width: "fit-content", maxWidth: 80 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#4ade80",
          animation: "bounce 1.2s infinite ease-in-out",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
  );
}

function parseMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={key++} style={{ fontWeight: 700, color: "#86efac", marginBottom: 4 }}>{line.slice(2, -2)}</p>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#4ade80", flexShrink: 0 }}>▸</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#86efac">$1</strong>') }} />
        </div>
      );
    } else if (line === '') {
      elements.push(<div key={key++} style={{ height: 8 }} />);
    } else {
      elements.push(
        <p key={key++} style={{ marginBottom: 2 }}
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#86efac">$1</strong>') }}
        />
      );
    }
  }
  return elements;
}

const EXAMPLE_CASES = [
  { label: "🚨 Urgencia", text: "Paciente de 28 años con dolor intenso pulsátil en molar inferior derecho desde hace 3 días, espontáneo, no cede con analgésicos y se irradia al oído." },
  { label: "🧫 Patología oral", text: "Lesión blanca en mucosa del carrillo derecho, 2 cm, superficie rugosa, no desprende al raspado, indolora. Paciente fumador de 20 años." },
  { label: "📷 Radiología", text: "Imagen radiolúcida bien delimitada con bordes corticalizados en ápice del diente 46. No presenta vitalidad pulpar." },
];

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.filter(m => m.role !== "system").map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages
        })
      });

      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "No pude procesar la respuesta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Hubo un error al conectar con el tutor. Intenta de nuevo." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setArea(null);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0f0a 0%, #0d1a0f 50%, #091409 100%)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#d1fae5",
      position: "relative",
      overflow: "hidden"
    }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #166534; border-radius: 4px; }
        textarea { resize: none; outline: none; border: none; }
        textarea::placeholder { color: #4b7a5a; }
        .msg-in { animation: fadeUp 0.3s ease forwards; }
        .chip:hover { background: rgba(74,222,128,0.15) !important; border-color: #4ade80 !important; transform: translateY(-1px); }
        .send-btn:hover { background: #16a34a !important; transform: scale(1.05); }
        .reset-btn:hover { color: #4ade80 !important; }
      `}</style>

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      {/* Glow orbs */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(22,163,74,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(74,222,128,0.15)",
        padding: "18px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #166534, #15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, boxShadow: "0 0 20px rgba(74,222,128,0.3)"
          }}>🦷</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em", color: "#dcfce7" }}>Tutor Clínico</div>
            <div style={{ fontSize: 12, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" }}>Odontología · Agente Diagnóstico</div>
          </div>
        </div>
        <button className="reset-btn" onClick={resetChat} style={{
          background: "transparent", border: "1px solid rgba(74,222,128,0.2)",
          color: "#6ee7b7", borderRadius: 8, padding: "6px 14px",
          fontSize: 12, cursor: "pointer", fontFamily: "monospace",
          letterSpacing: "0.06em", transition: "all 0.2s"
        }}>↺ Nuevo caso</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 760, width: "100%", margin: "0 auto" }}>

        {messages.map((msg, i) => (
          <div key={i} className="msg-in" style={{
            display: "flex",
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
            alignItems: "flex-end", gap: 10
          }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg, #166534, #15803d)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, boxShadow: "0 0 12px rgba(74,222,128,0.2)"
              }}>🦷</div>
            )}
            <div style={{
              maxWidth: "78%",
              padding: "13px 17px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user"
                ? "linear-gradient(135deg, #166534, #14532d)"
                : "rgba(255,255,255,0.05)",
              border: msg.role === "user" ? "none" : "1px solid rgba(74,222,128,0.1)",
              fontSize: 14.5, lineHeight: 1.65,
              color: msg.role === "user" ? "#dcfce7" : "#d1fae5",
              boxShadow: msg.role === "user" ? "0 4px 20px rgba(22,101,52,0.4)" : "none"
            }}>
              {msg.role === "assistant" ? parseMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg-in" style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #166534, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🦷</div>
            <TypingIndicator />
          </div>
        )}

        {/* Example cases — only show at start */}
        {messages.length === 1 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: "#4b7a5a", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>Casos de ejemplo para empezar:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EXAMPLE_CASES.map((c, i) => (
                <button key={i} className="chip" onClick={() => sendMessage(c.text)} style={{
                  background: "rgba(74,222,128,0.06)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#a7f3d0", fontSize: 13, cursor: "pointer",
                  textAlign: "left", lineHeight: 1.5, transition: "all 0.2s",
                  fontFamily: "Georgia, serif"
                }}>
                  <span style={{ fontWeight: 700, color: "#4ade80" }}>{c.label}</span><br />
                  <span style={{ color: "#6ee7b7", fontSize: 12 }}>{c.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: "1px solid rgba(74,222,128,0.12)",
        padding: "14px 16px",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        position: "sticky", bottom: 0
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(74,222,128,0.2)",
            borderRadius: 14, padding: "11px 16px",
            transition: "border-color 0.2s"
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Describe el caso clínico… (Enter para enviar)"
              rows={1}
              style={{
                width: "100%", background: "transparent",
                color: "#d1fae5", fontSize: 14.5,
                fontFamily: "Georgia, serif", lineHeight: 1.6,
                maxHeight: 120, overflowY: "auto"
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: loading || !input.trim() ? "rgba(74,222,128,0.1)" : "#15803d",
            border: "none", cursor: loading || !input.trim() ? "default" : "pointer",
            fontSize: 18, transition: "all 0.2s",
            boxShadow: !loading && input.trim() ? "0 0 16px rgba(74,222,128,0.3)" : "none"
          }}>
            {loading ? "⏳" : "↑"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "#2d5a3d", marginTop: 8, fontFamily: "monospace", letterSpacing: "0.04em" }}>
          Solo con fines educativos · No reemplaza criterio clínico profesional
        </p>
      </div>
    </div>
  );
}
