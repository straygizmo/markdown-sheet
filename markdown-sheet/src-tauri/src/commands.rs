use crate::markdown_parser::{parse_markdown, rebuild_document, MarkdownTable, ParsedDocument};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

/// ファイルツリーのエントリ
#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

/// 対象ファイルかどうか判定
fn is_target_file(name: &str, include_docx: bool, include_xls: bool, include_km: bool, include_images: bool) -> bool {
    if name.ends_with(".md") {
        return true;
    }
    let lower = name.to_lowercase();
    if include_docx && lower.ends_with(".docx") {
        return true;
    }
    if include_xls && (lower.ends_with(".xlsx") || lower.ends_with(".xlsm")) {
        return true;
    }
    if include_km && (lower.ends_with(".km") || lower.ends_with(".xmind")) {
        return true;
    }
    if include_images && (lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".gif") || lower.ends_with(".bmp") || lower.ends_with(".svg") || lower.ends_with(".webp")) {
        return true;
    }
    false
}

/// ディレクトリを再帰的に読み取り、対象ファイルとフォルダのみ返す
fn read_dir_recursive(dir: &Path, depth: u32, include_docx: bool, include_xls: bool, include_km: bool, include_images: bool, include_empty_dirs: bool) -> Vec<FileEntry> {
    if depth > 5 {
        return Vec::new();
    }
    let mut entries = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return entries;
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| e.file_name());

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // 隠しフォルダ/ファイルをスキップ
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = read_dir_recursive(&path, depth + 1, include_docx, include_xls, include_km, include_images, include_empty_dirs);
            // 対象ファイルを含むフォルダのみ表示（include_empty_dirs の場合は空フォルダも表示）
            if !children.is_empty() || include_empty_dirs {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if is_target_file(&name, include_docx, include_xls, include_km, include_images) {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    entries
}

/// ディレクトリのファイルツリーを取得する Tauri コマンド
#[tauri::command]
pub fn get_file_tree(
    dir_path: String,
    include_docx: Option<bool>,
    include_xls: Option<bool>,
    include_km: Option<bool>,
    include_images: Option<bool>,
    include_empty_dirs: Option<bool>,
) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.exists() || !path.is_dir() {
        return Err("ディレクトリが存在しません".to_string());
    }
    Ok(read_dir_recursive(
        path,
        0,
        include_docx.unwrap_or(false),
        include_xls.unwrap_or(false),
        include_km.unwrap_or(false),
        include_images.unwrap_or(false),
        include_empty_dirs.unwrap_or(false),
    ))
}

/// Zenn プロジェクト検出結果
#[derive(Debug, Serialize, Deserialize)]
pub struct ZennProjectInfo {
    pub is_zenn_project: bool,
    pub project_root: String,
    pub has_articles: bool,
    pub has_books: bool,
}

/// Zenn 記事のフロントマターメタ情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ZennArticleMeta {
    pub path: String,
    pub emoji: String,
    pub title: String,
    pub published: bool,
}

/// ディレクトリが Zenn プロジェクトかどうか検出する Tauri コマンド
#[tauri::command]
pub fn detect_zenn_project(dir_path: String) -> Result<ZennProjectInfo, String> {
    let path = Path::new(&dir_path);
    if !path.exists() || !path.is_dir() {
        return Err("ディレクトリが存在しません".to_string());
    }

    let articles_path = path.join("articles");
    let books_path = path.join("books");
    let has_articles = articles_path.exists() && articles_path.is_dir();
    let has_books = books_path.exists() && books_path.is_dir();

    // package.json に zenn-cli があるかもチェック
    let mut is_zenn = has_articles || has_books;
    if !is_zenn {
        let pkg_path = path.join("package.json");
        if pkg_path.exists() {
            if let Ok(content) = fs::read_to_string(&pkg_path) {
                is_zenn = content.contains("zenn-cli");
            }
        }
    }

    Ok(ZennProjectInfo {
        is_zenn_project: is_zenn,
        project_root: dir_path,
        has_articles,
        has_books,
    })
}

/// articles/ 内の .md ファイルからフロントマターのメタ情報を一括取得する Tauri コマンド
#[tauri::command]
pub fn get_zenn_articles_meta(dir_path: String) -> Result<Vec<ZennArticleMeta>, String> {
    let articles_dir = Path::new(&dir_path).join("articles");
    if !articles_dir.exists() || !articles_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut metas = Vec::new();
    let Ok(read_dir) = fs::read_dir(&articles_dir) else {
        return Ok(metas);
    };

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() || !path.extension().map_or(false, |e| e == "md") {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if let Some(meta) = extract_zenn_frontmatter(&content) {
                metas.push(ZennArticleMeta {
                    path: path.to_string_lossy().to_string(),
                    emoji: meta.0,
                    title: meta.1,
                    published: meta.2,
                });
            }
        }
    }
    Ok(metas)
}

/// フロントマターから emoji, title, published を抽出
fn extract_zenn_frontmatter(content: &str) -> Option<(String, String, bool)> {
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return None;
    }
    let end = content.find("\n---")?;
    if end <= 4 {
        return None;
    }
    let yaml = &content[4..end];
    let mut emoji = String::new();
    let mut title = String::new();
    let mut published = false;

    for line in yaml.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("emoji:") {
            emoji = val.trim().trim_matches('"').trim_matches('\'').to_string();
        } else if let Some(val) = line.strip_prefix("title:") {
            title = val.trim().trim_matches('"').trim_matches('\'').to_string();
        } else if let Some(val) = line.strip_prefix("published:") {
            published = val.trim() == "true";
        }
    }

    if emoji.is_empty() && title.is_empty() {
        return None;
    }
    Some((emoji, title, published))
}

