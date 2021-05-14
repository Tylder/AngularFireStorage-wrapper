import {AngularFireStorage, AngularFireStorageReference} from '@angular/fire/storage';
import {UploadMetadata, UploadTaskSnapshot} from '@angular/fire/storage/interfaces';
import {AngularFireUploadTask} from '@angular/fire/storage/task';
import {filter, map, startWith, switchMap, takeLast, tap} from 'rxjs/operators';
import {combineLatest, merge, Observable} from 'rxjs';
import firebase from 'firebase/app';


/**
 * Use LoadingBarService:
 *
 * const loader = this.loadingBar.useRef();
 * groupedUploadData.uploadPercentageGrouped$.pipe(
 *    takeWhile(percentage => percentage < 100, true),
 *    finalize(() => loader.complete()),
 *    tap(percentage => console.log(percentage))
 * )
 * .subscribe(percentage => loader.set(percentage));
 */


export interface CompletedUpload {
  ref: AngularFireStorageReference;
  file: File;
  metadata: firebase.storage.FullMetadata;
  downloadUrl: string;
  downloadUrlNoToken: string;

  idData: any;
}

/* Data required to track the upload of a file */
export interface UploadData {
  task: AngularFireUploadTask;
  ref: AngularFireStorageReference;
  file: File;
  requestedPath: string;  // the path given when we uploaded the file, not the download url
  requestedMetadata: UploadMetadata; // the metadata given when we uploaded the file, not necessarily up to date


  /* Data to show the progress of an upload and the the final downloadUrl given once the upload is complete,
  * For more control you can use the task object found in the UploadData,
  * Created by adding  uploadPercentage$, snapshot$ and downloadUrl$ to UploadData for easier use and tracking */
  uploadPercentage$: Observable<number | undefined>; /* Just a shortcut to task.percentageChanges()*/
  snapshot$: Observable<UploadTaskSnapshot | undefined>; /* Just a shortcut to task.snapshotChanges()*/

  completedUpload$: Observable<CompletedUpload>; /* Emits once when the upload is complete, this object could be the only thing you care
                                                   about if you dont wish to track or manipulate the upload */

  idData?: any; /* This will no be used when saving the file, its just meant to help you identify the file once its uploaded using the
                  completedUpload info, for example where the url should be saved once its done.*/
}


/* Used when you are uploading multiple files, uploadPercentageGrouped$ contains the the total of all
   uploadPercentage$ / basicUploadTaskDatas */
export interface GroupedUploadData {
  uploadDatas: UploadData[];
  uploadPercentageGrouped$: Observable<number>;
  completedUploadsGrouped$: Observable<CompletedUpload[]>; /* emits once ALL uploads are complete and will emit the completedUploads */
  completedUploadsIndividual$: Observable<CompletedUpload>; /* emits once for each upload that finishes */
}


export class AngularfireStorageWrapper {

  constructor(protected storageFs: AngularFireStorage) {}

  /**
   * Will start upload of file immediately, will return an UploadData object containing all items to manipulate and track upload.
   * If you only care about the result then just subscribe to completedUpload$
   */
  uploadFile(file: File, path: string, idData?: any, metadata?: UploadMetadata): UploadData {
    if (metadata === undefined) { metadata = {}; }

    const uploadData = this.createUploadData(file, path, idData, metadata);

    return uploadData;
  }


