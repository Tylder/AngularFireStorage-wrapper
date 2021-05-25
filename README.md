# AngularFire Storage Wrapper

Angular class which wraps AngularFire Storage and provides methods to upload multiple files simultaneously while keeping track of their progress. 

AngularFire (https://github.com/angular/angularfire) is the official Angular Library for Firebase. 

AngularFire Storage provides a simple interface to upload/download files to your Firebase storage bucket.

```typescript
@Component({s
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
    ngFireStorageWrapper: AngularfireStorageWrapper; /* this is the wrapper */
    
    constructor(private angularFireStorage: AngularFireStorage) {
    
        /* initialize wrapper by giving it the AngularFireStorage instance */
        this.ngFireStorageWrapper = new AngularfireStorageWrapper(angularFireStorage);
    }
  
    uploadFiles(files: File[]): void  {
       /* create a list of paths where the files will be saved on the firebase storage bucket,
        * the paths must be in the same order as the files */
       const paths: string[] = [];
   
       files.forEach(file => {
         paths.push(`${file.name}`);
       }); 

        /* create GroupedUploadData object, the upload will start as soon as this object is created */
        const groupedUploadData: GroupedUploadData = this.ngFireStorageWrapper.uploadMultipleFiles(
          paths, files, [], { cacheControl: 'public, max-age=15552000' });

        groupedUploadData.uploadPercentageGrouped$.pipe(
          takeWhile(percentage => percentage < 100, true),
        ).subscribe(percentage => console.log(percentage));  /* log percentage */
    }   

}
```


## Demo
You can find a simple demo in projects/demo.

[Demo](https://angularfire-wrappers-demo.web.app/)

or 

> Steps to run locally:
> <ol>
>    <li>Clone this repo</li>
>    <li>Setup a firebase project and place the config 'firebaseConfig' here: projects/demo/src/environments/firebase-secure.ts and export it.</li>
>    <li>Run the following commands:</li>
> </ol>

```bash
npm install
npm run start
```

## Using the library

Import the library in any Angular application by running:

```bash
$ npm install --save angularfire-storage-wrapper 
```

and then from your Angular `AppModule`:

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';

// Import the library module
import {AngularfireStorageWrapperModule} from 'angularfire-storage-wrapper';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,

    // Specify AngularfireStorageWrapperModule library as an import
    AngularfireStorageWrapperModule
  ],
  providers: [],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
```

Once the library is imported, you can use it in your Angular application:

To see an example of how you can upload multiple files and keep track of progress checkout the demo app.

## License

MIT © [Daniel Lofgren](mailto:lofgrendaniel@hotmail.com)
