// Acesso seguro ao localStorage: pode estar bloqueado (modo privado, políticas do navegador).
// Todas as funções aceitam um `storage` alternativo (usado nos testes).

function resolve(storage) {
  return storage ?? window.localStorage
}

export function readText(key, storage) {
  try {
    return resolve(storage).getItem(key)
  } catch {
    return null
  }
}

// Retorna false se não foi possível gravar (sem armazenamento ou espaço esgotado).
export function writeText(key, value, storage) {
  try {
    resolve(storage).setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function readJSON(key, storage) {
  try {
    const raw = readText(key, storage)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeJSON(key, value, storage) {
  return writeText(key, JSON.stringify(value), storage)
}

export function removeKey(key, storage) {
  try {
    resolve(storage).removeItem(key)
  } catch {
    // Sem armazenamento disponível: nada a remover.
  }
}

export function listKeys(prefix, storage) {
  try {
    const target = resolve(storage)
    const keys = []
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}
