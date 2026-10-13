import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { SIN_AVISO_ERROR, api } from '../api/api';
import { AlmacenLocal } from '../almacenamiento/almacen-local';
import { APARIENCIA_PREDETERMINADA, Apariencia, AparienciaGuardada } from './apariencia.model';
import { normalizarHex, textoSobre } from './colores';

const CLAVE = 'apariencia';
const ESPERA_PRIMERA_CARGA_MS = 4000;

/**
 * Logo, nombre y colores del sistema.
 *
 * Al iniciar aplica lo guardado en IndexedDB (sin esperar a la red, para que no haya parpadeo) y
 * luego consulta la API: si la versión cambió, descarga el logo, guarda todo y vuelve a aplicar.
 * Solo en la primera visita, sin nada guardado, espera a la API (con límite de tiempo).
 */
@Injectable({ providedIn: 'root' })
export class AparienciaService {
  private readonly http = inject(HttpClient);
  private readonly almacen = inject(AlmacenLocal);
  private readonly documento = inject(DOCUMENT);

  private readonly _apariencia = signal<Apariencia>(APARIENCIA_PREDETERMINADA);
  private readonly _logoUrl = signal<string | null>(null);

  readonly apariencia = this._apariencia.asReadonly();
  readonly logoUrl = this._logoUrl.asReadonly();
  readonly nombreCorto = computed(
    () => this._apariencia().nombreCorto || this._apariencia().nombreSistema,
  );

  async inicializar(): Promise<void> {
    const guardada = await this.almacen.obtener<AparienciaGuardada>(CLAVE);

    if (guardada) {
      this.aplicar(guardada.apariencia, guardada.logo);
      void this.sincronizar(guardada);
      return;
    }

    this.aplicar(APARIENCIA_PREDETERMINADA, null);
    await Promise.race([
      this.sincronizar(null),
      new Promise((resolve) => setTimeout(resolve, ESPERA_PRIMERA_CARGA_MS)),
    ]);
  }

  /**
   * Guarda y aplica una configuración recibida de la API (ej. la respuesta de una edición),
   * descargando el logo si cambió.
   */
  async actualizar(nueva: Apariencia): Promise<void> {
    const logo = nueva.tieneLogo ? await this.descargarLogo(nueva.version) : null;
    await this.almacen.guardar<AparienciaGuardada>(CLAVE, { apariencia: nueva, logo });
    this.aplicar(nueva, logo);
  }

  private async sincronizar(guardada: AparienciaGuardada | null): Promise<void> {
    try {
      const remota = await firstValueFrom(
        this.http
          .get<Apariencia>(api('configuracion/apariencia'), {
            context: new HttpContext().set(SIN_AVISO_ERROR, true),
          })
          .pipe(timeout(15000)),
      );

      // También se descarga de nuevo si el logo no se pudo obtener la vez anterior.
      const sinCambios =
        guardada !== null &&
        guardada.apariencia.version === remota.version &&
        guardada.apariencia.actualizadoEn === remota.actualizadoEn &&
        (!remota.tieneLogo || guardada.logo !== null);

      if (!sinCambios) {
        await this.actualizar(remota);
      }
    } catch {
      // Sin conexión con la API: se mantiene lo guardado o lo predeterminado.
    }
  }

  private async descargarLogo(version: number): Promise<Blob | null> {
    try {
      return await firstValueFrom(
        this.http.get(api(`configuracion/apariencia/logo?v=${version}`), {
          responseType: 'blob',
          context: new HttpContext().set(SIN_AVISO_ERROR, true),
        }),
      );
    } catch {
      return null;
    }
  }

  private aplicar(apariencia: Apariencia, logo: Blob | null): void {
    this._apariencia.set(apariencia);

    const anterior = this._logoUrl();
    if (anterior) URL.revokeObjectURL(anterior);
    const logoUrl = logo ? URL.createObjectURL(logo) : null;
    this._logoUrl.set(logoUrl);

    const raiz = this.documento.documentElement.style;
    const colores: [string, string, string | null][] = [
      ['--sgt-primario', apariencia.colorPrimario, '--sgt-primario-contraste'],
      ['--sgt-secundario', apariencia.colorSecundario, '--sgt-secundario-contraste'],
      ['--sgt-btn-primario', apariencia.colorBotonPrimario, '--sgt-btn-primario-texto'],
      ['--sgt-btn-secundario', apariencia.colorBotonSecundario, '--sgt-btn-secundario-texto'],
      ['--sgt-btn-peligro', apariencia.colorBotonPeligro, '--sgt-btn-peligro-texto'],
    ];

    for (const [variable, valor, variableTexto] of colores) {
      const hex = normalizarHex(valor);
      if (!hex) continue;
      raiz.setProperty(variable, hex);
      if (variableTexto) raiz.setProperty(variableTexto, textoSobre(hex));
    }

    this.documento
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', normalizarHex(apariencia.colorPrimario) ?? '#002D62');
    this.actualizarFavicon(logoUrl);
  }

  private actualizarFavicon(logoUrl: string | null): void {
    const icono = this.documento.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icono) return;

    icono.dataset['original'] ??= icono.href;
    icono.removeAttribute('type');
    icono.href = logoUrl ?? icono.dataset['original'];
  }
}
