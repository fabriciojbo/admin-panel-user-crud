import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserCheck,
  UserX,
  X,
  Pencil,
  Trash2,
  LockKeyhole,
  ArrowUpRight,
  Layers,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { hydrateSession } from '@netlify/identity'
import { AccessManager, accessApi } from '@/components/access-manager'
import type { AccessRole } from '@/components/access-manager'

type User = {
  id: string
  name: string
  email: string
  role: string
  roles: { id: string; name: string }[]
  permissions: string[]
  active: boolean
  createdAt: string
}
type Form = {
  name: string
  email: string
  roleIds: string[]
  active: boolean
  password: string
}
const emptyForm: Form = {
  name: '',
  email: '',
  roleIds: [],
  active: true,
  password: '',
}
export const Route = createFileRoute('/')({ component: Home })
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || 'Não foi possível carregar os dados.')
  return data
}
function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Layers size={23} strokeWidth={2.2} />
      </span>
      <span>
        mega<span className="brand-dot">.</span>
      </span>
    </div>
  )
}
export function Home({ initialPage = 'dashboard' }: { initialPage?: string }) {
  const [me, setMe] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [records, setRecords] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const page = initialPage
  const [availableRoles, setAvailableRoles] = useState<AccessRole[]>([])
  const can = (code: string) =>
    !!me?.permissions?.some(
      (p) => p === code || p === code.split(':')[0] + ':*',
    )
  const userArea = can('users:read') || can('users:write')
  const roleArea = can('roles:read') || can('roles:write')
  const pageTitle =
    page === 'users'
      ? 'Usuários'
      : page === 'roles'
        ? 'Regras'
        : page === 'permissions'
          ? 'Permissões'
          : 'Visão geral'
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [filters, setFilters] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [formError, setFormError] = useState('')
  const [help, setHelp] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  async function load() {
    setLoading(true)
    setError('')
    try {
      setRecords(await api('/api/users'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    hydrateSession()
      .catch(() => null)
      .then(async (identity) => {
        const user: User = await api('/api/session')
        // Read the Identity JWT claims; intersect with live grants to honor revocations.
        const claims = identity?.appMetadata?.permissions
        if (Array.isArray(claims))
          user.permissions = user.permissions.filter((code) =>
            claims.some(
              (p) =>
                typeof p === 'string' &&
                (p === code || p === code.split(':')[0] + ':*'),
            ),
          )
        return user
      })
      .then((user: User) => {
        setMe(user)
        if (
          user.permissions?.some((p) => p === 'users:read' || p === 'users:*')
        )
          void load()
        if (
          user.permissions?.some((p) => p === 'roles:read' || p === 'roles:*')
        )
          void accessApi('/api/roles')
            .then(setAvailableRoles)
            .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])
  useEffect(() => {
    setCurrentPage(1)
    setSelected([])
  }, [query, tab, roleFilter])
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/session', 'POST', { email, password })
      window.location.href = '/'
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  async function signOut() {
    try {
      await api('/api/session', 'DELETE')
      window.location.href = '/'
    } catch {
      toast.error('Não foi possível sair. Tente novamente.')
    }
  }
  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModal(true)
  }
  function openEdit(user: User) {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      roleIds: user.roles.map((r) => r.id),
      active: user.active,
      password: '',
    })
    setFormError('')
    setModal(true)
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const saved = await api('/api/users', editing ? 'PUT' : 'POST', {
        ...form,
        ...(editing ? { id: editing.id } : {}),
      })
      if (saved.id === me?.id) setMe(await api('/api/session'))
      setModal(false)
      toast.success(
        editing ? 'Usuário atualizado.' : 'Usuário criado com sucesso.',
      )
      await load()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await api('/api/users', 'DELETE', { id: deleting.id })
      setDeleting(null)
      toast.success('Usuário excluído.')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const filtered = records.filter(
    (u) =>
      (u.name + u.email).toLowerCase().includes(query.toLowerCase()) &&
      (tab === 'all' || (tab === 'active' ? u.active : !u.active)) &&
      (roleFilter === 'all' || u.roles.some((r) => r.id === roleFilter)),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 8))
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8)
  const activeCount = records.filter((u) => u.active).length
  function exportCsv() {
    const list = selected.length
      ? filtered.filter((u) => selected.includes(u.id))
      : filtered
    const cell = (v: string) =>
      '"' + (/^[=+\-@]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"'
    const csv =
      '\uFEFF' +
      [
        ['Nome', 'E-mail', 'Perfil', 'Status'],
        ...list.map((u) => [
          u.name,
          u.email,
          u.roles.map((r) => r.name).join('; '),
          u.active ? 'Ativo' : 'Inativo',
        ]),
      ]
        .map((row) => row.map(cell).join(';'))
        .join('\r\n')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'usuarios-mega.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Lista exportada.')
  }
  if (booting)
    return (
      <div className="boot">
        <Brand />
        <div className="loading-line" />
        <p>Preparando seu espaço de trabalho...</p>
      </div>
    )
  if (!me)
    return (
      <div className="login-page">
        <section className="login-story">
          <Brand />
          <div className="story-content">
            <span className="eyebrow">SEU ESPAÇO DE GESTÃO</span>
            <h1>
              Organização que
              <br />
              conecta pessoas<span>.</span>
            </h1>
            <p>
              Uma visão clara da sua equipe.
              <br />
              Mais controle para o seu dia a dia.
            </p>
            <div className="story-visual">
              <div className="visual-top">
                <span className="tiny-brand">
                  <Layers size={17} /> workspace
                </span>
                <span className="visual-dots">•••</span>
              </div>
              <div className="visual-person">
                <span className="visual-avatar">A</span>
                <div>
                  <strong>Um time, muitas possibilidades.</strong>
                  <small>Todos os acessos em um só lugar</small>
                </div>
                <span className="visual-check">
                  <Check size={18} />
                </span>
              </div>
              <div className="visual-bars">
                <i />
                <i />
                <i />
              </div>
              <div className="visual-bottom">
                <span>
                  <span className="green-dot" /> Ambiente protegido
                </span>
                <ShieldCheck size={17} />
              </div>
            </div>
          </div>
          <div className="story-footer">
            MEGA ADMIN <span>Simples. Seguro. Centralizado.</span>
          </div>
        </section>
        <section className="login-form-area">
          <div className="login-form-wrap">
            <span className="login-lock">
              <LockKeyhole size={24} />
            </span>
            <span className="eyebrow muted">PAINEL ADMINISTRATIVO</span>
            <h2>Bem-vindo de volta</h2>
            <p>Acesse sua conta para gerenciar seu espaço.</p>
            <form onSubmit={signIn}>
              <label>
                E-mail
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Senha
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? 'Ocultar senha' : 'Mostrar senha'
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <button className="primary login-submit" disabled={busy}>
                {busy ? 'Entrando...' : 'Entrar no painel'}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="login-security">
              <ShieldCheck size={16} /> Seu acesso é pessoal e protegido.
            </div>
          </div>
          <footer>
            © {new Date().getFullYear()} Mega. Todos os direitos reservados.
          </footer>
        </section>
      </div>
    )
  return (
    <div className="app">
      <aside className={mobile ? 'sidebar open' : 'sidebar'}>
        <Brand />
        <div className="workspace">
          <span className="workspace-icon">M</span>
          <div>
            <strong>Workspace Mega</strong>
            <small>Painel administrativo</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-label">PRINCIPAL</div>
        <nav>
          <button
            className={page === 'dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              window.location.href = '/'
              setMobile(false)
            }}
          >
            <LayoutDashboard size={19} /> Visão geral
          </button>
          {userArea && (
            <button
              className={page === 'users' ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                window.location.href = '/users'
                setMobile(false)
              }}
            >
              <Users size={19} /> Usuários{' '}
              <span className="nav-count">{records.length}</span>
            </button>
          )}
          {roleArea && (
            <>
              <button
                className={page === 'roles' ? 'nav-item active' : 'nav-item'}
                onClick={() => {
                  window.location.href = '/roles'
                }}
              >
                <ShieldCheck size={19} /> Regras
              </button>
              <button
                className={
                  page === 'permissions' ? 'nav-item active' : 'nav-item'
                }
                onClick={() => {
                  window.location.href = '/permissions'
                }}
              >
                <LockKeyhole size={19} /> Permissões
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <ShieldCheck size={20} />
            </span>
            <strong>Gestão com segurança</strong>
            <p>
              O controle da sua equipe
              <br />
              começa por aqui.
            </p>
            <span className="system-online">
              <i /> Sistema operacional
            </span>
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Ajuda e suporte <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-version">
            MEGA ADMIN <span>v1.0</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <i /> Ambiente de produção
            </span>
            <span className="header-divider" />
            <DropdownMenu>
              <DropdownMenuTrigger className="profile">
                <span className="avatar my-avatar">{initials(me.name)}</span>
                <span className="profile-info">
                  <strong>{me.name}</strong>
                  <small>
                    {me.roles.map((r) => r.name).join(', ') || 'Sem regras'}
                  </small>
                </span>
                <ChevronDown size={15} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can('users:write') && (
                  <DropdownMenuItem onClick={() => openEdit(me)}>
                    <Pencil size={15} /> Meu perfil
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut size={15} /> Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main>
          <div className="page-kicker">
            <span /> GESTÃO DE ACESSOS
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {pageTitle}
                <span>.</span>
              </h1>
              <p>
                {page === 'users'
                  ? 'Gerencie as pessoas que fazem parte do seu workspace.'
                  : page === 'roles' || page === 'permissions'
                    ? 'Controle as áreas e ações disponíveis para cada pessoa.'
                    : `Bem-vindo, ${me.name}. Acompanhe a sua equipe em um só lugar.`}
              </p>
            </div>
            {can('users:write') &&
              (page === 'users' || page === 'dashboard') && (
                <button className="primary" onClick={openCreate}>
                  <Plus size={18} /> Novo usuário
                </button>
              )}
          </div>
          {(page === 'users' || page === 'dashboard') && can('users:read') && (
            <div className="stats-grid">
              {[
                {
                  label: 'Total de usuários',
                  value: records.length,
                  icon: Users,
                  detail: 'Pessoas no seu workspace',
                  color: 'mint',
                },
                {
                  label: 'Usuários ativos',
                  value: activeCount,
                  icon: UserCheck,
                  detail: 'Com acesso ao sistema',
                  color: 'green',
                },
                {
                  label: 'Usuários inativos',
                  value: records.length - activeCount,
                  icon: UserX,
                  detail: 'Acesso desativado',
                  color: 'gray',
                },
                {
                  label: 'Administradores',
                  value: records.filter((u) =>
                    u.roles.some((r) => r.id === 'seed-role-admin'),
                  ).length,
                  icon: ShieldCheck,
                  detail: 'Gerenciam o workspace',
                  color: 'sand',
                },
              ].map((stat) => (
                <div className="stat-card" key={stat.label}>
                  <div className="stat-top">
                    <span>{stat.label}</span>
                    <span className={'stat-icon ' + stat.color}>
                      <stat.icon size={19} />
                    </span>
                  </div>
                  <strong>
                    {loading ? '—' : String(stat.value).padStart(2, '0')}
                  </strong>
                  <small>
                    <span className={'stat-dot ' + stat.color} />
                    {stat.detail}
                  </small>
                </div>
              ))}
            </div>
          )}
          {((page === 'roles' || page === 'permissions') && !roleArea) ||
          (page === 'users' && !userArea) ? (
            <section className="users-panel member-panel" role="alert">
              <LockKeyhole size={30} />
              <h2>Privilégios insuficientes</h2>
              <p>
                Você não tem permissão para acessar esta área. Solicite acesso
                ao administrador.
              </p>
            </section>
          ) : page === 'roles' || page === 'permissions' ? (
            <AccessManager kind={page} canWrite={can('roles:write')} />
          ) : !can('users:read') ? (
            <section className="users-panel member-panel">
              <ShieldCheck size={30} />
              <h2>Seu acesso está ativo</h2>
              <p>
                As informações disponíveis dependem das permissões das suas
                regras. Solicite acesso de leitura para consultar usuários.
              </p>
            </section>
          ) : (
            <section className="users-panel">
              <div className="panel-title">
                <div>
                  <h2>
                    {page === 'users' ? 'Todos os usuários' : 'Sua equipe'}
                    <span>{records.length}</span>
                  </h2>
                  <p>Organize os acessos e mantenha sua equipe atualizada.</p>
                </div>
                <button className="secondary" onClick={exportCsv}>
                  <Download size={16} /> Exportar{' '}
                  <span className="desktop-word">lista</span>
                </button>
              </div>
              <div className="table-controls">
                <div className="tabs">
                  {[
                    { id: 'all', label: 'Todos', count: records.length },
                    { id: 'active', label: 'Ativos', count: activeCount },
                    {
                      id: 'inactive',
                      label: 'Inativos',
                      count: records.length - activeCount,
                    },
                  ].map((t) => (
                    <button
                      className={tab === t.id ? 'selected' : ''}
                      key={t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                      <span>{t.count}</span>
                    </button>
                  ))}
                </div>
                <div className="search-controls">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Buscar usuários"
                      placeholder="Buscar por nome ou e-mail..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="Limpar busca"
                        onClick={() => setQuery('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    className={
                      'secondary filter-button ' +
                      (filters ? 'filter-active' : '')
                    }
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={16} /> Filtros
                    {roleFilter !== 'all' && <i />}
                  </button>
                </div>
              </div>
              {filters && (
                <div className="filter-row">
                  <label>
                    Perfil de acesso
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="all">Todos os perfis</option>
                      {availableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      setRoleFilter('all')
                      setTab('all')
                      setQuery('')
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
              {error ? (
                <div className="table-empty">
                  <p role="alert">{error}</p>
                  <button className="secondary" onClick={load}>
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="check-cell">
                          <input
                            type="checkbox"
                            aria-label="Selecionar página"
                            checked={
                              visible.length > 0 &&
                              visible.every((u) => selected.includes(u.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? visible.map((u) => u.id)
                                  : [],
                              )
                            }
                          />
                        </th>
                        <th>
                          Usuário <ArrowDown size={13} />
                        </th>
                        <th>Perfil de acesso</th>
                        <th>Status</th>
                        <th>Data de cadastro</th>
                        <th className="actions-cell">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array.from({ length: 4 }, (_, i) => (
                            <tr key={i}>
                              <td colSpan={6}>
                                <div className="skeleton-row" />
                              </td>
                            </tr>
                          ))
                        : visible.map((user, i) => (
                            <tr
                              key={user.id}
                              className={
                                selected.includes(user.id) ? 'row-selected' : ''
                              }
                            >
                              <td className="check-cell">
                                <input
                                  type="checkbox"
                                  aria-label={'Selecionar ' + user.name}
                                  checked={selected.includes(user.id)}
                                  onChange={(e) =>
                                    setSelected(
                                      e.target.checked
                                        ? [...selected, user.id]
                                        : selected.filter(
                                            (id) => id !== user.id,
                                          ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <div className="user-cell">
                                  <span className={'avatar avatar-' + (i % 5)}>
                                    {initials(user.name)}
                                  </span>
                                  <div>
                                    <strong>
                                      {user.name}
                                      {me.id === user.id && (
                                        <span className="you">Você</span>
                                      )}
                                    </strong>
                                    <small>{user.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={
                                    'role-badge ' +
                                    (user.role === 'admin' ? 'admin-role' : '')
                                  }
                                >
                                  {user.role === 'admin' && (
                                    <ShieldCheck size={12} />
                                  )}{' '}
                                  {user.roles.map((r) => r.name).join(', ') ||
                                    'Sem regras'}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={
                                    'status-badge ' +
                                    (user.active ? 'is-active' : '')
                                  }
                                >
                                  <i />
                                  {user.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="date-cell">
                                {new Date(user.createdAt)
                                  .toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    timeZone: 'UTC',
                                  })
                                  .replaceAll(' de ', ' ')}
                              </td>
                              <td className="actions-cell">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    className="icon-button"
                                    aria-label={'Ações de ' + user.name}
                                  >
                                    <MoreHorizontal size={20} />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      disabled={!can('users:write')}
                                      onClick={() => openEdit(user)}
                                    >
                                      <Pencil size={15} /> Editar usuário
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={
                                        !can('users:write') ||
                                        user.id === me.id ||
                                        user.id === 'seed-admin'
                                      }
                                      onClick={() => setDeleting(user)}
                                      className="text-red-600"
                                    >
                                      <Trash2 size={15} /> Excluir usuário
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                  {!loading && visible.length === 0 && (
                    <div className="table-empty">
                      <Users size={30} />
                      <h3>Nenhum usuário encontrado</h3>
                      <p>
                        {query || tab !== 'all' || roleFilter !== 'all'
                          ? 'Ajuste a busca ou os filtros para encontrar usuários.'
                          : 'Adicione o primeiro usuário da sua equipe.'}
                      </p>
                      <button
                        className="secondary"
                        disabled={
                          !can('users:write') &&
                          !query &&
                          tab === 'all' &&
                          roleFilter === 'all'
                        }
                        onClick={
                          query || tab !== 'all' || roleFilter !== 'all'
                            ? () => {
                                setQuery('')
                                setTab('all')
                                setRoleFilter('all')
                              }
                            : openCreate
                        }
                      >
                        {query || tab !== 'all' || roleFilter !== 'all'
                          ? 'Limpar filtros'
                          : 'Adicionar usuário'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="pagination">
                <span>
                  {selected.length
                    ? `${selected.length} selecionado(s) · `
                    : ''}
                  Mostrando{' '}
                  <strong>
                    {filtered.length ? (currentPage - 1) * 8 + 1 : 0}–
                    {Math.min(currentPage * 8, filtered.length)}
                  </strong>{' '}
                  de <strong>{filtered.length}</strong> usuários
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft size={16} />
                    <span>Anterior</span>
                  </button>
                  <span className="page-number">{currentPage}</span>
                  <button
                    className="secondary"
                    disabled={currentPage >= pages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <span>Próxima</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}
          <div className="access-note">
            <span>
              <ShieldCheck size={17} /> Um workspace organizado começa com os
              acessos certos.
            </span>
            <span>
              Você está em um ambiente seguro <LockKeyhole size={13} />
            </span>
          </div>
        </main>
        <footer className="app-footer">
          <span>
            © {new Date().getFullYear()} Mega. Todos os direitos reservados.
          </span>
          <span>Feito para simplificar a sua gestão.</span>
        </footer>
      </div>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="user-dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar usuário' : 'Novo usuário'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize as informações e permissões de acesso.'
                : 'Adicione uma pessoa ao seu workspace.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="user-form">
            <label>
              Nome completo
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome e sobrenome"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nome@empresa.com"
              />
            </label>
            <label>
              {editing ? 'Nova senha (opcional)' : 'Senha de acesso'}
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required={!editing}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={
                  editing
                    ? 'Deixe em branco para manter a atual'
                    : 'Pelo menos 8 caracteres'
                }
              />
            </label>
            <div className="form-columns">
              <fieldset className="access-checks">
                <legend>Regras de acesso</legend>
                {!can('roles:write') && (
                  <small>
                    Alterar regras exige roles:write. As regras atuais serão
                    preservadas.
                  </small>
                )}
                {(availableRoles.length
                  ? availableRoles
                  : (editing?.roles ?? []).map((r) => ({
                      ...r,
                      description: '',
                      permissionIds: [],
                    }))
                ).map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      disabled={!can('roles:write')}
                      checked={form.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roleIds: e.target.checked
                            ? [...form.roleIds, r.id]
                            : form.roleIds.filter((id) => id !== r.id),
                        })
                      }
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Status
                <select
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.value === 'true' })
                  }
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>
            </div>
            {formError && (
              <div className="error-message" role="alert">
                {formError}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Salvando...'
                  : editing
                    ? 'Salvar alterações'
                    : 'Criar usuário'}
                <Check size={16} />
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário?</DialogTitle>
            <DialogDescription>
              O acesso de {deleting?.name} será removido permanentemente. Essa
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </button>
            <button className="danger" disabled={busy} onClick={remove}>
              {busy ? 'Excluindo...' : 'Excluir usuário'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seu espaço, sob controle.</DialogTitle>
            <DialogDescription>
              Gerencie os acessos da sua equipe com segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="help-content">
            <p>
              <strong>Adicionar pessoas</strong>
              <br />
              Clique em “Novo usuário” e informe nome, e-mail, senha e perfil de
              acesso.
            </p>
            <p>
              <strong>Gerenciar acessos</strong>
              <br />
              Use o menu de ações de cada pessoa para editar ou excluir.
              Usuários inativos não podem acessar o painel.
            </p>
            <p>
              <strong>Perfis</strong>
              <br />
              Regras agregam permissões. Uma pessoa pode receber várias regras;
              o acesso resulta da união das permissões. O administrador
              principal permanece protegido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
