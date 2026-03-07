# 音声認識モデル (moonshine-tiny-ja) セットアップ手順

ONNXモデルはサイズが大きい（約141MB）ため、Gitリポジトリには含めていません。
開発・ビルド時は以下の手順でモデルを取得・配置してください。

## モデル情報

| 項目 | 値 |
|------|-----|
| 元モデル | [UsefulSensors/moonshine-tiny-ja](https://huggingface.co/UsefulSensors/moonshine-tiny-ja)（PyTorch） |
| 配置先 | `markdown-sheet/public/models/moonshine-tiny-ja/` |
| 合計サイズ | 約141MB（encoder: 30MB, decoder: 111MB） |

> **注意**: HuggingFace の `onnx-community/moonshine-tiny-ja-ONNX` は量子化済みモデル（`encoder_model_q4.onnx` 等）であり、
> 本プロジェクトが使用する fp32 の `encoder_model.onnx` / `decoder_model_merged.onnx` とはファイル形式・設定が異なるため使用できません。
> PyTorch モデルから `optimum` で変換する必要があります。

## 手順

### 1. ONNX にエクスポート

[uv](https://docs.astral.sh/uv/) を使用する場合:

```bash
uv run --with "optimum[onnxruntime]" --with transformers -- \
  optimum-cli export onnx \
    --model UsefulSensors/moonshine-tiny-ja \
    --task automatic-speech-recognition-with-past \
    moonshine-tiny-ja-onnx
```

pip を使用する場合:

```bash
pip install optimum[onnxruntime] transformers
optimum-cli export onnx \
  --model UsefulSensors/moonshine-tiny-ja \
  --task automatic-speech-recognition-with-past \
  moonshine-tiny-ja-onnx
```

> バリデーションで max diff の警告が出ますが、動作に問題はありません。

### 2. モデルファイルの配置

```bash
mkdir -p markdown-sheet/public/models/moonshine-tiny-ja/onnx

# 設定ファイル
cp moonshine-tiny-ja-onnx/config.json \
   moonshine-tiny-ja-onnx/generation_config.json \
   moonshine-tiny-ja-onnx/preprocessor_config.json \
   moonshine-tiny-ja-onnx/special_tokens_map.json \
   moonshine-tiny-ja-onnx/tokenizer.json \
   moonshine-tiny-ja-onnx/tokenizer_config.json \
   markdown-sheet/public/models/moonshine-tiny-ja/

# ONNX モデル本体（decoder_model.onnx, decoder_with_past_model.onnx は不要）
cp moonshine-tiny-ja-onnx/encoder_model.onnx \
   moonshine-tiny-ja-onnx/decoder_model_merged.onnx \
   markdown-sheet/public/models/moonshine-tiny-ja/onnx/
```

## 配置後のディレクトリ構成

```
markdown-sheet/public/models/moonshine-tiny-ja/
  config.json
  generation_config.json
  preprocessor_config.json
  special_tokens_map.json
  tokenizer.json
  tokenizer_config.json
  onnx/
    encoder_model.onnx        (~30MB)
    decoder_model_merged.onnx  (~111MB)
```

## 確認

モデルが正しく配置されていれば、アプリ起動後にマイクボタンから音声入力が利用できます。
`useSpeechToText.ts` がローカルの `/models/moonshine-tiny-ja` からモデルを読み込みます。
