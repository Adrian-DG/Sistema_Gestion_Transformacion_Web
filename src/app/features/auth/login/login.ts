import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { esApiError } from '../../../core/api/api';
import { AparienciaService } from '../../../core/apariencia/apariencia.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Campo } from '../../../shared/formularios/campo';
import { Marca } from '../../../layout/marca/marca';
import { Icono } from '../../../shared/ui/icono/icono';
import { Cargando } from '../../../shared/ui/cargando/cargando';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Campo, Marca, Icono, Cargando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  host: { class: 'flex min-h-dvh flex-col lg:flex-row' },
})
export class Login {
  protected readonly apariencia = inject(AparienciaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Ruta a la que volver después de iniciar sesión (query param `retorno`). */
  readonly retorno = input<string>();

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuario: ['', [Validators.required, Validators.maxLength(50)]],
    password: ['', [Validators.required]],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verPassword = signal(false);
  protected readonly anio = new Date().getFullYear();

  protected async ingresar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    try {
      const { usuario, password } = this.formulario.getRawValue();
      await this.auth.iniciarSesion(usuario.trim(), password);
      await this.router.navigateByUrl(this.destino());
    } catch (e) {
      this.error.set(esApiError(e) ? e.mensaje : 'No se pudo iniciar sesión. Intente nuevamente.');
      this.formulario.controls.password.reset();
    } finally {
      this.enviando.set(false);
    }
  }

  /** Solo se aceptan rutas internas, para no redirigir a sitios externos. */
  private destino(): string {
    const retorno = this.retorno();
    return retorno &&
      retorno.startsWith('/') &&
      !retorno.startsWith('//') &&
      !retorno.startsWith('/login')
      ? retorno
      : '/inicio';
  }
}
