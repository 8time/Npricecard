import { useState } from 'react';

type Props = {
  onInsertQr: (dataUrl: string, value: string) => void;
};

export const QrPanel = ({ onInsertQr }: Props) => {
  const [value, setValue] = useState('https://example.com');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!value.trim()) return;
    setGenerating(true);
    try {
      // qrcodeライブラリを動的インポート
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(value, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      onInsertQr(dataUrl, value);
    } catch (e) {
      console.error('QRコード生成エラー:', e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">QRコード</div>
      <div className="rounded-lg border border-[#d9e0e6] bg-white p-2.5 space-y-2">
        <label className="text-xs font-semibold text-[#374151]">URL / テキスト</label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          className="w-full rounded border border-[#d9e0e6] px-2 py-1.5 text-xs"
          placeholder="https://example.com"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !value.trim()}
          className="w-full rounded-md bg-[#7c3aed] py-2 text-xs font-bold text-white transition hover:bg-[#6d28d9] disabled:opacity-40"
        >
          {generating ? '生成中...' : 'QRコードを挿入'}
        </button>
      </div>
    </div>
  );
};
