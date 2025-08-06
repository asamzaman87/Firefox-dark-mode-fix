import { useControllableState } from "@/hooks/use-controllable-state";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UploadIcon } from "lucide-react";
import * as React from "react";
import Dropzone, {
  type DropzoneProps,
  type FileRejection,
} from "react-dropzone";
import { toast as sonner } from "sonner";
import FileTypeIconList from "./file-type-icon-list";
import { usePremiumModal } from "../../context/premium-modal";
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
    accept = ACCEPTED_FILE_TYPES,
    maxFileCount = 1,
    multiple = false,
    disabled = false,
    className,
    ...dropzoneProps
  } = props;

  const { toast } = useToast();
  const {isTriggered, setOpen} = usePremiumModal();

  const [files, setFiles] = useControllableState({
    prop: valueProp,
    onChange: onValueChange,
  });

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      
      //* trigger this when premium voice is selected
      if (isTriggered) {
        setOpen(true);
        return;
      }

      if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
        toast({ description: chrome.i18n.getMessage("cannot_upload_one_file"), style: TOAST_STYLE_CONFIG });
        return;
      }

      if ((files?.length ?? 0) + acceptedFiles.length > maxFileCount) {
        toast({ description: chrome.i18n.getMessage('cannot_upload_more_files', [String(maxFileCount)]), style: TOAST_STYLE_CONFIG });
        return;
      }

      // warn if any new file is huge (50 MB+)
      acceptedFiles.forEach((file) => {
        if (file.size > 50 * 1024 * 1024) {
          toast({
            description: "That file is pretty big! The extension might not work properly.",
            style: TOAST_STYLE_CONFIG_INFO,
          });
        }
      });

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      );

      const updatedFiles = files ? [...files, ...newFiles] : newFiles;

      setFiles(updatedFiles);

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file }) => {
          toast({ description: chrome.i18n.getMessage('file_rejected', [file.name]), style: TOAST_STYLE_CONFIG });
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
          loading: chrome.i18n.getMessage('uploading_files', [target]),
          success: () => {
            setFiles([]);
            return chrome.i18n.getMessage('uploaded_files', [target]);
          },
          error: chrome.i18n.getMessage('failed_upload', [target]),
        });
      }
    },

    [files, maxFileCount, multiple, onUpload, setFiles, isTriggered]
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

  const triggerPremium = (open: () => void) => {
    if(isTriggered) {
      setOpen(true);
      return;
    }
    open();
  };

  return (
    <div className="gpt:relative gpt:flex gpt:flex-col gpt:gap-6 gpt:overflow-hidden gpt:size-full">
      <Dropzone
        onDrop={onDrop}
        accept={accept}
        maxFiles={maxFileCount}
        multiple={maxFileCount > 1 || multiple}
        disabled={isDisabled}
      >
        {({ getRootProps, getInputProps, isDragActive, open }) => (
          <div
            {...getRootProps()}
            onClick={() => triggerPremium(open)}
            className={cn(
              "group gpt:relative gpt:grid gpt:size-full gpt:cursor-pointer gpt:place-items-center gpt:rounded-2xl gpt:border-2 gpt:border-dashed gpt:border-gray-500 hover:border-gray-700 dark:hover:border-gray-200 gpt:px-5 gpt:py-2.5 gpt:text-center gpt:transition hover:bg-gray-200 dark:hover:bg-gray-700 gpt:bg-opacity-15",
              "gpt:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isDragActive && "gpt:border-green-300 gpt:bg-green-100",
              isDisabled && "gpt:pointer-events-none gpt:opacity-60",
              className
            )}
            {...dropzoneProps}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:sm:px-5">
                <div className="gpt:rounded-full gpt:border gpt:border-gray-500 gpt:border-dashed gpt:p-3">
                  <UploadIcon
                    className="gpt:size-7"
                    aria-hidden="true"
                  />
                </div>
                <p className="gpt:font-medium">
                  {chrome.i18n.getMessage('drop_file_here')}
                </p>
              </div>
            ) : (
              <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:sm:px-5">
                {/* <div className="gpt:rounded-full gpt:border gpt:border-gray-500 gpt:border-dashed gpt:p-3">
                  <UploadIcon
                    className="gpt:size-7"
                    aria-hidden="true"
                  />
                </div> */}
                <FileTypeIconList fileTypes={Object.keys(accept).filter(type => type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document")} />
                <div className="gpt:flex gpt:flex-col gpt:gap-px">
                  <p className="gpt:font-medium">
                    {chrome.i18n.getMessage('drag_and_drop_files')}
                  </p>
                  <p className="gpt:text-sm gpt:text-gray-500">
                    Avoid uploading files larger than 50MB as it can make the extension crash
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Dropzone>
      {/* {files?.length ? (
        <ScrollArea className="gpt:h-fit gpt:w-full gpt:px-3">
          <div className="gpt:flex gpt:max-h-48 gpt:flex-col gpt:gap-4">
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
//     <div className="gpt:relative gpt:flex gpt:items-center gpt:gap-2.5">
//       <div className="gpt:flex gpt:flex-1 gpt:gap-2.5">
//         {isFileWithPreview(file) ? <FilePreview file={file} /> : null}
//         <div className="gpt:flex gpt:w-full gpt:flex-col gpt:gap-2">
//           <div className="gpt:flex gpt:flex-col gpt:gap-px">
//             <p className="gpt:line-clamp-1 gpt:text-sm gpt:font-medium gpt:text-foreground/80">
//               {file.name}
//             </p>
//             <p className="gpt:text-xs gpt:text-muted-foreground">
//               {formatBytes(file.size)}
//             </p>
//           </div>
//           {progress ? <Progress value={progress} /> : null}
//         </div>
//       </div>
//       <div className="gpt:flex gpt:items-center gpt:gap-2">
//         <Button
//           type="button"
//           variant="ghost"
//           size="icon"
//           className="gpt:size-7"
//           onClick={onRemove}
//         >
//           <X className="gpt:h-4 gpt:w-4" />
//           <span className="gpt:sr-only">Remove file</span>
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
//         className="gpt:aspect-square gpt:shrink-0 gpt:rounded-md gpt:object-cover"
//       />
//     );
//   }

//   return (
//     <FileTextIcon
//       className="gpt:size-10 gpt:text-muted-foreground"
//       aria-hidden="true"
//     />
//   );
// }
