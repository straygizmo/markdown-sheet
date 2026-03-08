use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

/// チャンク情報（フロントエンドとの受け渡し用）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagChunk {
    pub id: Option<i64>,
    pub file_path: String,
    pub heading: String,
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
}

/// 埋め込み付きチャンク（保存用）
#[derive(Debug, Deserialize)]
pub struct RagChunkWithEmbedding {
    pub file_path: String,
    pub heading: String,
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
    pub embedding: Vec<f32>,
    pub file_hash: String,
}

/// 検索結果
#[derive(Debug, Serialize)]
pub struct RagSearchResult {
    pub file_path: String,
    pub heading: String,
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
    pub score: f64,
}

/// インデックス状況
#[derive(Debug, Serialize)]
pub struct RagStatus {
    pub indexed: bool,
    pub chunk_count: usize,
    pub file_count: usize,
}

fn db_path(folder_path: &str) -> std::path::PathBuf {
    Path::new(folder_path).join(".md-sheet").join("rag.db")
}

fn ensure_db(folder_path: &str) -> Result<Connection, String> {
    let path = db_path(folder_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            heading TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            file_hash TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
        CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(file_hash);",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn file_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Markdownファイルを見出し単位でチャンクに分割
fn split_into_chunks(file_path: &str, content: &str) -> Vec<RagChunk> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current_heading = String::new();
    let mut current_lines: Vec<&str> = Vec::new();
    let mut start_line: usize = 0;

    for (i, line) in lines.iter().enumerate() {
        if line.starts_with('#') {
            // 前のチャンクを保存
            if !current_lines.is_empty() {
                let text = current_lines.join("\n").trim().to_string();
                if !text.is_empty() {
                    chunks.push(RagChunk {
                        id: None,
                        file_path: file_path.to_string(),
                        heading: current_heading.clone(),
                        content: text,
                        start_line,
                        end_line: i.saturating_sub(1),
                    });
                }
            }
            current_heading = line.trim_start_matches('#').trim().to_string();
            current_lines = vec![*line];
            start_line = i;
        } else {
            current_lines.push(*line);
        }
    }

    // 最後のチャンクを保存
    if !current_lines.is_empty() {
        let text = current_lines.join("\n").trim().to_string();
        if !text.is_empty() {
            chunks.push(RagChunk {
                id: None,
                file_path: file_path.to_string(),
                heading: current_heading,
                content: text,
                start_line,
                end_line: lines.len().saturating_sub(1),
            });
        }
    }

    chunks
}

/// フォルダ内のMarkdownファイルを走査してチャンクリストを返す
fn scan_md_files(dir: &Path, depth: u32) -> Vec<(String, String)> {
    if depth > 5 {
        return Vec::new();
    }
    let mut results = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return results;
    };
    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            results.extend(scan_md_files(&path, depth + 1));
        } else if name.ends_with(".md") || name.ends_with(".txt") {
            if let Ok(content) = fs::read_to_string(&path) {
                results.push((path.to_string_lossy().to_string(), content));
            }
        }
    }
    results
}

/// コサイン類似度を計算
fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f64;
    let mut norm_a = 0.0f64;
    let mut norm_b = 0.0f64;
    for i in 0..a.len() {
        let ai = a[i] as f64;
        let bi = b[i] as f64;
        dot += ai * bi;
        norm_a += ai * ai;
        norm_b += bi * bi;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

fn f32_vec_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(v.len() * 4);
    for &f in v {
        bytes.extend_from_slice(&f.to_le_bytes());
    }
    bytes
}

fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

// ===== Tauri Commands =====

