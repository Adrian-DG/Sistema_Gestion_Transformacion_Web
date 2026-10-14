import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icono } from '../ui/icono/icono';

/** API del navegador para leer códigos con la cámara (Chrome/Edge en Android, macOS y ChromeOS). */
interface DetectorCodigos {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = new (opciones?: { formats?: string[] }) => DetectorCodigos;

const FORMATOS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
  'codabar',
  'qr_code',
];
const INTERVALO_MS = 250;

function constructorDetector(): ConstructorDetector | null {
  return (globalThis as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector ?? null;
}

/**
 * Campo para escanear códigos de barras. Los lectores USB/Bluetooth escriben el código y envían
 * Enter: en ese momento se emite `leido` y el campo se limpia para el siguiente escaneo. Si el
 * navegador lo permite, también lee con la cámara del dispositivo.
 *
 * ```html
 * <app-lector-codigo-barras (leido)="alEscanear($event)" />
 * ```
 */
@Component({
  selector: 'app-lector-codigo-barras',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex gap-2">
      <label class="relative flex-1">
        <span class="sr-only">{{ etiqueta() }}</span>
        <app-icono
          nombre="codigoBarras"
          [tamano]="18"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
        />
        <input
          #campo
          type="text"
          class="control pl-10 font-mono"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="done"
          [attr.id]="idControl()"
          [placeholder]="etiqueta()"
          (keydown.enter)="$event.preventDefault(); emitir(campo.value)"
        />
      </label>
      @if (conCamara) {
        <button
          type="button"
          class="btn btn-contorno"
          [attr.aria-pressed]="camaraActiva()"
          (click)="camaraActiva() ? detenerCamara() : iniciarCamara()"
        >
          <app-icono [nombre]="camaraActiva() ? 'cerrar' : 'camara'" [tamano]="18" />
          <span class="hidden sm:inline">{{ camaraActiva() ? 'Cerrar cámara' : 'Cámara' }}</span>
        </button>
      }
    </div>
    @if (camaraActiva()) {
      <div class="relative mt-2 overflow-hidden rounded-md bg-black">
        <video #video class="mx-auto max-h-64 w-full object-contain" muted playsinline></video>
        <span
          class="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80"
          aria-hidden="true"
        ></span>
        <p class="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs text-white">
          Apunte la cámara al código de barras
        </p>
      </div>
    }
    @if (errorCamara(); as error) {
      <p class="mt-1 text-xs text-red-600" role="alert">{{ error }}</p>
    }
  `,
})
export class LectorCodigoBarras {
  readonly etiqueta = input('Escanee o escriba el código de barras y presione Enter');
  readonly idControl = input<string>();
  readonly leido = output<string>();

  protected readonly conCamara = constructorDetector() !== null && !!navigator.mediaDevices;
  protected readonly camaraActiva = signal(false);
  protected readonly errorCamara = signal<string | null>(null);

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private flujo: MediaStream | null = null;
  private temporizador?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCamara());
  }

  /** Pone el foco en el campo, listo para el siguiente escaneo. */
  enfocar(): void {
    this.campo().nativeElement.focus();
  }

  protected emitir(valor: string): void {
    const codigo = valor.trim();
    this.campo().nativeElement.value = '';
    if (codigo) this.leido.emit(codigo);
  }

  protected async iniciarCamara(): Promise<void> {
    const Detector = constructorDetector();
    if (!Detector) return;
    this.errorCamara.set(null);

    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      this.errorCamara.set('No se pudo acceder a la cámara. Revise los permisos del navegador.');
      return;
    }

    this.camaraActiva.set(true);
    // El <video> aparece en el siguiente ciclo de detección de cambios.
    await new Promise((r) => setTimeout(r));
    const video = this.video()?.nativeElement;
    if (!video) return this.detenerCamara();
    video.srcObject = this.flujo;
    await video.play();

    const detector = new Detector({ formats: FORMATOS });
    let leyendo = false;
    this.temporizador = setInterval(async () => {
      if (leyendo || video.readyState < 2) return;
      leyendo = true;
      try {
        const [codigo] = await detector.detect(video);
        if (codigo?.rawValue) {
          this.detenerCamara();
          this.leido.emit(codigo.rawValue.trim());
        }
      } catch {
        // Un cuadro que no se pudo analizar; se intenta con el siguiente.
      } finally {
        leyendo = false;
      }
    }, INTERVALO_MS);
  }

  protected detenerCamara(): void {
    clearInterval(this.temporizador);
    this.flujo?.getTracks().forEach((t) => t.stop());
    this.flujo = null;
    this.camaraActiva.set(false);
  }
}

/** Busca la pieza por su código de barras o, si no lo tiene, por su código interno. */
export function buscarPorCodigo<T extends { codigo: string; codigoBarras: string | null }>(
  piezas: readonly T[],
  leido: string,
): T | null {
  const codigo = leido.trim().toUpperCase();
  return (
    piezas.find((p) => p.codigoBarras?.toUpperCase() === codigo) ??
    piezas.find((p) => p.codigo.toUpperCase() === codigo) ??
    null
  );
}