  /**
   * Takes a file, path and metadata and creates the UploadData object.
   * In order to actually upload this file to fireStorage you will need to subscribe to uploadData.task.snapshotChanges()
   */
  createUploadData(file: File, path: string, idData?: any, metadata?: UploadMetadata): UploadData {
    if (metadata === undefined) { metadata = {}; }

    const ref = this.storageFs.ref(path);

    const task = ref.put(file, metadata);

    /* completedUpload */
    const completedUpload$: Observable<CompletedUpload> = task.snapshotChanges().pipe(
      // tslint:disable-next-line:variable-name
      filter((_task: UploadTaskSnapshot | undefined) => _task.state === firebase.storage.TaskState.SUCCESS),
      // tslint:disable-next-line:variable-name
      // tap((_task: UploadTaskSnapshot | undefined) => console.log(_task.state)),
      /* it should emit more than once even though the TaskState == SUCCESS...the last one will contain the full metadata */
      takeLast(1),
      /* switch into getting downloadUrl */
      // tslint:disable-next-line:variable-name
      switchMap((_task: UploadTaskSnapshot | undefined) => {

        return ref.getDownloadURL().pipe(
          // tap(url => console.log(url)),
          map((downloadUrl) => { /* create completeUpload */
            const completeUpload: CompletedUpload = {
              ref,
              file,
              idData,
              metadata: _task.metadata,
              downloadUrl,
              downloadUrlNoToken: this.downloadUrlWithoutToken(downloadUrl)
            };

            return completeUpload;
          })
        );
      }),
    );

    const uploadData: UploadData = {
      task,
      ref,
      file,
      idData,
      requestedPath: path,
      requestedMetadata: metadata,
      uploadPercentage$: task.percentageChanges(),
      snapshot$: task.snapshotChanges(),
      completedUpload$
    };

    return uploadData;
  }

  uploadMultipleFiles(path: string | string[], files: FileList | File[], idDatas: {[key: string]: any}[] = [], metadata = {}):
    GroupedUploadData {

    const uploadDatas: UploadData[] = [];

    if (files instanceof FileList) {
      files = Array.from(files);
    }

    files.forEach((file, index) => {

      let usedPath: string;

      if (typeof path === 'string') {
        usedPath = `${path}/${file.name}`;
      } else {
        usedPath = path[index];
      }

      let idData = {index};

      /* if idDatas are given */
      if (idDatas.length === files.length) {
        idData = {...idDatas[index], index};
      }

      const fileUploadData: UploadData = this.uploadFile(file, usedPath, idData, metadata);

      uploadDatas.push(fileUploadData);
    });

    return this.groupTogetherMultipleUploadDatas(uploadDatas);
  }


  groupTogetherMultipleUploadDatas(uploadDatas: UploadData[]): GroupedUploadData {
    /* Takes an array of BasicUploadTaskData and groups the uploadPercentages to give a all together percentage */

    const uploadPercentagesList$: Observable<number>[] = [];
    const completedUploadsList$: Observable<CompletedUpload>[] = [];

    uploadDatas.forEach((uploadData) => {
      /* percentage */
      const uploadPercentage$ = uploadData.uploadPercentage$.pipe(
        startWith(0), // we gotta start with 0
      );
      uploadPercentagesList$.push(uploadPercentage$);

      /* completedUploads */
      const completedUpload$ = uploadData.completedUpload$;
      completedUploadsList$.push(completedUpload$);
    });

    /* percentage */
    const uploadPercentageGrouped$: Observable<number> = combineLatest(uploadPercentagesList$).pipe(
      // tap(percentages => console.log(percentages)),
      map((percentages) => percentages.reduce((a, b) => a + b, 0)),
      map((totalPercentage: number) => totalPercentage / uploadPercentagesList$.length),
      // tap(percentages => console.log(percentages)),
    );

    /* completedUploads Grouped */
    const completedUploadsGrouped$: Observable<CompletedUpload[]> = combineLatest(completedUploadsList$).pipe(
      // tap(comp => console.log(comp)),
    );

    /* completedUploads Individual */
    const completedUploadsIndividual$: Observable<any> = merge(...completedUploadsList$).pipe(
      // tap(comp => console.log(comp)),
    );

    const groupedUploadData: GroupedUploadData = {
      uploadDatas,
      uploadPercentageGrouped$,
      completedUploadsGrouped$,
      completedUploadsIndividual$
    };

    return groupedUploadData;
  }

  downloadUrlWithoutToken(downloadUrl: string): string {
    /* Meant to be used when you just want the downloadUrl for storing longterm for speed
     *  instead of asking for a new url and token each time. Less safe but much faster. Only to be used when the files are public */
    return downloadUrl.split('&token')[0];
  }

  deleteFile$(path: string): Observable<any> {
    return this.storageFs.ref(path).delete();
  }




}
