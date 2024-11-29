import { useControllableState } from "@/hooks/use-controllable-state";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";
import { UploadIcon } from "lucide-react";
import * as React from "react";
import Dropzone, {
  type DropzoneProps,
  type FileRejection,
} from "react-dropzone";
import { toast as sonner } from "sonner";
interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Value of the uploader.
   * @type File[]
   * @default undefined
   * @example value={files}
   */
  value?: File[];

  /**
   * Function to be called when the value changes.
   * @type (files: File[]) => void
   * @default undefined
   * @example onValueChange={(files) => setFiles(files)}
   */
  onValueChange?: (files: File[]) => void;

  /**
   * Function to be called when files are uploaded.
   * @type (files: File[]) => Promise<void>
   * @default undefined
   * @example onUpload={(files) => uploadFiles(files)}
   */
  onUpload?: (files: File[]) => Promise<void>;

  /**
   * Progress of the uploaded files.
   * @type Record<string, number> | undefined
   * @default undefined
   * @example progresses={{ "file1.png": 50 }}
   */
  progresses?: Record<string, number>;

  /**
   * Accepted file types for the uploader.
   * @type { [key: string]: string[]}
   * @default
   * ```ts
   * { "image/*": [] }
   * ```
   * @example accept={["image/png", "image/jpeg"]}
   */
  accept?: DropzoneProps["accept"];

  /**
   * Maximum file size for the uploader.
   * @type number | undefined
   * @default 1024 * 1024 * 2 // 2MB
   * @example maxSize={1024 * 1024 * 2} // 2MB
   */
  maxSize?: DropzoneProps["maxSize"];

  /**
   * Maximum number of files for the uploader.
   * @type number | undefined
   * @default 1
   * @example maxFileCount={4}
   */
  maxFileCount?: DropzoneProps["maxFiles"];

  /**
   * Whether the uploader should accept multiple files.
   * @type boolean
   * @default false
   * @example multiple
   */
  multiple?: boolean;

  /**
   * Whether the uploader is disabled.
   * @type boolean
   * @default false
   * @example disabled
   */
  disabled?: boolean;
}

