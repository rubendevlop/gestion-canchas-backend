import { useEffect, useMemo, useState } from 'react';
import { fetchAPI } from '../services/api';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShoppingBag,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';

const ROLES = ['client', 'owner', 'superadmin'];

const ROLE_STYLE = {
  superadmin: { label: 'Super Admin', cls: 'bg-purple-400/15 text-purple-300 border border-purple-400/20' },
  owner: { label: 'Owner', cls: 'bg-primary/15 text-primary border border-primary/20' },
  client: { label: 'Cliente', cls: 'bg-surface_container_low text-on_surface_variant border border-outline_variant/20' },
};

const OWNER_STATUS_STYLE = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-400/15 text-yellow-300', icon: Clock },
  APPROVED: { label: 'Aprobado', cls: 'bg-green-400/15 text-green-400', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-400/15 text-red-400', icon: XCircle },
};

const BILLING_STYLE = {
  ACTIVE: { label: 'Al dia', cls: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  GRACE: { label: 'En gracia', cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  BLOCKED: { label: 'Bloqueado', cls: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  NOT_REQUIRED: { label: 'No aplica', cls: 'bg-surface_container_highest text-on_surface_variant border border-outline_variant/10' },
};

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value, currency = 'ARS') {
  if (typeof value !== 'number') return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [ownerStatusFilter, setOwnerStatusFilter] = useState('ALL');
  const [billingFilter, setBillingFilter] = useState('ALL');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    setLoading(true);

    try {
      const [usersData, directoryData] = await Promise.all([
        fetchAPI('/users'),
        fetchAPI('/users/directory'),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setDirectory(Array.isArray(directoryData) ? directoryData : []);
    } catch (error) {
      setUsers([]);
      setDirectory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const owners = directory.filter((user) => user.role === 'owner');
    return {
      total: directory.length,
      superadmin: directory.filter((user) => user.role === 'superadmin').length,
      owners: owners.length,
      pending: users.filter((user) => user.role === 'owner' && user.ownerStatus === 'PENDING').length,
      clients: directory.filter((user) => user.role === 'client').length,
      ownersWithDebt: owners.filter((user) => ['GRACE', 'BLOCKED'].includes(user.ownerBilling?.status)).length,
    };
  }, [directory, users]);

  const pendingOwners = useMemo(
    () => users.filter((user) => user.role === 'owner' && user.ownerStatus === 'PENDING'),
    [users],
  );

  const filteredDirectory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return directory.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) {
        return false;
      }

      if (ownerStatusFilter !== 'ALL') {
        if (user.role !== 'owner' || user.ownerStatus !== ownerStatusFilter) {
          return false;
        }
      }

      if (billingFilter !== 'ALL') {
        if (user.role !== 'owner' || user.ownerBilling?.status !== billingFilter) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        user.displayName,
        user.email,
        user.role,
        user.ownerStatus,
        user.ownerBilling?.status,
        ...(user.complexes || []).map((complex) => complex.name),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [billingFilter, directory, ownerStatusFilter, roleFilter, search]);

  const handleApprove = async (userId) => {
    setUpdating(userId);

    try {
      await fetchAPI(`/users/${userId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ note: '' }),
      });
      await loadData();
    } catch (error) {
      alert(error.message || 'Error aprobando.');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;

    setUpdating(rejectModal.userId);

    try {
      await fetchAPI(`/users/${rejectModal.userId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectReason }),
      });

      setRejectModal(null);
      setRejectReason('');
      await loadData();
    } catch (error) {
      alert(error.message || 'Error rechazando.');
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const currentUser = directory.find((user) => user._id === userId) || users.find((user) => user._id === userId);
    if (currentUser?.role === 'superadmin' && newRole !== 'superadmin') {
      return;
    }

    setUpdating(userId);

    try {
      await fetchAPI(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await loadData();
    } catch (error) {
      alert(error.message || 'Error actualizando rol.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="animate-fade-in pb-10">
      <header className="mb-8 lg:mb-10">
        <h2 className="text-[2rem] sm:text-[2.5rem] font-display font-medium text-on_surface tracking-tight mb-1">
          Panel Superadmin
        </h2>
        <p className="text-on_surface_variant">
          Validacion de owners, directorio completo de usuarios y seguimiento de actividad.
        </p>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-8 lg:mb-10">
        {[
          { icon: Users, label: 'Total', value: stats.total, color: 'text-on_surface' },
          { icon: Shield, label: 'Superadmin', value: stats.superadmin, color: 'text-purple-400' },
          { icon: Building2, label: 'Owners', value: stats.owners, color: 'text-primary' },
          { icon: Clock, label: 'Pendientes', value: stats.pending, color: 'text-yellow-400' },
          { icon: User, label: 'Clientes', value: stats.clients, color: 'text-on_surface_variant' },
          { icon: CreditCard, label: 'Con deuda', value: stats.ownersWithDebt, color: 'text-red-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className={`bg-surface_container border rounded-[1.5rem] p-5 ${
              (label === 'Pendientes' && stats.pending > 0) || (label === 'Con deuda' && stats.ownersWithDebt > 0)
                ? 'border-yellow-400/30 bg-yellow-400/5'
                : 'border-outline_variant/10'
            }`}
          >
            <Icon size={18} className={`${color} mb-2 opacity-70`} />
            <p className="text-xs text-outline uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-outline_variant/10 pb-2">
        {[
          { id: 'pending', label: 'Solicitudes pendientes', badge: stats.pending },
          { id: 'directory', label: 'Directorio completo' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-all ${
              tab === item.id ? 'text-primary border-b-2 border-primary' : 'text-outline hover:text-on_surface'
            }`}
          >
            {item.label}
            {item.badge > 0 && (
              <span className="bg-yellow-400 text-black text-[0.6rem] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : tab === 'pending' ? (
        pendingOwners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 size={48} className="text-green-400/40 mb-4" strokeWidth={1} />
            <p className="text-on_surface_variant">No hay solicitudes pendientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOwners.map((user) => (
              <OwnerRequestCard
                key={user._id}
                user={user}
                updating={updating === user._id}
                onApprove={() => handleApprove(user._id)}
                onReject={() => setRejectModal({ userId: user._id, name: user.displayName })}
              />
            ))}
          </div>
        )
      ) : (
        <section className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_high overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-outline_variant/10 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por usuario, email o complejo..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 pl-9 pr-4 text-sm text-on_surface placeholder-outline focus:outline-none focus:border-primary/40 transition-all"
                />
              </div>

              <FilterSelect value={roleFilter} onChange={setRoleFilter}>
                <option value="ALL">Todos los roles</option>
                <option value="client">Clientes</option>
                <option value="owner">Owners</option>
                <option value="superadmin">Superadmin</option>
              </FilterSelect>

              <FilterSelect value={ownerStatusFilter} onChange={setOwnerStatusFilter}>
                <option value="ALL">Todo owner status</option>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
              </FilterSelect>

              <div className="flex gap-3">
                <FilterSelect value={billingFilter} onChange={setBillingFilter}>
                  <option value="ALL">Toda facturacion</option>
                  <option value="ACTIVE">Al dia</option>
                  <option value="GRACE">En gracia</option>
                  <option value="BLOCKED">Bloqueado</option>
                </FilterSelect>

                <button
                  type="button"
                  onClick={loadData}
                  className="shrink-0 p-2.5 rounded-xl bg-surface_container hover:bg-surface_container_highest transition-colors text-outline hover:text-primary"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>

          {filteredDirectory.length === 0 ? (
            <div className="text-center py-12 text-on_surface_variant">No hay resultados con esos filtros.</div>
          ) : (
            <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredDirectory.map((user) => (
                <DirectoryUserCard
                  key={user._id}
                  user={user}
                  updating={updating === user._id}
                  onApprove={() => handleApprove(user._id)}
                  onReject={() => setRejectModal({ userId: user._id, name: user.displayName })}
                  onRoleChange={handleRoleChange}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface_container_low rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-outline_variant/20">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-on_surface text-lg">Rechazar solicitud</h3>
              <button
                type="button"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-outline hover:text-on_surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-on_surface_variant text-sm mb-4">
              Vas a rechazar la solicitud de <span className="text-on_surface font-semibold">{rejectModal.name}</span>.
              Podes agregar un motivo opcional.
            </p>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ej: informacion incompleta, no cumple los requisitos..."
              rows={3}
              className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-3 px-4 text-sm text-on_surface placeholder-outline focus:outline-none focus:border-primary/40 transition-all mb-5"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 border border-outline_variant/20 text-on_surface_variant py-3 rounded-2xl text-sm hover:bg-surface_container_highest transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={Boolean(updating)}
                className="flex-1 bg-error text-white font-semibold py-3 rounded-2xl hover:brightness-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle size={16} /> Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-surface_container border border-outline_variant/15 rounded-xl py-2.5 pl-4 pr-9 text-sm text-on_surface appearance-none focus:outline-none focus:border-primary/40 transition-all"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
    </div>
  );
}

function DirectoryUserCard({ user, updating, onApprove, onReject, onRoleChange }) {
  const roleMeta = ROLE_STYLE[user.role] || ROLE_STYLE.client;
  const ownerMeta = user.role === 'owner' && user.ownerStatus ? OWNER_STATUS_STYLE[user.ownerStatus] : null;
  const billingMeta = BILLING_STYLE[user.ownerBilling?.status] || BILLING_STYLE.NOT_REQUIRED;
  const StatusIcon = ownerMeta?.icon;

  return (
    <article className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container_low p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-11 h-11 rounded-2xl shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-surface_container_highest flex items-center justify-center text-primary text-sm font-bold shrink-0">
                {user.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-on_surface truncate">{user.displayName}</p>
              <p className="text-sm text-outline break-all">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${roleMeta.cls}`}>
              {roleMeta.label}
            </span>

            {ownerMeta && StatusIcon && (
              <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold ${ownerMeta.cls}`}>
                <StatusIcon size={12} />
                {ownerMeta.label}
              </span>
            )}

            {user.role === 'owner' && (
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${billingMeta.cls}`}>
                {billingMeta.label}
              </span>
            )}
          </div>
        </div>

        <div className="w-full lg:w-auto">
          <RoleEditor
            user={user}
            updating={updating}
            onApprove={onApprove}
            onReject={onReject}
            onRoleChange={onRoleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        <MiniStat label="Reservas" value={user.metrics?.reservations?.total || 0} icon={Users} />
        <MiniStat label="Pedidos" value={user.metrics?.orders?.total || 0} icon={ShoppingBag} />
        <MiniStat label="Alta" value={formatDate(user.createdAt)} icon={Clock} />
        <MiniStat label="Ult. actividad" value={formatDate(user.metrics?.lastActivityAt)} icon={CheckCircle2} />
      </div>

      {user.role === 'owner' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoPanel
            title="Solicitud owner"
            rows={[
              { label: 'Responsable', value: user.ownerApplication?.fullName || '-' },
              { label: 'Telefono', value: user.ownerApplication?.contactPhone || user.phone || '-' },
              { label: 'Documento', value: `${user.ownerApplication?.documentType || '-'} ${user.ownerApplication?.documentNumber || ''}`.trim() },
              { label: 'Complejo', value: user.ownerApplication?.complexName || '-' },
              { label: 'Ciudad', value: user.ownerApplication?.city || '-' },
              { label: 'Canchas', value: user.ownerApplication?.courtsCount || 0 },
            ]}
            footer={
              user.ownerApplication?.websiteOrInstagram || user.ownerApplication?.notes ? (
                <div className="mt-3 space-y-2 text-sm text-on_surface_variant">
                  {user.ownerApplication?.websiteOrInstagram ? (
                    <p>
                      <span className="text-outline">Web / Instagram:</span>{' '}
                      {user.ownerApplication.websiteOrInstagram}
                    </p>
                  ) : null}
                  {user.ownerApplication?.notes ? (
                    <p>
                      <span className="text-outline">Notas:</span>{' '}
                      {user.ownerApplication.notes}
                    </p>
                  ) : null}
                </div>
              ) : null
            }
          />

          <InfoPanel
            title="Facturacion owner"
            rows={[
              { label: 'Estado', value: billingMeta.label },
              { label: 'Mensualidad', value: formatMoney(user.ownerBilling?.amount, user.ownerBilling?.currency) },
              { label: 'Bloqueo', value: formatDate(user.ownerBilling?.blockAt) },
              { label: 'Acceso hasta', value: formatDate(user.ownerBilling?.accessEndsAt) },
            ]}
          />

          <InfoPanel
            title="Complejos asignados"
            rows={[
              { label: 'Cantidad', value: user.complexes?.length || 0 },
              { label: 'Ultimo alta', value: formatDate(user.complexes?.[0]?.createdAt) },
            ]}
            footer={
              user.complexes?.length ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {user.complexes.map((complex) => (
                    <span
                      key={complex._id}
                      className={`text-xs px-3 py-1 rounded-full ${
                        complex.isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-red-400/10 text-red-400'
                      }`}
                    >
                      {complex.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-outline mt-3">Sin complejos asignados.</p>
              )
            }
          />
        </div>
      )}

      {user.role !== 'owner' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoPanel
            title="Actividad de reservas"
            rows={[
              { label: 'Confirmadas', value: user.metrics?.reservations?.confirmed || 0 },
              { label: 'Pendientes', value: user.metrics?.reservations?.pending || 0 },
              { label: 'Importe total', value: formatMoney(user.metrics?.reservations?.amount || 0) },
            ]}
          />

          <InfoPanel
            title="Actividad de tienda"
            rows={[
              { label: 'Pedidos completados', value: user.metrics?.orders?.completed || 0 },
              { label: 'Pedidos pendientes', value: user.metrics?.orders?.pending || 0 },
              { label: 'Importe total', value: formatMoney(user.metrics?.orders?.amount || 0) },
            ]}
          />
        </div>
      )}

      {user.ownerStatusNote && (
        <div className="mt-4 rounded-2xl border border-outline_variant/10 bg-surface_container px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-outline mb-1">Nota de validacion</p>
          <p className="text-sm text-on_surface_variant">{user.ownerStatusNote}</p>
        </div>
      )}
    </article>
  );
}

function UserIdentity({ user }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-surface_container_highest flex items-center justify-center text-primary text-xs font-bold shrink-0">
          {user.displayName?.charAt(0) || 'U'}
        </div>
      )}
      <span className="font-medium text-on_surface text-sm truncate">{user.displayName}</span>
    </div>
  );
}

function RoleEditor({ user, updating, onApprove, onReject, onRoleChange }) {
  const roleLocked = user.role === 'superadmin';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <select
          value={user.role}
          onChange={(event) => onRoleChange(user._id, event.target.value)}
          disabled={updating || roleLocked}
          className="bg-surface_container border border-outline_variant/20 text-on_surface text-sm rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_STYLE[role]?.label ?? role}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
      </div>

      {updating && <Loader2 size={14} className="animate-spin text-primary" />}

      {roleLocked && !updating && (
        <span className="text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-400/10 text-purple-300 border border-purple-400/20">
          Protegido
        </span>
      )}

      {user.role === 'owner' && user.ownerStatus === 'PENDING' && !updating && (
        <>
          <button
            type="button"
            onClick={onApprove}
            title="Aprobar"
            className="p-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors"
          >
            <CheckCircle2 size={14} />
          </button>
          <button
            type="button"
            onClick={onReject}
            title="Rechazar"
            className="p-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
          >
            <XCircle size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-surface_container px-4 py-3">
      <Icon size={14} className="text-outline mb-1" />
      <p className="text-[0.65rem] uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className="text-sm font-medium text-on_surface">{value}</p>
    </div>
  );
}

function InfoPanel({ title, rows, footer = null }) {
  return (
    <div className="rounded-[1.5rem] border border-outline_variant/10 bg-surface_container p-4">
      <h4 className="text-sm font-semibold text-on_surface mb-3">{title}</h4>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="flex items-center justify-between gap-4">
            <span className="text-sm text-outline">{row.label}</span>
            <span className="text-sm font-medium text-on_surface text-right">{row.value}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

function OwnerRequestCard({ user, updating, onApprove, onReject }) {
  const application = user.ownerApplication || {};

  return (
    <div className="bg-surface_container_low border border-yellow-400/15 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="relative shrink-0">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-12 h-12 rounded-2xl" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-surface_container_highest flex items-center justify-center text-primary font-bold text-xl">
            {user.displayName?.charAt(0) || 'U'}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
          <Clock size={10} className="text-black" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-on_surface">{user.displayName}</p>
        <p className="text-outline text-sm break-all">{user.email}</p>
        <p className="text-yellow-400/70 text-xs mt-1">
          Solicito ser owner · {formatDate(user.createdAt)}
        </p>
        <div className="mt-3 grid gap-2 text-sm text-on_surface_variant sm:grid-cols-2">
          <p><span className="text-outline">Responsable:</span> {application.fullName || '-'}</p>
          <p><span className="text-outline">Telefono:</span> {application.contactPhone || user.phone || '-'}</p>
          <p><span className="text-outline">Complejo:</span> {application.complexName || '-'}</p>
          <p><span className="text-outline">Ciudad:</span> {application.city || '-'}</p>
          <p><span className="text-outline">Documento:</span> {`${application.documentType || '-'} ${application.documentNumber || ''}`.trim()}</p>
          <p><span className="text-outline">Canchas:</span> {application.courtsCount || 0}</p>
        </div>
        {(application.websiteOrInstagram || application.notes) && (
          <div className="mt-3 rounded-2xl bg-surface_container px-4 py-3 text-sm text-on_surface_variant">
            {application.websiteOrInstagram ? (
              <p>
                <span className="text-outline">Web / Instagram:</span> {application.websiteOrInstagram}
              </p>
            ) : null}
            {application.notes ? (
              <p className="mt-1">
                <span className="text-outline">Notas:</span> {application.notes}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
        {updating ? (
          <div className="flex items-center justify-center px-4 py-2.5">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-400/10 text-green-400 border border-green-400/20 rounded-xl font-semibold text-sm hover:bg-green-400/20 transition-all"
            >
              <CheckCircle2 size={15} /> Aprobar
            </button>
            <button
              type="button"
              onClick={onReject}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-xl font-semibold text-sm hover:bg-red-400/20 transition-all"
            >
              <XCircle size={15} /> Rechazar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
