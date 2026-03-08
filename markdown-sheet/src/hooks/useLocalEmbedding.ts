import { useCallback, useRef, useState } from "react";

type ModelStatus = "idle" | "loading" | "ready" | "error";

let pipelineInstance: any = null;
let pipelinePromise: Promise<any> | null = null;

export function useLocalEmbedding() {
  const [status, setStatus] = useState<ModelStatus>(
    pipelineInstance ? "ready" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadModel = useCallback(async () => {
    if (pipelineInstance) {
      setStatus("ready");
      return;
    }
    if (pipelinePromise) {
      setStatus("loading");
      await pipelinePromise;
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setError(null);
    setProgress(0);
    abortRef.current = false;

    pipelinePromise = (async () => {
      try {
        console.log("[RAG] Importing @huggingface/transformers...");
        const { pipeline, env } = await import("@huggingface/transformers");

        // Allow remote models (HuggingFace Hub)
        env.allowRemoteModels = true;
        // Use browser cache
        env.useBrowserCache = true;

        console.log("[RAG] Creating feature-extraction pipeline...");
        pipelineInstance = await pipeline(
          "feature-extraction",
          "Xenova/multilingual-e5-small",
          {
            progress_callback: (p: any) => {
              if (p.status === "progress" && p.progress != null) {
                setProgress(Math.round(p.progress));
              }
              if (p.status === "done" || p.status === "ready") {
                console.log("[RAG] Model load progress:", p.status);
              }
            },
          }
        );
        console.log("[RAG] Pipeline ready");
        setStatus("ready");
      } catch (err: any) {
        console.error("[RAG] Model load failed:", err);
        pipelineInstance = null;
        pipelinePromise = null;
        setError(err?.message || "モデルの読み込みに失敗しました");
        setStatus("error");
        throw err;
      }
    })();

    await pipelinePromise;
  }, []);

  const embed = useCallback(
    async (text: string): Promise<Float32Array> => {
      if (!pipelineInstance) {
        await loadModel();
      }
      const output = await pipelineInstance!(text, {
        pooling: "mean",
        normalize: true,
      });
      return output.data as Float32Array;
    },
    [loadModel]
  );

  const embedBatch = useCallback(
    async (
      texts: string[],
      onProgress?: (done: number, total: number) => void
    ): Promise<Float32Array[]> => {
      if (!pipelineInstance) {
        await loadModel();
      }
      const results: Float32Array[] = [];
      for (let i = 0; i < texts.length; i++) {
        const output = await pipelineInstance!(texts[i], {
          pooling: "mean",
          normalize: true,
        });
        results.push(output.data as Float32Array);
        onProgress?.(i + 1, texts.length);
      }
      return results;
    },
    [loadModel]
  );

  return { status, progress, error, loadModel, embed, embedBatch };
}
