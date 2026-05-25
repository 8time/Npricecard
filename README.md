# レトロPOP風プライスカード作成アプリ

## 1. ディレクトリ構成

```text
.
├─ dist
├─ node_modules
├─ src
│  ├─ components
│  │  ├─ CanvasStage.tsx
│  │  ├─ EditorPanel.tsx
│  │  └─ TemplateSidebar.tsx
│  ├─ hooks
│  │  └─ usePriceCardStore.ts
│  ├─ lib
│  │  ├─ format.ts
│  │  ├─ pdf.ts
│  │  └─ storage.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ templates.ts
│  └─ types.ts
├─ index.html
├─ package.json
├─ postcss.config.js
├─ tailwind.config.js
├─ tsconfig.app.json
├─ tsconfig.json
└─ vite.config.js
```

## 2. 技術設計

- Vite + React + TypeScript で軽量な SPA を構成
- Tailwind CSS で UI を高速構築
- Fabric.js を中央 Canvas の値札描画に利用
- PDF-lib で A4 面付け PDF をブラウザ内生成
- IndexedDB でテンプレ選択済みの作成データをローカル保存
- 状態管理は `useReducer` のみで完結

## 3. コンポーネント設計

- `App.tsx`
  - 全体レイアウト、通知、保存、PDF 出力
- `TemplateSidebar.tsx`
  - テンプレ一覧、保存済みドキュメント一覧
- `CanvasStage.tsx`
  - Fabric.js Canvas の初期化と再描画
- `EditorPanel.tsx`
  - 商品名、価格、PR、税表示の編集

## 4. 状態管理設計

- `usePriceCardStore.ts`
  - `document`: 現在の値札データ
  - `savedItems`: IndexedDB から読み込んだ保存データ
- `useReducer` アクション
  - `setTemplate`
  - `setField`
  - `toggleFlag`
  - `setSavedItems`
  - `loadSavedDocument`

## 5. Fabric.js 構成

- 値札テンプレは `templates.ts` に固定定義
- Canvas 上のオブジェクト
  - 外枠
  - 見出し帯
  - 見出し文字
  - 背景アクセント
  - 商品名
  - 価格
  - PR文
- MVP では自由レイヤー編集を避け、値札専用 UI を優先

## 6. PDF 出力設計

- `pdf.ts` で Canvas を PNG 化して PDF-lib に埋め込み
- 対応設計サイズ
  - A4
  - A5
  - A3
  - B5
- MVP では A4 面付けを実装
- 余白とカードサイズから自動で行列計算
- トンボ描画関数も実装済み

## 7. IndexedDB 設計

- DB 名: `retro-pop-price-card-db`
- Store 名: `documents`
- 保存内容
  - テンプレ ID
  - 商品名
  - 価格
  - PR 文
  - 税表示フラグ
  - 保存日時

## 8. UI モック

```text
┌──────────────────────────────────────────────────────────────┐
│ レトロPOP風プライスカード作成アプリ                         │
├──────────────┬──────────────────────────────┬───────────────┤
│ テンプレ     │ Canvas                       │ 設定          │
│ ・駄菓子風   │ ┌──────────────────────────┐ │ 商品名        │
│ ・スーパー風 │ │        値札プレビュー     │ │ 価格          │
│ ・木目POP    │ │      Fabric.js Canvas     │ │ PR文          │
│ ・昭和風     │ └──────────────────────────┘ │ 税込/税別     │
│              │                              │ 円表示         │
│ 保存済み一覧 │                              │ 保存           │
│              │                              │ PDF出力        │
└──────────────┴──────────────────────────────┴───────────────┘
```

## 9. MVP 実装

- 実装済み
  - テンプレ読み込み
  - 商品名編集
  - 価格編集
  - PR文編集
  - 税込/税別/円表示切替
  - IndexedDB 保存
  - PDF 出力
  - A4 自動面付け
  - トンボ描画
- 後回し
  - 画像アップロード
  - ドラッグ配置 UI
  - 詳細フォントパネル
  - A3/A5/B5 切替 UI

## 10. 開発コマンド

```bash
npm install
npm run dev
npm run build
npm run preview
```