/// Markdown ファイルを読み込んでパースする Tauri コマンド
#[tauri::command]
pub fn read_markdown_file(file_path: String) -> Result<ParsedDocument, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(parse_markdown(&content))
}

/// テーブルを更新して Markdown ファイルに書き戻す Tauri コマンド
#[tauri::command]
pub fn save_markdown_file(
    file_path: String,
    original_lines: Vec<String>,
    tables: Vec<MarkdownTable>,
) -> Result<(), String> {
    let content = rebuild_document(&original_lines, &tables);
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

/// Git ファイル変更状態
#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub status: String,
    pub path: String,
}

/// git init
#[tauri::command]
pub fn git_init(dir_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["init", "-b", "main"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git init 失敗: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// git status --porcelain の結果を返す
#[tauri::command]
pub fn git_status(dir_path: String) -> Result<Vec<GitFileStatus>, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git コマンド実行失敗: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let status = line[..2].trim().to_string();
            let path = line[3..].to_string();
            GitFileStatus { status, path }
        })
        .collect();
    Ok(files)
}

/// git add .
#[tauri::command]
pub fn git_add_all(dir_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["add", "."])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git add 失敗: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// git commit -m "message"
/// For Zenn projects, temporarily replaces ../images/ with /images/ in .md files before committing,
/// then restores the original content after the commit.
#[tauri::command]
pub fn git_commit(dir_path: String, message: String) -> Result<(), String> {
    // Collect .md files and replace ../images/ -> /images/ for Zenn deploy
    let originals = fix_image_paths_for_zenn(&dir_path);

    // Re-stage after modifications
    if !originals.is_empty() {
        let add_output = Command::new("git")
            .args(["add", "."])
            .current_dir(&dir_path)
            .output()
            .map_err(|e| {
                restore_originals(&originals);
                format!("git add 失敗: {}", e)
            })?;
        if !add_output.status.success() {
            restore_originals(&originals);
            return Err(String::from_utf8_lossy(&add_output.stderr).to_string());
        }
    }

    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| {
            restore_originals(&originals);
            format!("git commit 失敗: {}", e)
        })?;

    // Always restore original files
    restore_originals(&originals);

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Find all .md files recursively and replace ../images/ with /images/.
/// Returns Vec of (path, original_content) for restoration.
fn fix_image_paths_for_zenn(dir_path: &str) -> Vec<(std::path::PathBuf, String)> {
    let mut originals = Vec::new();
    let dir = Path::new(dir_path);
    if let Ok(entries) = glob_md_files(dir) {
        for path in entries {
            if let Ok(content) = fs::read_to_string(&path) {
                if content.contains("../images/") {
                    let fixed = content.replace("../images/", "/images/");
                    if fs::write(&path, &fixed).is_ok() {
                        originals.push((path, content));
                    }
                }
            }
        }
    }
    originals
}

/// Recursively collect .md files
fn glob_md_files(dir: &Path) -> Result<Vec<std::path::PathBuf>, std::io::Error> {
    let mut results = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                if let Ok(mut sub) = glob_md_files(&path) {
                    results.append(&mut sub);
                }
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                results.push(path);
            }
        }
    }
    Ok(results)
}

/// Restore original file contents
fn restore_originals(originals: &[(std::path::PathBuf, String)]) {
    for (path, content) in originals {
        let _ = fs::write(path, content);
    }
}

/// git remote get-url origin
#[tauri::command]
pub fn git_get_remote_url(dir_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git remote 取得失敗: {}", e))?;

    if !output.status.success() {
        return Ok(String::new());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// git remote add/set-url origin <url>
#[tauri::command]
pub fn git_set_remote_url(dir_path: String, url: String) -> Result<(), String> {
    // Check if origin already exists
    let check = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git remote 確認失敗: {}", e))?;

    let args = if check.status.success() {
        vec!["remote", "set-url", "origin", &url]
    } else {
        vec!["remote", "add", "origin", &url]
    };

    let output = Command::new("git")
        .args(&args)
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git remote 設定失敗: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// git push (with -u origin main/master for first push)
#[tauri::command]
pub fn git_push(dir_path: String) -> Result<(), String> {
    // Try normal push first
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git push 失敗: {}", e))?;

    if output.status.success() {
        return Ok(());
    }

    // If failed, try detecting current branch and push with -u
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("ブランチ名取得失敗: {}", e))?;

    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();
    if branch.is_empty() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let retry = Command::new("git")
        .args(["push", "-u", "origin", &branch])
        .current_dir(&dir_path)
        .output()
        .map_err(|e| format!("git push -u 失敗: {}", e))?;

    if !retry.status.success() {
        return Err(String::from_utf8_lossy(&retry.stderr).to_string());
    }
    Ok(())
}

/// URLをデフォルトブラウザで開く
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("URL を開けませんでした: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("URL を開けませんでした: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("URL を開けませんでした: {}", e))?;
    }
    Ok(())
}
