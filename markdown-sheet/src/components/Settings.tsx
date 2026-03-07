import { type FC, useState } from "react";
import type { AiSettings } from "../types";
import "./Settings.css";

const PROVIDERS: {
  id: string;
  label: string;
  format: "openai" | "anthropic" | "azure";
  baseUrl: string;
  model: string;
}[] = [
  { id: "deepseek",  label: "DeepSeek (無料枠あり)",    format: "openai",    baseUrl: "https://api.deepseek.com/v1",                              model: "deepseek-chat"            },
  { id: "groq",      label: "Groq (無料・高速)",         format: "openai",    baseUrl: "https://api.groq.com/openai/v1",                           model: "llama-3.3-70b-versatile"  },
  { id: "grok",      label: "Grok / xAI (無料枠あり)",   format: "openai",    baseUrl: "https://api.x.ai/v1",                                      model: "grok-2-latest"            },
  { id: "gemini",    label: "Gemini / Google (無料枠あり)", format: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.0-flash"         },
  { id: "openai",    label: "OpenAI (ChatGPT)",           format: "openai",    baseUrl: "https://api.openai.com/v1",                                model: "gpt-4o"                   },
  { id: "azure",     label: "Azure OpenAI",               format: "azure",     baseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}", model: "gpt-5.1" },
  { id: "anthropic", label: "Claude / Anthropic",         format: "anthropic", baseUrl: "https://api.anthropic.com/v1",                             model: "claude-haiku-4-5-20251001"},
  { id: "custom",    label: "カスタム (さくらのAI など)", format: "openai",    baseUrl: "",                                                         model: ""                         },
];

interface FilterVisibility {
  showDocx: boolean;
  showXls: boolean;
  showKm: boolean;
  showImages: boolean;
  showZenn: boolean;
}

interface Props {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
  filterVisibility: FilterVisibility;
  onSaveFilterVisibility: (v: FilterVisibility) => void;
}

type TabId = "ai" | "display";

const Settings: FC<Props> = ({ settings, onSave, onClose, filterVisibility, onSaveFilterVisibility }) => {
  const [local, setLocal] = useState<AiSettings>({ ...settings });
  const [localFilter, setLocalFilter] = useState<FilterVisibility>({ ...filterVisibility });
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("ai");

  const selectProvider = (id: string) => {
    const preset = PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setLocal((prev) => ({
      ...prev,
      provider: id,
      apiFormat: preset.format,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setTestMsg(null);
  };

  const handleTest = async () => {
    if (!local.apiKey) {
      setTestMsg({ text: "APIキーを入力してください", ok: false });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      if (local.apiFormat === "anthropic") {
        const url = local.baseUrl.replace(/\/$/, "") + "/messages";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": local.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: local.model,
            max_tokens: 5,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: "接続成功！", ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: `エラー: ${err?.error?.message || resp.statusText}`, ok: false });
        }
      } else if (local.apiFormat === "azure") {
        const url = local.baseUrl.replace(/\/$/, "") + "/chat/completions?api-version=2024-12-01-preview";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": local.apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "hi" }],
            max_completion_tokens: 5,
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: "接続成功！", ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: `エラー: ${err?.error?.message || resp.statusText}`, ok: false });
        }
      } else {
        const url = local.baseUrl.replace(/\/$/, "") + "/chat/completions";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${local.apiKey}`,
          },
          body: JSON.stringify({
            model: local.model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: "接続成功！", ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: `エラー: ${err?.error?.message || resp.statusText}`, ok: false });
        }
      }
    } catch (e) {
      setTestMsg({ text: `接続失敗: ${String(e)}`, ok: false });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(local);
    onSaveFilterVisibility(localFilter);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">設定</h2>
          <button className="settings-close" onClick={onClose} title="閉じる">✕</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            AI API
          </button>
          <button
            className={`settings-tab ${activeTab === "display" ? "active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            表示
          </button>
        </div>

        {activeTab === "ai" && (
          <div className="settings-section">
            {/* プロバイダー選択（プルダウン） */}
            <label className="settings-label" style={{ marginTop: 0 }}>プロバイダー</label>
            <select
              className="settings-input settings-select"
              value={local.provider}
              onChange={(e) => selectProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            <div className="settings-format-badge">
              形式: <strong>{local.apiFormat === "anthropic" ? "Anthropic Messages API" : local.apiFormat === "azure" ? "Azure OpenAI" : "OpenAI 互換"}</strong>
            </div>

            {/* API キー */}
            <label className="settings-label">API キー</label>
            <input
              type="password"
              className="settings-input"
              value={local.apiKey}
              onChange={(e) => { setLocal((s) => ({ ...s, apiKey: e.target.value })); setTestMsg(null); }}
              placeholder={local.apiFormat === "anthropic" ? "sk-ant-..." : local.apiFormat === "azure" ? "Azure API キー" : "sk-..."}
              spellCheck={false}
            />

            {/* Base URL */}
            <label className="settings-label">Base URL</label>
            <input
              type="text"
              className="settings-input"
              value={local.baseUrl}
              onChange={(e) => { setLocal((s) => ({ ...s, baseUrl: e.target.value })); setTestMsg(null); }}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
            />

            {/* モデル */}
            <label className="settings-label">モデル</label>
            <input
              type="text"
              className="settings-input"
              value={local.model}
              onChange={(e) => { setLocal((s) => ({ ...s, model: e.target.value })); setTestMsg(null); }}
              placeholder="model-name"
              spellCheck={false}
            />

            {/* 接続テスト */}
            <div className="settings-test-row">
              <button
                className="settings-detect-btn"
                onClick={handleTest}
                disabled={testing || !local.baseUrl || !local.model}
              >
                {testing ? "テスト中..." : "接続テスト"}
              </button>
              {testMsg && (
                <span className={`settings-detect-msg ${testMsg.ok ? "ok" : "err"}`}>
                  {testMsg.text}
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "display" && (
          <>
            <div className="settings-section">
              <div className="settings-section-title">画像</div>
              <label className="settings-toggle-row">
                <span>画像ボタンを表示</span>
                <input
                  type="checkbox"
                  checked={localFilter.showImages}
                  onChange={(e) => setLocalFilter((s) => ({ ...s, showImages: e.target.checked }))}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Office 系ファイル</div>
              <label className="settings-toggle-row">
                <span>.docx ボタンを表示</span>
                <input
                  type="checkbox"
                  checked={localFilter.showDocx}
                  onChange={(e) => setLocalFilter((s) => ({ ...s, showDocx: e.target.checked }))}
                />
              </label>
              <label className="settings-toggle-row" style={{ marginTop: 6 }}>
                <span>.xls* ボタンを表示</span>
                <input
                  type="checkbox"
                  checked={localFilter.showXls}
                  onChange={(e) => setLocalFilter((s) => ({ ...s, showXls: e.target.checked }))}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">マインドマップ</div>
              <label className="settings-toggle-row">
                <span>.km / .xmind ボタンを表示</span>
                <input
                  type="checkbox"
                  checked={localFilter.showKm}
                  onChange={(e) => setLocalFilter((s) => ({ ...s, showKm: e.target.checked }))}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Zenn</div>
              <label className="settings-toggle-row">
                <span>Zenn ボタンを表示</span>
                <input
                  type="checkbox"
                  checked={localFilter.showZenn}
                  onChange={(e) => setLocalFilter((s) => ({ ...s, showZenn: e.target.checked }))}
                />
              </label>
            </div>
          </>
        )}

        <div className="settings-footer">
          <button className="settings-close-btn" onClick={onClose}>キャンセル</button>
          <button className="settings-save-btn" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
