import { type FC, useCallback, useEffect, useRef, useState } from "react";
import type { ZennFrontMatter } from "../types";
import "./ZennFrontmatterForm.css";

interface Props {
  frontMatter: ZennFrontMatter | null;
  onUpdate: (fm: ZennFrontMatter) => void;
}

const ZennFrontmatterForm: FC<Props> = ({ frontMatter, onUpdate }) => {
  const [local, setLocal] = useState<ZennFrontMatter>(
    frontMatter ?? {
      title: "",
      emoji: "",
      type: "tech",
      topics: [],
      published: false,
    }
  );
  const [topicInput, setTopicInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when file changes
  useEffect(() => {
    if (frontMatter) setLocal(frontMatter);
  }, [frontMatter]);

  // Debounced auto-sync to parent
  const syncToParent = useCallback(
    (fm: ZennFrontMatter) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdate(fm), 400);
    },
    [onUpdate]
  );

  const update = useCallback(
    (patch: Partial<ZennFrontMatter>) => {
      setLocal((prev) => {
        const next = { ...prev, ...patch };
        syncToParent(next);
        return next;
      });
    },
    [syncToParent]
  );

  const addTopic = useCallback(() => {
    const tag = topicInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!tag || local.topics.length >= 5 || local.topics.includes(tag)) return;
    const next = [...local.topics, tag];
    setTopicInput("");
    update({ topics: next });
  }, [topicInput, local.topics, update]);

  const removeTopic = useCallback(
    (idx: number) => {
      update({ topics: local.topics.filter((_, i) => i !== idx) });
    },
    [local.topics, update]
  );

  return (
    <div className="zenn-fm">
      <div className="zenn-fm-row">
        <label className="zenn-fm-field zenn-fm-emoji">
          <span className="zenn-fm-label">Emoji</span>
          <input
            type="text"
            value={local.emoji}
            onChange={(e) => update({ emoji: e.target.value })}
            maxLength={2}
            placeholder="😸"
          />
        </label>

        <label className="zenn-fm-field zenn-fm-title">
          <span className="zenn-fm-label">Title</span>
          <input
            type="text"
            value={local.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="記事タイトル"
          />
        </label>

        <label className="zenn-fm-field">
          <span className="zenn-fm-label">Type</span>
          <select
            value={local.type}
            onChange={(e) => update({ type: e.target.value as "tech" | "idea" })}
          >
            <option value="tech">tech</option>
            <option value="idea">idea</option>
          </select>
        </label>

        <label className="zenn-fm-field zenn-fm-toggle">
          <span className="zenn-fm-label">公開</span>
          <input
            type="checkbox"
            checked={local.published}
            onChange={(e) => update({ published: e.target.checked })}
          />
          <span className={`zenn-fm-status ${local.published ? "published" : "draft"}`}>
            {local.published ? "公開" : "下書き"}
          </span>
        </label>
      </div>

      <div className="zenn-fm-row">
        <div className="zenn-fm-field zenn-fm-topics">
          <span className="zenn-fm-label">Topics ({local.topics.length}/5)</span>
          <div className="zenn-fm-topics-list">
            {local.topics.map((t, i) => (
              <span key={t} className="zenn-fm-topic-tag">
                {t}
                <button onClick={() => removeTopic(i)} title="削除">&times;</button>
              </span>
            ))}
            {local.topics.length < 5 && (
              <input
                type="text"
                className="zenn-fm-topic-input"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="タグを追加 (Enter)"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZennFrontmatterForm;
