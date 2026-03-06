import { type FC, useState } from "react";

interface Props {
  onClose: () => void;
  onCreate: (slug: string, title: string, emoji: string, type: "tech" | "idea", topics: string[]) => void;
}

const ZennNewArticleDialog: FC<Props> = ({ onClose, onCreate }) => {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [type, setType] = useState<"tech" | "idea">("tech");
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState("");

  const slugValid = /^[a-z0-9][a-z0-9_-]{10,48}[a-z0-9]$/.test(slug);

  const addTopic = () => {
    const tag = topicInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!tag || topics.length >= 5 || topics.includes(tag)) return;
    setTopics([...topics, tag]);
    setTopicInput("");
  };

  const handleCreate = () => {
    if (!slugValid) {
      setError("slug: 12-50文字、英小文字・数字・ハイフン・アンダースコアのみ");
      return;
    }
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setError("");
    onCreate(slug, title.trim(), emoji || "📝", type, topics);
  };

  return (
    <div className="ai-gen-overlay" onClick={onClose}>
      <div className="ai-gen-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="ai-gen-header">
          <span className="ai-gen-title">Zenn 新規記事を作成</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Slug (ファイル名)</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="my-article-slug (12-50文字)"
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }}
              autoFocus
            />
            <span style={{ fontSize: 11, color: slugValid || !slug ? "var(--text-muted)" : "#e53935" }}>
              {slug.length}/50 文字 {slug && !slugValid && "- 12-50文字、a-z 0-9 - _ のみ"}
            </span>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 60 }}>
              <span style={{ fontWeight: 600 }}>Emoji</span>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={2}
                placeholder="📝"
                style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)", textAlign: "center", fontSize: 16 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <span style={{ fontWeight: 600 }}>タイトル</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="記事タイトル"
                style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }}
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>タイプ</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "tech" | "idea")}
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)" }}
            >
              <option value="tech">tech (技術記事)</option>
              <option value="idea">idea (アイデア)</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Topics ({topics.length}/5)</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              {topics.map((t, i) => (
                <span key={t} className="zenn-fm-topic-tag">
                  {t}
                  <button onClick={() => setTopics(topics.filter((_, j) => j !== i))}>&times;</button>
                </span>
              ))}
              {topics.length < 5 && (
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }}
                  placeholder="タグ (Enter)"
                  style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text)", width: 100, fontSize: 12 }}
                />
              )}
            </div>
          </label>

          {error && <div style={{ color: "#e53935", fontSize: 12 }}>{error}</div>}

          <button
            onClick={handleCreate}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#3ea8ff",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZennNewArticleDialog;
