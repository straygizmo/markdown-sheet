import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import type { AiSettings } from "../types";
import { callAI } from "../lib/callAI";
import { useLocalEmbedding } from "./useLocalEmbedding";

interface RagChunk {
  id: number | null;
  file_path: string;
  heading: string;
  content: string;
  start_line: number;
  end_line: number;
}

interface RagSearchResult {
  file_path: string;
  heading: string;
  content: string;
  start_line: number;
  end_line: number;
  score: number;
}

interface RagStatus {
  indexed: boolean;
  chunk_count: number;
  file_count: number;
}

export interface RagMessage {
  role: "user" | "assistant";
  content: string;
  sources?: RagSearchResult[];
}

type IndexStatus = "none" | "building" | "ready";

export function useRagFeatures(
  aiSettings: AiSettings,
  showToast: (msg: string, isError?: boolean) => void,
) {
  const embedding = useLocalEmbedding();
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("none");
  const [indexInfo, setIndexInfo] = useState<RagStatus | null>(null);
  const [indexProgress, setIndexProgress] = useState("");
  const [messages, setMessages] = useState<RagMessage[]>([]);
  const [querying, setQuerying] = useState(false);
  const folderRef = useRef<string | null>(null);

  const checkStatus = useCallback(async (folderPath: string) => {
    folderRef.current = folderPath;
    try {
      const status = await invoke<RagStatus>("rag_get_status", {
        folderPath,
      });
      setIndexInfo(status);
      setIndexStatus(status.indexed ? "ready" : "none");
    } catch {
      setIndexStatus("none");
      setIndexInfo(null);
    }
  }, []);

  const buildIndex = useCallback(
    async (folderPath: string) => {
      folderRef.current = folderPath;
      setIndexStatus("building");
      setIndexProgress("ファイルを走査中...");

      try {
        // 1. Scan for changed chunks
        const chunks = await invoke<RagChunk[]>("rag_scan_folder", {
          folderPath,
        });

        if (chunks.length === 0) {
          setIndexProgress("変更なし");
          await checkStatus(folderPath);
          return;
        }

        // 2. Load embedding model if needed
        setIndexProgress(
          embedding.status === "ready"
            ? "埋め込み生成中..."
            : "モデルを読み込み中..."
        );

        // 3. Generate embeddings
        const texts = chunks.map((c) => c.content);
        const embeddings = await embedding.embedBatch(texts, (done, total) => {
          setIndexProgress(`埋め込み生成中... (${done}/${total})`);
        });

        // 4. Build file hash map
        const fileContents = new Map<string, string>();
        for (const chunk of chunks) {
          if (!fileContents.has(chunk.file_path)) {
            fileContents.set(chunk.file_path, "");
          }
          fileContents.set(
            chunk.file_path,
            fileContents.get(chunk.file_path)! + chunk.content
          );
        }

        // Simple hash for each file
        const fileHashes = new Map<string, string>();
        for (const [fp, content] of fileContents) {
          let hash = 0;
          for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
          }
          fileHashes.set(fp, hash.toString(16));
        }

        // 5. Save to SQLite
        setIndexProgress("保存中...");
        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
          file_path: chunk.file_path,
          heading: chunk.heading,
          content: chunk.content,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
          embedding: Array.from(embeddings[i]),
          file_hash: fileHashes.get(chunk.file_path) || "",
        }));

        await invoke("rag_save_chunks", {
          folderPath,
          chunks: chunksWithEmbeddings,
        });

        await checkStatus(folderPath);
        setIndexProgress("");
        showToast(`インデックス構築完了 (${chunks.length} チャンク)`);
      } catch (err: any) {
        console.error("RAG buildIndex error:", err);
        setIndexStatus("none");
        setIndexProgress("");
        const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
        showToast(`インデックス構築失敗: ${msg}`, true);
      }
    },
    [embedding, checkStatus, showToast]
  );

  const deleteIndex = useCallback(
    async (folderPath: string) => {
      try {
        await invoke("rag_delete_index", { folderPath });
        setIndexStatus("none");
        setIndexInfo(null);
        setMessages([]);
        showToast("インデックスを削除しました");
      } catch (err: any) {
        showToast(`削除失敗: ${err}`, true);
      }
    },
    [showToast]
  );

  const askQuestion = useCallback(
    async (folderPath: string, question: string) => {
      if (!aiSettings.apiKey) {
        showToast("設定でAPIキーを入力してください", true);
        return;
      }

      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setQuerying(true);

      try {
        // 1. Embed query
        const queryEmbedding = await embedding.embed(question);

        // 2. Search similar chunks
        const results = await invoke<RagSearchResult[]>("rag_search", {
          folderPath,
          queryEmbedding: Array.from(queryEmbedding),
          topK: 5,
        });

        // 3. Build context from results
        const context = results
          .filter((r) => r.score > 0.3)
          .map(
            (r, i) =>
              `[参照${i + 1}] (${r.file_path.split(/[\\/]/).pop()} - ${r.heading || "冒頭"}, 関連度: ${(r.score * 100).toFixed(0)}%)\n${r.content}`
          )
          .join("\n\n---\n\n");

        // 4. Call LLM with context
        const systemPrompt = `あなたはフォルダ内のドキュメントに基づいて質問に回答するアシスタントです。
以下の参照情報を基に、正確かつ簡潔に回答してください。
参照情報にない内容については「この情報はドキュメントに見つかりませんでした」と回答してください。
回答には参照元のファイル名を含めてください。

## 参照情報:
${context || "（関連するドキュメントが見つかりませんでした）"}`;

        const answer = await callAI(aiSettings, systemPrompt, question);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: answer,
            sources: results.filter((r) => r.score > 0.3),
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `エラー: ${err?.message || err}`,
          },
        ]);
      } finally {
        setQuerying(false);
      }
    },
    [aiSettings, embedding, showToast]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    embeddingStatus: embedding.status,
    embeddingProgress: embedding.progress,
    embeddingError: embedding.error,
    loadModel: embedding.loadModel,
    indexStatus,
    indexInfo,
    indexProgress,
    messages,
    querying,
    buildIndex,
    deleteIndex,
    askQuestion,
    checkStatus,
    clearMessages,
  };
}
