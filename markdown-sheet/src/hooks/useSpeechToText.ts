import { useCallback, useRef, useState } from "react";

type SttStatus = "idle" | "loading" | "recording" | "transcribing";

interface UseSpeechToTextReturn {
  status: SttStatus;
  interimText: string;
  toggle: () => void;
  stop: () => void;
}

const MODEL_ID = "moonshine-tiny-ja";

let pipelineCache: {
  processor: any;
  tokenizer: any;
  model: any;
} | null = null;

async function loadPipeline(onProgress?: (msg: string) => void) {
  if (pipelineCache) return pipelineCache;

  onProgress?.("音声認識モデルを読み込み中...");

  const transformers = await import("@huggingface/transformers");
  const { AutoProcessor, AutoTokenizer, MoonshineForConditionalGeneration, env } = transformers;

  // Configure for local model loading from public/ directory
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = "/models/";

  const [processor, tokenizer, model] = await Promise.all([
    AutoProcessor.from_pretrained(MODEL_ID),
    AutoTokenizer.from_pretrained(MODEL_ID),
    MoonshineForConditionalGeneration.from_pretrained(MODEL_ID, {
      dtype: "fp32",
    }),
  ]);

  pipelineCache = { processor, tokenizer, model };
  return pipelineCache;
}

export function useSpeechToText(
  onTranscribed: (text: string) => void,
  showToast: (msg: string, isError?: boolean) => void,
): UseSpeechToTextReturn {
  const [status, setStatus] = useState<SttStatus>("idle");
  const [interimText, setInterimText] = useState("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const silenceCountRef = useRef(0);
  const isRecordingRef = useRef(false);
  const transcribeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SAMPLE_RATE = 16000;
  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_FRAMES_TO_COMMIT = 30; // ~0.5s of silence at ~60fps
  const TRANSCRIBE_INTERVAL_MS = 2000;

  const transcribeBuffer = useCallback(async () => {
    if (audioBufferRef.current.length === 0) return;

    const chunks = audioBufferRef.current;
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    if (totalLength < SAMPLE_RATE * 0.3) return; // Skip if less than 0.3s

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      const pipeline = await loadPipeline();
      const inputs = await pipeline.processor(merged);
      const maxLength = Math.max(64, Math.trunc((totalLength / SAMPLE_RATE) * 13));
      const outputs = await pipeline.model.generate({ ...inputs, max_length: maxLength });
      const decoded = pipeline.tokenizer.batch_decode(outputs, { skip_special_tokens: true });
      const text = (decoded[0] || "").trim();
      if (text) {
        setInterimText(text);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    }
  }, []);

  const commitAndClear = useCallback(async () => {
    if (audioBufferRef.current.length === 0) return;

    const chunks = audioBufferRef.current;
    audioBufferRef.current = [];
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    if (totalLength < SAMPLE_RATE * 0.3) return;

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    setStatus("transcribing");
    try {
      const pipeline = await loadPipeline();
      const inputs = await pipeline.processor(merged);
      const maxLength = Math.max(64, Math.trunc((totalLength / SAMPLE_RATE) * 13));
      const outputs = await pipeline.model.generate({ ...inputs, max_length: maxLength });
      const decoded = pipeline.tokenizer.batch_decode(outputs, { skip_special_tokens: true });
      const text = (decoded[0] || "").trim();
      if (text) {
        onTranscribed(text);
      }
    } catch (err) {
      console.error("Commit transcription error:", err);
    }
    setInterimText("");
    if (isRecordingRef.current) {
      setStatus("recording");
    }
  }, [onTranscribed]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (transcribeTimerRef.current) {
      clearInterval(transcribeTimerRef.current);
      transcribeTimerRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    // Commit remaining buffer
    commitAndClear().finally(() => {
      setStatus("idle");
      setInterimText("");
    });
  }, [commitAndClear]);

  const startRecording = useCallback(async () => {
    try {
      setStatus("loading");
      await loadPipeline((msg) => showToast(msg));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessorNode (deprecated but widely supported in WebView)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      workletNodeRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        audioBufferRef.current.push(chunk);

        // Detect silence
        let energy = 0;
        for (let i = 0; i < chunk.length; i++) {
          energy += chunk[i] * chunk[i];
        }
        energy = Math.sqrt(energy / chunk.length);

        if (energy < SILENCE_THRESHOLD) {
          silenceCountRef.current++;
          if (silenceCountRef.current >= SILENCE_FRAMES_TO_COMMIT) {
            silenceCountRef.current = 0;
            commitAndClear();
          }
        } else {
          silenceCountRef.current = 0;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      isRecordingRef.current = true;
      audioBufferRef.current = [];
      silenceCountRef.current = 0;
      setStatus("recording");
      showToast("音声入力を開始しました");

      // Periodic interim transcription
      transcribeTimerRef.current = setInterval(() => {
        if (isRecordingRef.current && audioBufferRef.current.length > 0) {
          transcribeBuffer();
        }
      }, TRANSCRIBE_INTERVAL_MS);
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      showToast(
        err?.name === "NotAllowedError"
          ? "マイクへのアクセスが拒否されました"
          : `マイクエラー: ${err?.message || err}`,
        true,
      );
      setStatus("idle");
    }
  }, [showToast, transcribeBuffer, commitAndClear]);

  const toggle = useCallback(() => {
    if (status === "idle") {
      startRecording();
    } else if (status === "recording" || status === "transcribing") {
      stopRecording();
    }
  }, [status, startRecording, stopRecording]);

  return { status, interimText, toggle, stop: stopRecording };
}
