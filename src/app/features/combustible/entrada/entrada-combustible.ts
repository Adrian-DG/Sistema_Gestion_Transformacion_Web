import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, startWith } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Permiso } from '../../../core/auth/permisos';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { ArchivoSeleccionado, SelectorArchivo } from '../../../shared/formularios/selector-archivo';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import {
  CombustibleService,
  NOMBRE_COMBUSTIBLE,
  NuevaEntradaCombustible,
  TIPO_COMBUSTIBLE,
  TipoCombustible,
} from '../combustible.service';

type Adjunto = FormGroup<{
  tipoDocumentoId: FormControl<string | null>;
  archivo: FormControl<ArchivoSeleccionado | null>;
}>;

/** Fecha y hora local para datetime-local (yyyy-MM-ddTHH:mm), como la espera la API (sin zona). */
function ahoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** La recepción no puede registrarse con fecha futura (misma regla que la API). */
const noFutura: ValidatorFn = (control) =>
  control.value && control.value > ahoraLocal()
    ? { futura: 'La fecha de recepción no puede ser futura.' }
    : null;

/**
 * Entrada (recepción) de combustible al depósito: tipo (gasolina o gasoil), galones recibidos,
 * suplidor (de los registrados en el sistema) y factura. Suma a la existencia del tipo indicado;
 * al guardar se vuelve a Combustible.
 */
@Component({
  selector: 'app-entrada-combustible',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorArchivo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrada-combustible.html',
})
export class EntradaCombustible {
  private readonly combustible = inject(CombustibleService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly combustibles = Object.values(TIPO_COMBUSTIBLE);
  protected readonly nombreCombustible = NOMBRE_COMBUSTIBLE;
  protected readonly maximaFecha = ahoraLocal();

  protected readonly formulario = this.fb.group({
    tipoCombustible: this.fb.control<TipoCombustible | null>(null, Validators.required),
    galones: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fecha: [ahoraLocal(), [Validators.required, noFutura]],
    proveedorId: this.fb.control<string | null>(null, Validators.required),
    numeroFactura: ['', Validators.maxLength(50)],
    observacion: ['', Validators.maxLength(500)],
    adjuntos: this.fb.array<Adjunto>([]),
  });

  protected readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  /** null mientras carga; 'error' si no se pudieron consultar. */
  protected readonly proveedores = toSignal(
    this.combustible.proveedores().pipe(catchError(() => of('error' as const))),
    { initialValue: null },
  );
  protected readonly listaProveedores = computed(() => {
    const p = this.proveedores();
    return Array.isArray(p) ? p : [];
  });
  protected readonly ayudaProveedor = computed(() => {
    const p = this.proveedores();
    if (p === 'error') return 'No se pudieron cargar los suplidores. Recargue la página.';
    if (Array.isArray(p) && p.length === 0) {
      return 'No hay suplidores de combustible. Marque al proveedor como "Suplidor de combustible" en Proveedores.';
    }
    return '';
  });
  protected readonly puedeGestionarProveedores = computed(() =>
    this.auth.tiene(Permiso.GestionInventarioPiezas),
  );
  protected readonly existencias = toSignal(
    this.combustible.existencia().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly v = computed(() => {
    this.valores();
    return this.formulario.getRawValue();
  });

  protected existenciaDe(tipo: TipoCombustible | null) {
    return this.existencias()?.find((e) => e.tipoCombustible === tipo);
  }

  /** Existencia actual del tipo elegido y la que quedará al registrar la entrada. */
  protected readonly resultado = computed(() => {
    const { tipoCombustible, galones } = this.v();
    const actual = this.existenciaDe(tipoCombustible);
    if (!tipoCombustible || !actual) return null;
    return {
      actual: actual.existencia,
      final: actual.existencia + (galones && galones > 0 ? galones : 0),
    };
  });

  constructor() {
    // El primer adjunto se crea antes de que llegue el catálogo: se propone "Factura".
    this.catalogos
      .tiposDocumento()
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(),
      )
      .subscribe((tipos) => {
        const sugerido = tipos.find((t) => /factura/i.test(t.nombre))?.id;
        if (!sugerido) return;
        for (const adjunto of this.adjuntos.controls) {
          if (!adjunto.controls.tipoDocumentoId.value)
            adjunto.controls.tipoDocumentoId.setValue(sugerido);
        }
      });
  }

  protected get adjuntos(): FormArray<Adjunto> {
    return this.formulario.controls.adjuntos;
  }

  protected agregarAdjunto(): void {
    const sugerido = this.tiposDocumento().find((t) => /factura/i.test(t.nombre))?.id ?? null;
    this.adjuntos.push(
      this.fb.group({
        tipoDocumentoId: this.fb.control<string | null>(sugerido, Validators.required),
        archivo: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
      }),
    );
  }

  protected quitarAdjunto(indice: number): void {
    this.adjuntos.removeAt(indice);
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const entrada: NuevaEntradaCombustible = {
      tipoCombustible: v.tipoCombustible!,
      galones: v.galones!,
      fecha: v.fecha,
      proveedorId: v.proveedorId!,
      numeroFactura: v.numeroFactura.trim() || null,
      observacion: v.observacion.trim() || null,
      adjuntos: v.adjuntos.map((a) => ({
        tipoDocumentoId: a.tipoDocumentoId!,
        nombreArchivo: a.archivo!.nombreArchivo,
        contentType: a.archivo!.contentType,
        fileBase64: a.archivo!.fileBase64,
      })),
    };

    this.guardando.set(true);
    try {
      await firstValueFrom(this.combustible.registrarEntrada(entrada));
      this.notificaciones.exito(
        `Entrada registrada: ${entrada.galones} gal de ${NOMBRE_COMBUSTIBLE[entrada.tipoCombustible]}.`,
      );
      await this.router.navigate(['/combustible']);
    } catch (e) {
      this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
    } finally {
      this.guardando.set(false);
    }
  }
}
