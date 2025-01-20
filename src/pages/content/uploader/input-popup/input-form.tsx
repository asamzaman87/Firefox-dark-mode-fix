import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    title: z.string().optional(),
    text: z.string().min(5, { message: "This is a required field (min 5 characters)" })
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
        if(disabled) return toast({description: "Please wait until the previous request is completed", style: TOAST_STYLE_CONFIG});
        onSubmit(values);
    }

    return (
        <Form {...form}>
            <form className="w-full space-y-4 [&_label]:text-lg [&_button]:text-lg" onSubmit={form.handleSubmit(onFormSubmit)}>
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input  className="rounded-lg" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormLabel>Text</FormLabel>
                            <FormControl>
                                <Textarea className="resize-none rounded-lg min-h-[50dvh] border focus:border-gray-900 dark:focus:border-gray-200" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <DialogFooter>
                    <Button disabled={disabled} type="submit" size={"lg"} variant={"outline"} className="rounded-lg dark:bg-gray-200 dark:text-gray-900 bg-gray-900 text-gray-100">Submit</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default InputForm;