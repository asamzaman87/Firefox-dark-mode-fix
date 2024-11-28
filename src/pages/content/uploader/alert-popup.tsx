import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangleIcon } from "lucide-react";
import { FC } from "react";

interface AlertPopupProps {
  setConfirmed: (confirmed: boolean) => void
}
const AlertPopup: FC<AlertPopupProps> = ({ setConfirmed }) => {
  return (
    <div className="flex flex-col justify-center items-center h-full">
      <DialogHeader className={"sr-only"}>
        <DialogTitle className="inline-flex flex-col justify-center items-center gap-2">Are you sure</DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 shadow w-full md:w-1/2 flex flex-col gap-6 justify-center items-center">

        <section className="flex flex-col justify-center items-center gap-4 text-justify">
          <AlertTriangleIcon className="size-12 text-yellow-600" />
          <h1 className="text-xl font-medium">Are you sure you want to continue?</h1>
          <p className="font-medium dark:text-gray-200 text-gray-600 leading-loose">
            GPT Reader splits your text into smaller chunks and individually sends them using the ChatGPT website.
            As such, there is a chance that you may get rate limited by ChatGPT and have to wait around 1 hour before using this extension or ChatGPT again.
            Do you wish to proceed knowing this? 
          </p>
          <p className="font-bold">Please note that you will not be able to use this extension if you click No.</p>
        </section>

        <footer className="flex items-end justify-center gap-4">
          <Button className="w-full text-lg rounded-lg dark:bg-gray-200 dark:text-gray-900 bg-gray-900 text-gray-100" size={"lg"} onClick={() => setConfirmed(true)}>Yes</Button>
          <Button className="rounded-lg text-lg" size={"lg"} variant={"outline"} onClick={() => setConfirmed(false)}>No</Button>
        </footer>
      </div>

    </div>
  )
}

export default AlertPopup;
