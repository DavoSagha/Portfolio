/*
 * Marca "este navegador inició sesión hace poco" (D-032). No es secreta ni da permisos: solo
 * evita consultar /auth/me en cada visita. La sesión la valida siempre el backend.
 * Vive en localStorage, y no en una cookie, para que nunca viaje al servidor ni a una caché.
 */
const STORAGE_KEY = 'panel-session-hint';
const ROOT_ATTRIBUTE = 'data-session-hint';
const CHANGE_EVENT = 'panel-session-hint-change';

/**
 * Corre antes de pintar: oculta "Acceso" (sin quitarle su lugar) mientras se verifica la sesión.
 * Sin JavaScript no corre, y el enlace se ve normalmente.
 */
export const sessionHintInitScript = `try{if(localStorage.getItem('${STORAGE_KEY}'))document.documentElement.setAttribute('${ROOT_ATTRIBUTE}','')}catch(e){}`;

export function hasSessionHint() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Almacenamiento bloqueado: se comporta como un visitante sin marca.
    return false;
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setSessionHint() {
  if (hasSessionHint()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
    document.documentElement.setAttribute(ROOT_ATTRIBUTE, '');
  } catch {
    return;
  }
  notify();
}

export function clearSessionHint() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si no se puede leer tampoco se usa: no hay nada que limpiar.
  }
  revealAccessLink();
  notify();
}

/** Vuelve a mostrar "Acceso" sin borrar la marca, por ejemplo si la verificación falló por red. */
export function revealAccessLink() {
  document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
}

/** Avisa los cambios de esta pestaña y de las demás (evento `storage`). */
export function subscribeToSessionHint(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
