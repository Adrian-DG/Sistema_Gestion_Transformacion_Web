import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { ArchivoSeleccionado, SelectorArchivo } from '../../../shared/formularios/selector-archivo';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { InventarioService, NuevaEntrada, moneda } from '../inventario.service';

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

/** Compra de piezas al inventario: proveedor, factura y una línea por pieza con su costo. */
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
  protected readonly piezas = toSignal(
    this.inventario.catalogoPiezas().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  private readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly totalEntrada = computed(() => {
    this.valores();
    return this.formulario
      .getRawValue()
      .lineas.reduce((t, l) => t + (l.cantidad ?? 0) * (l.costoUnitario ?? 0), 0);
  });

  constructor() {
    this.agregarLinea();
  }

  protected get lineas(): FormArray<Linea> {
    return this.formulario.controls.lineas;
  }

  protected unidad(piezaId: string | null): string {
    return this.piezas().find((p) => p.id === piezaId)?.unidadMedida ?? '';
  }

  protected agregarLinea(): void {
    this.lineas.push(
      this.fb.group({
        piezaId: this.fb.control<string | null>(null, Validators.required),
        cantidad: this.fb.control<number | null>(1, [Validators.required, Validators.min(0.01)]),
        costoUnitario: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(0),
        ]),
      }),
    );
  }

  protected quitarLinea(indice: number): void {
    this.lineas.removeAt(indice);
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.lineas.length === 0) {
      this.errorGeneral.set('Agregue al menos una pieza.');
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const ids = v.lineas.map((l) => l.piezaId);
    if (new Set(ids).size !== ids.length) {
      this.errorGeneral.set('Cada pieza debe aparecer una sola vez en la entrada.');
      return;
    }

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
