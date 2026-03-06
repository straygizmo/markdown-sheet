import { type FC, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
}

const ZennPublishPanel: FC<Props> = ({ folderPath, showToast, onRefreshFileTree, onRefreshZenn }) => {
  const [gitStatus, setGitStatus] = useState<GitFileStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notGitRepo, setNotGitRepo] = useState(false);

  const fetchGitStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const result = await invoke<GitFileStatus[]>("git_status", { dirPath: folderPath });
      setGitStatus(result);
      setNotGitRepo(false);
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
  }, [folderPath, showToast]);

  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

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

  const handleGitInit = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("git_init", { dirPath: folderPath });
      showToast("Git リポジトリを初期化しました");
      setNotGitRepo(false);
      await fetchGitStatus();
    } catch (e) {
      showToast(`git init 失敗: ${e}`, true);
    } finally {
      setLoading(false);
    }
  }, [folderPath, showToast, fetchGitStatus]);

  if (notGitRepo) {
    return (
      <div className="zenn-publish">
        <div className="zenn-publish-header">
          <span>Zenn デプロイ (Git)</span>
        </div>
        <div className="zenn-publish-empty">Git リポジトリではありません</div>
        <div className="zenn-publish-actions">
          <button
            className="zenn-publish-btn"
            onClick={handleGitInit}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? "初期化中..." : "git init"}
          </button>
        </div>
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
          disabled={loading || gitStatus.length === 0}
        >
          {loading ? "処理中..." : "Commit & Push"}
        </button>
      </div>
    </div>
  );
};

export default ZennPublishPanel;
