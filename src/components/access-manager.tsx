import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export type AccessRole = {
  id: string
  name: string
  description: string
  permissionIds: string[]
}
type Permission = { id: string; name: string; code: string }
export async function accessApi(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || 'Não foi possível concluir a operação.')
  return data
}
export function AccessManager({
  kind,
  canWrite,
}: {
  kind: 'roles' | 'permissions'
  canWrite: boolean
}) {
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    permissionIds: [] as string[],
  })
  const [formError, setFormError] = useState('')
  async function load() {
    setLoading(true)
    setError('')
    try {
      const [r, p] = await Promise.all([
        accessApi('/api/roles'),
        accessApi('/api/permissions'),
      ])
      setRoles(r)
      setPermissions(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await accessApi('/api/' + kind, editing === '' ? 'POST' : 'PUT', {
        ...form,
        id: editing,
      })
      setEditing(null)
      toast.success('Registro salvo.')
      await load()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const rows = (kind === 'roles' ? roles : permissions).filter((row) =>
    (row.name + ('code' in row ? row.code : ''))
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <section className="users-panel">
      <div className="panel-title">
        <div>
          <h2>
            {kind === 'roles' ? 'Regras de acesso' : 'Permissões'}{' '}
            <span>{rows.length}</span>
          </h2>
          <p>
            {kind === 'roles'
              ? 'Agrupe permissões e atribua uma ou mais regras a cada pessoa.'
              : 'Códigos únicos definem quais ações cada regra permite.'}
          </p>
        </div>
        {canWrite && (
          <button
            className="primary"
            onClick={() => {
              setForm({
                name: '',
                code: '',
                description: '',
                permissionIds: [],
              })
              setFormError('')
              setEditing('')
            }}
          >
            <Plus size={18} />
            {kind === 'roles' ? 'Nova regra' : 'Nova permissão'}
          </button>
        )}
      </div>
      <div className="table-controls">
        <input
          className="access-search"
          aria-label="Buscar regras ou permissões"
          placeholder="Buscar por nome ou código…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error ? (
        <div className="table-empty" role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={load}>
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="table-empty" aria-live="polite">
          Carregando registros…
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>
                  {kind === 'roles' ? 'Permissões agregadas' : 'Código único'}
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {'description' in row && <p>{row.description}</p>}
                  </td>
                  <td>
                    {'code' in row ? (
                      <code>{row.code}</code>
                    ) : (
                      <div className="permission-tags">
                        {row.permissionIds.length
                          ? row.permissionIds.map((id) => (
                              <code key={id}>
                                {permissions.find((p) => p.id === id)?.code}
                              </code>
                            ))
                          : 'Nenhuma permissão'}
                      </div>
                    )}
                  </td>
                  <td>
                    {canWrite && (
                      <div className="access-actions">
                        <button
                          className="icon-button"
                          aria-label={'Editar ' + row.name}
                          disabled={row.id.startsWith('seed-')}
                          onClick={() => {
                            setForm({
                              name: row.name,
                              code: 'code' in row ? row.code : '',
                              description:
                                'description' in row ? row.description : '',
                              permissionIds:
                                'permissionIds' in row ? row.permissionIds : [],
                            })
                            setFormError('')
                            setEditing(row.id)
                          }}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={row.id.startsWith('seed-')}
                          aria-label={'Excluir ' + row.name}
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="table-empty">
              <ShieldCheck size={28} />
              <h3>Nenhum registro encontrado</h3>
              <p>Adicione um registro ou ajuste a busca.</p>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null)
        }}
      >
        <DialogContent className="user-dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar' : 'Adicionar'}{' '}
              {kind === 'roles' ? 'regra' : 'permissão'}
            </DialogTitle>
            <DialogDescription>
              {kind === 'roles'
                ? 'Selecione as permissões que esta regra agrega.'
                : 'Use um código único no formato área:ação.'}
            </DialogDescription>
          </DialogHeader>
          <form className="user-form" onSubmit={save}>
            <label>
              Nome descritivo
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            {kind === 'permissions' ? (
              <label>
                Código único
                <input
                  required
                  maxLength={100}
                  placeholder="users:read"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
            ) : (
              <>
                <label>
                  Descrição
                  <input
                    maxLength={500}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <fieldset className="access-checks">
                  <legend>Permissões</legend>
                  {permissions.map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={form.permissionIds.includes(p.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            permissionIds: e.target.checked
                              ? [...form.permissionIds, p.id]
                              : form.permissionIds.filter((id) => id !== p.id),
                          })
                        }
                      />
                      <span>
                        {p.name}
                        <small>{p.code}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {formError && (
              <div className="error-message" role="alert">
                {formError}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Os vínculos deste registro serão removidos e os acessos serão
              recalculados.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await accessApi('/api/' + kind, 'DELETE', {
                    id: deleting?.id,
                  })
                  setDeleting(null)
                  toast.success('Registro excluído.')
                  await load()
                } catch (e) {
                  toast.error((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
