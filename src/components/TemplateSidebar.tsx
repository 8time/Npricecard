import { CARD_TEMPLATES } from '../templates';
import type { SavedDocument, TemplateId } from '../types';

type Props = {
  activeTemplateId: TemplateId;
  savedItems: SavedDocument[];
  onSelectTemplate: (templateId: TemplateId) => void;
  onLoadSaved: (item: SavedDocument) => void;
  onDeleteSaved: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export const TemplateSidebar = ({
  activeTemplateId,
  savedItems,
  onSelectTemplate,
  onLoadSaved,
  onDeleteSaved,
  onExport,
  onImport,
}: Props) => (
  <aside className="min-h-0 border-r border-[#d9e0e6] bg-white px-5 py-5 pb-12">
    <div className="grid gap-4">
      {CARD_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'template', id: template.id }));
            e.dataTransfer.setData('application/price-card-template', template.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => onSelectTemplate(template.id)}
          className="group text-center"
        >
          <div
            className={`mx-auto grid h-[92px] w-[142px] place-items-center overflow-hidden rounded-md border bg-white cursor-grab active:cursor-grabbing transition ${
              activeTemplateId === template.id
                ? 'border-[#328eaa] shadow-[0_0_0_2px_rgba(50,142,170,0.18)]'
                : 'border-[#cfd8df] group-hover:border-[#328eaa]'
            }`}
          >
            <div className="h-full w-full bg-white" />
          </div>
          <div className="mt-1 text-sm font-medium text-[#111827]">{template.name}</div>
        </button>
      ))}
    </div>

    <div className="mt-8 border-t border-[#e5e9ed] pt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-black text-[#66717d] uppercase tracking-wider">保存済みデザイン</div>
        <div className="flex gap-1">
          <label
            title="バックアップから読み込む"
            className="flex h-6 cursor-pointer items-center rounded border border-[#cfd8df] px-1.5 text-[10px] font-bold text-[#475569] hover:border-[#328eaa] hover:text-[#328eaa]"
          >
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { onImport(file); e.target.value = ''; }
              }}
            />
            読込
          </label>
          {savedItems.length > 0 && (
            <button
              type="button"
              title="バックアップとして書き出す"
              onClick={onExport}
              className="flex h-6 items-center rounded border border-[#cfd8df] px-1.5 text-[10px] font-bold text-[#475569] hover:border-[#328eaa] hover:text-[#328eaa]"
            >
              書出
            </button>
          )}
        </div>
      </div>

      {savedItems.length > 0 ? (
        <div className="grid gap-4">
          {savedItems.map((item) => (
            <div key={item.id} className="group relative">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'saved', item }));
                  e.dataTransfer.setData('application/price-card-saved', JSON.stringify(item));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onLoadSaved(item)}
                className="w-full text-center"
              >
                <div className="mx-auto grid h-[92px] w-[142px] place-items-center overflow-hidden rounded-md border border-[#cfd8df] bg-[#f8fafc] shadow-sm cursor-grab active:cursor-grabbing transition group-hover:border-[#328eaa] group-hover:shadow-md">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} className="h-full w-full object-contain pointer-events-none" />
                  ) : (
                    <div className="text-[10px] text-[#94a3b8]">No Image</div>
                  )}
                </div>
                <div className="mt-1.5 px-1">
                  <div className="truncate text-[11px] font-bold text-[#111827]">{item.name}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('このデザインを削除しますか？')) {
                    onDeleteSaved(item.id);
                  }
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-red-100 bg-white text-[10px] font-bold text-red-500 shadow-sm opacity-0 transition group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-[10px] text-[#94a3b8]">
          保存済みデザインはありません
        </div>
      )}
    </div>
  </aside>
);
