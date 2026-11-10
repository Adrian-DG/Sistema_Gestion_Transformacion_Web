import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, startWith } from 'rxjs';
import { CatalogosService, TIPOS_OPERACION } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import {
  LectorCodigoBarras,
  buscarPorCodigo,
} from '../../../shared/formularios/lector-codigo-barras';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { ArchivoSeleccionado, SelectorArchivo } from '../../../shared/formularios/selector-archivo';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { InventarioService, NuevaEntrada, PiezaCatalogo, moneda } from '../inventario.service';
import { BuscadorPieza } from './buscador-pieza';
import { InicioPiezaRapida, PiezaRapida } from './pieza-rapida';

type Linea = FormGroup<{
  piezaId: FormControl<string | null>;
  cantidad: FormControl<number | null>;
  costoUnitario: FormControl<number | null>;
}>;

/** Fecha local de hoy (yyyy-MM-dd) para el campo de fecha. */
function hoy(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Compra de piezas al inventario: proveedor, factura y una línea por pieza con su costo. Las piezas se
 * agregan buscándolas por código o nombre, o escaneando su código de barras: si ya están en la entrada
 * se suma a su cantidad; si no existen, se registran ahí mismo (registro rápido) y se agregan.
 */
@Component({
  selector: 'app-entrada-formulario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorArchivo,
    LectorCodigoBarras,
    BuscadorPieza,
    PiezaRapida,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrada-formulario.html',
})
export class EntradaFormulario {
  private readonly inventario = inject(InventarioService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly moneda = moneda;
  protected readonly hoy = hoy();

  protected readonly formulario = this.fb.group({
    proveedorId: this.fb.control<string | null>(null, Validators.required),
    numeroFactura: ['', Validators.maxLength(50)],
    fecha: [hoy(), Validators.required],
    observacion: ['', Validators.maxLength(500)],
    lineas: this.fb.array<Linea>([]),
    factura: this.fb.control<ArchivoSeleccionado | null>(null),
  });

  protected readonly proveedores = toSignal(
    this.inventario.catalogoProveedores().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly piezas = signal<PiezaCatalogo[]>([]);
  private readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento(TIPOS_OPERACION.EntradaPieza).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  /** Registro rápido de una pieza que no existe (abierto con lo buscado o escaneado). */
  protected readonly nuevaPieza = signal<InicioPiezaRapida | null>(null);
  private readonly buscador = viewChild(BuscadorPieza);

  /** Ids de las piezas ya agregadas (el buscador indica que elegirlas suma). */
  protected readonly enEntrada = computed(() => {
    this.valores();
    return this.lineas.controls.map((l) => l.controls.piezaId.value!).filter(Boolean);
  });

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly totalEntrada = computed(() => {
    this.valores();
    return this.formulario
      .getRawValue()
      .lineas.reduce((t, l) => t + (l.cantidad ?? 0) * (l.costoUnitario ?? 0), 0);
  });

  constructor() {
    void this.cargarPiezas();
  }

  private async cargarPiezas(): Promise<void> {
    this.piezas.set(
      await firstValueFrom(this.inventario.catalogoPiezas().pipe(catchError(() => of([])))),
    );
  }

  protected get lineas(): FormArray<Linea> {
    return this.formulario.controls.lineas;
  }

  protected pieza(piezaId: string | null): PiezaCatalogo | undefined {
    return this.piezas().find((p) => p.id === piezaId);
  }

  protected subtotal(linea: Linea): number {
    return (linea.controls.cantidad.value ?? 0) * (linea.controls.costoUnitario.value ?? 0);
  }

  protected async escanear(leido: string): Promise<void> {
    let pieza = buscarPorCodigo(this.piezas(), leido);
    if (!pieza) {
      // Puede haberse registrado en otra pestaña después de abrir el formulario.
      await this.cargarPiezas();
      pieza = buscarPorCodigo(this.piezas(), leido);
    }
    if (pieza) this.agregarPieza(pieza);
    else this.nuevaPieza.set({ codigoBarras: leido.trim() });
  }

  /**
   * Agrega la pieza a la entrada o, si ya está, suma 1 a su cantidad. El foco va al costo (pieza nueva
   * en la entrada) o a la cantidad (pieza repetida) para seguir sin el ratón.
   */
  protected agregarPieza(pieza: PiezaCatalogo): void {
    const indice = this.lineas.controls.findIndex((l) => l.controls.piezaId.value === pieza.id);
    if (indice >= 0) {
      const cantidad = this.lineas.at(indice).controls.cantidad;
      cantidad.setValue((cantidad.value ?? 0) + 1);
      this.notificaciones.info(`${pieza.nombre}: ahora ${cantidad.value} ${pieza.unidadMedida}.`);
      this.enfocar(`cantidad-${indice}`);
      return;
    }

    this.lineas.push(
      this.fb.group({
        piezaId: this.fb.control<string | null>(pieza.id, Validators.required),
        cantidad: this.fb.control<number | null>(1, [Validators.required, Validators.min(0.01)]),
        costoUnitario: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(0),
        ]),
      }),
    );
    this.enfocar(`costo-${this.lineas.length - 1}`);
  }

  /** Pieza registrada desde la entrada: entra al catálogo y a la entrada. */
  protected piezaCreada(pieza: PiezaCatalogo): void {
    this.piezas.update((piezas) =>
      [...piezas, pieza].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    this.nuevaPieza.set(null);
    this.notificaciones.exito(`Pieza ${pieza.codigo} registrada y agregada a la entrada.`);
    this.agregarPieza(pieza);
  }

  protected cancelarNuevaPieza(): void {
    this.nuevaPieza.set(null);
    this.buscador()?.enfocar();
  }

  private enfocar(id: string): void {
    setTimeout(() => {
      const campo = document.getElementById(id) as HTMLInputElement | null;
      campo?.focus();
      campo?.select();
    });
  }

  protected quitarLinea(indice: number): void {
    this.lineas.removeAt(indice);
    this.buscador()?.enfocar();
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.lineas.length === 0) {
      this.errorGeneral.set(
        'Agregue al menos una pieza: búsquela por código o nombre, o escanéela.',
      );
      this.buscador()?.enfocar();
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const tipoFactura = this.tiposDocumento().find((t) => /^factura$/i.test(t.nombre))?.id;
    const entrada: NuevaEntrada = {
      proveedorId: v.proveedorId!,
      numeroFactura: v.numeroFactura.trim() || null,
      fecha: v.fecha === this.hoy ? null : `${v.fecha}T00:00:00`,
      observacion: v.observacion.trim() || null,
      lineas: v.lineas.map((l) => ({
        piezaId: l.piezaId!,
        cantidad: l.cantidad!,
        costoUnitario: l.costoUnitario!,
      })),
      adjuntos:
        v.factura && tipoFactura
          ? [
              {
                tipoDocumentoId: tipoFactura,
                nombreArchivo: v.factura.nombreArchivo,
                contentType: v.factura.contentType,
                fileBase64: v.factura.fileBase64,
              },
            ]
          : [],
    };

    this.guardando.set(true);
    try {
      await firstValueFrom(this.inventario.registrarEntrada(entrada));
      this.notificaciones.exito(
        'Entrada registrada; la existencia de las piezas quedó actualizada.',
      );
      await this.router.navigate(['/inventario-piezas/entradas']);
    } catch (e) {
      this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
    } finally {
      this.guardando.set(false);
    }
  }
}