/// フォルダ内のMDファイルを走査し、差分があるファイルのチャンクのみ返す
#[tauri::command]
pub fn rag_scan_folder(folder_path: String) -> Result<Vec<RagChunk>, String> {
    let dir = Path::new(&folder_path);
    if !dir.exists() || !dir.is_dir() {
        return Err("フォルダが存在しません".to_string());
    }

    let conn = ensure_db(&folder_path)?;
    let files = scan_md_files(dir, 0);
    let mut chunks = Vec::new();

    for (path, content) in &files {
        let hash = file_hash(content);

        // 既存のハッシュと比較して変更があるか確認
        let existing_hash: Option<String> = conn
            .query_row(
                "SELECT file_hash FROM chunks WHERE file_path = ?1 LIMIT 1",
                params![path],
                |row| row.get(0),
            )
            .ok();

        if existing_hash.as_deref() == Some(&hash) {
            continue; // 変更なし
        }

        let file_chunks = split_into_chunks(path, content);
        chunks.extend(file_chunks);
    }

    Ok(chunks)
}

/// 埋め込み付きチャンクをSQLiteに保存
#[tauri::command]
pub fn rag_save_chunks(
    folder_path: String,
    chunks: Vec<RagChunkWithEmbedding>,
) -> Result<(), String> {
    let conn = ensure_db(&folder_path)?;

    // ファイルパスごとにグループ化して古いチャンクを削除
    let mut file_paths = std::collections::HashSet::new();
    for chunk in &chunks {
        file_paths.insert(chunk.file_path.clone());
    }
    for fp in &file_paths {
        conn.execute("DELETE FROM chunks WHERE file_path = ?1", params![fp])
            .map_err(|e| e.to_string())?;
    }

    // 新しいチャンクを挿入
    let mut stmt = conn
        .prepare(
            "INSERT INTO chunks (file_path, heading, content, embedding, start_line, end_line, file_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .map_err(|e| e.to_string())?;

    for chunk in &chunks {
        let embedding_bytes = f32_vec_to_bytes(&chunk.embedding);
        stmt.execute(params![
            chunk.file_path,
            chunk.heading,
            chunk.content,
            embedding_bytes,
            chunk.start_line,
            chunk.end_line,
            chunk.file_hash,
        ])
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// クエリ埋め込みで類似チャンクを検索
#[tauri::command]
pub fn rag_search(
    folder_path: String,
    query_embedding: Vec<f32>,
    top_k: Option<usize>,
) -> Result<Vec<RagSearchResult>, String> {
    let conn = ensure_db(&folder_path)?;
    let k = top_k.unwrap_or(5);

    let mut stmt = conn
        .prepare("SELECT file_path, heading, content, embedding, start_line, end_line FROM chunks WHERE embedding IS NOT NULL")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let file_path: String = row.get(0)?;
            let heading: String = row.get(1)?;
            let content: String = row.get(2)?;
            let embedding_bytes: Vec<u8> = row.get(3)?;
            let start_line: usize = row.get(4)?;
            let end_line: usize = row.get(5)?;
            Ok((file_path, heading, content, embedding_bytes, start_line, end_line))
        })
        .map_err(|e| e.to_string())?;

    let mut results: Vec<RagSearchResult> = Vec::new();
    for row in rows {
        let (file_path, heading, content, embedding_bytes, start_line, end_line) =
            row.map_err(|e| e.to_string())?;
        let embedding = bytes_to_f32_vec(&embedding_bytes);
        let score = cosine_similarity(&query_embedding, &embedding);
        results.push(RagSearchResult {
            file_path,
            heading,
            content,
            start_line,
            end_line,
            score,
        });
    }

    // スコア降順でソートし、上位K件を返す
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(k);

    Ok(results)
}

/// インデックス状況を取得
#[tauri::command]
pub fn rag_get_status(folder_path: String) -> Result<RagStatus, String> {
    let path = db_path(&folder_path);
    if !path.exists() {
        return Ok(RagStatus {
            indexed: false,
            chunk_count: 0,
            file_count: 0,
        });
    }

    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    let chunk_count: usize = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
        .unwrap_or(0);
    let file_count: usize = conn
        .query_row(
            "SELECT COUNT(DISTINCT file_path) FROM chunks",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(RagStatus {
        indexed: chunk_count > 0,
        chunk_count,
        file_count,
    })
}

/// インデックスを削除
#[tauri::command]
pub fn rag_delete_index(folder_path: String) -> Result<(), String> {
    let path = db_path(&folder_path);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
