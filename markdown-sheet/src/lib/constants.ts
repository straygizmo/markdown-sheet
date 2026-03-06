import type { Tab } from "../types";

// ========== AI & Template Constants ==========

export const MERMAID_GENERATE_PROMPT =
  "You are a Mermaid diagram generator. " +
  "Based on the user's description, generate appropriate Mermaid diagram source code. " +
  "Output ONLY the raw Mermaid source. Do NOT include code fences, explanation, or any other text.";

export const TRANSFORM_OPTIONS = [
  {
    id: "translate",
    label: "翻訳 (日⇔英)",
    prompt:
      "Translate the following text. If it is Japanese, translate to English. If it is English, translate to Japanese. " +
      "Return ONLY the translated text, no explanations.",
  },
  {
    id: "summarize",
    label: "要約",
    prompt:
      "Summarize the following text concisely in Japanese. Return ONLY the summary, no additional commentary.",
  },
  {
    id: "proofread",
    label: "校正",
    prompt:
      "Proofread and correct any grammatical or spelling errors in the following text. " +
      "Preserve the original language and tone. Return ONLY the corrected text.",
  },
  {
    id: "bullets",
    label: "箇条書き変換",
    prompt:
      "Convert the following text into a Markdown bullet list using '- ' prefix. " +
      "Return ONLY the bullet list, one item per line.",
  },
] as const;

export const MERMAID_TEMPLATES: { label: string; code: string }[] = [
  {
    label: "業務フロー図",
    code: `flowchart LR
  開始([開始]) --> 受注[受注処理]
  受注 --> 確認{在庫確認}
  確認 -->|あり| 出荷[出荷手配]
  確認 -->|なし| 発注[仕入発注]
  発注 --> 入荷[入荷処理]
  入荷 --> 出荷
  出荷 --> 請求[請求処理]
  請求 --> 終了([終了])`,
  },
  {
    label: "シーケンス図",
    code: `sequenceDiagram
  actor ユーザー
  participant フロント as フロントエンド
  participant API as バックエンドAPI
  participant DB as データベース
  ユーザー->>フロント: ログイン要求
  フロント->>API: 認証リクエスト
  API->>DB: ユーザー照合
  DB-->>API: ユーザー情報
  API-->>フロント: JWTトークン
  フロント-->>ユーザー: ログイン成功`,
  },
  {
    label: "ER図",
    code: `erDiagram
  顧客 ||--o{ 注文 : "する"
  注文 ||--|{ 注文明細 : "含む"
  商品 ||--o{ 注文明細 : "含まれる"
  顧客 {
    int 顧客ID PK
    string 氏名
    string 電話番号
  }
  注文 {
    int 注文ID PK
    int 顧客ID FK
    date 注文日
  }
  商品 {
    int 商品ID PK
    string 商品名
    int 価格
  }`,
  },
  {
    label: "ガントチャート",
    code: `gantt
  title プロジェクト計画
  dateFormat YYYY-MM-DD
  section 企画フェーズ
    要件定義      :a1, 2025-04-01, 14d
    設計書作成    :a2, after a1, 7d
  section 開発フェーズ
    フロント開発  :b1, after a2, 21d
    バックエンド  :b2, after a2, 21d
    テスト        :b3, after b1, 14d
  section リリース
    UAT           :c1, after b3, 7d
    本番リリース  :c2, after c1, 1d`,
  },
  {
    label: "クラス図",
    code: `classDiagram
  class ユーザー {
    +int id
    +string 名前
    +string メール
    +ログイン() bool
    +ログアウト() void
  }
  class 管理者 {
    +string 権限レベル
    +ユーザー削除(id) void
  }
  class 一般ユーザー {
    +int ポイント
    +ポイント使用(amount) void
  }
  ユーザー <|-- 管理者
  ユーザー <|-- 一般ユーザー`,
  },
  {
    label: "マインドマップ",
    code: `mindmap
  root((プロジェクト))
    目標
      売上向上
      コスト削減
    課題
      リソース不足
      スケジュール遅延
    解決策
      人員補充
      外部委託
      工程見直し`,
  },
  {
    label: "組織図",
    code: `graph TD
  CEO[代表取締役]
  CEO --> COO[最高執行責任者]
  CEO --> CFO[最高財務責任者]
  COO --> 営業部[営業部長]
  COO --> 開発部[開発部長]
  営業部 --> 営業1[営業チーム1]
  営業部 --> 営業2[営業チーム2]
  開発部 --> FE[フロントエンドチーム]
  開発部 --> BE[バックエンドチーム]`,
  },
  {
    label: "状態遷移図",
    code: `stateDiagram-v2
  [*] --> 待機中
  待機中 --> 処理中 : 開始
  処理中 --> 完了 : 成功
  処理中 --> エラー : 失敗
  エラー --> 待機中 : リトライ
  完了 --> [*]
  エラー --> [*] : キャンセル`,
  },
  {
    label: "円グラフ",
    code: `pie title 売上構成比
  "製品A" : 42.5
  "製品B" : 27.3
  "製品C" : 18.2
  "その他" : 12.0`,
  },
];

export const OFFICE_EXTENSIONS = [".docx", ".xlsx", ".xlsm"];
export const MINDMAP_EXTENSIONS = [".km", ".xmind"];

export function getOfficeExt(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  return OFFICE_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

export function getMindmapExt(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  return MINDMAP_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

export function makeInitialTab(folderPath = ""): Tab {
  return {
    id: crypto.randomUUID(),
    filePath: null,
    folderPath,
    content: "",
    originalLines: [],
    tables: [],
    dirty: false,
    contentUndoStack: [],
    contentRedoStack: [],
  };
}
