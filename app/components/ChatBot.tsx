
"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ProductSearchResult = {
  id: string;
  name: string;
  category: string;
  price: number | null;
  priceLabel: string | null;
  stock: number;
  min_order_quantity: number;
};

type StoreTools = {
  searchProducts: {
    input: { query: string };
    output: ProductSearchResult[];
  };
  addToCart: {
    input: { productId: string; productName: string; quantity: number };
    output: string;
  };
  openCheckout: {
    input: Record<string, never>;
    output: string;
  };
};

type StoreChatMessage = UIMessage<unknown, never, StoreTools>;

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6">
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.8-3.2A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 11.5h7M8.5 14.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M21 3 10.5 13.5M21 3l-6.7 18-3.8-7.5L3 9.7 21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [pendingCartAdd, setPendingCartAdd] = useState<{
    toolCallId: string;
    productId: string;
    productName: string;
    quantity: number;
  } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSpokenId = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, addToolOutput, status, error } = useChat<StoreChatMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => {
        const pathname = window.location.pathname;
        const salesChannel = pathname.startsWith("/retail")
          ? "retail"
          : pathname.startsWith("/wholesale")
            ? "wholesale"
            : null;

        return {
          body: { ...body, messages, salesChannel },
        };
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      if (toolCall.toolName === "openCheckout") {
        window.dispatchEvent(new Event("store:open-cart"));
        addToolOutput({
          tool: "openCheckout",
          toolCallId: toolCall.toolCallId,
          output: "Checkout opened. The customer will review and submit the order themselves.",
        });
        return;
      }
      if (toolCall.toolName !== "addToCart") return;
      setPendingCartAdd({
        toolCallId: toolCall.toolCallId,
        productId: toolCall.input.productId,
        productName: toolCall.input.productName,
        quantity: toolCall.input.quantity,
      });
    },
    onError: (err) => {
      console.error("Chatbot error:", err);
    },
  });

  const busy = status === "streaming" || status === "submitted";

  function respondToCartAdd(approved: boolean) {
    if (!pendingCartAdd) return;

    if (approved) {
      window.dispatchEvent(
        new CustomEvent("store:add-to-cart", {
          detail: {
            productId: pendingCartAdd.productId,
            quantity: pendingCartAdd.quantity,
          },
        })
      );
    }

    addToolOutput({
      tool: "addToCart",
      toolCallId: pendingCartAdd.toolCallId,
      output: approved
        ? "The customer confirmed adding the product to the basket."
        : "The customer declined adding the product to the basket.",
    });
    setPendingCartAdd(null);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const startRecording = useCallback(async () => {
    setVoiceError("");

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVoiceError("Recording stopped unexpectedly. Please try again.");
        setListening(false);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setListening(false);

        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (!audioBlob.size) {
          setVoiceError("No audio was recorded. Please try again.");
          return;
        }

        const extension = audioBlob.type.includes("mp4")
          ? "mp4"
          : audioBlob.type.includes("ogg")
            ? "ogg"
            : "webm";

        const formData = new FormData();
        formData.append("audio", audioBlob, `recording.${extension}`);

        setTranscribing(true);
        setVoiceError("Transcribing your voice message...");

        try {
          const response = await fetch("/api/chat/transcribe", {
            method: "POST",
            body: formData,
          });

          // Read as text first, so HTML or server errors
          // do not cause "Unexpected token ... is not valid JSON".
          const responseText = await response.text();

          let data: { text?: string; error?: string };

          try {
            data = JSON.parse(responseText);
          } catch {
            console.error(
              "Transcription API returned non-JSON:",
              responseText
            );

            throw new Error(
              `The transcription service returned an unexpected response (HTTP ${response.status}).`
            );
          }

          if (!response.ok) {
            throw new Error(
              response.status === 429
                ? "Voice transcription is temporarily unavailable. Please type your message or try again later."
                : "Voice transcription failed. Please try again or type your message."
            );
          }

          const transcript = String(data.text || "").trim();

          if (!transcript) {
            setVoiceError("We couldn't hear that clearly. Please try again.");
            return;
          }

          setInput((previous) =>
            previous ? `${previous} ${transcript}` : transcript
          );
          setVoiceError("");
        } catch (err) {
          console.error("Transcription error:", err);

          setVoiceError(
            err instanceof Error
              ? err.message
              : "Voice text aakkan pattiyilla."
          );
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setListening(true);
    } catch (err) {
      console.error("Microphone access error:", err);

      setVoiceError(
        err instanceof Error
          ? `Microphone error: ${err.message}`
            : "Microphone access is unavailable. Check your browser permissions."
      );

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setListening(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    setListening(false);
  }, []);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const text = input.trim();

    if (!text || busy || transcribing || listening) return;

    setVoiceError("");
    setInput("");

    try {
      await sendMessage({ text });
    } catch (err) {
      console.error("Send message error:", err);
      setVoiceError("Your message could not be sent. Please try again.");
      setInput(text);
    }
  }

  // Speak the latest completed AI reply.
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;

    const latest = messages[messages.length - 1];

    if (
      latest.role !== "assistant" ||
      latest.id === lastSpokenId.current
    ) {
      return;
    }

    const text = latest.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim();

    if (!text || !("speechSynthesis" in window)) return;

    lastSpokenId.current = latest.id;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;

    window.speechSynthesis.speak(utterance);
  }, [messages, status]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section
          aria-label="Abdul Mohsen stationery support chat"
          className="mb-3 flex h-[min(620px,calc(100dvh-6rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.4)]"
        >
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-emerald-900 font-serif text-xs font-bold text-white">
                AM
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Abdul Mohsen</p>
                <p className="text-xs text-slate-500">Stationery support · Saudi Arabia</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              title="Close chat"
              className="grid size-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
            >
              <CloseIcon />
            </button>
          </header>

          <div
            ref={scrollRef}
            aria-live="polite"
            className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 text-sm text-slate-800"
          >
            {messages.length === 0 && (
              <div className="flex min-h-full flex-col justify-center py-5">
                <p className="text-xs font-semibold uppercase text-emerald-800">
                  Welcome to Abdul Mohsen Store
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950">
                  How can we help?
                </h2>
                <p className="mt-2 max-w-xs leading-6 text-slate-600">
                  Ask about stationery, bulk orders, delivery, or pickup.
                </p>
                <div className="mt-7">
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    COMMON QUESTIONS
                  </p>
                  {[
                    "I'm looking for school supplies",
                    "I have a wholesale stationery enquiry",
                    "Do you offer delivery?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="flex w-full items-center justify-between border-b border-slate-200 py-3 text-left text-sm text-slate-700 transition hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-800"
                    >
                      {suggestion}
                      <span aria-hidden="true" className="pl-3 text-slate-400">
                        &#8599;
                      </span>
                    </button>
                  ))}
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("store:open-cart"))}
                      className="mt-4 flex w-full items-center justify-between rounded-md bg-emerald-900 px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Start a stationery order
                      <span aria-hidden="true">→</span>
                    </button>
                  <div className="mt-4 flex gap-2">
                    <a
                      href="#catalogue"
                      onClick={() => setIsOpen(false)}
                      className="rounded-md bg-emerald-900 px-3 py-2 text-xs font-semibold text-white no-underline hover:bg-emerald-800"
                    >
                      Browse catalogue
                    </a>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("store:open-cart"))}
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Open basket
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role !== "user" && (
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-md bg-emerald-900 font-serif text-[9px] font-bold text-white">
                    AM
                  </span>
                )}
                <div
                  className={`max-w-[84%] rounded-xl px-3.5 py-3 ${
                    message.role === "user"
                      ? "bg-emerald-900 text-white"
                      : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  <p className={`mb-1 text-[11px] font-semibold ${message.role === "user" ? "text-emerald-100" : "text-slate-500"}`}>
                    {message.role === "user" ? "You" : "Stationery assistant"}
                  </p>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <p key={index} className="whitespace-pre-wrap leading-6">
                        {part.text}
                      </p>
                    ) : null
                  )}
                </div>
              </div>
            ))}

            {pendingCartAdd && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-800">
                <p className="font-semibold">Confirm basket addition</p>
                <p className="mt-1">
                  Add {pendingCartAdd.quantity} × {pendingCartAdd.productName}?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respondToCartAdd(true)}
                    className="rounded-md bg-emerald-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Add to basket
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToCartAdd(false)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {busy && (
              <p role="status" className="animate-pulse pl-9 text-xs text-slate-500">
                Preparing a reply...
              </p>
            )}

            {(transcribing || voiceError || error) && (
              <div
                role={transcribing ? "status" : "alert"}
                className={`rounded-lg px-3 py-2.5 text-xs ${
                  voiceError && !transcribing
                    ? "border border-red-200 bg-red-50 text-red-800"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {transcribing
                  ? voiceError
                  : voiceError ||
                    (error instanceof Error
                      ? error.message
                      : "The message could not be processed. Please try again.")}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            aria-label="Send a message to stationery support"
            className="border-t border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about stationery or orders..."
                aria-label="Chat message"
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
              />

              <button
                type="button"
                onClick={listening ? stopRecording : startRecording}
                disabled={busy || transcribing}
                aria-label={listening ? "Stop recording" : "Start recording"}
                title={listening ? "Stop recording" : "Record a voice message"}
                className={`grid size-11 shrink-0 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
                  listening
                    ? "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-emerald-800"
                }`}
              >
                {listening ? <StopIcon /> : <MicrophoneIcon />}
              </button>

              <button
                type="submit"
                disabled={!input.trim() || busy || transcribing || listening}
                aria-label="Send message"
                title="Send message"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-900 text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
        title={isOpen ? "Close stationery support" : "Chat with stationery support"}
        className="ml-auto grid size-14 place-items-center rounded-full bg-emerald-900 text-white shadow-[0_12px_30px_-8px_rgba(6,78,59,0.7)] transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
}

