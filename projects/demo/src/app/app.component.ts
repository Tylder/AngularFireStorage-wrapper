import {Component, HostListener, OnDestroy} from '@angular/core';
import {AngularFireStorage, AngularFireStorageReference} from '@angular/fire/storage';
import {
  AngularfireStorageWrapper,
  CompletedUpload,
  GroupedUploadData
} from '../../../angularfire-storage-wrapper/src/lib/angularfire-storage-wrapper';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {finalize, map, switchMap, takeWhile, tap} from 'rxjs/operators';
import {BehaviorSubject, forkJoin} from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  maxIndividualFileSizeMb = 2.0;
  maxTotalFileSizeMb = 10.0;

  ngFireStorageWrapper: AngularfireStorageWrapper; /* this is the wrapper */

  completedUploads$: BehaviorSubject<CompletedUpload[]> = new BehaviorSubject<CompletedUpload[]>([]);
  errorMessage$: BehaviorSubject<string> = new BehaviorSubject<string>('');

  constructor(private angularFireStorage: AngularFireStorage,
              private loadingBar: LoadingBarService) {

    /* initialize wrapper by giving it the AngularFireStorage instance */
    this.ngFireStorageWrapper = new AngularfireStorageWrapper(angularFireStorage);
  }

  /* delete uploaded files on beforeunload */
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event): void {
    if (this.completedUploads$.getValue().length > 0) {
      this.deleteAllUploadedFiles();
    }
  }

  ngOnDestroy(): void {
    this.deleteAllUploadedFiles();
  }

  fileUpload(event: any): void {

    this.errorMessage$.next(''); /* reset error message */

    let files: FileList | File[] = event.target.files;

    if (files.length <= 0) { return; }

    if (files instanceof FileList) {
      files = Array.from(files);
    }

    // console.log(files);
    // console.log(event);

    /* file size checks  */
    const fileSizesMb = files.map(file => file.size / Math.pow(10, 6));

    console.log(fileSizesMb);

    if (fileSizesMb.find(size => size > this.maxIndividualFileSizeMb)) {
      this.errorMessage$.next('File size too large');
      return;
    }

    if (fileSizesMb.reduce((a, b) => a + b) > this.maxTotalFileSizeMb) {
      this.errorMessage$.next('Total file size too large');
      return;
    }

    /* create a list of paths where the files will be saved on the firebase storage bucket,
     * the paths must be in the same order as the files */
    const paths: string[] = [];

    files.forEach(file => {
      paths.push(`${file.name}`);
    });

    /* create GroupedUploadData object, the upload will start as soon as this object is created */
    const groupedUploadData: GroupedUploadData = this.ngFireStorageWrapper.uploadMultipleFiles(
      paths, files, [], { cacheControl: 'public, max-age=15552000' });

    /* LOADING BAR */
    const loadingBar = this.loadingBar.useRef();
    loadingBar.start(0);

    groupedUploadData.uploadPercentageGrouped$.pipe(
      takeWhile(percentage => percentage < 100, true),
      finalize(() => loadingBar.complete()),
      tap(percentage => console.log(percentage)),
      tap(percentage => loadingBar.set(percentage)),
    ).subscribe();

    groupedUploadData.completedUploadsIndividual$.pipe(
      tap(val => console.log(val)),
    ).subscribe(completedUpload => this.addCompletedUpload(completedUpload));

    groupedUploadData.completedUploadsGrouped$.pipe(
      tap(val => console.log(val)),

    ).subscribe();
  }

  deleteAllUploadedFiles(): void {
    this.completedUploads$.pipe(
      map((uploads: CompletedUpload[]) => uploads.map(upload => upload.ref)),
      switchMap((refs: AngularFireStorageReference[]) => forkJoin( refs.map(ref => ref.delete()) ) ),
      tap(() => this.completedUploads$.next([]))
    ).subscribe();
  }

  addCompletedUpload(upload: CompletedUpload): void  {
    const completedUploads: CompletedUpload[] = this.completedUploads$.getValue();

    /* if upload not already in completedUploads then add it */
    // tslint:disable-next-line:variable-name
    if (completedUploads.findIndex(_upload => _upload.downloadUrlNoToken === upload.downloadUrlNoToken) === -1) {
      completedUploads.push(upload);
      this.completedUploads$.next(completedUploads);
    }
  }

}
