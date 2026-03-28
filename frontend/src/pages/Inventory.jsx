import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { fetchAPI } from '../services/api';
import ImageUploadField from '../components/ImageUploadField';
import { uploadImageToCloudinary } from '../services/cloudinary';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  image: '',
  imagePublicId: '',
};
const INPUT_CLS =
  'w-full rounded-2xl border border-outline_variant/15 bg-surface_container px-4 py-3 text-sm text-on_surface placeholder:text-outline focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CRITICAL', label: 'Critico' },
  { value: 'LOW', label: 'Bajo' },
  { value: 'NORMAL', label: 'Normal' },
];

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [complex, setComplex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noComplex, setNoComplex] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [deleteProduct, setDeleteProduct] = useState(null);

  useEffect(() => () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
  }, [imagePreviewUrl]);

  useEffect(() => {
    fetchAPI('/complexes/mine')
      .then(async (ownedComplex) => {
        setComplex(ownedComplex);
        const list = await fetchAPI(`/products?complexId=${ownedComplex._id}`);
        setProducts(list);
      })
      .catch((error) => {
        if (error.status === 404) {
          setNoComplex(true);
          return;
        }
        alert(error.message || 'No se pudo cargar la informacion del complejo.');
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['', ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesSearch = product.name?.toLowerCase().includes(search.trim().toLowerCase());
        const matchesCategory = !categoryFilter || product.category === categoryFilter;
        const matchesStock = matchesStockFilter(product.stock, stockFilter);
        return matchesSearch && matchesCategory && matchesStock;
      }),
    [products, search, categoryFilter, stockFilter],
  );

  const stats = useMemo(() => {
    const critical = products.filter((product) => Number(product.stock) === 0).length;
    const low = products.filter((product) => Number(product.stock) > 0 && Number(product.stock) < 5).length;
    const value = products.reduce(
      (sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0),
      0,
    );
    return { total: products.length, critical, low, value };
  }, [products]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    clearImageSelection();
    setModal({ mode: 'create' });
  };

  const openEdit = (product) => {
    setForm({
      name: product.name ?? '',
      description: product.description ?? '',
      price: product.price?.toString() ?? '',
      stock: product.stock?.toString() ?? '',
      category: product.category ?? '',
      image: product.image || product.imageUrl || '',
      imagePublicId: product.imagePublicId || '',
    });
    clearImageSelection();
    setModal({ mode: 'edit', productId: product._id });
  };

  const closeModal = () => {
    setModal(null);
    setForm(EMPTY_FORM);
    clearImageSelection();
  };

  const clearImageSelection = () => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl('');
    setImageFile(null);
  };

  const handleImageSelection = (file) => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!file) {
      setImagePreviewUrl('');
      setImageFile(null);
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    clearImageSelection();
    setForm((current) => ({
      ...current,
      image: '',
      imagePublicId: '',
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!complex) return;
    setSaving(true);

    let payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      category: form.category.trim(),
      image: form.image,
      imagePublicId: form.imagePublicId,
    };

    try {
      if (imageFile) {
        setUploadingImage(true);
        const uploadedImage = await uploadImageToCloudinary(imageFile, 'product');
        payload = {
          ...payload,
          image: uploadedImage.image,
          imagePublicId: uploadedImage.imagePublicId,
        };
      }

      if (modal?.mode === 'create') {
        const created = await fetchAPI('/products', {
          method: 'POST',
          body: JSON.stringify({ ...payload, complexId: complex._id }),
        });
        setProducts((current) => [created, ...current]);
      } else {
        const updated = await fetchAPI(`/products/${modal.productId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setProducts((current) =>
          current.map((product) => (product._id === updated._id ? updated : product)),
        );
      }
      closeModal();
    } catch (error) {
      alert(error.message || 'No se pudo guardar el producto.');
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    try {
      await fetchAPI(`/products/${deleteProduct._id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((product) => product._id !== deleteProduct._id));
      setDeleteProduct(null);
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el producto.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (noComplex) {
    return <NoComplexBanner />;
  }

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-sm uppercase tracking-widest text-outline">
            {complex?.name || 'Mi complejo'}
          </p>
          <h2 className="text-[2rem] font-display font-medium tracking-tight text-on_surface sm:text-[2.5rem]">
            Inventario
          </h2>
          <p className="text-on_surface_variant">
            Controla stock, categorias y movimiento de productos del complejo.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed shadow-[0_8px_30px_-10px_rgba(47,172,76,0.42)] transition-all hover:scale-[1.01] hover:brightness-110 sm:w-auto"
        >
          <Plus size={20} />
          Nuevo producto
        </button>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Productos" value={stats.total} hint="items activos" />
        <StatCard label="Sin stock" value={stats.critical} hint="requieren reposicion" accent="error" />
        <StatCard label="Stock bajo" value={stats.low} hint="menos de 5 unidades" accent="warning" />
        <StatCard label="Valor estimado" value={`$${stats.value.toLocaleString('es-AR')}`} hint="precio x stock actual" />
      </section>

      <div className="mb-6 rounded-[1.5rem] border border-primary/15 bg-primary/10 px-5 py-4">
        <p className="flex items-start gap-3 text-sm text-on_surface">
          <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
          Todo producto vendido desde este complejo debe entregarse aca mismo. La plataforma no es un servicio de delivery.
        </p>
      </div>

      {(stats.critical > 0 || stats.low > 0) && (
        <div className="mb-6 rounded-[1.5rem] border border-red-400/15 bg-red-400/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">
              Hay {stats.critical} producto{stats.critical !== 1 ? 's' : ''} sin stock y {stats.low} con stock bajo.
            </p>
          </div>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_200px]">
        <label className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${INPUT_CLS} pl-11`}
            placeholder="Buscar por nombre"
          />
        </label>

        <label className="relative">
          <Filter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={`${INPUT_CLS} pl-11`}
          >
            {categories.map((category) => (
              <option key={category || 'all'} value={category}>
                {category || 'Todas las categorias'}
              </option>
            ))}
          </select>
        </label>

        <select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value)}
          className={INPUT_CLS}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {filteredProducts.length === 0 ? (
        <EmptyInventoryState hasProducts={products.length > 0} onCreate={openCreate} />
      ) : (
        <>
          <div className="space-y-4 lg:hidden">
            {filteredProducts.map((product) => (
              <ProductCard key={product._id} product={product} onEdit={openEdit} onDelete={setDeleteProduct} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low lg:block">
            <div className="grid grid-cols-[minmax(0,2.5fr)_1fr_1fr_1fr_120px] gap-4 border-b border-outline_variant/10 px-6 py-4 text-xs font-semibold uppercase tracking-widest text-outline">
              <span>Producto</span>
              <span>Categoria</span>
              <span>Stock</span>
              <span>Precio</span>
              <span className="text-right">Acciones</span>
            </div>

            {filteredProducts.map((product, index) => {
              const stockStatus = getStockStatus(Number(product.stock));
              return (
                <div
                  key={product._id}
                  className={`grid grid-cols-[minmax(0,2.5fr)_1fr_1fr_1fr_120px] gap-4 px-6 py-5 ${
                    index < filteredProducts.length - 1 ? 'border-b border-outline_variant/5' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-outline_variant/10 bg-surface_container">
                        {product.imageUrl || product.image ? (
                          <img
                            src={product.imageUrl || product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-outline">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium text-on_surface">{product.name}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-on_surface_variant">{product.description || 'Sin descripcion'}</p>
                  </div>
                  <span className="text-sm text-on_surface_variant">{product.category}</span>
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.cls}`}>
                      {product.stock} u.
                    </span>
                  </div>
                  <span className="text-sm font-medium text-on_surface">
                    ${Number(product.price || 0).toLocaleString('es-AR')}
                  </span>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="rounded-xl p-2 text-outline transition-colors hover:bg-surface_container hover:text-primary"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteProduct(product)}
                      className="rounded-xl p-2 text-outline transition-colors hover:bg-red-400/10 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Nuevo producto' : 'Editar producto'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Nombre">
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={INPUT_CLS}
                placeholder="Pelota oficial"
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <input
                  type="text"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className={INPUT_CLS}
                  placeholder="Bebidas, equipamiento..."
                  required
                />
              </Field>

              <Field label="Stock">
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
                  className={INPUT_CLS}
                  placeholder="24"
                  required
                />
              </Field>
            </div>

            <Field label="Precio">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className={INPUT_CLS}
                placeholder="3500"
                required
              />
            </Field>

            <Field label="Descripcion">
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className={INPUT_CLS}
                placeholder="Detalle opcional del producto"
              />
            </Field>

            <ImageUploadField
              label="Foto del producto"
              imageUrl={form.image}
              previewUrl={imagePreviewUrl}
              onSelectFile={handleImageSelection}
              onClear={handleClearImage}
              hint="Esta foto se mostrara en el inventario y en la tienda publica del complejo."
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface_variant transition-colors hover:bg-surface_container_highest"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-4 py-3 text-sm font-semibold text-on_primary_fixed transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? (uploadingImage ? 'Subiendo imagen...' : 'Guardando...') : 'Guardar producto'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteProduct && (
        <Modal title="Eliminar producto" onClose={() => setDeleteProduct(null)}>
          <p className="text-sm text-on_surface_variant">
            Vas a eliminar <span className="font-semibold text-on_surface">{deleteProduct.name}</span>. Esta accion no se puede deshacer.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setDeleteProduct(null)}
              className="flex-1 rounded-2xl border border-outline_variant/20 px-4 py-3 text-sm font-medium text-on_surface_variant transition-colors hover:bg-surface_container_highest"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500/90"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete }) {
  const stockStatus = getStockStatus(Number(product.stock));
  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5">
      <div className="mb-4 overflow-hidden rounded-[1.25rem] border border-outline_variant/10 bg-surface_container">
        {product.imageUrl || product.image ? (
          <img src={product.imageUrl || product.image} alt={product.name} className="h-44 w-full object-cover" />
        ) : (
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-primary/10 to-surface_container_highest text-outline">
            <ImageIcon size={28} />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {product.category}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.cls}`}>
              {stockStatus.label}
            </span>
          </div>
          <h3 className="truncate text-lg font-display font-medium text-on_surface">{product.name}</h3>
          <p className="mt-2 text-sm text-on_surface_variant">{product.description || 'Sin descripcion'}</p>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="rounded-xl p-2 text-outline transition-colors hover:bg-surface_container hover:text-primary"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="rounded-xl p-2 text-outline transition-colors hover:bg-red-400/10 hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoTile label="Stock" value={`${product.stock} u.`} />
        <InfoTile label="Precio" value={`$${Number(product.price || 0).toLocaleString('es-AR')}`} />
      </div>
    </article>
  );
}

function StatCard({ label, value, hint, accent = 'default' }) {
  const accentCls =
    accent === 'error' ? 'text-red-400' : accent === 'warning' ? 'text-yellow-400' : 'text-primary';

  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-outline">{label}</p>
      <h3 className={`mt-2 text-3xl font-display font-medium ${accentCls}`}>{value}</h3>
      <p className="mt-1 text-sm text-on_surface_variant">{hint}</p>
    </article>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface_container p-4">
      <p className="text-xs uppercase tracking-widest text-outline">{label}</p>
      <p className="mt-2 text-sm font-medium text-on_surface">{value}</p>
    </div>
  );
}

function EmptyInventoryState({ hasProducts, onCreate }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-outline_variant/20 bg-surface_container_low px-6 py-12 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <PackageOpen size={28} />
      </div>
      <h3 className="text-2xl font-display font-medium text-on_surface">
        {hasProducts ? 'No hay resultados para esos filtros' : 'Todavia no cargaste productos'}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-on_surface_variant">
        {hasProducts
          ? 'Prueba con otra categoria o limpia la busqueda para volver a ver el inventario.'
          : 'Empieza con bebidas, pelotas o accesorios para controlar stock y ventas desde un solo lugar.'}
      </p>
      {!hasProducts && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
        >
          <Plus size={18} />
          Crear primer producto
        </button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-outline_variant/15 bg-surface_container_low p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-xl font-display font-semibold text-on_surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-outline transition-colors hover:bg-surface_container hover:text-on_surface"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-outline">
        {label}
      </label>
      {children}
    </div>
  );
}

function NoComplexBanner() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 size={28} className="text-primary" />
      </div>
      <h3 className="mb-2 text-2xl font-display font-medium text-on_surface">Configura tu complejo primero</h3>
      <p className="mb-6 text-sm text-on_surface_variant">
        Antes de cargar productos necesitas registrar tu complejo con nombre y direccion.
      </p>
      <Link
        to="/dashboard/settings"
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-8 py-3.5 font-semibold text-on_primary_fixed transition-all hover:brightness-110"
      >
        <Building2 size={16} />
        Configurar complejo
      </Link>
    </div>
  );
}

function getStockStatus(stock) {
  if (stock === 0) return { label: 'Sin stock', cls: 'bg-red-400/10 text-red-400' };
  if (stock < 5) return { label: 'Critico', cls: 'bg-red-400/10 text-red-400' };
  if (stock < 20) return { label: 'Bajo', cls: 'bg-yellow-400/10 text-yellow-400' };
  return { label: 'Normal', cls: 'bg-green-400/10 text-green-400' };
}

function matchesStockFilter(stock, filter) {
  if (filter === 'ALL') return true;
  if (filter === 'CRITICAL') return Number(stock) === 0;
  if (filter === 'LOW') return Number(stock) > 0 && Number(stock) < 5;
  if (filter === 'NORMAL') return Number(stock) >= 5;
  return true;
}
