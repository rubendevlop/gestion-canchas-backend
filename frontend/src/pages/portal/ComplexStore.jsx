import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, MapPin, Minus, Plus, ShoppingCart, Tag } from 'lucide-react';
import { fetchAPI } from '../../services/api';

export default function ComplexStore() {
  const { complexId } = useParams();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Todos');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchAPI(`/products?complexId=${complexId}&clientVisible=true`)
      .then(setProducts)
      .catch((error) => {
        setProducts([]);
        setErrorMessage(error.message || 'La tienda de este complejo no esta disponible.');
      })
      .finally(() => setLoading(false));
  }, [complexId]);

  const categories = ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))];
  const filtered = category === 'Todos' ? products : products.filter((product) => product.category === category);

  const addToCart = (id) => setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  const removeFromCart = (id) =>
    setCart((current) => {
      const next = { ...current };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });

  const totalItems = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link
            to={`/portal/complejo/${complexId}`}
            className="mb-3 flex items-center gap-2 text-sm text-on_surface_variant transition-colors hover:text-on_surface"
          >
            <ChevronLeft size={16} />
            Volver al complejo
          </Link>
          <h1 className="font-display text-3xl font-bold text-on_surface">Tienda</h1>
          <p className="mt-1 text-sm text-on_surface_variant">Productos de este complejo</p>
        </div>

        {totalItems > 0 && (
          <Link
            to={`/portal/complejo/${complexId}/tienda/carrito`}
            state={{ cart, products }}
            className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary_container to-primary px-6 py-3 font-semibold text-on_primary transition-all hover:brightness-110"
          >
            <ShoppingCart size={18} />
            Ver carrito
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs font-bold text-white">
              {totalItems}
            </span>
          </Link>
        )}
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              category === item
                ? 'border-primary/25 bg-primary/10 text-primary'
                : 'border-outline_variant/20 bg-white text-on_surface_variant hover:border-primary/25 hover:text-on_surface'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/10 px-5 py-4">
        <p className="flex items-start gap-3 text-sm text-on_surface">
          <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
          Todo producto comprado en este complejo se retira presencialmente aca. La tienda no funciona como delivery.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-on_surface_variant">{errorMessage || 'No hay productos disponibles.'}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              quantity={cart[product._id] || 0}
              onAdd={() => addToCart(product._id)}
              onRemove={() => removeFromCart(product._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, quantity, onAdd, onRemove }) {
  const imageUrl = product.imageUrl || product.image || '';

  return (
    <div className="overflow-hidden rounded-3xl border border-outline_variant/20 bg-white transition-all hover:border-primary/25 hover:bg-surface_container_low">
      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-surface_container_low to-surface_container">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl text-on_surface_variant/30">Carrito</span>
        )}
      </div>
      <div className="p-4">
        {product.category && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-primary">
            <Tag size={10} />
            {product.category}
          </span>
        )}
        <p className="mb-1 text-sm font-medium leading-tight text-on_surface">{product.name}</p>
        <p className="mb-4 text-lg font-bold text-primary">${product.price?.toLocaleString('es-AR')}</p>

        {quantity === 0 ? (
          <button
            onClick={onAdd}
            className="w-full rounded-xl border border-outline_variant/20 bg-surface_container_low py-2.5 text-sm font-semibold text-on_surface transition-all hover:border-primary/25 hover:text-primary"
          >
            Agregar
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5">
            <button onClick={onRemove} className="text-primary transition-colors hover:text-on_surface">
              <Minus size={16} />
            </button>
            <span className="font-bold text-on_surface">{quantity}</span>
            <button onClick={onAdd} className="text-primary transition-colors hover:text-on_surface">
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
