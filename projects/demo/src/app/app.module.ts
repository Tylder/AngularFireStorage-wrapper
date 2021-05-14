import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import {AngularFireModule} from '@angular/fire';
import {environment} from '../environments/environment';
import {AngularFireStorageModule} from '@angular/fire/storage';
import {AngularfireStorageWrapperModule} from '../../../angularfire-storage-wrapper/src/lib/angularfire-storage-wrapper.module';
import {LoadingBarModule} from '@ngx-loading-bar/core';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireStorageModule,
    AngularfireStorageWrapperModule,
    LoadingBarModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
