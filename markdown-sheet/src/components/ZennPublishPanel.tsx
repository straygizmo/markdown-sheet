import { type FC, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ZennArticleMeta } from "../types";
import "./ZennPublishPanel.css";

interface GitFileStatus {
  status: string;
  path: string;
}

interface Props {
  folderPath: string;
  showToast: (message: string, isError?: boolean) => void;
  onRefreshFileTree: () => void;
  onRefreshZenn: () => void;
  zennArticlesMeta?: Record<string, ZennArticleMeta>;
}

const ZennPublishPanel: FC<Props> = ({ folderPath, showToast, onRefreshFileTree, onRefreshZenn, zennArticlesMeta }) => {
  const [gitStatus, setGitStatus] = useState<GitFileStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notGitRepo, setNotGitRepo] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteInput, setRemoteInput] = useState("");
  const [editingRemote, setEditingRemote] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const fetchRemoteUrl = useCallback(async () => {
    try {
      const url = await invoke<string>("git_get_remote_url", { dirPath: folderPath });
      setRemoteUrl(url);
      setRemoteInput(url);
    } catch {
      setRemoteUrl("");
      setRemoteInput("");
    }
  }, [folderPath]);

  const handleSetRemote = useCallback(async () => {
    const url = remoteInput.trim();
    if (!url) {
      showToast("リポジトリURLを入力してください", true);
      return;
    }
    setRemoteLoading(true);
    try {
      await invoke("git_set_remote_url", { dirPath: folderPath, url });
      setRemoteUrl(url);
      setEditingRemote(false);
      showToast("リモートURLを設定しました");
    } catch (e) {
      showToast(`リモートURL設定失敗: ${e}`, true);
    } finally {
      setRemoteLoading(false);
    }
  }, [folderPath, remoteInput, showToast]);

  const generateCommitMessage = useCallback((files: GitFileStatus[]) => {
    if (!zennArticlesMeta) return "";
    const mdFiles = files.filter(f => f.path.endsWith(".md") && f.path.startsWith("articles/"));
    if (mdFiles.length === 0) return "";
    const titles: string[] = [];
    for (const f of mdFiles) {
      const normalizedGitPath = f.path.replace(/\//g, "\\");
      const meta = Object.entries(zennArticlesMeta).find(
        ([key]) => key.endsWith(normalizedGitPath) || key.endsWith(f.path)
      );
      if (meta?.[1]?.title) {
        titles.push(meta[1].title);
      }
    }
    if (titles.length === 0) return "";
    return titles.length === 1
      ? `${titles[0]}の変更`
      : `${titles.join(", ")}の変更`;
  }, [zennArticlesMeta]);

  const fetchGitStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const result = await invoke<GitFileStatus[]>("git_status", { dirPath: folderPath });
      setGitStatus(result);
      setNotGitRepo(false);
      const autoMsg = generateCommitMessage(result);
      if (autoMsg) {
        setCommitMessage(autoMsg);
      }
    } catch (e) {
      setGitStatus([]);
      const msg = String(e);
      if (msg.includes("not a git repository")) {
        setNotGitRepo(true);
      } else {
        showToast(`Git status 取得失敗: ${e}`, true);
      }
    } finally {
      setStatusLoading(false);
    }
  }, [folderPath, showToast, generateCommitMessage]);

  useEffect(() => {
    fetchGitStatus();
    fetchRemoteUrl();
  }, [fetchGitStatus, fetchRemoteUrl]);

  const handleCommitAndPush = useCallback(async () => {
    if (!commitMessage.trim()) {
      showToast("コミットメッセージを入力してください", true);
      return;
    }
    setLoading(true);
    try {
      await invoke("git_add_all", { dirPath: folderPath });
      await invoke("git_commit", { dirPath: folderPath, message: commitMessage.trim() });
      showToast("コミット完了。プッシュ中...");
      await invoke("git_push", { dirPath: folderPath });
      showToast("Zenn にプッシュしました！");
      setCommitMessage("");
      onRefreshFileTree();
      onRefreshZenn();
      await fetchGitStatus();
    } catch (e) {
      showToast(`Git エラー: ${e}`, true);
    } finally {
      setLoading(false);
    }
  }, [folderPath, commitMessage, showToast, onRefreshFileTree, onRefreshZenn, fetchGitStatus]);

  if (notGitRepo) {
    return (
      <div className="zenn-publish">
        <div className="zenn-publish-header">
          <span>Zenn デプロイ (Git)</span>
        </div>
        <div className="zenn-publish-empty">Git リポジトリではありません</div>
      </div>
    );
  }

  return (
    <div className="zenn-publish">
      <div className="zenn-publish-header">
        <span>Zenn デプロイ (Git)</span>
        <button
          className="zenn-publish-refresh"
          onClick={fetchGitStatus}
          disabled={statusLoading}
          title="ステータスを更新"
        >
          ↻
        </button>
      </div>

      <div className="zenn-publish-remote">
        {editingRemote ? (
          <div className="zenn-publish-remote-form">
            <input
              type="text"
              className="zenn-publish-remote-input"
              value={remoteInput}
              onChange={(e) => setRemoteInput(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !remoteLoading) {
                  e.preventDefault();
                  handleSetRemote();
                }
                if (e.key === "Escape") {
                  setEditingRemote(false);
                  setRemoteInput(remoteUrl);
                }
              }}
              disabled={remoteLoading}
            />
            <button
              className="zenn-publish-remote-save-btn"
              onClick={handleSetRemote}
              disabled={remoteLoading}
            >
              {remoteLoading ? "..." : "保存"}
            </button>
            <button
              className="zenn-publish-remote-cancel-btn"
              onClick={() => { setEditingRemote(false); setRemoteInput(remoteUrl); }}
              disabled={remoteLoading}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="zenn-publish-remote-display">
            <span className="zenn-publish-remote-url" title={remoteUrl}>{remoteUrl}</span>
            <button
              className="zenn-publish-remote-edit-btn"
              onClick={() => setEditingRemote(true)}
              title="リモートURLを変更"
            >
              編集
            </button>
          </div>
        )}
      </div>

      <div className="zenn-publish-status">
        {statusLoading ? (
          <div className="zenn-publish-loading">読み込み中...</div>
        ) : gitStatus.length === 0 ? (
          <div className="zenn-publish-empty">変更なし</div>
        ) : (
          <div className="zenn-publish-files">
            {gitStatus.map((f) => (
              <div key={f.path} className="zenn-publish-file">
                <span className={`zenn-publish-file-status zenn-git-${f.status.toLowerCase()}`}>
                  {f.status}
                </span>
                <span className="zenn-publish-file-path">{f.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="zenn-publish-actions">
        <input
          type="text"
          className="zenn-publish-message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="コミットメッセージ"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              handleCommitAndPush();
            }
          }}
          disabled={loading}
        />
        <button
          className="zenn-publish-btn"
          onClick={handleCommitAndPush}
          disabled={loading || gitStatus.length === 0 || !remoteUrl}
        >
          {loading ? "処理中..." : "Commit & Push"}
        </button>
      </div>
    </div>
  );
};

export default ZennPublishPanel;
