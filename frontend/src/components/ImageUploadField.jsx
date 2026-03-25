import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';

export default function ImageUploadField({
  label,
  imageUrl,
  previewUrl,
  onSelectFile,
  onClear,
  hint = 'JPG, PNG o WEBP. Se sube a Cloudinary al guardar.',
}) {
  const currentImage = previewUrl || imageUrl || '';

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-outline">
        {label}
      </label>

      <div className="rounded-[1.5rem] border border-outline_variant/15 bg-surface_container p-4">
        {currentImage ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-outline_variant/10 bg-surface_container_low">
            <img src={currentImage} alt="" className="h-52 w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-[1.25rem] border border-dashed border-outline_variant/20 bg-surface_container_low text-outline">
            <div className="text-center">
              <ImagePlus size={28} className="mx-auto mb-3" />
              <p className="text-sm">Todavia no cargaste una imagen</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface transition-colors hover:bg-surface_container_highest">
            <UploadCloud size={16} />
            Elegir archivo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => onSelectFile?.(event.target.files?.[0] || null)}
            />
          </label>

          {(currentImage || imageUrl) && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/15"
            >
              <Trash2 size={16} />
              Quitar imagen
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-on_surface_variant">{hint}</p>
      </div>
    </div>
  );
}
