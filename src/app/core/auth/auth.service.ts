import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SIN_AVISO_ERROR, api } from '../api/api';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuarioSesion, leerToken } from './jwt';
import { Permiso, cumplePermisos } from './permisos';

const CLAVE_TOKEN = 'sgt.token';
/** Margen para no enviar un token a punto de vencer. */
const MARGEN_VENCIMIENTO_MS = 30_000;

export type MotivoCierre = 'manual' | 'expirada' | 'no-autorizado';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  private readonly _token = signal<string | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  readonly token = this._token.asReadonly();
  readonly usuario = computed<UsuarioSesion | null>(() => {
    const token = this._token();
    return token ? leerToken(token) : null;
  });
  readonly autenticado = computed(() => this.usuario() !== null);
  readonly permisos = computed(() => this.usuario()?.permisos ?? []);

  constructor() {
    this.restaurar();

    // Mantiene sincronizadas las pestañas abiertas: cerrar sesión en una la cierra en todas.
    window.addEventListener('storage', (evento) => {
      if (evento.key !== CLAVE_TOKEN) return;

      const sesion = evento.newValue ? leerToken(evento.newValue) : null;
      if (evento.newValue && sesion) {
        this.establecer(evento.newValue, sesion);
      } else if (this._token()) {
        clearTimeout(this.temporizador);
        this._token.set(null);
        void this.router.navigate(['/login']);
      }
    });
  }

  async iniciarSesion(usuario: string, password: string): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post(
        api('authentication'),
        { username: usuario, password },
        { responseType: 'text', context: new HttpContext().set(SIN_AVISO_ERROR, true) },
      ),
    );

    // La API devuelve el token como texto plano o como cadena JSON según el Accept negociado.
    const token = respuesta.startsWith('"') ? (JSON.parse(respuesta) as string) : respuesta;
    const sesion = leerToken(token);
    if (!sesion) {
      throw new Error('La respuesta del servidor no contiene un token válido.');
    }

    this.establecer(token, sesion);
  }

  cerrarSesion(motivo: MotivoCierre = 'manual'): void {
    const habiaSesion = this._token() !== null;
    clearTimeout(this.temporizador);
    this._token.set(null);
    this.borrarGuardado();

    if (habiaSesion && motivo === 'expirada') {
      this.notificaciones.advertencia('Su sesión expiró. Inicie sesión nuevamente.');
    } else if (habiaSesion && motivo === 'no-autorizado') {
      this.notificaciones.advertencia('Su sesión ya no es válida. Inicie sesión nuevamente.');
    }

    const retorno = motivo === 'manual' ? undefined : this.router.url;
    void this.router.navigate(['/login'], {
      queryParams: retorno && !retorno.startsWith('/login') ? { retorno } : undefined,
    });
  }

  tiene(...requeridos: Permiso[]): boolean {
    return this.autenticado() && cumplePermisos(this.permisos(), requeridos);
  }

  private restaurar(): void {
    const token = this.leerGuardado();
    const sesion = token ? leerToken(token) : null;

    if (token && sesion && sesion.expira - MARGEN_VENCIMIENTO_MS > Date.now()) {
      this.establecer(token, sesion);
    } else if (token) {
      this.borrarGuardado();
    }
  }

  private establecer(token: string, sesion: UsuarioSesion): void {
    this._token.set(token);
    this.guardar(token);

    clearTimeout(this.temporizador);
    const restante = Math.max(sesion.expira - MARGEN_VENCIMIENTO_MS - Date.now(), 0);
    // setTimeout admite como máximo ~24,8 días.
    this.temporizador = setTimeout(
      () => this.cerrarSesion('expirada'),
      Math.min(restante, 2 ** 31 - 1),
    );
  }

  private leerGuardado(): string | null {
    try {
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  }

  private guardar(token: string): void {
    try {
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      // Sin almacenamiento: la sesión dura lo que la pestaña.
    }
  }

  private borrarGuardado(): void {
    try {
      localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      // Ignorado.
    }
  }
}
