import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Confirmacion } from './shared/ui/confirmacion/confirmacion';
import { Toasts } from './shared/ui/toasts/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirmacion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toasts />
    <app-confirmacion />
  `,
})
export class App {}
