import type { CardDocument, MergeField } from '../types';

type Props = {
  document: CardDocument;
  onUpdateMergeFields: (fields: MergeField[]) => void;
};

export const MergeFieldPanel = ({ document, onUpdateMergeFields }: Props) => {
  const { mergeFields } = document;

  const addField = () => {
    const newField: MergeField = {
      id: `field-${Date.now()}`,
      fieldName: `フィールド${mergeFields.length + 1}`,
      values: ['値1', '値2', '値3'],
    };
    onUpdateMergeFields([...mergeFields, newField]);
  };

  const removeField = (id: string) => {
    onUpdateMergeFields(mergeFields.filter((f) => f.id !== id));
  };

  const updateFieldName = (id: string, name: string) => {
    onUpdateMergeFields(mergeFields.map((f) => (f.id === id ? { ...f, fieldName: name } : f)));
  };

  const updateValues = (id: string, valuesText: string) => {
    const values = valuesText.split('\n').filter((v) => v.trim());
    onUpdateMergeFields(mergeFields.map((f) => (f.id === id ? { ...f, values } : f)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#8896a5]">差し込み印刷</span>
        <button
          type="button"
          onClick={addField}
          className="rounded bg-[#10b981] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#059669]"
        >
          + フィールド追加
        </button>
      </div>

      {mergeFields.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#d9e0e6] p-4 text-center text-[11px] text-[#9ca3af]">
          フィールドを追加すると<br />連番・差し込み印刷が使えます
        </div>
      )}

      {mergeFields.map((field) => (
        <div key={field.id} className="rounded-lg border border-[#d9e0e6] bg-white p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={field.fieldName}
              onChange={(e) => updateFieldName(field.id, e.target.value)}
              className="flex-1 rounded border border-[#d9e0e6] px-1.5 py-0.5 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="text-[11px] font-bold text-[#f87171] hover:text-[#dc2626]"
            >
              ×
            </button>
          </div>
          <textarea
            value={field.values.join('\n')}
            onChange={(e) => updateValues(field.id, e.target.value)}
            rows={3}
            className="w-full rounded border border-[#d9e0e6] px-1.5 py-1 text-[10px] font-mono"
            placeholder="値を1行ずつ入力"
          />
          <div className="text-[10px] text-[#9ca3af]">{field.values.length}件 → {field.values.length}枚印刷</div>
        </div>
      ))}
    </div>
  );
};