export function FileUploader(props: FileUploaderProps) {
  const {
    value: valueProp,
    onValueChange,
    onUpload,
    accept = {
      "image/*": [],
    },
    maxSize = 1024 * 1024 * 2,
    maxFileCount = 1,
    multiple = false,
    disabled = false,
    className,
    ...dropzoneProps
  } = props;

  const { toast } = useToast();

  const [files, setFiles] = useControllableState({
    prop: valueProp,
    onChange: onValueChange,
  });

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {

      if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
        toast({description:"Cannot upload more than 1 file at a time", style: TOAST_STYLE_CONFIG});
        return;
      }

      if ((files?.length ?? 0) + acceptedFiles.length > maxFileCount) {
        toast({ description: `Cannot upload more than ${maxFileCount} files`, style: TOAST_STYLE_CONFIG});
        return;
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      );

      const updatedFiles = files ? [...files, ...newFiles] : newFiles;

      setFiles(updatedFiles);

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file }) => {
          toast({description:`File ${file.name} was rejected`, style: TOAST_STYLE_CONFIG});
        });
      }

      if (
        onUpload &&
        updatedFiles.length > 0 &&
        updatedFiles.length <= maxFileCount
      ) {
        const target =
          updatedFiles.length > 0 ? `${updatedFiles.length} files` : `file`;

          sonner.promise(onUpload(updatedFiles), {
          loading: `Uploading ${target}...`,
          success: () => {
            setFiles([]);
            return `${target} uploaded`;
          },
          error: `Failed to upload ${target}`,
        });
      }
    },

    [files, maxFileCount, multiple, onUpload, setFiles]
  );

  // function onRemove(index: number) {
  //   if (!files) return;
  //   const newFiles = files.filter((_, i) => i !== index);
  //   setFiles(newFiles);
  //   onValueChange?.(newFiles);
  // }

  // Revoke preview url when component unmounts
  React.useEffect(() => {
    return () => {
      if (!files) return;
      files.forEach((file) => {
        if (isFileWithPreview(file)) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  const isDisabled = disabled || (files?.length ?? 0) >= maxFileCount;

  return (
    <div className="relative flex flex-col gap-6 overflow-hidden size-full">
      <Dropzone
        onDrop={onDrop}
        accept={accept}
        maxSize={maxSize}
        maxFiles={maxFileCount}
        multiple={maxFileCount > 1 || multiple}
        disabled={isDisabled}
      >
        {({ getRootProps, getInputProps, isDragActive }) => (
          <div
            {...getRootProps()}
            className={cn(
              "group relative grid size-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-gray-500 hover:border-gray-700 dark:hover:border-gray-200 px-5 py-2.5 text-center transition hover:bg-gray-200 dark:hover:bg-gray-700 bg-opacity-15",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isDragActive && "border-green-300 bg-green-100",
              isDisabled && "pointer-events-none opacity-60",
              className
            )}
            {...dropzoneProps}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-gray-500 border-dashed p-3">
                  <UploadIcon
                    className="size-7"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-medium">
                  Drop the File Here
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-gray-500 border-dashed p-3">
                  <UploadIcon
                    className="size-7"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-col gap-px">
                  <p className="font-medium">
                    Drag {`'n'`} Drop Files Here, or Click to Select File
                  </p>
                  <p className="text-sm text-gray-500">
                    You Can Upload
                    {maxFileCount > 1
                      ? ` ${
                          maxFileCount === Infinity ? "multiple" : maxFileCount
                        }
                      files (up to ${formatBytes(maxSize)} each)`
                      : ` a File Up to ${formatBytes(maxSize)}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Dropzone>
      {/* {files?.length ? (
        <ScrollArea className="h-fit w-full px-3">
          <div className="flex max-h-48 flex-col gap-4">
            {files?.map((file, index) => (
              <FileCard
                key={index}
                file={file}
                onRemove={() => onRemove(index)}
                progress={progresses?.[file.name]}
              />
            ))}
          </div>
        </ScrollArea>
      ) : null} */}
    </div>
  );
}

// interface FileCardProps {
//   file: File;
//   onRemove: () => void;
//   progress?: number;
// }

// function FileCard({ file, progress, onRemove }: FileCardProps) {
//   return (
//     <div className="relative flex items-center gap-2.5">
//       <div className="flex flex-1 gap-2.5">
//         {isFileWithPreview(file) ? <FilePreview file={file} /> : null}
//         <div className="flex w-full flex-col gap-2">
//           <div className="flex flex-col gap-px">
//             <p className="line-clamp-1 text-sm font-medium text-foreground/80">
//               {file.name}
//             </p>
//             <p className="text-xs text-muted-foreground">
//               {formatBytes(file.size)}
//             </p>
//           </div>
//           {progress ? <Progress value={progress} /> : null}
//         </div>
//       </div>
//       <div className="flex items-center gap-2">
//         <Button
//           type="button"
//           variant="ghost"
//           size="icon"
//           className="size-7"
//           onClick={onRemove}
//         >
//           <X className="h-4 w-4" />
//           <span className="sr-only">Remove file</span>
//         </Button>
//       </div>
//     </div>
//   );
// }

function isFileWithPreview(file: File): file is File & { preview: string } {
  return "preview" in file && typeof file.preview === "string";
}

// interface FilePreviewProps {
//   file: File & { preview: string };
// }

// function FilePreview({ file }: FilePreviewProps) {
//   if (file.type.startsWith("image/")) {
//     return (
//       <img
//         src={file.preview}
//         alt={file.name}
//         width={48}
//         height={48}
//         loading="lazy"
//         className="aspect-square shrink-0 rounded-md object-cover"
//       />
//     );
//   }

//   return (
//     <FileTextIcon
//       className="size-10 text-muted-foreground"
//       aria-hidden="true"
//     />
//   );
// }
