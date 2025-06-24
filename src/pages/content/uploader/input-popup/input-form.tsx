import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    title: z.string().optional(),
    text: z.string().min(5, { message: chrome.i18n.getMessage('input_required_error') })
})

export interface InputFormProps {
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    disabled?: boolean
}

const InputForm: FC<InputFormProps> = ({ onSubmit, disabled }) => {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            text: "",
            title: ""
        },
    })

    const onFormSubmit = (values: z.infer<typeof formSchema>) => {
        if (false) return toast({ description: chrome.i18n.getMessage('please_wait_previous'), style: TOAST_STYLE_CONFIG });
        onSubmit(values);
    }

    return (
        <Form {...form}>
            <form className="w-full space-y-4 [&_label]:text-lg" onSubmit={form.handleSubmit(onFormSubmit)}>
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>{chrome.i18n.getMessage('title')}</FormLabel>
                            <FormControl>
                                <Input className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>{chrome.i18n.getMessage('text')}</FormLabel>
                            <FormControl>
                                <Textarea className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none rounded min-h-[50dvh] focus:border-gray-200 dark:focus:border-gray-700 outline-none" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <DialogFooter>
                    <Button disabled={false} type="submit" variant={"ghost"} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                        <Send /> {chrome.i18n.getMessage('submit')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default InputForm;