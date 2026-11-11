import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import {
  CombustibleService,
  DespachoTicket,
  TicketDespacho,
  normalizarCodigoTicket,
} from '../combustible.service';

/** API del navegador para leer códigos con la cámara (Chrome en Android y macOS). */
interface DetectorCodigos {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = new (opciones: { formats: string[] }) => DetectorCodigos;

const INTERVALO_CAMARA_MS = 250;

/**
 * Despacho de combustible por ticket. El operador escanea el código de barras del ticket (con un lector
 * de mano, que escribe el código y pulsa Enter, o con la cámara), revisa los datos y confirma. La API
 * registra la fecha y hora del despacho y el operador; un ticket ya utilizado muestra cuándo y quién lo
 * despachó.
 */
@Component({
  selector: 'app-despacho-combustible',
  imports: [DatePipe, DecimalPipe, RouterLink, EncabezadoPagina, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './despacho-combustible.html',
})
export class DespachoCombustible {
  private readonly combustible = inject(CombustibleService);

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly confirmar = viewChild<ElementRef<HTMLButtonElement>>('confirmar');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  /** Lo escrito o escaneado. */
  protected readonly codigo = signal('');
  /** Código con el que se encontró el ticket; es el que se envía al despachar. */
  private codigoLeido = '';
  protected readonly ticket = signal<TicketDespacho | null>(null);
  protected readonly receptor = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly buscando = signal(false);
  protected readonly despachando = signal(false);
  /** Último despacho confirmado, para mostrar la constancia en pantalla. */
  protected readonly ultimo = signal<DespachoTicket | null>(null);
  protected readonly despachos = signal<DespachoTicket[]>([]);

  protected readonly totales = computed(() => {
    const total = { Gasolina: 0, Gasoil: 0 };
    for (const d of this.despachos()) total[d.tipoCombustible] += d.galones;
    return total;
  });

  // Cámara
  private readonly Detector = (globalThis as { BarcodeDetector?: ConstructorDetector })
    .BarcodeDetector;
  protected readonly camaraDisponible =
    !!this.Detector && !!globalThis.navigator?.mediaDevices?.getUserMedia;
  protected readonly camaraActiva = signal(false);
  private flujo: MediaStream | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.cargarDespachos();
    inject(DestroyRef).onDestroy(() => this.detenerCamara());
  }

  private cargarDespachos(): void {
    this.combustible.despachosDeHoy().subscribe({
      next: (d) => this.despachos.set(d),
      error: () => this.despachos.set([]),
    });
  }

  /** Enter del lector o del teclado. */
  protected async buscar(): Promise<void> {
    const codigo = normalizarCodigoTicket(this.codigo());
    if (!codigo || this.buscando()) return;

    this.buscando.set(true);
    this.error.set(null);
    this.ultimo.set(null);
    this.ticket.set(null);
    this.receptor.set('');
    try {
      const ticket = await firstValueFrom(this.combustible.ticketDespacho(codigo));
      this.codigoLeido = codigo;
      this.ticket.set(ticket);
      this.codigo.set('');
      // Con el ticket listo, Enter confirma; si no se puede despachar, se vuelve a escanear.
      setTimeout(() =>
        (this.puedeDespachar() ? this.confirmar() : this.campo())?.nativeElement.focus(),
      );
    } catch (e) {
      this.error.set(esApiError(e) ? e.mensaje : 'No se pudo consultar el ticket.');
      this.seleccionarCampo();
    } finally {
      this.buscando.set(false);
    }
  }

  protected readonly puedeDespachar = computed(() => {
    const t = this.ticket();
    return !!t && t.estatus === 'Disponible' && !t.requiereCodigoVerificacion;
  });

  protected async despachar(): Promise<void> {
    const t = this.ticket();
    if (!t || !this.puedeDespachar() || this.despachando()) return;

    this.despachando.set(true);
    this.error.set(null);
    try {
      const despacho = await firstValueFrom(
        this.combustible.despachar(this.codigoLeido, this.receptor().trim() || null),
      );
      this.ultimo.set(despacho);
      this.despachos.update((d) => [despacho, ...d]);
      this.ticket.set(null);
      this.receptor.set('');
    } catch (e) {
      this.error.set(esApiError(e) ? e.mensaje : 'No se pudo despachar el ticket.');
    } finally {
      this.despachando.set(false);
      this.seleccionarCampo();
    }
  }

  /** Código de verificación escrito a mano (cuando el ticket se buscó solo por su número). */
  protected readonly verificacion = signal('');

  protected async verificar(): Promise<void> {
    const t = this.ticket();
    const codigo = this.verificacion().trim();
    if (!t || !codigo) return;
    this.codigo.set(`${t.numero}-${codigo}`);
    this.verificacion.set('');
    await this.buscar();
  }

  /** Descarta el ticket leído y vuelve al escaneo. */
  protected limpiar(): void {
    this.ticket.set(null);
    this.error.set(null);
    this.codigo.set('');
    this.receptor.set('');
    this.seleccionarCampo();
  }

  private seleccionarCampo(): void {
    setTimeout(() => this.campo().nativeElement.select());
  }

  // ---------------- Cámara ----------------

  protected async alternarCamara(): Promise<void> {
    if (this.camaraActiva()) {
      this.detenerCamara();
      return;
    }
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch {
      this.error.set('No se pudo usar la cámara. Revise el permiso del navegador o use el lector.');
      return;
    }
    this.camaraActiva.set(true);
    setTimeout(() => {
      const video = this.video()?.nativeElement;
      if (!video || !this.flujo) return;
      video.srcObject = this.flujo;
      void video.play();
      this.leerCamara(new this.Detector!({ formats: ['code_128'] }), video);
    });
  }

  private leerCamara(detector: DetectorCodigos, video: HTMLVideoElement): void {
    this.temporizador = setTimeout(async () => {
      if (!this.camaraActiva()) return;
      try {
        const [codigo] = await detector.detect(video);
        if (codigo?.rawValue) {
          this.detenerCamara();
          this.codigo.set(codigo.rawValue);
          await this.buscar();
          return;
        }
      } catch {
        // El video aún no tiene imagen; se reintenta.
      }
      this.leerCamara(detector, video);
    }, INTERVALO_CAMARA_MS);
  }

  private detenerCamara(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.flujo?.getTracks().forEach((t) => t.stop());
    this.flujo = null;
    this.camaraActiva.set(false);
  }
}
